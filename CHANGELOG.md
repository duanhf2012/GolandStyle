# Changelog

## 0.4.5

- 默认关闭 VS Code 内置 AI 功能，移除编辑器右键菜单中的 Chat、Inline Chat、说明和评审入口；用户可将 `chat.disableAIFeatures` 改为 `false` 重新启用。
- 将官方 Go 扩展散落在编辑器右键菜单中的 5 个常用操作收进“Go 工具”子菜单，保留添加 import、结构体标签、切换测试文件和光标处运行/调试测试。
- `Go: Show All Commands...` 为官方 Go 扩展固定入口，继续保留在顶层，便于访问其他低频命令。

## 0.4.4

- 新增 GoLand 风格“复制引用”：编辑器右键菜单和 `Ctrl+Alt+Shift+C` 可复制项目相对路径及当前行号，选中多行时包含行范围。
- 精简 Go 编辑器右键菜单：书签操作合并到子菜单，Go 扩展仅保留添加 import、结构体标签/填充、光标处运行/调试测试和切换测试文件等高频入口。

## 0.4.3

- 安装扩展后默认启用 GoLand 书签快捷键，顶排 `Ctrl+Shift+0` 至 `Ctrl+Shift+9` 可直接设置或取消数字书签，`Ctrl+0` 至 `Ctrl+9` 可直接跳转；仍可通过 `golandStyle.bookmarks.golandKeybindings` 关闭。

## 0.4.2

- 重构 README，将安装、Profile、视觉设置、Bookmarks、运行配置、快捷键、Snippets、项目模板和常见问题整理为完整使用手册。
- 新增实际 VS Code 整体界面、Bookmarks 与运行/调试配置截图，并补充功能覆盖矩阵和发布元数据。
- 深色与浅色主题的代码注释改为正体显示，与 GoLand 默认注释样式保持一致。
- 资源管理器隐藏 Problems 警告计数与黄色着色，保留 GoLand 风格的蓝色修改、绿色新增文件状态；默认关闭 Staticcheck 命名类波浪线，同时保留编译、语法和类型诊断。
- 深色主题的关键字、字符串、数字和常量标识符按 GoLand 截图校准；常量使用 GoLand 的紫色斜体，关闭 import 路径末段的 `namespace` 异色覆盖，并从 Full Profile 移除会额外产生拼写波浪线的 Code Spell Checker。
- 启用顶部 Command Center，并将调试继续、单步、重启和停止工具栏停靠到窗口顶部，减少对编辑器内容的遮挡并贴近 GoLand 操作位置。
- Go 编辑器隐藏所有诊断波浪线，诊断结果仍保留在 Problems 列表中供需要时查看。
- 数字书签改用与键盘布局无关的物理数字键扫描码，修复部分电脑上 `Ctrl+Shift+数字` 被解析为符号后无法触发的问题。

## 0.4.1

- 在 VS Code 原生“运行和调试”侧栏新增“运行配置”列表，集中显示各工作区 `launch.json` 配置。
- 配置项提供内联运行与调试按钮；单击配置可直接打开并定位到对应的 GoLand 风格配置表单。
- 侧栏标题栏增加编辑与刷新操作，Go 编辑器的运行菜单增加“编辑运行/调试配置”入口。

## 0.4.0

- 新增 GoLand 风格的 `launch.json` 可视化运行/调试配置编辑器，支持配置新增、复制、删除、排序和 Go `launch` / `attach` / `exec` 常用字段。
- 支持工作目录、程序路径、构建参数、程序参数、环境变量、`preLaunchTask`、远程附加配置，以及直接运行或调试。
- 提供原始 JSONC 编辑页和普通文本编辑器入口；表单保存会保留未知字段，并在非结构性修改时保留原有注释。
- 自定义编辑器保持为可选打开方式，不强制替换 VS Code 默认的 `launch.json` 文本编辑器。

## 0.3.0

- 内置 GoLand 风格 Bookmarks 工具窗口，支持匿名与数字/字母助记书签、文件/目录书签、多列表管理、拖放、描述和断点汇总。
- 书签按工作区持久化，代码编辑、工作区文件重命名和外部文件行位移后自动跟随或重新定位。
- GoLand Keymap Profile 启用 `F11`、`Ctrl+F11`、`Ctrl+Shift+0` 至 `Ctrl+Shift+9`、`Shift+F11`、`Alt+2` 和 `Ctrl+0` 至 `Ctrl+9` 等平台对应快捷键。
- 修复 Bookmarks Activity Bar 容器 ID 不符合 VS Code 规则，导致 `Alt+2` 报命令不存在的问题。

## 0.2.9

- 移除 VS Code 未注册的 `editor.lineNumbersMinChars` 默认设置，修复启动和 F5 调试时的 `Cannot convert undefined or null to object` 错误。
- 为 `go.coverageDecorator` 提供完整对象默认值，兼容 Go 扩展在 VS Code 1.135 中的配置读取。

## 0.2.8

- 新增 Marketplace 图标，使用 OriginBlueprint 应用图标。
- 核心扩展包收敛为官方 Go、微软简体中文包和两套 JetBrains 风格图标主题。
- 移除 Todo Tree、Error Lens、Buf、REST Client、Makefile、YAML/TOML 与 EditorConfig 的自动安装和默认配置，避免可选第三方扩展影响启动、调试和语言服务。
- 删除当前 VS Code 不支持作为配置默认值的窗口设置，减少启动告警。

## 0.2.7

- 默认恢复 VS Code 原生快捷键，不再随核心扩展包安装或覆盖 IntelliJ/GoLand Keybindings。
- 新增 `jetbrains-style-go-goland-keymap.code-profile`，需要 GoLand 键位时可单独导入。

## 0.2.6

- 固定 `F12` 为跳转定义，并将 Ctrl+单击所需的多光标修饰键设为 `Alt`，避免与跳转操作冲突。
- 新增“Goland Style: 修复 Go 跳转（gopls）”命令：检测工作区信任和 Go 语言服务开关，并在安全条件满足时重启 gopls。
- Restricted Mode 提示明确说明其会禁用 Ctrl+鼠标、F12/Ctrl+B 的定义跳转。

## 0.2.5

- 按最新对比截图将代码字号从 `13` 小幅提高到 `13.5`，行高保持 `21` 不变。
- 新增主构建脚本 `Goland Style.bat`，原 `build.bat` 保留为兼容入口；构建标题、提示和最终 VSIX 产物名统一为 `Goland Style` / `Goland-Style.vsix`。
- 同步更新 Windows/Linux 安装脚本和 GitHub CI/Release 产物名称。

## 0.2.4

- 随扩展附带 JetBrains Mono 2.304 的常规、粗体、斜体和粗斜体，并新增需用户确认的一键安装命令。
- 将字体族名称调整为官方的 `JetBrains Mono`，避免字体未识别时静默回退到 Consolas。
- 关闭 Project 树竖向缩进线，并启用 Go 测试文件专用图标，使目录树更接近 GoLand。

## 0.2.3

- 将扩展、命令分类和共享 Profile 的用户可见名称统一改为 `Goland Style`。
- 保留原有扩展 ID 和产物文件名，确保已安装版本能够直接升级。

## 0.2.2

- 首次启动或升级时自动应用当前版本的 GoLand 风格设置，避免旧用户配置继续覆盖字号、图标和布局。
- 关闭中文字符的 Unicode 黄色高亮框，以及与 GoLand 不一致的彩虹括号。
- 收窄行号栏，并补充编辑器顶部/底部留白。
- 在 Restricted Mode 下提示其对 `gopls` 语义颜色、重构和 CodeLens 的影响。

## 0.2.1

- 按新 GoLand/VS Code 对比截图将窗口缩放改为 `0`，代码字号改为 `13`，行高改为 `21`。
- 将 Project 树缩进收紧到 `16`，隐藏 Breadcrumbs、Tree Sticky Scroll 和默认右侧栏。
- 将当前行颜色修正为 `#1F2024`，并统一聚焦/未聚焦活动页签颜色。
- 新增可撤销的“应用 GoLand 风格设置”命令，解决已有 VS Code 用户设置覆盖扩展默认值的问题。

## 0.2.0

- 将 Microsoft 简体中文语言包加入核心扩展依赖。
- 补充 EditorConfig、YAML、TOML、Protobuf/Buf、REST Client、TODO Tree 和 Makefile Tools。
- 新增 Full Profile，按需覆盖数据库、容器、远程 SSH、Kubernetes、Git 历史、GitHub PR、XML 和拼写检查。
- 新增 GoLand 功能覆盖矩阵，以及构建、覆盖率、代码生成和性能 profile 项目任务。

## 0.1.0

- 提供非官方 JetBrains New UI 深色和浅色主题。
- 集成官方 Go 插件、IntelliJ IDEA Keybindings 和 Error Lens。
- 提供接近 GoLand 的编辑器、导航、格式化、检查和 Inlay Hints 默认配置。
- 提供常用 Go Live Templates、共享 Profile 和调试/任务模板。
