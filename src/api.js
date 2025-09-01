const API_BASE = '/.netlify/functions/tasks';

export async function listTasks({ q = '', status = 'all', sort = 'created' } = {}) {
  const url = new URL(API_BASE, window.location.origin);
  if (q) url.searchParams.set('q', q);
  if (status) url.searchParams.set('status', status);
  if (sort) url.searchParams.set('sort', sort);
  const res = await fetch(url.toString(), { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load tasks');
  return res.json();
}

export async function createTask(data) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export async function updateTask(id, patch) {
  const url = `${API_BASE}/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

export async function deleteTask(id) {
  const url = `${API_BASE}/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
  return { ok: true };
}

