# Changelog

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
