// Collapse state persists across re-renders
const collapsedIds = new Set()

let archivePanelOpen  = false
let _floatClose       = null

// Drag-and-drop state
const DND_QUADRANTS   = ['main', 'side', 'fun']   // deadline excluded
let _dragId           = null
let _dragQuadrant     = null
let _dragDepth        = 0
let _dragParentId     = null
let _dropIndex        = -1
let _dropIndicator    = null
let _dndInitialized   = false

function onDataReady() {
  renderAll()
  renderArchiveBtn()
  setupResizable()
  if (!_dndInitialized) { setupDragDrop(); _dndInitialized = true }
}

function saveData() {
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage(JSON.stringify({
      action: 'saveData',
      dataJson: JSON.stringify(getData(), null, 2)
    }))
  }
}

function renderAll() {
  const data = getData()
  const q    = data.quadrants
  renderQuadrant('main', q.main.items)
  renderQuadrant('side', q.side.items)
  renderQuadrant('fun',  q.fun.items)
  renderDeadlineQuadrant(collectDeadlineItems(data), q.deadline.standalone)
}

// ── Quadrant rendering ────────────────────────────────────────────────────────

function renderQuadrant(key, items) {
  const container = document.getElementById('items-' + key)
  container.innerHTML = ''
  items.forEach(item => appendItemTree(container, item, 0, key))
  container.appendChild(makeAddBtn('+ 添加项目', () => addTopLevelItem(key)))
}

function appendItemTree(container, item, depth, quadrant) {
  if (depth === 0 && container.children.length > 0) {
    const sep = document.createElement('div')
    sep.className = 'item-separator'
    container.appendChild(sep)
  }
  container.appendChild(buildItemEl(item, depth, quadrant, null))
  if (item.children && item.children.length) {
    const parentCollapsed = collapsedIds.has(item.id)
    item.children.forEach(child => {
      const childEl = buildItemEl(child, depth + 1, quadrant, item.id)
      if (parentCollapsed) childEl.style.display = 'none'
      container.appendChild(childEl)
      if (child.children && child.children.length) {
        const childCollapsed = collapsedIds.has(child.id)
        child.children.forEach(gc => {
          const gcEl = buildItemEl(gc, depth + 2, quadrant, child.id)
          if (parentCollapsed || childCollapsed) gcEl.style.display = 'none'
          container.appendChild(gcEl)
        })
      }
    })
  }
}

function buildItemEl(item, depth, quadrant, parentId) {
  const el = document.createElement('div')
  el.className = 'item status-' + item.status
  el.style.paddingLeft = (depth * 16) + 'px'
  el.dataset.id       = item.id
  el.dataset.quadrant = quadrant
  el.dataset.depth    = depth
  el.dataset.parentId = parentId || ''
  const hasKids = item.children && item.children.length > 0
  const isCollapsed = collapsedIds.has(item.id)
  if (isCollapsed) el.dataset.collapsed = '1'

  // ── Main row ──────────────────────────────────────────────────────────────
  const row = document.createElement('div')
  row.className = 'item-main-row'

  // Drag handle (all depths in draggable quadrants)
  if (DND_QUADRANTS.includes(quadrant)) {
    const handle = document.createElement('span')
    handle.className   = 'drag-handle'
    handle.textContent = '⠿'
    handle.title       = depth === 0 ? '拖拽移动（可跨象限）' : '拖拽调整顺序'
    handle.addEventListener('mousedown', () => el.setAttribute('draggable', 'true'))
    el.addEventListener('dragstart', e => {
      _dragId       = item.id
      _dragQuadrant = quadrant
      _dragDepth    = depth
      _dragParentId = parentId || null
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', item.id)
      setTimeout(() => el.classList.add('drag-source'), 0)
    })
    el.addEventListener('dragend', () => {
      el.removeAttribute('draggable')
      el.classList.remove('drag-source')
      hideDropIndicator()
      _dragId = null; _dragQuadrant = null; _dragDepth = 0; _dragParentId = null; _dropIndex = -1
    })
    row.appendChild(handle)
  }

  // Toggle arrow
  const toggle = document.createElement('span')
  toggle.className   = 'item-toggle'
  toggle.textContent = hasKids ? (isCollapsed ? '▶' : '▼') : ''
  if (hasKids) {
    toggle.style.cursor = 'pointer'
    toggle.addEventListener('click', e => { e.stopPropagation(); toggleCollapse(item.id, el) })
  }
  row.appendChild(toggle)

  // Status badge (click to cycle)
  const statusLabels = { todo: 'TODO', active: 'ACTIVE', paused: 'PAUSE', done: 'DONE' }
  const badge = document.createElement('span')
  badge.className   = 'item-status-badge status-badge-' + item.status
  badge.textContent = statusLabels[item.status] || item.status
  badge.title       = '点击切换状态'
  badge.addEventListener('click', e => { e.stopPropagation(); cycleStatus(item.id, quadrant) })
  row.appendChild(badge)

  // Title (click to edit inline)
  const titleEl = document.createElement('span')
  titleEl.className   = 'item-title'
  titleEl.textContent = item.title
  titleEl.addEventListener('click', e => { e.stopPropagation(); startEditTitle(titleEl, item.id, quadrant) })
  row.appendChild(titleEl)

  // Deadline badge
  if (item.deadline) {
    const dl = document.createElement('span')
    dl.className   = 'item-deadline ' + urgencyClass(item.deadline)
    dl.textContent = '[' + relativeLabel(item.deadline) + ']'
    dl.title       = item.deadline
    row.appendChild(dl)
  }

  // Hover controls
  const controls = document.createElement('div')
  controls.className = 'item-controls'
  if (depth < 2) {
    controls.appendChild(makeCtrlBtn('+ 子项', () => addChildItem(item.id, quadrant)))
  }
  const dlText = item.deadline ? '清除日期' : '+ 日期'
  controls.appendChild(makeCtrlBtn(dlText, btn => editDeadline(item.id, quadrant, item.deadline, btn)))
  if (item.logs && item.logs.length) {
    const logBtn = makeCtrlBtn('日志 ' + item.logs.length, btn => showLogsDialog(btn, item.logs, item.title))
    logBtn.classList.add('ctrl-btn-log')
    controls.appendChild(logBtn)
  }
  const delBtn = makeCtrlBtn('×', () => deleteItem(item.id, quadrant))
  delBtn.classList.add('ctrl-btn-del')
  controls.appendChild(delBtn)
  row.appendChild(controls)

  el.appendChild(row)

  // ── Description row ───────────────────────────────────────────────────────
  const descEl = document.createElement('div')
  const hasDesc = !!(item.description && item.description.trim())
  descEl.className   = 'item-desc' + (hasDesc ? '' : ' item-desc-empty')
  descEl.textContent = hasDesc ? item.description : ''
  descEl.addEventListener('click', e => { e.stopPropagation(); startEditDesc(descEl, item.id, quadrant) })
  el.appendChild(descEl)

  return el
}

function makeCtrlBtn(text, onClick) {
  const btn = document.createElement('button')
  btn.className   = 'ctrl-btn'
  btn.textContent = text
  btn.addEventListener('click', e => { e.stopPropagation(); onClick(btn) })
  return btn
}

function makeAddBtn(text, onClick) {
  const btn = document.createElement('button')
  btn.className   = 'add-item-btn'
  btn.textContent = text
  btn.addEventListener('click', e => { e.stopPropagation(); onClick(btn) })
  return btn
}

// ── Floating dialog ───────────────────────────────────────────────────────────

function showFloatDialog(anchorEl, buildContent) {
  closeFloatDialog()
  const dialog = document.getElementById('float-dialog')
  buildContent(dialog)

  // Measure off-screen, then position
  dialog.style.left = '-9999px'
  dialog.style.top  = '-9999px'
  dialog.classList.remove('hidden')
  const dw = dialog.offsetWidth
  const dh = dialog.offsetHeight
  const rect = anchorEl.getBoundingClientRect()

  let left = rect.left
  let top  = rect.bottom + 6
  if (left + dw > window.innerWidth - 8)  left = window.innerWidth - dw - 8
  if (top  + dh > window.innerHeight - 8) top  = rect.top - dh - 6

  dialog.style.left = Math.max(8, left) + 'px'
  dialog.style.top  = Math.max(8, top)  + 'px'

  setTimeout(() => {
    _floatClose = e => { if (!dialog.contains(e.target)) closeFloatDialog() }
    document.addEventListener('mousedown', _floatClose)
  }, 0)
}

function closeFloatDialog() {
  const dialog = document.getElementById('float-dialog')
  if (dialog) { dialog.classList.add('hidden'); dialog.innerHTML = '' }
  if (_floatClose) { document.removeEventListener('mousedown', _floatClose); _floatClose = null }
}

function showLogsDialog(anchorBtn, logs, title) {
  showFloatDialog(anchorBtn, dialog => {
    dialog.style.minWidth = '400px'
    const rows = logs.slice().reverse().map(l =>
      `<div class="log-entry"><span class="log-time">${esc(l.time)}</span><span class="log-text">${esc(l.text)}</span></div>`
    ).join('')
    dialog.innerHTML = `
      <div class="float-log-title">${esc(title)} 的进展记录</div>
      <div class="float-log-list">${rows || '<p class="empty" style="margin:0;padding:8px 0">暂无记录</p>'}</div>
      <div class="float-actions"><button class="float-btn-ok" onclick="closeFloatDialog()">关闭</button></div>`
  })
}

// ── Collapse ──────────────────────────────────────────────────────────────────

function toggleCollapse(id, itemEl) {
  const wasCollapsed = collapsedIds.has(id)
  wasCollapsed ? collapsedIds.delete(id) : collapsedIds.add(id)
  const nowCollapsed = !wasCollapsed
  itemEl.dataset.collapsed = nowCollapsed ? '1' : ''
  const toggleEl = itemEl.querySelector('.item-toggle')
  if (toggleEl) toggleEl.textContent = nowCollapsed ? '▶' : '▼'

  const myIndent = parseInt(itemEl.style.paddingLeft || '0')
  let next = itemEl.nextElementSibling
  while (next && next.classList.contains('item')) {
    const nextIndent = parseInt(next.style.paddingLeft || '0')
    if (nextIndent <= myIndent) break
    if (nextIndent === myIndent + 16) {
      next.style.display = nowCollapsed ? 'none' : ''
    } else if (nowCollapsed) {
      next.style.display = 'none'
    }
    next = next.nextElementSibling
  }
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function findItemById(items, id) {
  for (const item of items) {
    if (item.id === id) return item
    if (item.children) {
      const found = findItemById(item.children, id)
      if (found) return found
    }
  }
  return null
}

function removeItemById(items, id) {
  const idx = items.findIndex(i => i.id === id)
  if (idx !== -1) { items.splice(idx, 1); return true }
  return items.some(i => i.children && removeItemById(i.children, id))
}

// ── Edit actions ──────────────────────────────────────────────────────────────

function cycleStatus(id, quadrant) {
  const order = ['todo', 'active', 'paused', 'done']
  const data = getData()
  const item = findItemById(data.quadrants[quadrant].items, id)
  if (!item) return
  const newStatus = order[(order.indexOf(item.status) + 1) % order.length]
  item.status = newStatus
  setData(data)
  saveData()
  renderAll()
  if (newStatus === 'done') {
    setTimeout(() => archiveDoneItem(id, quadrant), 1800)
  }
}

function archiveDoneItem(id, quadrant) {
  const data = getData()
  const item = findItemById(data.quadrants[quadrant].items, id)
  if (!item || item.status !== 'done') return
  const quadrantNames = { main: '主线工作', side: '支线项目', fun: '有意思的项目' }
  const now = new Date()
  const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ` +
             `${pad(now.getHours())}:${pad(now.getMinutes())}`
  data.archive.unshift({
    id:           item.id,
    title:        item.title,
    description:  item.description || '',
    quadrant,
    quadrantName: quadrantNames[quadrant] || quadrant,
    archivedAt:   ts,
    deadline:     item.deadline  || null,
    logs:         item.logs      || [],
    children:     item.children  || []
  })
  removeItemById(data.quadrants[quadrant].items, id)
  setData(data)
  saveData()
  renderAll()
  renderArchiveBtn()
  if (archivePanelOpen) renderArchiveList()
}

function startEditTitle(titleEl, id, quadrant) {
  const old = titleEl.textContent
  titleEl.contentEditable = 'true'
  titleEl.classList.add('editing')
  titleEl.focus()
  const range = document.createRange()
  range.selectNodeContents(titleEl)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)

  let saved = false
  function finish() {
    if (saved) return
    saved = true
    titleEl.contentEditable = 'false'
    titleEl.classList.remove('editing')
    const newText = titleEl.textContent.trim()
    if (!newText) { titleEl.textContent = old; return }
    if (newText === old) return
    const data = getData()
    const item = findItemById(data.quadrants[quadrant].items, id)
    if (item) { item.title = newText; setData(data); saveData() }
  }

  titleEl.addEventListener('blur', finish, { once: true })
  titleEl.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); titleEl.blur() }
    if (e.key === 'Escape') {
      saved = true
      titleEl.contentEditable = 'false'
      titleEl.classList.remove('editing')
      titleEl.textContent = old
    }
  })
}

function startEditDesc(descEl, id, quadrant) {
  const wasEmpty = descEl.classList.contains('item-desc-empty')
  const old = wasEmpty ? '' : descEl.textContent
  descEl.classList.remove('item-desc-empty')
  descEl.classList.add('editing')
  descEl.textContent = old
  descEl.contentEditable = 'true'
  descEl.focus()

  // Place cursor at end
  const range = document.createRange()
  range.selectNodeContents(descEl)
  range.collapse(false)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)

  let saved = false
  function finish() {
    if (saved) return
    saved = true
    descEl.contentEditable = 'false'
    descEl.classList.remove('editing')
    const newText = descEl.textContent.trim()
    const data = getData()
    const item = findItemById(data.quadrants[quadrant].items, id)
    if (item) { item.description = newText; setData(data); saveData() }
    if (!newText) {
      descEl.textContent = ''
      descEl.classList.add('item-desc-empty')
    }
  }

  descEl.addEventListener('blur', finish, { once: true })
  descEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); descEl.blur() }
    if (e.key === 'Escape') {
      saved = true
      descEl.contentEditable = 'false'
      descEl.classList.remove('editing')
      descEl.textContent = old
      if (!old) descEl.classList.add('item-desc-empty')
    }
  })
}

function addTopLevelItem(quadrant) {
  const data = getData()
  const item = makeItem('新项目')
  data.quadrants[quadrant].items.push(item)
  setData(data)
  saveData()
  renderAll()
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-id="' + item.id + '"] .item-title')
    if (el) startEditTitle(el, item.id, quadrant)
  })
}

function addChildItem(parentId, quadrant) {
  const data   = getData()
  const parent = findItemById(data.quadrants[quadrant].items, parentId)
  if (!parent) return
  const item = makeItem('新子项')
  parent.children.push(item)
  collapsedIds.delete(parentId)
  setData(data)
  saveData()
  renderAll()
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-id="' + item.id + '"] .item-title')
    if (el) startEditTitle(el, item.id, quadrant)
  })
}

function deleteItem(id, quadrant) {
  const data = getData()
  removeItemById(data.quadrants[quadrant].items, id)
  setData(data)
  saveData()
  renderAll()
}

function editDeadline(id, quadrant, current, anchorBtn) {
  if (current) {
    const data = getData()
    const item = findItemById(data.quadrants[quadrant].items, id)
    if (item) { item.deadline = null; setData(data); saveData(); renderAll() }
    return
  }
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().slice(0, 10)
  showFloatDialog(anchorBtn, dialog => {
    dialog.innerHTML = `
      <label class="float-label">截止日期</label>
      <input type="date" id="float-date" class="float-input" value="${defaultDate}">
      <div class="float-actions">
        <button class="float-btn-cancel" onclick="closeFloatDialog()">取消</button>
        <button class="float-btn-ok" onclick="confirmDeadline('${id}','${quadrant}')">确定</button>
      </div>`
    setTimeout(() => { const i = document.getElementById('float-date'); if (i) i.focus() }, 0)
  })
}

function confirmDeadline(id, quadrant) {
  const input = document.getElementById('float-date')
  if (!input || !input.value) { closeFloatDialog(); return }
  const data = getData()
  const item = findItemById(data.quadrants[quadrant].items, id)
  if (item) { item.deadline = input.value; setData(data); saveData(); renderAll() }
  closeFloatDialog()
}

// ── Deadline quadrant ──────────────────────────────────────────────────────────

function renderDeadlineQuadrant(deadlineItems, standalone) {
  const el = document.getElementById('items-deadline')
  el.innerHTML = ''

  if (!deadlineItems.length && !standalone.length) {
    const p = document.createElement('p')
    p.className   = 'empty'
    p.textContent = '暂无 Deadline 任务'
    el.appendChild(p)
  } else {
    deadlineItems.forEach(item => {
      const div = document.createElement('div')
      div.className = 'deadline-item ' + urgencyClass(item.deadline)
      div.innerHTML = '<span class="dl-icon">⚠</span>' +
        '<span class="dl-title">' + esc(item.title) + '</span>' +
        '<span class="dl-label">' + relativeLabel(item.deadline) + '</span>' +
        '<span class="dl-date">[' + item.deadline.slice(5) + ']</span>'
      el.appendChild(div)
    })

    standalone.forEach((item, idx) => {
      const div = document.createElement('div')
      div.className = 'deadline-item standalone ' + (item.deadline ? urgencyClass(item.deadline) : '')
      div.innerHTML = '<span class="dl-icon">•</span>' +
        '<span class="dl-title">' + esc(item.title) + '</span>' +
        (item.deadline ? '<span class="dl-label">' + relativeLabel(item.deadline) + '</span>' +
          '<span class="dl-date">[' + item.deadline.slice(5) + ']</span>' : '')
      const delBtn = makeCtrlBtn('×', () => deleteStandalone(idx))
      delBtn.classList.add('ctrl-btn-del')
      div.appendChild(delBtn)
      el.appendChild(div)
    })
  }

  el.appendChild(makeAddBtn('+ 添加独立事项', btn => addStandaloneItem(btn)))
}

function addStandaloneItem(anchorBtn) {
  showFloatDialog(anchorBtn, dialog => {
    dialog.innerHTML = `
      <label class="float-label">事项名称</label>
      <input type="text" id="float-standalone-title" class="float-input" placeholder="输入名称...">
      <label class="float-label" style="margin-top:10px">截止日期（可留空）</label>
      <input type="date" id="float-standalone-date" class="float-input">
      <div class="float-actions">
        <button class="float-btn-cancel" onclick="closeFloatDialog()">取消</button>
        <button class="float-btn-ok" onclick="confirmStandalone()">添加</button>
      </div>`
    setTimeout(() => {
      const t = document.getElementById('float-standalone-title')
      if (t) {
        t.focus()
        t.addEventListener('keydown', e => { if (e.key === 'Enter') confirmStandalone() })
      }
    }, 0)
  })
}

function confirmStandalone() {
  const titleInput = document.getElementById('float-standalone-title')
  const dateInput  = document.getElementById('float-standalone-date')
  const title = titleInput ? titleInput.value.trim() : ''
  if (!title) return
  const data = getData()
  const item = makeItem(title)
  if (dateInput && dateInput.value) item.deadline = dateInput.value
  data.quadrants.deadline.standalone.push(item)
  setData(data)
  saveData()
  closeFloatDialog()
  renderDeadlineQuadrant(collectDeadlineItems(data), data.quadrants.deadline.standalone)
}

function deleteStandalone(idx) {
  const data = getData()
  data.quadrants.deadline.standalone.splice(idx, 1)
  setData(data)
  saveData()
  renderDeadlineQuadrant(collectDeadlineItems(data), data.quadrants.deadline.standalone)
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Archive ───────────────────────────────────────────────────────────────────

function renderArchiveBtn() {
  const count = (getData().archive || []).length
  const el = document.getElementById('archive-count')
  if (el) el.textContent = count
}

function toggleArchive() {
  archivePanelOpen = !archivePanelOpen
  const panel = document.getElementById('archive-panel')
  if (panel) panel.classList.toggle('hidden', !archivePanelOpen)
  if (archivePanelOpen) renderArchiveList()
}

function renderArchiveList() {
  const archive = getData().archive || []
  const list = document.getElementById('archive-list')
  if (!list) return
  if (!archive.length) {
    list.innerHTML = '<p class="empty">暂无归档记录</p>'
    return
  }
  list.innerHTML = archive.map((entry, idx) => {
    const logs = entry.logs || []
    const logsHtml = logs.length
      ? `<div class="archive-logs" id="archive-logs-${idx}" style="display:none">` +
        logs.slice().reverse().map(l =>
          `<div class="log-entry"><span class="log-time">${esc(l.time)}</span><span class="log-text">${esc(l.text)}</span></div>`
        ).join('') + `</div>`
      : ''
    return `
    <div class="archive-entry">
      <div class="archive-entry-title">${esc(entry.title)}</div>
      ${entry.description ? `<div class="archive-entry-desc">${esc(entry.description)}</div>` : ''}
      <div class="archive-entry-meta">
        <span class="archive-q-badge archive-q-${esc(entry.quadrant)}">${esc(entry.quadrantName)}</span>
        <span>${esc(entry.archivedAt)}</span>
        ${entry.deadline ? '<span class="archive-deadline">截止 ' + esc(entry.deadline) + '</span>' : ''}
        ${logs.length ? `<button class="archive-log-btn" onclick="toggleArchiveLogs(${idx})">日志 ${logs.length}</button>` : ''}
        <button class="archive-restore-btn" onclick="toggleRestoreSelector(${idx})">复原</button>
      </div>
      ${logsHtml}
      <div class="restore-selector hidden" id="restore-sel-${idx}">
        <span class="restore-label">复原到：</span>
        <button onclick="restoreArchiveItem(${idx},'main')">主线工作</button>
        <button onclick="restoreArchiveItem(${idx},'side')">支线项目</button>
        <button onclick="restoreArchiveItem(${idx},'fun')">有意思的项目</button>
      </div>
    </div>`
  }).join('')
}

function toggleRestoreSelector(idx) {
  const sel = document.getElementById('restore-sel-' + idx)
  if (sel) sel.classList.toggle('hidden')
}

function toggleArchiveLogs(idx) {
  const el = document.getElementById('archive-logs-' + idx)
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'
}

// ── Drag and drop ─────────────────────────────────────────────────────────────

function hideDropIndicator() {
  if (_dropIndicator && _dropIndicator.parentNode) {
    _dropIndicator.parentNode.removeChild(_dropIndicator)
  }
  _dropIndex = -1
}

function groupLastEl(itemEl) {
  const myDepth = parseInt(itemEl.dataset.depth || '0')
  let last = itemEl
  let next = itemEl.nextElementSibling
  while (next && next.classList.contains('item') && parseInt(next.dataset.depth || '0') > myDepth) {
    last = next
    next = next.nextElementSibling
  }
  return last
}

function calcDropIndex(e, quadrant) {
  const container = document.getElementById('items-' + quadrant)
  const topItems  = Array.from(container.querySelectorAll('.item[data-depth="0"]'))
    .filter(el => el.dataset.id !== _dragId)

  const mouseY = e.clientY
  let insertBefore = null
  let idx = topItems.length

  for (let i = 0; i < topItems.length; i++) {
    const top    = topItems[i].getBoundingClientRect().top
    const bottom = groupLastEl(topItems[i]).getBoundingClientRect().bottom
    if (mouseY < (top + bottom) / 2) {
      insertBefore = topItems[i]
      idx = i
      break
    }
  }

  // Position indicator in DOM
  const addBtn = container.querySelector('.add-item-btn')
  container.insertBefore(_dropIndicator, insertBefore || addBtn)
  _dropIndex = idx
}

function calcChildDropIndex(e, quadrant, parentId, depth) {
  const container = document.getElementById('items-' + quadrant)
  const siblings  = Array.from(
    container.querySelectorAll(`.item[data-depth="${depth}"][data-parent-id="${parentId}"]`)
  ).filter(el => el.dataset.id !== _dragId)

  if (siblings.length === 0) return

  // Only show indicator when mouse is within the sibling group's vertical bounds
  const firstTop    = siblings[0].getBoundingClientRect().top
  const lastBottom  = groupLastEl(siblings[siblings.length - 1]).getBoundingClientRect().bottom
  const mouseY      = e.clientY
  if (mouseY < firstTop - 12 || mouseY > lastBottom + 12) { hideDropIndicator(); return }

  let insertBefore = null
  let idx = siblings.length

  for (let i = 0; i < siblings.length; i++) {
    const top    = siblings[i].getBoundingClientRect().top
    const bottom = groupLastEl(siblings[i]).getBoundingClientRect().bottom
    if (mouseY < (top + bottom) / 2) { insertBefore = siblings[i]; idx = i; break }
  }

  if (insertBefore) {
    container.insertBefore(_dropIndicator, insertBefore)
  } else {
    const lastEl  = groupLastEl(siblings[siblings.length - 1])
    const afterEl = lastEl.nextElementSibling
    afterEl ? container.insertBefore(_dropIndicator, afterEl) : container.appendChild(_dropIndicator)
  }
  _dropIndex = idx
}

function setupDragDrop() {
  _dropIndicator = document.createElement('div')
  _dropIndicator.className = 'drop-indicator'

  DND_QUADRANTS.forEach(q => {
    const container = document.getElementById('items-' + q)

    container.addEventListener('dragover', e => {
      if (!_dragId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (_dragDepth === 0) {
        calcDropIndex(e, q)
      } else if (_dragQuadrant === q) {
        calcChildDropIndex(e, q, _dragParentId, _dragDepth)
      }
    })

    container.addEventListener('dragleave', e => {
      if (!container.contains(e.relatedTarget)) hideDropIndicator()
    })

    container.addEventListener('drop', e => {
      e.preventDefault()
      if (!_dragId || _dropIndex < 0) { hideDropIndicator(); return }

      const data = getData()

      if (_dragDepth === 0) {
        // Top-level: can move across quadrants
        const srcItems = data.quadrants[_dragQuadrant].items
        const tgtItems = data.quadrants[q].items
        const srcIdx   = srcItems.findIndex(i => i.id === _dragId)
        if (srcIdx < 0) { hideDropIndicator(); return }
        const [item] = srcItems.splice(srcIdx, 1)
        tgtItems.splice(_dropIndex, 0, item)
      } else {
        // Child: reorder within same parent only
        if (q !== _dragQuadrant) { hideDropIndicator(); return }
        const parent = findItemById(data.quadrants[_dragQuadrant].items, _dragParentId)
        if (!parent || !parent.children) { hideDropIndicator(); return }
        const srcIdx = parent.children.findIndex(c => c.id === _dragId)
        if (srcIdx < 0) { hideDropIndicator(); return }
        const [item] = parent.children.splice(srcIdx, 1)
        parent.children.splice(_dropIndex, 0, item)
      }

      hideDropIndicator()
      _dragId = null; _dragQuadrant = null; _dragDepth = 0; _dragParentId = null; _dropIndex = -1
      setData(data)
      saveData()
      renderAll()
    })
  })
}

// ── Resizable panes ───────────────────────────────────────────────────────────

function setupResizable() {
  const app  = document.getElementById('app')
  const divV = document.getElementById('divider-v')
  const divH = document.getElementById('divider-h')

  const SNAP_FRACTIONS = [1/4, 1/2, 3/4]
  const SNAP_RADIUS    = 18   // px

  // Build snap indicator dots
  const snapVEls = SNAP_FRACTIONS.map(f => {
    const el = document.createElement('div')
    el.className  = 'snap-indicator snap-v'
    el.style.left = (f * 100).toFixed(4) + '%'
    app.appendChild(el)
    return el
  })
  const snapHEls = SNAP_FRACTIONS.map(f => {
    const el = document.createElement('div')
    el.className = 'snap-indicator snap-h'
    el.style.top = (f * 100).toFixed(4) + '%'
    app.appendChild(el)
    return el
  })

  let dragging = null

  function startDrag(type, divEl) {
    return e => {
      dragging = type
      divEl.classList.add('dragging')
      document.body.style.cursor    = type === 'v' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    }
  }

  divV.addEventListener('mousedown', startDrag('v', divV))
  divH.addEventListener('mousedown', startDrag('h', divH))

  document.addEventListener('mousemove', e => {
    if (!dragging) return
    const rect = app.getBoundingClientRect()

    if (dragging === 'v') {
      let x    = e.clientX - rect.left
      const sz = rect.width
      // Snap to 1/3 and 2/3 positions
      snapVEls.forEach((el, i) => {
        const snapX = SNAP_FRACTIONS[i] * sz
        if (Math.abs(x - snapX) <= SNAP_RADIUS) {
          x = snapX
          el.classList.add('active')
        } else {
          el.classList.remove('active')
        }
      })
      x = Math.max(200, Math.min(x, sz - 204))
      // Use percentage so layout scales with window resize
      app.style.gridTemplateColumns = (x / sz * 100).toFixed(3) + '% 4px 1fr'

    } else {
      let y    = e.clientY - rect.top
      const sz = rect.height
      // Snap to 1/3 and 2/3 positions
      snapHEls.forEach((el, i) => {
        const snapY = SNAP_FRACTIONS[i] * sz
        if (Math.abs(y - snapY) <= SNAP_RADIUS) {
          y = snapY
          el.classList.add('active')
        } else {
          el.classList.remove('active')
        }
      })
      y = Math.max(120, Math.min(y, sz - 124))
      app.style.gridTemplateRows = (y / sz * 100).toFixed(3) + '% 4px 1fr'
    }
  })

  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = null
    divV.classList.remove('dragging')
    divH.classList.remove('dragging')
    snapVEls.forEach(el => el.classList.remove('active'))
    snapHEls.forEach(el => el.classList.remove('active'))
    document.body.style.cursor     = ''
    document.body.style.userSelect = ''
  })
}

function restoreArchiveItem(idx, targetQuadrant) {
  const data  = getData()
  const entry = data.archive[idx]
  if (!entry) return
  const item = {
    id:          entry.id,
    title:       entry.title,
    status:      'todo',
    description: entry.description || '',
    deadline:    entry.deadline    || null,
    logs:        entry.logs        || [],
    children:    entry.children    || []
  }
  data.quadrants[targetQuadrant].items.push(item)
  data.archive.splice(idx, 1)
  setData(data)
  saveData()
  renderAll()
  renderArchiveBtn()
  renderArchiveList()
}
