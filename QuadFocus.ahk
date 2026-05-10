#Requires AutoHotkey v2.0
#SingleInstance Force

#Include lib\WebView2.ahk
#Include lib\cJson.ahk
#Include lib\DataManager.ahk

global AppName  := "QuadFocus"
global MainWin  := ""
global PopupWin := ""
global DataMgr  := DataManager()

OnExit(ExitHandler)
SetupTray()
SetupHotkey()
SetupSessionEvents()

if (!DataMgr.ConfigExists()) {
    ShowOnboarding()
} else {
    DataMgr.LoadConfig()
}

Return

; ── Exit ────────────────────────────────────────────────────────────────────
ExitHandler(*) {
    TrayTip("", "", 0)
}

; ── Tray ────────────────────────────────────────────────────────────────────
SetupTray() {
    A_TrayMenu.Delete()
    A_TrayMenu.Add("打开 QuadFocus",  (*) => ShowMain())
    A_TrayMenu.Add("设置",            (*) => ShowSettings())
    A_TrayMenu.Add()
    A_TrayMenu.Add("退出",            (*) => ExitApp())
    A_TrayMenu.Default := "打开 QuadFocus"
}

; ── Hotkey ───────────────────────────────────────────────────────────────────
SetupHotkey() {
    local hk := DataMgr.ConfigExists() ? DataMgr.config["hotkey"] : "^!Space"
    Hotkey(hk, (*) => ToggleMain())
}

ToggleMain() {
    if (MainWin != "" && WinExist("ahk_id " . MainWin.Hwnd))
        MainWin.Hide()
    else
        ShowMain()
}

; ── Main window ──────────────────────────────────────────────────────────────
ShowMain() {
    global MainWin
    if (MainWin != "" && WinExist("ahk_id " . MainWin.Hwnd)) {
        MainWin.Show()
        WinActivate("ahk_id " . MainWin.Hwnd)
        return
    }

    local cfg := DataMgr.ConfigExists() ? DataMgr.config : Map()
    local w   := cfg.Has("windowSize") ? cfg["windowSize"]["w"] : 1200
    local h   := cfg.Has("windowSize") ? cfg["windowSize"]["h"] : 700

    MainWin := Gui("+Resize -MinimizeBox", "QuadFocus")
    MainWin.OnEvent("Close", (*) => MainWin.Hide())
    MainWin.OnEvent("Size",  OnMainResize)
    MainWin.Show("w" . w . " h" . h)

    local wv := WebView2.create(MainWin.Hwnd)
    wv.Navigate("file:///" . StrReplace(A_ScriptDir, "\", "/") . "/ui/index.html")
    wv.add_NavigationCompleted((*) => SendDataToMain(wv))
    MainWin._wv := wv
}

SendDataToMain(wv) {
    local data := DataMgr.LoadData()
    local json := JSON.stringify(data)
    wv.ExecuteScript("onAHKMessage({type:'load',data:" . json . "})")
}

OnMainResize(gui, minMax, w, h) {
    if (gui.HasProp("_wv"))
        gui._wv.Fill()
}

; ── Session events (Task 6) ───────────────────────────────────────────────────
SetupSessionEvents() {
    ; Register for WM_WTSSESSION_CHANGE (0x02B1)
    DllCall("Wtsapi32\WTSRegisterSessionNotification",
        "Ptr", A_ScriptHwnd, "UInt", 0)
    OnMessage(0x02B1, OnSessionChange)
}

OnSessionChange(wParam, lParam, msg, hwnd) {
    if (wParam == 8)   ; WTS_SESSION_UNLOCK
        OnUnlock()
    ; wParam == 7 (WTS_SESSION_LOCK) is handled by the #l hotkey below
}

OnUnlock() {
    if (DataMgr.IsFirstOpenToday()) {
        DataMgr.MarkOpenedToday()
        ShowMain()
    }
}

; ── Win+L intercept ──────────────────────────────────────────────────────────
#l:: ShowPopupThenLock()

ShowPopupThenLock() {
    global PopupWin
    if (PopupWin != "" && WinExist("ahk_id " . PopupWin.Hwnd)) {
        WinActivate("ahk_id " . PopupWin.Hwnd)
        return
    }

    PopupWin := Gui("-MinimizeBox -MaximizeBox +AlwaysOnTop", "QuadFocus — 更新进展")
    PopupWin.OnEvent("Close", (*) => (DoLock(), PopupWin := ""))
    PopupWin.Show("w600 h500")

    local wv := WebView2.create(PopupWin.Hwnd)
    wv.Navigate("file:///" . StrReplace(A_ScriptDir, "\", "/") . "/ui/popup.html")
    wv.add_NavigationCompleted((*) => SendDataToPopup(wv))
    wv.add_WebMessageReceived((sender, args) => HandlePopupMessage(args, wv))
    PopupWin._wv := wv
}

SendDataToPopup(wv) {
    local data := DataMgr.LoadData()
    local json := JSON.stringify(data)
    wv.ExecuteScript("onAHKMessage({type:'load',data:" . json . "})")
}

HandlePopupMessage(args, wv) {
    global PopupWin
    local msg := JSON.parse(args.TryGetWebMessageAsString())
    if (msg["action"] == "lock" || msg["action"] == "skip") {
        if (msg["action"] == "lock" && msg.Has("data"))
            DataMgr.SaveData(msg["data"])
        PopupWin.Destroy()
        PopupWin := ""
        DoLock()
    }
}

DoLock() {
    DllCall("LockWorkStation")
}

; ── Settings window (stub — implemented in Task 10) ──────────────────────────
ShowSettings() {
    MsgBox("Settings coming soon.")
}

; ── Onboarding window (stub — implemented in Task 7) ─────────────────────────
ShowOnboarding() {
    MsgBox("Onboarding coming soon.")
}
