function onDataReady() {
  renderPopupQuadrants()
}

function renderPopupQuadrants() {
  const data = getData()

  for (const key of ['main', 'side', 'fun']) {
    const items = collectActive(data.quadrants[key].items)
    const container = document.getElementById('pq-items-' + key)
    if (!items.length) {
      container.innerHTML = '<p class="empty">暂无进行中任务</p>'
    } else {
      container.innerHTML = items.map(renderPopupItem).join('')
    }
  }

  const dlItems = collectDeadlineItems(data)
  const dlContainer = document.getElementById('pq-items-deadline')
  if (!dlItems.length) {
    dlContainer.innerHTML = '<p class="empty">暂无 Deadline 任务</p>'
  } else {
    dlContainer.innerHTML = dlItems.map(item => `
      <div class="popup-dl-item ${urgencyClass(item.deadline)}">
        <span class="popup-dl-title">${esc(item.title)}</span>
        <span class="dl-label">${relativeLabel(item.deadline)}</span>
        <span class="dl-date">[${item.deadline.slice(5)}]</span>
      </div>
    `).join('')
  }
}

function collectActive(items) {
  const result = []
  for (const item of items) {
    if (item.status === 'active') result.push(item)
    if (item.children && item.children.length) result.push(...collectActive(item.children))
  }
  return result
}

function renderPopupItem(item) {
  const statuses = ['todo', 'active', 'paused', 'done']
  const labels   = { todo: 'TODO', active: 'ACTIVE', paused: 'PAUSE', done: 'DONE' }
  const opts = statuses.map(s =>
    `<option value="${s}"${s === item.status ? ' selected' : ''}>${labels[s]}</option>`
  ).join('')
  return `
    <div class="popup-item" data-id="${esc(item.id)}">
      <div class="popup-item-header">
        <span class="item-title">${esc(item.title)}</span>
        <select class="status-select" onchange="onStatusChange('${esc(item.id)}', this.value)">${opts}</select>
      </div>
      <textarea class="log-input" rows="2"
        placeholder="今天做了什么？（留空则不记录）"
        data-id="${esc(item.id)}"></textarea>
    </div>`
}

function onStatusChange(id, newStatus) {
  const data = getData()
  updateItemById(data, id, item => setStatus(item, newStatus))
  setData(data)
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
  window.chrome.webview.postMessage(JSON.stringify({ action: 'lock', dataJson: JSON.stringify(data, null, 2) }))
}

function skipAndLock() {
  window.chrome.webview.postMessage(JSON.stringify({ action: 'skip' }))
}

function closePopup() {
  window.chrome.webview.postMessage(JSON.stringify({ action: 'close' }))
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
