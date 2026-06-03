function onDataReady() {
  renderPopupQuadrants()
}

function renderPopupQuadrants() {
  const data = getData()

  for (const key of ['main', 'side', 'fun']) {
    const container = document.getElementById('pq-items-' + key)
    const html = renderTaskCards(data.quadrants[key].items)
    container.innerHTML = html || '<p class="empty">暂无进行中任务</p>'
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

// ── Card renderer (one card per top-level task) ───────────────────────────────

function hasActive(item) {
  if (item.status === 'active') return true
  return (item.children || []).some(hasActive)
}

function statusOpts(current) {
  const statuses = ['todo', 'active', 'paused', 'done']
  const labels   = { todo: 'TODO', active: 'ACTIVE', paused: 'PAUSE', done: 'DONE' }
  return statuses.map(s =>
    `<option value="${s}"${s === current ? ' selected' : ''}>${labels[s]}</option>`
  ).join('')
}

// Render one card per top-level task that has active tasks (self or descendants).
function renderTaskCards(topLevelItems) {
  return topLevelItems.filter(hasActive).map(renderTaskCard).join('')
}

function renderTaskCard(topItem) {
  // If the top-level item itself is active, include it as the first row
  const selfRow = topItem.status === 'active' ? renderActiveRow(topItem, 0, true) : ''

  // Render active descendants as a tree
  const childRows = (topItem.children || [])
    .filter(hasActive)
    .map(child => renderTreeRow(child, 0))
    .join('')

  return `
    <div class="popup-card">
      <div class="popup-card-header">
        <span class="popup-card-title">${esc(topItem.title)}</span>
      </div>
      <div class="popup-card-body">
        ${selfRow}${childRows}
      </div>
    </div>`
}

// Recursively render active subtree within a card.
// Non-active ancestors are shown as section labels (with indentation).
// Active items get status selector + log textarea.
function renderTreeRow(item, depth) {
  const childRows = (item.children || [])
    .filter(hasActive)
    .map(child => renderTreeRow(child, depth + 1))
    .join('')

  if (item.status === 'active') {
    return renderActiveRow(item, depth, false) + childRows
  } else {
    // Non-active parent that has active children — show as section label
    const indent = depth * 20
    return `<div class="popup-subtree-label" style="margin-left:${indent}px">${esc(item.title)}</div>` + childRows
  }
}

// Render one active task row (status selector + log textarea).
// isSelfRow: true when this is the top-level task itself being active
function renderActiveRow(item, depth, isSelfRow) {
  const cls = depth > 0 ? 'popup-row popup-row-child' : 'popup-row'
  const indent = isSelfRow ? 0 : depth * 20
  // Top-level item active: just a bare log textarea, no redundant header
  if (isSelfRow) {
    return `
      <div class="${cls}" data-id="${esc(item.id)}">
        <textarea class="log-input" rows="1"
          placeholder="今天做了什么？（留空则不记录）"
          data-id="${esc(item.id)}"></textarea>
      </div>`
  }
  return `
    <div class="${cls}" data-id="${esc(item.id)}" style="margin-left:${indent}px">
      <div class="popup-row-header">
        <span class="popup-row-title">${esc(item.title)}</span>
        <select class="status-select" onchange="onStatusChange('${esc(item.id)}', this.value)">
          ${statusOpts(item.status)}
        </select>
      </div>
      <textarea class="log-input" rows="1"
        placeholder="今天做了什么？（留空则不记录）"
        data-id="${esc(item.id)}"></textarea>
    </div>`
}

// ── Status / log helpers ──────────────────────────────────────────────────────

function onStatusChange(id, newStatus) {
  const data = getData()
  updateItemById(data, id, item => setStatus(item, newStatus))
  setData(data)
  if (newStatus !== 'active') {
    const row = document.querySelector(`.popup-row[data-id="${id}"]`)
    if (row) row.style.opacity = '0.5'
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
