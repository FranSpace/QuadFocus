let currentConfig = {}
let ahkHotkey = '^!Space'

// AHK calls this with {type:'loadConfig', config:{...}} after navigation
function onAHKMessage(msg) {
  if (msg.type === 'loadConfig') {
    currentConfig = msg.config
    document.getElementById('data-path').value  = msg.config.dataPath      || ''
    document.getElementById('hotkey').value     = msg.config.hotkeyDisplay || 'Ctrl+Alt+Space'
    document.getElementById('auto-start').checked = !!msg.config.autoStart
    ahkHotkey = msg.config.hotkey || '^!Space'
  }
  if (msg.type === 'pathSelected') {
    document.getElementById('data-path').value = msg.path
  }
}

document.getElementById('hotkey').addEventListener('keydown', e => {
  e.preventDefault()
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

  const parts = []
  if (e.ctrlKey)  parts.push('Ctrl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(e.key === ' ' ? 'Space' : e.key.toUpperCase())
  document.getElementById('hotkey').value = parts.join('+')

  ahkHotkey = (e.ctrlKey  ? '^' : '')
            + (e.altKey   ? '!' : '')
            + (e.shiftKey ? '+' : '')
            + (e.key === ' ' ? 'Space' : e.key)
})

function browsePath() {
  window.chrome.webview.postMessage(JSON.stringify({ action: 'browsePath' }))
}

function saveSettings() {
  const path = document.getElementById('data-path').value.trim()
  if (!path) { alert('请输入数据文件路径'); return }
  const config = {
    ...currentConfig,
    dataPath:      path,
    hotkey:        ahkHotkey,
    hotkeyDisplay: document.getElementById('hotkey').value,
    autoStart:     document.getElementById('auto-start').checked
  }
  window.chrome.webview.postMessage(JSON.stringify({ action: 'saveConfig', config }))
}

function cancelSettings() {
  window.chrome.webview.postMessage(JSON.stringify({ action: 'cancel' }))
}
