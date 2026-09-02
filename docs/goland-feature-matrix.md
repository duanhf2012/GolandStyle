# GoLand 功能覆盖矩阵

本项目以 GoLand 的日常 Go 开发工作流为目标，不宣称复制 JetBrains 的专有实现。核心只使用 VS Code 内置能力、官方 Go 扩展、微软简体中文包和两套视觉图标主题；其他第三方工具不自动安装。

## 核心 Profile（默认扩展包）

| GoLand 能力 | VS Code 对应实现 | 状态 |
| --- | --- | --- |
| 简体中文界面 | Microsoft `vscode-language-pack-zh-hans` | 已包含；首次安装后运行“配置显示语言”并选择 `zh-cn` |
| Project 文件树、搜索、结构视图 | VS Code Explorer、Search、Outline、Breadcrumbs | 内置；主题已校准颜色、缩进和选中态 |
| Go 语义高亮、补全、导航、查找引用 | 官方 Go 扩展 + `gopls` | 已包含 |
| Rename、Extract、Inline、Quick Fix | 官方 Go 扩展 + `gopls` Code Actions | 已包含；具体重构范围随 `gopls` 演进 |
| Inspection、静态分析 | `gopls` diagnostics + staticcheck | 已包含 |
| 参数名、类型等 Inlay Hints | `gopls` inlay hints | 已包含并默认开启 |
| 格式化、优化 import | `gofumpt` + `goimports` 能力 | 已配置为保存时执行 |
| Run/Debug、断点、变量、调用栈 | 官方 Go 扩展 + Delve + 本扩展的 `launch.json` 可视化配置编辑器 | 已包含；原生 Run and Debug 侧栏显示配置列表和运行/调试按钮，支持 Go 常用字段与原始 JSONC |
| Test、子测试、Benchmark、Coverage | 官方 Go 扩展 Test Explorer + 项目任务 | 已包含 |
| Live Templates | 本扩展的 Go snippets | 已包含 |
| Bookmarks | 本扩展的 Bookmarks 工具窗口、行号栏装饰和工作区持久化 | 已包含；支持匿名/助记书签、文件与目录、多列表、断点汇总及 GoLand Keymap 快捷键 |
| 快捷键 | VS Code 原生快捷键 | 默认使用；可导入单独 GoLand Keymap Profile |
| `.editorconfig` | EditorConfig | 按项目需要单独安装 |
| YAML、JSON Schema、Kubernetes Schema | Red Hat YAML；JSON 由 VS Code 内置 | 按项目需要单独安装 |
| TOML | Even Better TOML / Taplo | 按项目需要单独安装 |
| Protocol Buffers | Buf：补全、导航、格式化、诊断和生成命令 | 按项目需要单独安装 |
| GoLand HTTP Client | REST Client：`.http` / `.rest` 请求、环境变量和历史 | 按项目需要单独安装 |
| TODO 工具窗口 | Todo Tree | 不推荐随核心安装；存在兼容性风险 |
| Makefile 目标和构建 | Microsoft Makefile Tools | 按项目需要单独安装 |
| Git 提交、分支、合并、差异、时间线 | VS Code 内置 Source Control、Merge Editor、Timeline | 核心 Profile 使用内置能力 |
| 终端、任务、问题窗口 | VS Code Terminal、Tasks、Problems | 内置 |

## Full Profile（按需导入）

`profile/jetbrains-style-go-full.code-profile` 仅在用户主动导入时，在核心能力之上增加下列重型或连接型功能：

| GoLand 能力 | 扩展 | 说明 |
| --- | --- | --- |
| Git blame、文件/行历史、交互式历史图 | GitLens | Community 基础能力免费；部分图形、私有仓库和协作能力需要 GitKraken 账号或 Pro |
| GitHub PR 与 Issue | GitHub Pull Requests | 需要登录 GitHub；非 GitHub 仓库可忽略 |
| 容器管理、Dockerfile/Compose | Microsoft Container Tools | 需要本机 Docker 或 Podman |
| 容器开发环境 | Microsoft Dev Containers | 需要受支持的容器运行时 |
| 远程主机开发 | Microsoft Remote - SSH | 需要 SSH 客户端和目标主机权限 |
| Kubernetes、Helm | Microsoft Kubernetes | 需要或可由扩展安装 `kubectl` / `helm` |
| 数据库浏览、查询、历史 | SQLTools | 已附 MySQL/MariaDB/TiDB、PostgreSQL/CockroachDB、SQLite 驱动；连接凭据由扩展管理 |
| XML | Red Hat XML | 补全、校验、格式化和导航 |
| 拼写检查 | Code Spell Checker | 对注释、字符串和标识符提供额外检查，可能需要按项目维护词典 |

这些扩展不会随 VSIX 默认自动安装，因为它们可能需要账号、外部服务、数据库凭据、Docker/SSH/Kubernetes 权限，或引入额外侧边栏和后台进程。

## 可选工具策略

- Goland Style 不再自动安装 Todo Tree、Error Lens、Buf、REST Client、Makefile、YAML/TOML 或 EditorConfig。
- 需要这些能力时，在项目实际使用对应文件、服务或工具链后，再从扩展市场单独安装；这样单个插件失败不会影响基础 Go 开发和调试。

## 不重复安装的能力

- 不额外安装 Go Test Adapter、Go Outline、Go Doc、Go Debug 等旧插件：官方 `golang.go` 已提供对应能力，重复语言服务容易产生诊断、格式化和快捷键冲突。
- 不默认安装 Tooltitude：它的 CodeLens、Inspection、Postfix Completion 很接近 GoLand，但与 `gopls` 有部分重叠，且部分能力为 Premium。需要时可以单独评估。
- 不绑定某个 AI 编程助手：Copilot、Cursor、Trae 或其他助手涉及账号、付费和数据策略，不属于稳定的 Go 工具链基线。

## 平台级差异

以下能力无法由普通 VS Code 扩展完整复制：GoLand 专有重构 UI、Database Tools 的全部对象编辑器、内置 Profiler 的统一界面、圆角工具窗口、Project 树独立字体/行高，以及 JetBrains 自己的索引和检查实现。

性能分析仍可使用 Go 原生工具：模板任务能生成 CPU/内存 profile，再通过 `go tool pprof` 分析。Go SDK、Git、Docker、SSH、数据库服务等外部程序不会被打包进 VSIX。
