// Called by data.js when AHK sends 'load' message
function onDataReady() {
  renderActiveItems()
}

function renderActiveItems() {
  const data   = getData()
  const groups = []

  for (const key of ['main', 'side', 'fun']) {
    const q      = data.quadrants[key]
    const active = collectActive(q.items)
    if (active.length) groups.push({ name: q.name, items: active })
  }

  const el = document.getElementById('active-items')
  if (!groups.length) {
    el.innerHTML = '<p class="empty">没有进行中的任务</p>'
    return
  }
  el.innerHTML = groups.map(g => `
    <div class="popup-group">
      <h3>${esc(g.name)}</h3>
      ${g.items.map(renderActiveItem).join('')}
    </div>
  `).join('')
}

function collectActive(items) {
  const result = []
  for (const item of items) {
    if (item.status === 'active') result.push(item)
    if (item.children && item.children.length) result.push(...collectActive(item.children))
  }
  return result
}

function renderActiveItem(item) {
  const statuses = ['todo', 'active', 'paused', 'done']
  const labels   = { todo: '待办', active: '进行中', paused: '暂停', done: '完成' }
  const opts = statuses.map(s =>
    `<option value="${s}"${s === item.status ? ' selected' : ''}>${labels[s]}</option>`
  ).join('')
  return `
    <div class="popup-item" data-id="${item.id}">
      <div class="popup-item-header">
        <span class="item-title">${esc(item.title)}</span>
        <select class="status-select" onchange="onStatusChange('${item.id}', this.value)">${opts}</select>
      </div>
      <textarea class="log-input" rows="2"
        placeholder="今天做了什么？（留空则不记录）"
        data-id="${item.id}"></textarea>
    </div>`
}

function onStatusChange(id, newStatus) {
  const data = getData()
  updateItemById(data, id, item => setStatus(item, newStatus))
  setData(data)
  // If item is no longer active, hide its popup-item card
  if (newStatus !== 'active') {
    const card = document.querySelector(`.popup-item[data-id="${id}"]`)
    if (card) card.style.opacity = '0.5'
  }
}

function updateItemById(data, id, fn) {
  for (const key of ['main', 'side', 'fun']) {
    if (updateInItems(data.quadrants[key].items, id, fn)) return
  }
}

function updateInItems(items, id, fn) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) { items[i] = fn(items[i]); return true }
    if (items[i].children && updateInItems(items[i].children, id, fn)) return true
  }
  return false
}

function collectLogs() {
  const data = getData()
  document.querySelectorAll('.log-input').forEach(ta => {
    const text = ta.value.trim()
    if (text) updateItemById(data, ta.dataset.id, item => addLog(item, text))
  })
  setData(data)
  return getData()
}

function saveAndLock() {
  const data = collectLogs()
  window.chrome.webview.postMessage(JSON.stringify({ action: 'lock', data }))
}

function skipAndLock() {
  window.chrome.webview.postMessage(JSON.stringify({ action: 'skip' }))
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
