import { listTasks, createTask, updateTask, deleteTask } from './api.js';

const els = {
  search: document.getElementById('search'),
  status: document.getElementById('status-filter'),
  sort: document.getElementById('sort-by'),
  title: document.getElementById('title'),
  tags: document.getElementById('tags'),
  due: document.getElementById('due'),
  priority: document.getElementById('priority'),
  notes: document.getElementById('notes'),
  add: document.getElementById('add'),
  list: document.getElementById('list'),
  tpl: document.getElementById('item-template')
};

let state = { items: [], q: '', status: 'all', sort: 'created' };

async function refresh() {
  const items = await listTasks({ q: state.q, status: state.status, sort: state.sort });
  state.items = items;
  render();
}

function render() {
  els.list.innerHTML = '';
  for (const item of state.items) {
    const li = els.tpl.content.firstElementChild.cloneNode(true);
    li.dataset.id = item.id;
    li.querySelector('.title').textContent = item.title;
    if (item.completed) li.classList.add('completed');
    const toggle = li.querySelector('.toggle');
    toggle.checked = !!item.completed;
    const due = li.querySelector('.due');
    due.textContent = item.due_date ? new Date(item.due_date).toLocaleDateString() : '';
    const pr = li.querySelector('.priority');
    pr.textContent = `P${item.priority}`;
    const tags = li.querySelector('.tags');
    (item.tags || []).forEach(t => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = t;
      tags.appendChild(span);
    });

    toggle.addEventListener('change', async () => {
      await updateTask(item.id, { completed: toggle.checked });
      await refresh();
    });
    li.querySelector('.delete').addEventListener('click', async () => {
      await deleteTask(item.id);
      await refresh();
    });
    li.querySelector('.edit').addEventListener('click', async () => {
      const title = prompt('Edit title', item.title);
      if (title && title.trim()) {
        await updateTask(item.id, { title: title.trim() });
        await refresh();
      }
    });

    els.list.appendChild(li);
  }
}

els.add.addEventListener('click', async () => {
  const title = els.title.value.trim();
  if (!title) return;
  const tags = els.tags.value.split(',').map(s => s.trim()).filter(Boolean);
  const due = els.due.value ? new Date(els.due.value).toISOString() : null;
  const priority = parseInt(els.priority.value, 10);
  const notes = els.notes.value.trim() || null;
  await createTask({ title, tags, due_date: due, priority, notes });
  els.title.value = '';
  els.tags.value = '';
  els.due.value = '';
  els.notes.value = '';
  await refresh();
});

for (const [el, key] of [[els.search, 'q'], [els.status, 'status'], [els.sort, 'sort']]) {
  el.addEventListener('input', async () => {
    state[key] = el.value;
    await refresh();
  });
}

refresh().catch(err => {
  console.error(err);
  els.list.innerHTML = `<li class="item">Failed to load tasks. Check API setup.</li>`;
});

