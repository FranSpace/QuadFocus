// Shared data layer — loaded by all pages via <script src>
// No imports/exports; uses global scope for WebView2 compatibility.

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function makeItem(title) {
  return {
    id: makeId(),
    title,
    status: 'todo',       // todo | active | paused | done
    description: '',
    deadline: null,        // ISO date string or null
    logs: [],              // [{ time: string, text: string }]
    children: []           // recursive same shape
  }
}

// Returns new item with log appended (immutable)
function addLog(item, text) {
  const now = new Date()
  const time = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ` +
               `${pad(now.getHours())}:${pad(now.getMinutes())}`
  return { ...item, logs: [...item.logs, { time, text }] }
}

// Returns new item with status changed (immutable)
function setStatus(item, status) {
  return { ...item, status }
}

function emptyData() {
  return {
    lastOpenDate: null,
    archive: [],
    quadrants: {
      main:     { name: '主线工作',    items: [] },
      side:     { name: '支线项目',    items: [] },
      fun:      { name: '有意思的项目', items: [] },
      // standalone: items that live only in the deadline quadrant.
      // The full deadline view also aggregates items with deadlines
      // from main/side/fun quadrants (handled by deadline.js).
      deadline: { name: 'Deadline', standalone: [] }
    }
  }
}

function pad(n) { return String(n).padStart(2, '0') }

// Global state — populated by AHK on page load
let _data = emptyData()

function getData()       { return _data }
function setData(d)      { _data = d }

// Called by AHK: window.onAHKMessage({type:'load', data:{...}})
function onAHKMessage(msg) {
  if (msg.type === 'load') {
    if (!msg.data || !msg.data.quadrants) {
      console.warn('onAHKMessage: malformed payload', msg)
      return
    }
    _data = msg.data
    if (!_data.archive) _data.archive = []
    if (typeof onDataReady === 'function') onDataReady()
  }
}
