// Called by data.js when AHK sends 'load' message
function onDataReady() {
  renderAll()
}

function renderAll() {
  const data = getData()
  const q    = data.quadrants
  renderQuadrant('main',     q.main.items)
  renderQuadrant('side',     q.side.items)
  renderQuadrant('fun',      q.fun.items)
  renderDeadlineQuadrant(collectDeadlineItems(data))
}

function renderQuadrant(key, items) {
  document.getElementById('items-' + key).innerHTML =
    items.map(item => renderItem(item, 0)).join('')
}

function renderDeadlineQuadrant(items) {
  const el = document.getElementById('items-deadline')
  if (!items.length) {
    el.innerHTML = '<p class="empty">暂无 Deadline 任务</p>'
    return
  }
  el.innerHTML = items.map(item => {
    const label = relativeLabel(item.deadline)
    const cls   = urgencyClass(item.deadline)
    return `<div class="deadline-item ${cls}">
      <span class="dl-icon">⚠</span>
      <span class="dl-title">${esc(item.title)}</span>
      <span class="dl-label">${label}</span>
      <span class="dl-date">[${item.deadline.slice(5)}]</span>
    </div>`
  }).join('')
}

function renderItem(item, depth) {
  const icons    = { todo: '○', active: '●', paused: '⏸', done: '✓' }
  const icon     = icons[item.status] || '○'
  const indent   = depth * 16
  const hasKids  = item.children && item.children.length > 0
  const kids     = hasKids ? item.children.map(c => renderItem(c, depth + 1)).join('') : ''
  const dlLabel  = item.deadline
    ? `<span class="item-deadline ${urgencyClass(item.deadline)}">[${relativeLabel(item.deadline)}]</span>` : ''
  return `
    <div class="item status-${item.status}" style="padding-left:${indent}px" data-id="${item.id}">
      <span class="item-toggle">${hasKids ? '▶' : ''}</span>
      <span class="item-icon">${icon}</span>
      <span class="item-title">${esc(item.title)}</span>
      ${dlLabel}
    </div>
    ${kids}`
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Expand/collapse children on ▶ click
document.getElementById('app').addEventListener('click', e => {
  const itemEl = e.target.closest('.item')
  if (!itemEl) return
  const myIndent = parseInt(itemEl.style.paddingLeft || '0')
  let next = itemEl.nextElementSibling
  while (next && next.classList.contains('item')) {
    const nextIndent = parseInt(next.style.paddingLeft || '0')
    if (nextIndent <= myIndent) break
    next.style.display = next.style.display === 'none' ? '' : 'none'
    next = next.nextElementSibling
  }
})
