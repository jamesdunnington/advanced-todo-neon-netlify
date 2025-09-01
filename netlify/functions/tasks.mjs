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

// DB init
const connString = process.env.NEON_DATABASE_URL;
const sql = neon(connString);

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return noContent();
  try {
    const idFromPath = (() => {
      const m = event.path.match(/\/tasks\/?([^\/]*)?$/);
      return m && m[1] ? decodeURIComponent(m[1]) : null;
    })();

    if (event.httpMethod === 'GET') {
      if (idFromPath) {
        const rows = await sql`select * from tasks where id=${idFromPath}`;
        if (rows.length === 0) return json(404, { error: 'not found' });
        return json(200, rows[0]);
      }
      const u = new URL(event.rawUrl);
      const q = (u.searchParams.get('q') || '').trim();
      const status = (u.searchParams.get('status') || 'all').toLowerCase();
      const sort = (u.searchParams.get('sort') || 'created').toLowerCase();

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

      const rows = await sql`
        insert into tasks (id, title, completed, priority, due_date, tags, notes)
        values (${id}, ${title}, ${completed}, ${priority}, ${due}, ${tags}, ${notes})
        returning *
      `;
      return json(201, rows[0]);
    }

    if (event.httpMethod === 'PUT') {
      const id = idFromPath;
      if (!id) return badRequest('id required');
      const p = JSON.parse(event.body || '{}');
      const fields = [];
      const params = [];
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
    }

    if (event.httpMethod === 'DELETE') {
      const id = idFromPath;
      if (!id) return badRequest('id required');
      await sql`delete from tasks where id=${id}`;
      return noContent();
    }

    return json(405, { error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return serverError('internal error');
  }
}

