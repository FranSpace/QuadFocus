let ahkHotkey = '^!Space'

document.getElementById('hotkey').addEventListener('keydown', e => {
  e.preventDefault()
  // Ignore modifier-only keypresses
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

// AHK calls window.onAHKMessage() directly on this page.
// data.js is NOT loaded on onboarding.html, so there is no name collision.
function onAHKMessage(msg) {
  if (msg.type === 'pathSelected')
    document.getElementById('data-path').value = msg.path
}
