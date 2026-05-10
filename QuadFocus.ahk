#Requires AutoHotkey v2.0
#SingleInstance Force

#Include lib\WebView2.ahk
#Include lib\cJson.ahk
#Include lib\DataManager.ahk

global AppName := "QuadFocus"
global MainWin := ""
global PopupWin := ""
global DataMgr := DataManager()

; Entry point
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

ExitHandler(*) {
    TrayTip("", "", 0)
}
