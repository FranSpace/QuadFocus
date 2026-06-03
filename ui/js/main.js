// Collapse state persists across re-renders
const collapsedIds = new Set()
// Track which items have their inline log section open
const openLogIds = new Set()

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

// ── Quadrant SVG icons (24×24 viewBox) ────────────────────────────────────────

const QUAD_ICONS = {
  main: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9.5" stroke="#2f6fb0" stroke-width="1.3" fill="none" opacity="0.35"/>
    <path d="M 12 3 L 14.4 12 L 12 21 L 9.6 12 Z" fill="#2f6fb0"/>
    <circle cx="12" cy="12" r="1.4" fill="#fbf8ee"/>
  </svg>`,
  side: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#c89438" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M 12 21 L 12 14 M 12 14 L 5 7 M 12 14 L 19 7 M 12 14 L 12 4"/>
    </g>
    <circle cx="5" cy="7" r="1.8" fill="#c89438"/>
    <circle cx="19" cy="7" r="1.8" fill="#c89438"/>
    <circle cx="12" cy="4" r="1.8" fill="#c89438"/>
  </svg>`,
  fun: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 12 21 C 12 14, 5 13, 4 6 C 11 7, 13 13, 12 21 Z" fill="#4a9a6c" opacity="0.85"/>
    <path d="M 12 21 C 12 16, 15 13, 20 11" stroke="#4a9a6c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  ddl: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#b53b3b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M 5 3.5 L 19 3.5 M 5 20.5 L 19 20.5"/>
      <path d="M 6 3.5 C 6 9, 12 11, 12 12 C 12 13, 6 15, 6 20.5"/>
      <path d="M 18 3.5 C 18 9, 12 11, 12 12 C 12 13, 18 15, 18 20.5"/>
    </g>
    <path d="M 8.5 6 L 15.5 6 L 12 10 Z" fill="#b53b3b"/>
  </svg>`
}

// ── Status SVG badges (12×12 viewBox) ────────────────────────────────────────

function makeStatusSVG(status) {
  const svgs = {
    todo: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="5" fill="none" stroke="#8a7e64" stroke-width="1.4"/></svg>`,
    active: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="5" fill="none" stroke="#2f6fb0" stroke-width="1.4"/><path d="M 6 1 A 5 5 0 0 1 6 11 Z" fill="#2f6fb0"/></svg>`,
    paused: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="2.5" width="2" height="7" rx="0.6" fill="#a8782e"/><rect x="6.5" y="2.5" width="2" height="7" rx="0.6" fill="#a8782e"/></svg>`,
    done: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="5" fill="#4a9a6c"/><path d="M 3.5 6.5 L 5.5 8.5 L 8.5 3.5" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
  }
  return svgs[status] || svgs.todo
}

// ── Init icons in header ──────────────────────────────────────────────────────

function initQuadrantIcons() {
  const iconMain = document.getElementById('icon-main')
  const iconSide = document.getElementById('icon-side')
  const iconFun  = document.getElementById('icon-fun')
  const iconDdl  = document.getElementById('icon-ddl')
  if (iconMain) iconMain.innerHTML = QUAD_ICONS.main
  if (iconSide) iconSide.innerHTML = QUAD_ICONS.side
  if (iconFun)  iconFun.innerHTML  = QUAD_ICONS.fun
  if (iconDdl)  iconDdl.innerHTML  = QUAD_ICONS.ddl
}

// ── Stats counting ────────────────────────────────────────────────────────────

function countItemsDeep(items) {
  const counts = { active: 0, todo: 0, paused: 0, done: 0 }
  function walk(list) {
    for (const item of list) {
      const s = item.status
      if (counts[s] !== undefined) counts[s]++
      if (item.children && item.children.length) walk(item.children)
    }
  }
  walk(items)
  return counts
}

function updateStats(key, items) {
  const el = document.getElementById('stats-' + key)
  if (!el) return
  const c = countItemsDeep(items)
  const parts = []
  if (c.active) parts.push(c.active + ' active')
  if (c.todo)   parts.push(c.todo   + ' todo')
  if (c.paused) parts.push(c.paused + ' paused')
  if (c.done)   parts.push(c.done   + ' done')
  el.textContent = parts.length ? parts.join(' · ') : '无任务'
}

function onDataReady() {
  initTitlebar()
  initQuadrantIcons()
  renderAll()
  renderArchiveBtn()
  setupResizable()
  if (!_dndInitialized) { setupDragDrop(); _dndInitialized = true }
}

// ── Title bar ─────────────────────────────────────────────────────────────────

function initTitlebar() {
  updateTitlebarDate()
  // Refresh date every minute
  setInterval(updateTitlebarDate, 60000)

  // Window drag: mousedown on titlebar (skip interactive elements)
  const titlebar = document.getElementById('titlebar')
  if (titlebar) {
    titlebar.addEventListener('mousedown', e => {
      if (e.button !== 0) return
      if (e.target.closest('.no-drag, button, input, kbd, a')) return
      tbWinDrag()
    })
    titlebar.addEventListener('dblclick', e => {
      if (e.target.closest('.no-drag, button, input, kbd, a')) return
      tbWinMaximize()
    })
  }

  // Window control buttons
  document.getElementById('tb-minimize').addEventListener('click', tbWinMinimize)
  document.getElementById('tb-maximize').addEventListener('click', tbWinMaximize)
  document.getElementById('tb-close').addEventListener('click', tbWinClose)

  // Search
  const searchInput = document.getElementById('tb-search-input')
  if (searchInput) {
    searchInput.addEventListener('input', () => performSearch(searchInput.value))
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeSearchResults(); searchInput.value = ''; searchInput.blur() }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSearchSelection(1) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); moveSearchSelection(-1) }
      if (e.key === 'Enter')     { e.preventDefault(); commitSearchSelection() }
    })
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) performSearch(searchInput.value)
    })
  }

  // Ctrl+K to focus search
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault()
      if (searchInput) { searchInput.focus(); searchInput.select() }
    }
  })

  // N shortcut for new item (when not in a text field)
  document.addEventListener('keydown', e => {
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = document.activeElement.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.contentEditable === 'true') return
      tbNewItem()
    }
  })

  // Today button
  document.getElementById('tb-btn-today').addEventListener('click', tbScrollToday)

  // New button
  document.getElementById('tb-btn-new').addEventListener('click', e => {
    tbNewItem(document.getElementById('tb-btn-new'))
  })

  // Close search results when clicking outside
  document.addEventListener('mousedown', e => {
    const results = document.getElementById('search-results')
    const wrap    = document.getElementById('tb-search-wrap')
    if (results && wrap && !results.contains(e.target) && !wrap.contains(e.target)) {
      closeSearchResults()
    }
  })
}

function updateTitlebarDate() {
  const el = document.getElementById('tb-date')
  if (!el) return
  const now    = new Date()
  const days   = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六']
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const day    = days[now.getDay()]
  const month  = months[now.getMonth()]
  const date   = now.getDate()
  const year   = now.getFullYear()
  const wk     = getISOWeek(now)
  el.textContent = `${day} · ${month} ${date}, ${year} · WK ${pad(wk)}`
}

function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
}

// ── Window control messages ───────────────────────────────────────────────────

function tbSend(action) {
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage(JSON.stringify({ action }))
  }
}
function tbWinDrag()     { tbSend('winDrag') }
function tbWinMinimize() { tbSend('winMinimize') }
function tbWinMaximize() { tbSend('winMaximize') }
function tbWinClose()    { tbSend('winClose') }

function setMaximized(isMax) {
  const btn = document.getElementById('tb-maximize')
  if (!btn) return
  if (isMax) {
    // Two overlapping squares = restore icon
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect x="2.5" y="0.5" width="8" height="8" stroke="currentColor" stroke-width="1"/>
      <rect x="0.5" y="2.5" width="8" height="8" fill="var(--bg-chrome)" stroke="currentColor" stroke-width="1"/>
    </svg>`
    btn.title = '还原'
  } else {
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" stroke-width="1"/></svg>`
    btn.title = '最大化'
  }
}

// ── Today / New shortcuts ────────────────────────────────────────────────────

function tbScrollToday() {
  const dlQ = document.getElementById('q-deadline')
  if (dlQ) dlQ.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  // Flash the deadline quadrant briefly
  dlQ && dlQ.classList.add('highlight-flash')
  setTimeout(() => dlQ && dlQ.classList.remove('highlight-flash'), 900)
}

function tbNewItem(anchorBtn) {
  const btn = anchorBtn || document.getElementById('tb-btn-new')
  showFloatDialog(btn, dialog => {
    dialog.style.minWidth = '200px'
    dialog.innerHTML = `
      <div class="float-label">添加到哪个象限？</div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">
        <button class="float-btn-ok" style="justify-content:flex-start;text-align:left;gap:8px;display:flex;align-items:center"
          onclick="closeFloatDialog();addTopLevelItem('main')">
          <span style="color:var(--main)">●</span> 主线工作
        </button>
        <button class="float-btn-ok" style="background:var(--side);justify-content:flex-start;text-align:left;gap:8px;display:flex;align-items:center"
          onclick="closeFloatDialog();addTopLevelItem('side')">
          <span style="color:var(--side-soft)">●</span> 支线项目
        </button>
        <button class="float-btn-ok" style="background:var(--fun);justify-content:flex-start;text-align:left;gap:8px;display:flex;align-items:center"
          onclick="closeFloatDialog();addTopLevelItem('fun')">
          <span style="color:var(--fun-soft)">●</span> 有意思的项目
        </button>
      </div>`
  })
}

// ── Search ───────────────────────────────────────────────────────────────────

let _searchIdx = -1

function getAllSearchableItems() {
  const data    = getData()
  const results = []
  const quadNames = { main: '主线', side: '支线', fun: '趣项' }

  function walk(items, quadrant, parentTitle) {
    for (const item of items) {
      results.push({ id: item.id, title: item.title, quadrant, parentTitle })
      if (item.children && item.children.length) walk(item.children, quadrant, item.title)
    }
  }

  for (const q of ['main', 'side', 'fun']) {
    walk(data.quadrants[q].items, q, null)
  }
  // Standalone deadline items
  for (const item of (data.quadrants.deadline.standalone || [])) {
    results.push({ id: item.id, title: item.title, quadrant: 'ddl', parentTitle: null })
  }
  return results
}

function performSearch(query) {
  const q = query.trim().toLowerCase()
  if (!q) { closeSearchResults(); return }
  const all     = getAllSearchableItems()
  const matches = all.filter(r => r.title.toLowerCase().includes(q)).slice(0, 10)
  _searchIdx = -1
  renderSearchResults(matches, q)
}

function renderSearchResults(results, query) {
  const el   = document.getElementById('search-results')
  const wrap = document.getElementById('tb-search-wrap')
  if (!el || !wrap) return

  // Position below the search box
  const rect = wrap.getBoundingClientRect()
  el.style.left  = rect.left + 'px'
  el.style.top   = (rect.bottom + 4) + 'px'
  el.style.minWidth = rect.width + 'px'
  el.classList.remove('hidden')

  if (!results.length) {
    el.innerHTML = `<div class="search-no-results">无匹配结果</div>`
    return
  }

  const quadLabel = { main: '主线', side: '支线', fun: '趣项', ddl: 'DDL' }
  el.innerHTML = results.map((r, i) => {
    const qClass = `sr-quad-${r.quadrant}`
    const parent = r.parentTitle ? `<span class="search-result-parent">← ${esc(r.parentTitle)}</span>` : ''
    // Highlight matching text
    const hi  = r.title.replace(new RegExp('(' + escapeRegex(query) + ')', 'gi'), '<mark>$1</mark>')
    return `<div class="search-result-item" data-idx="${i}" data-id="${esc(r.id)}" data-quad="${esc(r.quadrant)}"
              onclick="selectSearchResult(this)">
      <span class="search-result-quad ${qClass}">${quadLabel[r.quadrant] || r.quadrant}</span>
      <span class="search-result-title">${hi}</span>
      ${parent}
    </div>`
  }).join('')
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function moveSearchSelection(dir) {
  const items = document.querySelectorAll('#search-results .search-result-item')
  if (!items.length) return
  items[_searchIdx]?.classList.remove('sr-active')
  _searchIdx = Math.max(-1, Math.min(items.length - 1, _searchIdx + dir))
  if (_searchIdx >= 0) {
    items[_searchIdx].classList.add('sr-active')
    items[_searchIdx].scrollIntoView({ block: 'nearest' })
  }
}

function commitSearchSelection() {
  const items = document.querySelectorAll('#search-results .search-result-item')
  if (_searchIdx >= 0 && items[_searchIdx]) {
    selectSearchResult(items[_searchIdx])
  } else if (items.length === 1) {
    selectSearchResult(items[0])
  }
}

function selectSearchResult(el) {
  const id   = el.dataset.id
  const quad = el.dataset.quad
  closeSearchResults()
  const input = document.getElementById('tb-search-input')
  if (input) { input.value = ''; input.blur() }

  if (quad === 'ddl') {
    tbScrollToday(); return
  }

  // Find item element in the quadrant and scroll to it
  const itemEl = document.querySelector(`.item[data-id="${id}"]`)
  if (itemEl) {
    // Expand parents if collapsed
    let parent = itemEl
    while (parent && parent.classList.contains('item')) {
      if (parent.style.display === 'none') {
        const pid = parent.dataset.parentId
        if (pid) {
          const parentEl = document.querySelector(`.item[data-id="${pid}"]`)
          if (parentEl) toggleCollapse(pid, parentEl)
        }
      }
      parent = parent.previousElementSibling
    }
    itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    itemEl.classList.add('highlight-flash')
    setTimeout(() => itemEl.classList.remove('highlight-flash'), 900)
  }
}

function closeSearchResults() {
  const el = document.getElementById('search-results')
  if (el) el.classList.add('hidden')
  _searchIdx = -1
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
  updateStats(key, items)
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
  el.style.paddingLeft = (depth * 20) + 'px'
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

  // Status badge — SVG icon (click to cycle)
  const badge = document.createElement('span')
  badge.className = 'item-status-badge'
  badge.innerHTML = makeStatusSVG(item.status)
  badge.title     = '点击切换状态'
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

  // Log hover button — always shown, with count if logs exist
  const logCount = item.logs && item.logs.length ? item.logs.length : 0
  const logBtnText = logCount ? '日志 ' + logCount : '日志'
  const logBtn = makeCtrlBtn(logBtnText, () => toggleItemLog(item.id))
  logBtn.classList.add('ctrl-btn-log')
  controls.appendChild(logBtn)

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

  // ── Inline log section ────────────────────────────────────────────────────
  const logSection = document.createElement('div')
  logSection.className = 'item-log-section'
  logSection.dataset.itemId = item.id
  if (openLogIds.has(item.id)) logSection.classList.add('open')

  // Log list (reverse order — newest first)
  const logList = document.createElement('div')
  logList.className = 'item-log-list'
  if (item.logs && item.logs.length) {
    item.logs.slice().reverse().forEach(l => {
      const entry = document.createElement('div')
      entry.className = 'log-entry-inline'
      entry.innerHTML = `<span class="log-time">${esc(l.time)}</span><span class="log-text">${esc(l.text)}</span>`
      logList.appendChild(entry)
    })
  }
  logSection.appendChild(logList)

  // Log input row
  const inputRow = document.createElement('div')
  inputRow.className = 'item-log-input-row'
  const textarea = document.createElement('textarea')
  textarea.className   = 'log-inline-textarea'
  textarea.placeholder = '记录今日进展…'
  textarea.rows        = 1
  // Prevent click on textarea from propagating to item (which would trigger collapse etc.)
  textarea.addEventListener('click', e => e.stopPropagation())
  inputRow.appendChild(textarea)

  const addBtn = document.createElement('button')
  addBtn.className   = 'log-inline-add'
  addBtn.textContent = '添加'
  addBtn.addEventListener('click', e => { e.stopPropagation(); addInlineLog(item.id, quadrant, addBtn) })
  inputRow.appendChild(addBtn)
  logSection.appendChild(inputRow)

  el.appendChild(logSection)

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

// ── Inline log helpers ────────────────────────────────────────────────────────

function toggleItemLog(id) {
  const el = document.querySelector(`.item-log-section[data-item-id="${id}"]`)
  if (!el) return
  if (openLogIds.has(id)) {
    openLogIds.delete(id)
    el.classList.remove('open')
  } else {
    openLogIds.add(id)
    el.classList.add('open')
  }
}

function addInlineLog(id, quadrant, btn) {
  const section  = btn.closest('.item-log-section')
  const textarea = section.querySelector('.log-inline-textarea')
  const text     = textarea.value.trim()
  if (!text) return
  const data = getData()
  const item = findItemById(data.quadrants[quadrant].items, id)
  if (!item) return
  if (!item.logs) item.logs = []
  const now  = new Date()
  const time = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  item.logs.push({ time, text })
  setData(data)
  saveData()
  textarea.value = ''
  // Update log list DOM without full re-render
  const list  = section.querySelector('.item-log-list')
  const entry = document.createElement('div')
  entry.className = 'log-entry-inline'
  entry.innerHTML = `<span class="log-time">${esc(time)}</span><span class="log-text">${esc(text)}</span>`
  list.insertBefore(entry, list.firstChild)
  // Update the log hover button count
  const itemEl    = section.closest('.item')
  const logHoverBtn = itemEl && itemEl.querySelector('.ctrl-btn-log')
  if (logHoverBtn) logHoverBtn.textContent = '日志 ' + item.logs.length
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
    if (nextIndent === myIndent + 20) {
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

function startEditTitle(titleEl, id, quadrant, selectAll = false) {
  const old = titleEl.textContent
  titleEl.contentEditable = 'true'
  titleEl.classList.add('editing')
  titleEl.focus()
  if (selectAll) {
    const range = document.createRange()
    range.selectNodeContents(titleEl)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }
  const itemEl = titleEl.closest('.item')
  if (itemEl) itemEl.classList.add('item-editing')

  let saved = false
  function finish() {
    if (saved) return
    saved = true
    titleEl.contentEditable = 'false'
    titleEl.classList.remove('editing')
    if (itemEl) itemEl.classList.remove('item-editing')
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
      if (itemEl) itemEl.classList.remove('item-editing')
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
  const itemEl = descEl.closest('.item')
  if (itemEl) itemEl.classList.add('item-editing')

  let saved = false
  function finish() {
    if (saved) return
    saved = true
    descEl.contentEditable = 'false'
    descEl.classList.remove('editing')
    if (itemEl) itemEl.classList.remove('item-editing')
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
      if (itemEl) itemEl.classList.remove('item-editing')
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
    if (el) startEditTitle(el, item.id, quadrant, true)
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
    if (el) startEditTitle(el, item.id, quadrant, true)
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
  showFloatDialog(anchorBtn, dialog => {
    dialog.innerHTML = `
      <label class="float-label">截止日期</label>
      <input type="text" id="float-date" class="float-input" placeholder="MM-DD 或留空">
      <div class="float-actions">
        <button class="float-btn-cancel" onclick="closeFloatDialog()">取消</button>
        <button class="float-btn-ok" onclick="confirmDeadline('${id}','${quadrant}')">确定</button>
      </div>`
    setTimeout(() => { const i = document.getElementById('float-date'); if (i) i.focus() }, 0)
  })
}

function confirmDeadline(id, quadrant) {
  const input = document.getElementById('float-date')
  const raw = input ? input.value.trim() : ''
  if (!raw) { closeFloatDialog(); return }
  let dateStr = raw
  if (/^\d{2}-\d{2}$/.test(raw)) {
    dateStr = new Date().getFullYear() + '-' + raw
  }
  const data = getData()
  const item = findItemById(data.quadrants[quadrant].items, id)
  if (item) { item.deadline = dateStr; setData(data); saveData(); renderAll() }
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
        '<span class="dl-date">[' + item.deadline.slice(5).replace('-', '/') + ']</span>'
      el.appendChild(div)
    })

    standalone.forEach((item, idx) => {
      const div = document.createElement('div')
      div.className = 'deadline-item standalone ' + (item.deadline ? urgencyClass(item.deadline) : '')
      const dateDisplay = item.deadline ? item.deadline.slice(5).replace('-', '/') : ''
      div.innerHTML = '<span class="dl-icon">•</span>' +
        '<span class="dl-title">' + esc(item.title) + '</span>' +
        (item.deadline ? '<span class="dl-label">' + relativeLabel(item.deadline) + '</span>' +
          '<span class="dl-date">[' + dateDisplay + ']</span>' : '')
      const delBtn = makeCtrlBtn('×', () => deleteStandalone(idx))
      delBtn.classList.add('ctrl-btn-del')
      div.appendChild(delBtn)
      el.appendChild(div)
    })
  }

  el.appendChild(makeAddBtn('+ 添加独立事项', btn => addStandaloneItem(btn)))

  // Update deadline stats badge
  const statsEl = document.getElementById('stats-deadline')
  if (statsEl) {
    const total = deadlineItems.length + standalone.length
    statsEl.textContent = total ? total + ' 项' : '无任务'
  }
}

function addStandaloneItem(anchorBtn) {
  showFloatDialog(anchorBtn, dialog => {
    dialog.innerHTML = `
      <label class="float-label">事项名称</label>
      <input type="text" id="float-standalone-title" class="float-input" placeholder="输入名称...">
      <label class="float-label" style="margin-top:10px">截止日期（可留空）</label>
      <input type="text" id="float-standalone-date" class="float-input" placeholder="MM-DD 或留空">
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
  if (dateInput && dateInput.value.trim()) {
    const raw = dateInput.value.trim()
    if (/^\d{2}-\d{2}$/.test(raw)) {
      item.deadline = new Date().getFullYear() + '-' + raw
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      item.deadline = raw
    }
  }
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

  const SNAP_FRACTIONS = [1/3, 1/2, 2/3]
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
      app.style.gridTemplateColumns = (x / sz * 100).toFixed(3) + '% 4px 1fr'

    } else {
      let y    = e.clientY - rect.top
      const sz = rect.height
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
