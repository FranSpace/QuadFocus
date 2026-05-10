let ahkHotkey = '^!Space'

document.getElementById('hotkey').addEventListener('keydown', e => {
  e.preventDefault()
  const parts = []
  if (e.ctrlKey)  parts.push('Ctrl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (!['Control', 'Alt', 'Shift'].includes(e.key)) parts.push(e.key.toUpperCase())
  document.getElementById('hotkey').value = parts.join('+')

  ahkHotkey = (e.ctrlKey  ? '^' : '')
            + (e.altKey   ? '!' : '')
            + (e.shiftKey ? '+' : '')
            + (e.key === ' ' ? 'Space' : e.key)
})

function browseDataPath() {
  window.chrome.webview.postMessage(JSON.stringify({ action: 'browsePath' }))
}

function goStep2() {
  const path = document.getElementById('data-path').value.trim()
  if (!path) { alert('请输入数据文件路径'); return }
  document.getElementById('step-1').style.display = 'none'
  document.getElementById('step-2').style.display = 'block'
}

function goStep3() {
  document.getElementById('step-2').style.display = 'none'
  document.getElementById('step-3').style.display = 'block'
}

function finishSetup() {
  const config = {
    dataPath:      document.getElementById('data-path').value.trim(),
    hotkey:        ahkHotkey,
    hotkeyDisplay: document.getElementById('hotkey').value,
    autoStart:     document.getElementById('auto-start').checked,
    windowSize:    { w: 1200, h: 700 }
  }
  window.chrome.webview.postMessage(JSON.stringify({ action: 'saveConfig', config }))
}

// AHK replies with selected path from file picker
function onAHKMessage(msg) {
  if (msg.type === 'pathSelected')
    document.getElementById('data-path').value = msg.path
}
