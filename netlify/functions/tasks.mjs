import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

// CORS helper
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body)
  };
}

function noContent() {
  return { statusCode: 204, headers: corsHeaders(), body: '' };
}

function badRequest(message) { return json(400, { error: message }); }
function serverError(message) { return json(500, { error: message }); }

// Storage init (DB or in-memory fallback)
const connString = process.env.NEON_DATABASE_URL;
let sql = null;
let MODE = 'memory';
try {
  if (connString) {
    sql = neon(connString);
    MODE = 'db';
  }
} catch (e) {
  // fall back to memory
  MODE = 'memory';
}

// In-memory store as a non-persistent fallback when no DB URL is configured
const mem = {
  items: [],
  upsert(item) {
    const idx = this.items.findIndex(it => it.id === item.id);
    if (idx >= 0) this.items[idx] = item; else this.items.push(item);
    return item;
  },
  remove(id) {
    const i = this.items.findIndex(it => it.id === id);
    if (i >= 0) this.items.splice(i, 1);
  }
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return noContent();
  try {
    const idFromPath = (() => {
      const m = event.path.match(/\/tasks\/?([^\/]*)?$/);
      return m && m[1] ? decodeURIComponent(m[1]) : null;
    })();

    if (event.httpMethod === 'GET') {
      if (idFromPath) {
        if (MODE === 'db') {
          const rows = await sql`select * from tasks where id=${idFromPath}`;
          if (rows.length === 0) return json(404, { error: 'not found' });
          return json(200, rows[0]);
        } else {
          const item = mem.items.find(t => t.id === idFromPath);
          if (!item) return json(404, { error: 'not found' });
          return json(200, item);
        }
      }
      const u = new URL(event.rawUrl);
      const q = (u.searchParams.get('q') || '').trim();
      const status = (u.searchParams.get('status') || 'all').toLowerCase();
      const sort = (u.searchParams.get('sort') || 'created').toLowerCase();

      if (MODE === 'db') {
        const where = [];
        const params = [];
        if (q) {
          where.push(`(lower(title) like lower('%' || $${params.push(q)} || '%') or lower(coalesce(notes,'')) like lower('%' || $${params.push(q)} || '%'))`);
        }
        if (status === 'active') where.push('completed = false');
        if (status === 'completed') where.push('completed = true');

        const order = sort === 'due' ? 'due_date nulls last, created_at desc'
                    : sort === 'priority' ? 'priority asc, created_at desc'
                    : 'created_at desc';

        const whereSql = where.length ? `where ${where.join(' and ')}` : '';
        const query = `select * from tasks ${whereSql} order by ${order} limit 200`;
        const rows = await sql(query, params);
        return json(200, rows);
      } else {
        let rows = mem.items.slice();
        if (q) rows = rows.filter(r => (r.title||'').toLowerCase().includes(q.toLowerCase()) || (r.notes||'').toLowerCase().includes(q.toLowerCase()));
        if (status === 'active') rows = rows.filter(r => !r.completed);
        if (status === 'completed') rows = rows.filter(r => !!r.completed);
        rows.sort((a,b) => {
          if (sort === 'due') return ((a.due_date||'') > (b.due_date||'')) ? 1 : -1;
          if (sort === 'priority') return (a.priority??3) - (b.priority??3);
          return (new Date(b.created_at) - new Date(a.created_at));
        });
        return json(200, rows.slice(0,200));
      }
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const id = body.id || crypto.randomUUID();
      const title = (body.title || '').trim();
      if (!title) return badRequest('title is required');
      const completed = !!body.completed;
      const priority = Math.min(3, Math.max(1, parseInt(body.priority ?? 1, 10)));
      const due = body.due_date ? new Date(body.due_date) : null;
      const tags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : [];
      const notes = body.notes ?? null;
      if (MODE === 'db') {
        const rows = await sql`
          insert into tasks (id, title, completed, priority, due_date, tags, notes)
          values (${id}, ${title}, ${completed}, ${priority}, ${due}, ${tags}, ${notes})
          returning *
        `;
        return json(201, rows[0]);
      } else {
        const now = new Date().toISOString();
        const item = { id, title, completed, priority, due_date: due? new Date(due).toISOString():null, tags, notes, created_at: now, updated_at: now };
        mem.upsert(item);
        return json(201, item);
      }
    }

    if (event.httpMethod === 'PUT') {
      const id = idFromPath;
      if (!id) return badRequest('id required');
      const p = JSON.parse(event.body || '{}');
      const fields = [];
      const params = [];
      if (MODE === 'db') {
        if (typeof p.title === 'string') fields.push(`title=$${params.push(p.title.trim())}`);
        if (typeof p.completed === 'boolean') fields.push(`completed=$${params.push(!!p.completed)}`);
        if (p.priority != null) fields.push(`priority=$${params.push(Math.min(3, Math.max(1, parseInt(p.priority, 10))) )}`);
        if (Object.prototype.hasOwnProperty.call(p, 'due_date')) fields.push(`due_date=$${params.push(p.due_date ? new Date(p.due_date) : null)}`);
        if (Array.isArray(p.tags)) fields.push(`tags=$${params.push(p.tags.filter(Boolean))}`);
        if (Object.prototype.hasOwnProperty.call(p, 'notes')) fields.push(`notes=$${params.push(p.notes ?? null)}`);
        fields.push(`updated_at=now()`);
        if (!fields.length) return badRequest('no fields to update');

        const query = `update tasks set ${fields.join(', ')} where id=$${params.push(id)} returning *`;
        const rows = await sql(query, params);
        if (rows.length === 0) return json(404, { error: 'not found' });
        return json(200, rows[0]);
      } else {
        const item = mem.items.find(t => t.id === id);
        if (!item) return json(404, { error: 'not found' });
        if (typeof p.title === 'string') item.title = p.title.trim();
        if (typeof p.completed === 'boolean') item.completed = !!p.completed;
        if (p.priority != null) item.priority = Math.min(3, Math.max(1, parseInt(p.priority,10)));
        if (Object.prototype.hasOwnProperty.call(p, 'due_date')) item.due_date = p.due_date ? new Date(p.due_date).toISOString() : null;
        if (Array.isArray(p.tags)) item.tags = p.tags.filter(Boolean);
        if (Object.prototype.hasOwnProperty.call(p, 'notes')) item.notes = p.notes ?? null;
        item.updated_at = new Date().toISOString();
        return json(200, item);
      }
    }

    if (event.httpMethod === 'DELETE') {
      const id = idFromPath;
      if (!id) return badRequest('id required');
      if (MODE === 'db') {
        await sql`delete from tasks where id=${id}`;
        return noContent();
      } else {
        mem.remove(id);
        return noContent();
      }
    }

    return json(405, { error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return serverError('internal error');
  }
}
