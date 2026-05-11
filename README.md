<p align="center">
  <img src="logo_name.png" alt="QuadFocus" width="140" />
</p>

<h1 align="center">QuadFocus</h1>

<p align="center"><strong>四象限任务管理 × 锁屏进展记录</strong>，Windows 桌面原生工具。</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-blue" />
  <img src="https://img.shields.io/badge/version-1.0.0-green" />
  <img src="https://img.shields.io/badge/license-Private-lightgrey" />
</p>

---

## 简介

QuadFocus 是一款轻量级 Windows 桌面效率工具，帮助多线程工作的人理清任务优先级，并在每次锁屏时自然地完成进展记录。

核心理念：**主动提醒不打断工作流，在你锁屏的瞬间完成当日复盘。**

---

## 功能特性

### 四象限任务板
- **主线工作** · **支线项目** · **有意思的项目** · **Deadline**
- 支持三层嵌套（项目 → 阶段 → 子任务）
- 每个任务可设置状态（TODO / ACTIVE / PAUSE / DONE）、截止日期、描述
- 任务完成后自动归档，支持一键复原到任意象限

### 锁屏进展拦截
- 按 `Win+L` 触发进度更新弹窗，完成记录后才真正锁屏
- 支持跳过（不记录直接锁屏）或取消（保持解锁状态）
- 进展记录按任务保存，随时可在主界面查看历史

### 解锁自动打开
- 每天第一次解锁时，自动弹出 QuadFocus 主界面，提醒规划当日任务

### 归档系统
- 完成的任务自动移入归档，保留标题、描述、截止日期、进展日志
- 可复原归档任务到任意象限，继续追踪

### 数据存储
- 所有数据存为本地 JSON 文件，路径自定义（支持 OneDrive 同步）
- 格式化 JSON，便于备份和手动编辑

---

## 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10 / 11（64 位） |
| WebView2 运行时 | 通常已随 Edge 预装；如缺失请访问 [Microsoft 下载页](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| 权限 | 需要管理员权限（用于拦截 Win+L） |

---

## 安装方法

1. 前往 [Releases](../../releases) 页面，下载最新版 `QuadFocus-v*.zip`
2. 解压到任意目录（建议 `C:\Program Files\QuadFocus\` 或 `%LOCALAPPDATA%\QuadFocus\`）
3. 右键 `QuadFocus.exe` → **以管理员身份运行**
4. 首次启动将引导配置数据文件路径和开机自启

> **提示**：若需长期使用，建议在设置中开启「开机自启」，程序将自动以管理员身份启动。

---

## 使用说明

### 快捷键

| 操作 | 方式 |
|------|------|
| 打开主界面 | 系统托盘双击，或自定义快捷键（默认 `Ctrl+Alt+Space`） |
| 锁屏并记录进展 | `Win+L` |
| 切换任务状态 | 点击状态徽标（TODO → ACTIVE → PAUSE → DONE） |
| 编辑任务标题 | 点击标题文字，回车保存，Esc 取消 |
| 添加任务描述 | 悬停任务 → 点击描述占位符，Shift+Enter 换行 |

### 主界面操作

- **添加任务**：点击象限底部「+ 添加项目」
- **添加子任务**：悬停任务 → 点击「+ 子项」（最多三层）
- **设置截止日期**：悬停任务 → 点击「+ 日期」，弹出日期选择器
- **查看进展日志**：悬停任务 → 点击「日志 N」
- **归档查看**：右下角「📦 归档」按钮

### 锁屏弹窗

按 `Win+L` 后出现四象限进度更新界面：
- 为进行中的任务更新状态、填写今日进展
- **保存并锁定**：保存记录后锁屏
- **跳过**：不记录，直接锁屏
- **✕ 取消锁屏**：关闭弹窗，继续工作

---

## 版本历史

### v1.0.0
- 四象限任务管理（三层嵌套，状态/截止日期/描述）
- Win+L 锁屏拦截与进展记录
- 解锁自动弹出
- 任务归档与复原
- 浮动日期选择器
- 进展日志查看

---

## 数据说明

用户数据存储在首次配置时指定的 JSON 文件中，格式如下：

```json
{
  "lastOpenDate": "2026-05-11",
  "archive": [],
  "quadrants": {
    "main":     { "name": "主线工作",    "items": [] },
    "side":     { "name": "支线项目",    "items": [] },
    "fun":      { "name": "有意思的项目", "items": [] },
    "deadline": { "name": "Deadline",    "standalone": [] }
  }
}
```

建议将数据文件存放在 OneDrive / Dropbox 等同步目录实现多机同步。

---

*QuadFocus — 让每次锁屏都不虚度*
