# Goland Style

一个面向 Go 开发的 VS Code 扩展包，尽量复现 GoLand New UI 的操作习惯和视觉风格。项目为非官方实现，与 JetBrains s.r.o. 没有关联。

## 已包含的体验

- 按参考截图校准的深色主题：编辑器和 Project 树背景 `#191A1C`、目录选中项 `#33353B`、活动页签 `#233558`、当前行 `#27282B`；
- JetBrains Mono 优先，基准字号 `13`、行高 `21`、字距 `0`、窗口缩放 `0`；
- JetBrains New UI 风格的文件图标和产品图标；
- 默认保留 VS Code 原生快捷键：`F12` 跳转定义、`Shift+F12` 查找引用、`F2` 重命名、`Ctrl+.` 快速修复；可按需导入单独的 GoLand Keymap Profile；
- 官方 Go 插件、`gopls`、Delve 调试、Test Explorer、Benchmark 和覆盖率能力；
- GoLand 风格的语义色、Inlay Hints、Error Lens、格式化保存和自动整理 import；
- 微软官方简体中文语言包，以及 EditorConfig、YAML、TOML、Protobuf、HTTP Client、TODO 和 Makefile 支持；
- 常用 Go Live Templates，以及可复制到项目的调试和测试任务模板；
- 核心与 Full 两套可导入 Profile，避免污染用户已有的前端或其他语言配置。

扩展包会安装以下依赖：

- `golang.go`：官方 Go 语言支持；
- `MS-CEINTL.vscode-language-pack-zh-hans`：微软官方简体中文界面；
- `usernamehw.errorlens`：接近 JetBrains Inspection 的行内诊断；
- `fogio.jetbrains-file-icon-theme`：JetBrains New UI 文件图标；
- `fogio.jetbrains-product-icon-theme`：JetBrains New UI 产品图标；
- `EditorConfig.EditorConfig`：读取项目 `.editorconfig`；
- `redhat.vscode-yaml`、`tamasfe.even-better-toml`：配置文件补全、校验和格式化；
- `bufbuild.vscode-buf`：Protocol Buffers 语言支持和 Buf 命令；
- `humao.rest-client`：对应 GoLand HTTP Client 的 `.http` / `.rest` 工作流；
- `gruntfuggly.todo-tree`：TODO/FIXME 工具窗口；
- `ms-vscode.makefile-tools`：Makefile 目标和构建支持。

完整的 GoLand 功能映射、取舍和平台限制见 `docs/goland-feature-matrix.md`。

## 本地安装

要求：

- Visual Studio Code 1.94 或更高版本；
- Go 1.21 或更高版本；
- Node.js 22 或更高版本仅用于构建扩展；
- 推荐使用扩展内置命令 `Goland Style: 安装 JetBrains Mono 字体`。安装前会明确请求确认，字体仅安装到当前系统用户；未安装时 VS Code 会回退到 Consolas，字形不会与 GoLand 完全一致。

Windows：

```powershell
& '.\Goland Style.bat'
./scripts/install.ps1
```

`Goland Style.bat` 会自动按锁文件安装依赖、运行完整校验并生成 `dist/Goland-Style.vsix`。原 `build.bat` 作为兼容入口保留，执行结果相同。

Linux/macOS：

```bash
npm install
npm run package
sh ./scripts/install.sh
```

安装完成后，在 VS Code 中执行 `Profiles: Import Profile`，选择：

```text
profile/jetbrains-style-go.code-profile
```

使用独立 Profile 可以确保主题、布局、字号和扩展组合不受已有用户配置覆盖。首次打开 `.go` 文件时，官方 Go 插件会检查并提示安装兼容版本的 `gopls`、`dlv` 等工具。

默认 Profile 使用 VS Code 原生快捷键。若希望使用 `Ctrl+B` 跳转、`Shift+F6` 重命名等 GoLand/IntelliJ 按键，可改为导入：

```text
profile/jetbrains-style-go-goland-keymap.code-profile
```

该 Profile 会额外安装 `IntelliJ IDEA Keybindings`。两套按键不能同时启用；切回 VS Code 快捷键时，请在扩展面板禁用该 Keybindings 扩展，再导入默认 Profile。

如果直接安装 VSIX 到已有 Profile，扩展会在首次启动或升级后自动应用当前版本的主题、图标、紧凑菜单、目录密度、字号和 Go 设置，并提示重新加载。若系统未安装 JetBrains Mono，还会提示是否安装扩展内附的官方 2.304 字体文件。也可随时运行 `Goland Style: 应用 GoLand 风格设置`；扩展会保存首次应用前的全局设置，可通过 `Goland Style: 恢复应用前的设置` 撤销并停止后续自动应用。

为匹配 GoLand，默认关闭了中文等非 ASCII 字符的黄色 Unicode 高亮框和彩虹括号。若项目需要重点审计 Unicode 混淆字符，可以单独重新开启相应安全设置。

若顶部仍显示 `Restricted Mode`，请只在你信任该源码目录时选择 `Trust this folder`。受限模式会停用 `gopls`，因此 Ctrl+鼠标、`F12`、`Ctrl+B` 跳转定义、重构和 CodeLens 都无法工作。信任后可运行“`Goland Style: 修复 Go 跳转（gopls）`”来启用并重启语言服务；若仍提示缺少工具，再执行“`Go: Install/Update Tools`”安装 `gopls`。

简体中文语言包会随扩展包安装，但 VS Code 不允许普通扩展强制修改全局界面语言。首次使用请运行“配置显示语言”（`Configure Display Language`），选择 `中文（简体）/ zh-cn`，然后重启 VS Code。

需要接近 GoLand 全家桶的数据库、容器、远程 SSH、Kubernetes、Git 历史和 GitHub PR 能力时，改为导入：

```text
profile/jetbrains-style-go-full.code-profile
```

Full Profile 会安装需要账号、外部程序或连接权限的扩展；不使用这些功能时建议保留核心 Profile。

## 给 Go 项目使用统一配置

将 `templates/.vscode` 复制到目标 Go 仓库根目录，可共享：

- `settings.json`：Go 格式化、静态检查、Inlay Hints；
- `launch.json`：调试当前 Package 或测试；
- `tasks.json`：构建、生成代码、普通测试、竞态检测、覆盖率、Benchmark、Vet 和 CPU/内存 profile；
- `extensions.json`：团队插件推荐。

如果团队不希望强制视觉偏好，可以只提交 `launch.json`、`tasks.json` 和 Go 相关的 `settings.json` 字段。

## 视觉基准

深色主题以 GoLand New UI 截图为基准，主要值如下：

| 区域 | 配置 |
| --- | --- |
| 编辑器和 Project 树背景 | `#191A1C` |
| 顶部栏和 Activity Bar | `#26282C` |
| Project 树选中项 | `#33353B` |
| 活动页签 | `#233558`，顶部强调线 `#456EC0` |
| 当前行 | `#1F2024` |
| 普通代码 | `#BCBEC4` |
| 关键字 | `#CF8E6D` |
| 字符串 | `#6AAB73` |
| 数字 | `#2AACB8` |
| 函数声明 | `#56A8F5` |
| 函数调用 | `#B09D79` |
| 类型 | `#6FAFBD` |
| Inlay Hint | 前景 `#858A94`，背景 `#2A2C30` |

截图对应的排版基线为：

```json
{
  "window.zoomLevel": 0,
  "editor.fontFamily": "'JetBrains Mono', JetBrainsMono, Consolas, 'Courier New', monospace",
  "editor.fontSize": 13.5,
  "editor.lineHeight": 21,
  "editor.fontWeight": "400",
  "editor.letterSpacing": 0,
  "editor.fontLigatures": true
}
```

新基线来自同一台显示环境下的新一组 GoLand/VS Code 对比截图。`window.zoomLevel: 0` 负责缩小目录、页签和菜单，`13.5px / 21px` 单独校准代码字号和行距。显示器 DPI 和操作系统缩放仍会影响实际物理大小。

GoLand 2026.2 的本机配置使用默认字体方案，JetBrains Mono 来自 GoLand 自带的 JetBrains Runtime，不会自动注册为 Windows 系统字体。因此仅在 VS Code 设置中填写字体名称还不够，必须先将字体安装到系统。扩展附带的字体文件遵循 `assets/fonts/OFL.txt` 中的 SIL Open Font License 1.1。

## VS Code 平台限制

VS Code 官方主题 API 无法完整复刻以下 GoLand 界面细节：

- Project 面板、编辑器区域和工具窗口的大圆角容器；
- 独立设置 Project 树的字体、字号和精确行高；
- 将内置 Explorer 标题改为 Project，或隐藏单目录工作区的根节点；
- GoLand 专有的工具窗口布局、重构界面和数据库工具。

本项目不会通过修改 VS Code 安装文件或注入 Custom CSS 实现这些效果，因为这种方式会破坏完整性校验，并且容易在 VS Code 更新后失效。当前实现覆盖官方扩展 API 能稳定控制的颜色、图标、缩放、编辑器排版、快捷键和 Go 工具链行为。

## 开发与校验

```bash
npm ci
npm test
npm run package
```

生成物：

```text
dist/Goland-Style.vsix
profile/jetbrains-style-go.code-profile
profile/jetbrains-style-go-full.code-profile
```

`npm test` 会重新生成两套 Profile，并检查核心/完整扩展依赖、主题文件、参考色、字体参数、Snippet 和项目模板。

## 发布

完整的 Marketplace 发布步骤见项目中的 `docs/publishing.md`。简要流程是：先创建 Publisher 并将其 ID 与 `package.json` 的 `publisher` 保持一致，再使用 `vsce login` 或 `VSCE_PAT` 完成认证，最后执行 `npm run publish`。

Publisher ID 已统一为 `goland-style`，完整扩展标识为 `goland-style.jetbrains-style-go-vscode`；扩展的 `name` 和 Publisher ID 一旦发布，不要再修改。

在 GitHub 创建仓库并推送当前项目后，可以创建 `v*` Tag，让 GitHub Actions 自动生成 Release；配置 `VSCE_PAT` Secret 后，Marketplace 工作流也会自动发布。

手工打 Tag 示例：

```bash
git tag v0.2.0
git push origin v0.2.0
```

## 商标与许可证

项目代码采用 MIT License，完整条款见 `LICENSE`。GoLand、IntelliJ IDEA、JetBrains 和 JetBrains Mono 是其各自权利人的商标或资产名称；这些名称仅用于描述兼容目标。本项目不包含 GoLand 源码、专有主题文件或专有图标资源，第三方扩展分别遵循其自身许可证和隐私政策。
