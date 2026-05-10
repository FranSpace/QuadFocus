#Requires AutoHotkey v2.0

class DataManager {
    dataPath   := ""
    configPath := A_AppData . "\QuadFocus\config.json"
    config     := Map()

    __New() {
        DirCreate(A_AppData . "\QuadFocus")
    }

    ConfigExists() {
        return FileExist(this.configPath) != ""
    }

    LoadConfig() {
        raw := FileRead(this.configPath, "UTF-8")
        this.config := JSON.parse(raw)
        this.dataPath := this.config["dataPath"]
        return this.config
    }

    SaveConfig(cfg) {
        this.config := cfg
        this.dataPath := cfg["dataPath"]
        local f := FileOpen(this.configPath, "w", "UTF-8")
        if !f
            throw Error("Cannot write config: " . this.configPath)
        f.Write(JSON.stringify(cfg))
        f.Close()
    }

    LoadData() {
        if (this.dataPath == "")
            return this.EmptyData()
        if (!FileExist(this.dataPath))
            return this.EmptyData()
        raw := FileRead(this.dataPath, "UTF-8")
        return JSON.parse(raw)
    }

    SaveData(data) {
        if (this.dataPath == "")
            throw Error("DataManager: dataPath not set. Call LoadConfig() first.")
        local f := FileOpen(this.dataPath, "w", "UTF-8")
        if !f
            throw Error("Cannot write data: " . this.dataPath)
        f.Write(JSON.stringify(data))
        f.Close()
    }

    EmptyData() {
        return JSON.parse('{"lastOpenDate":null,"quadrants":{"main":{"name":"主线工作","items":[]},"side":{"name":"支线项目","items":[]},"fun":{"name":"有意思的项目","items":[]},"deadline":{"name":"Deadline","standalone":[]}}}')
    }

    IsFirstOpenToday() {
        if (!this.ConfigExists())
            return false
        local data := this.LoadData()
        local today := FormatTime(, "yyyy-MM-dd")
        return data["lastOpenDate"] != today
    }

    MarkOpenedToday() {
        local data := this.LoadData()
        data["lastOpenDate"] := FormatTime(, "yyyy-MM-dd")
        this.SaveData(data)
    }
}
