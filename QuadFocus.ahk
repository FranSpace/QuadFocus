#Requires AutoHotkey v2.0
#SingleInstance Force

#Include lib\WebView2.ahk
#Include lib\cJson.ahk
#Include lib\DataManager.ahk

global AppName      := "QuadFocus"
global MainWin      := ""
global PopupWin     := ""
global SettingsWin  := ""
global DataMgr      := DataManager()

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
    local hk := (DataMgr.ConfigExists()
                 && DataMgr.config.Has("hotkey")
                 && DataMgr.config["hotkey"] != "")
                ? DataMgr.config["hotkey"] : "^!Space"
    Hotkey(hk, (*) => ToggleMain())
}

ToggleMain() {
    if (MainWin != "" && WinExist("ahk_id " . MainWin.Hwnd)) {
        if (WinGetStyle("ahk_id " . MainWin.Hwnd) & 0x10000000)  ; WS_VISIBLE
            MainWin.Hide()
        else
            MainWin.Show()
    } else {
        ShowMain()
    }
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
    local ok := DllCall("Wtsapi32\WTSRegisterSessionNotification",
        "Ptr", A_ScriptHwnd, "UInt", 0)
    if !ok
        MsgBox("Warning: Could not register session notifications. Auto-open on unlock will not work.")
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
    PopupWin.OnEvent("Close", (*) => (PopupWin := ""))
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

; ── Settings window ──────────────────────────────────────────────────────────
ShowSettings() {
    global SettingsWin
    if (IsSet(SettingsWin) && SettingsWin != "" && WinExist("ahk_id " . SettingsWin.Hwnd)) {
        WinActivate("ahk_id " . SettingsWin.Hwnd)
        return
    }
    SettingsWin := Gui("-MinimizeBox -MaximizeBox", "QuadFocus — 设置")
    SettingsWin.Show("w480 h320")
    SettingsWin.OnEvent("Close", (*) => (SettingsWin := ""))

    local wv := WebView2.create(SettingsWin.Hwnd)
    wv.Navigate("file:///" . StrReplace(A_ScriptDir, "\", "/") . "/ui/settings.html")
    wv.add_NavigationCompleted((*) => {
        local cfg := JSON.stringify(DataMgr.config)
        wv.ExecuteScript("onAHKMessage({type:'loadConfig',config:" . cfg . "})")
    })
    wv.add_WebMessageReceived((sender, args) => HandleSettingsMessage(args, wv, SettingsWin))
}

HandleSettingsMessage(args, wv, win) {
    global SettingsWin
    local msg := JSON.parse(args.TryGetWebMessageAsString())
    if (msg["action"] == "browsePath") {
        local path := FileSelect("S", DataMgr.dataPath,
                                 "选择 data.json 位置", "JSON 文件 (*.json)")
        if (path != "")
            wv.ExecuteScript("onAHKMessage({type:'pathSelected',path:'" . StrReplace(path, "\", "/") . "'})")
    }
    if (msg["action"] == "saveConfig") {
        ; Capture old hotkey before overwriting config
        local oldHk := (DataMgr.config.Has("hotkey") && DataMgr.config["hotkey"] != "")
                       ? DataMgr.config["hotkey"] : "^!Space"
        DataMgr.SaveConfig(msg["config"])
        ApplyAutoStart(msg["config"]["autoStart"])
        ; Deregister old hotkey, register new one
        local newHk := (DataMgr.config.Has("hotkey") && DataMgr.config["hotkey"] != "")
                       ? DataMgr.config["hotkey"] : "^!Space"
        try Hotkey(oldHk, "Off")
        try Hotkey(newHk, (*) => ToggleMain())
        win.Destroy()
        SettingsWin := ""
    }
    if (msg["action"] == "cancel") {
        win.Destroy()
        SettingsWin := ""
    }
}

; ── Onboarding window ────────────────────────────────────────────────────────
ShowOnboarding() {
    global OnboardingWin
    OnboardingWin := Gui("-MinimizeBox -MaximizeBox", "QuadFocus — 初始设置")
    OnboardingWin.Show("w520 h420")

    local wv := WebView2.create(OnboardingWin.Hwnd)
    wv.Navigate("file:///" . StrReplace(A_ScriptDir, "\", "/") . "/ui/onboarding.html")
    wv.add_WebMessageReceived((sender, args) => HandleOnboardingMessage(args, wv, OnboardingWin))
}

HandleOnboardingMessage(args, wv, win) {
    local msg := JSON.parse(args.TryGetWebMessageAsString())
    if (msg["action"] == "browsePath") {
        local path := FileSelect("S", A_UserProfile . "\OneDrive\QuadFocus\data.json",
                                 "选择 data.json 位置", "JSON 文件 (*.json)")
        if (path != "")
            wv.ExecuteScript("onAHKMessage({type:'pathSelected',path:'" . StrReplace(path, "\", "/") . "'})")
    }
    if (msg["action"] == "saveConfig") {
        DataMgr.SaveConfig(msg["config"])
        ApplyAutoStart(msg["config"]["autoStart"])
        SetupHotkey()
        win.Destroy()
        ShowMain()
    }
}

ApplyAutoStart(enable) {
    local key := "HKCU\Software\Microsoft\Windows\CurrentVersion\Run"
    if (enable)
        RegWrite('"' . A_ScriptFullPath . '"', "REG_SZ", key, AppName)
    else
        try RegDelete(key, AppName)
}
