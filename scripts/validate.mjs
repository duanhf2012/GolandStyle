import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");

async function readJson(relativePath) {
  const fullPath = path.join(projectDirectory, relativePath);
  return JSON.parse(await readFile(fullPath, "utf8"));
}

function requireValue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const manifest = await readJson("package.json");
const defaults = manifest.contributes?.configurationDefaults;
const runtimeSettings = manifest.golandStyle?.runtimeSettings;
const profileDefaults = { ...defaults, ...runtimeSettings };

for (const setting of [
  "search.useIgnoreFiles",
  "search.useParentIgnoreFiles",
  "search.useGlobalIgnoreFiles",
]) {
  requireValue(
    defaults?.[setting] === false,
    `${setting} 必须关闭，确保 Ctrl+P 可查找工程目录中的 Git 忽略文件`,
  );
}
const requiredExtensions = [
  "MS-CEINTL.vscode-language-pack-zh-hans",
  "golang.go",
  "fogio.jetbrains-file-icon-theme",
  "fogio.jetbrains-product-icon-theme",
];
const fullProfileExtensions = [
  "eamodio.gitlens",
  "github.vscode-pull-request-github",
  "ms-azuretools.vscode-containers",
  "ms-kubernetes-tools.vscode-kubernetes-tools",
  "ms-vscode-remote.remote-containers",
  "ms-vscode-remote.remote-ssh",
  "mtxr.sqltools",
  "mtxr.sqltools-driver-mysql",
  "mtxr.sqltools-driver-pg",
  "mtxr.sqltools-driver-sqlite",
  "redhat.vscode-xml",
];

requireValue(manifest.name === "jetbrains-style-go-vscode", "扩展名称不正确");
requireValue(manifest.publisher === "goland-style", "Publisher ID 必须为 goland-style");
requireValue(/^\d+\.\d+\.\d+$/.test(manifest.version), "版本号必须符合 SemVer");
requireValue(manifest.icon === "assets/icon.png", "Marketplace 图标路径不正确");
requireValue(Array.isArray(manifest.extensionPack), "extensionPack 必须是数组");
for (const extensionId of requiredExtensions) {
  requireValue(
    manifest.extensionPack.includes(extensionId),
    `extensionPack 缺少 ${extensionId}`,
  );
}

const bookmarkCommandIds = [
  "jetbrainsStyleGo.bookmarks.toggle",
  "jetbrainsStyleGo.bookmarks.toggleMnemonic",
  "jetbrainsStyleGo.bookmarks.show",
  "jetbrainsStyleGo.bookmarks.next",
  "jetbrainsStyleGo.bookmarks.previous",
  "jetbrainsStyleGo.bookmarks.nextInEditor",
  "jetbrainsStyleGo.bookmarks.previousInEditor",
  "jetbrainsStyleGo.bookmarks.openView",
  "jetbrainsStyleGo.bookmarks.createList",
  "jetbrainsStyleGo.bookmarks.bookmarkOpenTabs",
  ...Array.from({ length: 10 }, (_, digit) => `jetbrainsStyleGo.bookmarks.toggle${digit}`),
  ...Array.from({ length: 10 }, (_, digit) => `jetbrainsStyleGo.bookmarks.goTo${digit}`),
];
const contributedCommands = manifest.contributes?.commands ?? [];
for (const commandId of [
  "jetbrainsStyleGo.usages.find",
  "jetbrainsStyleGo.usages.refresh",
  "jetbrainsStyleGo.usages.clear",
  "jetbrainsStyleGo.runConfigurations.open",
  "jetbrainsStyleGo.runConfigurations.refresh",
  "jetbrainsStyleGo.runConfigurations.editItem",
  "jetbrainsStyleGo.runConfigurations.runItem",
  "jetbrainsStyleGo.runConfigurations.debugItem",
]) {
  requireValue(
    contributedCommands.some(({ command }) => command === commandId),
    `缺少运行配置命令 ${commandId}`,
  );
}
requireValue(
  manifest.activationEvents?.includes("onCommand:jetbrainsStyleGo.usages.find") &&
    manifest.activationEvents?.includes("onView:jetbrainsStyleGo.findUsagesView"),
  "缺少查找用法命令或工具窗口激活事件",
);
const findUsagesContainer = manifest.contributes?.viewsContainers?.panel?.find(
  ({ id }) => id === "jetbrainsStyleGo-usages",
);
requireValue(findUsagesContainer, "查找用法必须位于底部 Panel 工具窗口");
requireValue(
  manifest.contributes?.views?.["jetbrainsStyleGo-usages"]?.some(
    ({ id }) => id === "jetbrainsStyleGo.findUsagesView",
  ),
  "缺少 GoLand 风格查找用法树",
);
const runConfigurationEditor = manifest.contributes?.customEditors?.find(
  ({ viewType }) => viewType === "jetbrainsStyleGo.runConfigurationEditor",
);
requireValue(runConfigurationEditor, "缺少运行/调试配置自定义编辑器");
requireValue(
  runConfigurationEditor.priority === "option",
  "运行/调试配置编辑器必须保持为可选编辑器，不能强制接管 launch.json",
);
requireValue(
  runConfigurationEditor.selector?.some(
    ({ filenamePattern }) => filenamePattern === "**/.vscode/launch.json",
  ),
  "运行/调试配置编辑器未关联 .vscode/launch.json",
);
requireValue(
  manifest.activationEvents?.includes(
    "onCustomEditor:jetbrainsStyleGo.runConfigurationEditor",
  ),
  "缺少运行/调试配置编辑器激活事件",
);
requireValue(
  manifest.activationEvents?.includes("onView:jetbrainsStyleGo.runConfigurationsView"),
  "缺少运行配置侧栏激活事件",
);
requireValue(
  manifest.contributes?.views?.debug?.some(
    ({ id }) => id === "jetbrainsStyleGo.runConfigurationsView",
  ),
  "运行配置列表必须位于 VS Code 原生 Run and Debug 侧栏",
);
const contributionMenus = manifest.contributes?.menus ?? {};
requireValue(
  contributedCommands.some(({ command }) => command === "jetbrainsStyleGo.copyReference"),
  "缺少复制代码引用命令",
);
requireValue(
  manifest.contributes?.keybindings?.some(
    ({ key, command, when }) =>
      key === "alt+f7" &&
      command === "jetbrainsStyleGo.usages.find" &&
      when?.includes("editorLangId == go"),
  ),
  "查找用法快捷键必须匹配 GoLand 的 Alt+F7",
);
requireValue(
  manifest.contributes?.keybindings?.some(
    ({ key, command, when }) =>
      key === "alt+f7" &&
      command === "-references-view.findReferences" &&
      when === "editorHasReferenceProvider",
  ),
  "必须移除 IntelliJ Keybindings 对 Alt+F7 的原生引用绑定",
);
requireValue(
  manifest.contributes?.keybindings?.some(
    ({ key, command, when }) =>
      key === "shift+alt+f7" &&
      command === "references-view.findReferences" &&
      when?.includes("editorHasReferenceProvider"),
  ),
  "Shift+Alt+F7 必须保留 VS Code 原生查找所有引用",
);
for (const { key, command } of [
  { key: "enter", command: "-workbench.action.terminal.findPrevious" },
  { key: "shift+enter", command: "-workbench.action.terminal.findNext" },
  { key: "enter", command: "workbench.action.terminal.findNext" },
  { key: "shift+enter", command: "workbench.action.terminal.findPrevious" },
]) {
  requireValue(
    manifest.contributes?.keybindings?.some(
      (binding) =>
        binding.key === key &&
        binding.command === command &&
        binding.when === "terminalFindInputFocused",
    ),
    `终端查找快捷键缺少 ${key} -> ${command}`,
  );
}
requireValue(
  contributionMenus["editor/context"]?.some(
    ({ command, when }) =>
      command === "jetbrainsStyleGo.usages.find" &&
      when?.includes("editorLangId == go"),
  ),
  "Go 编辑器右键菜单缺少查找用法入口",
);
for (const commandId of [
  "jetbrainsStyleGo.usages.find",
  "jetbrainsStyleGo.usages.refresh",
  "jetbrainsStyleGo.usages.clear",
]) {
  requireValue(
    contributionMenus["view/title"]?.some(
      ({ command, when }) =>
        command === commandId && when === "view == jetbrainsStyleGo.findUsagesView",
    ),
    `查找用法标题栏缺少 ${commandId}`,
  );
}
requireValue(
  manifest.contributes?.keybindings?.some(
    ({ key, mac, command, when }) =>
      key === "ctrl+alt+shift+c" &&
      mac === "cmd+alt+shift+c" &&
      command === "jetbrainsStyleGo.copyReference" &&
      when?.includes("editorTextFocus"),
  ),
  "复制代码引用快捷键未匹配 GoLand",
);
requireValue(
  manifest.contributes?.submenus?.some(
    ({ id, label }) =>
      id === "jetbrainsStyleGo.copyPasteSpecial" && label === "复制/粘贴特殊",
  ),
  "缺少复制/粘贴特殊子菜单",
);
requireValue(
  contributionMenus["editor/context"]?.some(
    ({ submenu }) => submenu === "jetbrainsStyleGo.copyPasteSpecial",
  ) &&
    contributionMenus["jetbrainsStyleGo.copyPasteSpecial"]?.some(
      ({ command }) => command === "jetbrainsStyleGo.copyReference",
    ),
  "编辑器右键菜单缺少复制引用入口",
);
requireValue(
  manifest.contributes?.submenus?.some(
    ({ id, label }) => id === "jetbrainsStyleGo.bookmarksMenu" && label === "书签",
  ) &&
    contributionMenus["editor/context"]?.some(
      ({ submenu }) => submenu === "jetbrainsStyleGo.bookmarksMenu",
    ),
  "编辑器右键菜单缺少书签子菜单",
);
for (const commandId of [
  "jetbrainsStyleGo.bookmarks.toggle",
  "jetbrainsStyleGo.bookmarks.toggleMnemonic",
  "jetbrainsStyleGo.bookmarks.show",
  "jetbrainsStyleGo.bookmarks.openView",
]) {
  requireValue(
    contributionMenus["jetbrainsStyleGo.bookmarksMenu"]?.some(
      ({ command }) => command === commandId,
    ),
    `书签子菜单缺少 ${commandId}`,
  );
}
requireValue(
  !contributionMenus["editor/context"]?.some(
    ({ command }) => command?.startsWith("jetbrainsStyleGo.bookmarks."),
  ),
  "书签命令不应继续占用编辑器顶层右键菜单",
);
requireValue(
  manifest.contributes?.submenus?.some(
    ({ id, label }) => id === "jetbrainsStyleGo.goToolsMenu" && label === "Go 工具",
  ) &&
    contributionMenus["editor/context"]?.some(
      ({ submenu, when }) =>
        submenu === "jetbrainsStyleGo.goToolsMenu" && when === "editorLangId == go",
    ),
  "Go 编辑器右键菜单缺少 Go 工具子菜单",
);
for (const commandId of [
  "jetbrainsStyleGo.go.addImport",
  "jetbrainsStyleGo.go.addTags",
  "jetbrainsStyleGo.go.toggleTestFile",
  "jetbrainsStyleGo.go.testAtCursor",
  "jetbrainsStyleGo.go.debugTestAtCursor",
]) {
  requireValue(
    contributedCommands.some(({ command }) => command === commandId) &&
      contributionMenus["jetbrainsStyleGo.goToolsMenu"]?.some(
        ({ command }) => command === commandId,
      ) &&
      contributionMenus.commandPalette?.some(
        ({ command, when }) => command === commandId && when === "false",
      ),
    `Go 工具子菜单缺少或重复暴露 ${commandId}`,
  );
}
requireValue(
  contributionMenus["view/title"]?.some(
    ({ command, when }) =>
      command === "jetbrainsStyleGo.runConfigurations.open" &&
      when === "view == jetbrainsStyleGo.runConfigurationsView",
  ),
  "运行配置列表标题栏缺少编辑入口",
);
for (const commandId of [
  "jetbrainsStyleGo.runConfigurations.runItem",
  "jetbrainsStyleGo.runConfigurations.debugItem",
]) {
  requireValue(
    contributionMenus["view/item/context"]?.some(
      ({ command, when, group }) =>
        command === commandId &&
        when?.includes("viewItem == runConfiguration") &&
        group?.startsWith("inline"),
    ),
    `运行配置列表缺少内联操作 ${commandId}`,
  );
}
requireValue(
  contributionMenus["editor/title/run"]?.some(
    ({ command }) => command === "jetbrainsStyleGo.runConfigurations.open",
  ),
  "Go 编辑器运行菜单缺少运行配置入口",
);
requireValue(
  manifest.contributes?.viewsWelcome?.some(
    ({ view, contents }) =>
      view === "jetbrainsStyleGo.runConfigurationsView" &&
      contents.includes("jetbrainsStyleGo.runConfigurations.open"),
  ),
  "空运行配置列表缺少创建入口",
);
requireValue(
  manifest.dependencies?.["jsonc-parser"],
  "运行/调试配置编辑器必须包含 jsonc-parser 运行时依赖",
);
for (const commandId of bookmarkCommandIds) {
  requireValue(
    contributedCommands.some(({ command }) => command === commandId),
    `缺少书签命令 ${commandId}`,
  );
}
const bookmarkConfiguration = manifest.contributes?.configuration?.properties;
requireValue(
  bookmarkConfiguration?.["golandStyle.bookmarks.golandKeybindings"]?.default === true,
  "安装扩展后必须默认启用 GoLand 书签快捷键",
);
const bookmarkKeybindings = manifest.contributes?.keybindings ?? [];
for (const [key, command] of [
  ["shift+alt+b", "jetbrainsStyleGo.bookmarks.toggle"],
  ["ctrl+f11", "jetbrainsStyleGo.bookmarks.toggleMnemonic"],
  ["shift+f11", "jetbrainsStyleGo.bookmarks.show"],
  ["alt+2", "jetbrainsStyleGo.bookmarks.openView"],
]) {
  requireValue(
    bookmarkKeybindings.some(
      (binding) =>
        binding.key === key &&
        binding.command === command &&
        binding.when?.includes("golandStyle.bookmarks.golandKeybindings"),
    ),
    `GoLand 书签快捷键 ${key} 未正确注册`,
  );
}
requireValue(
  !bookmarkKeybindings.some(
    ({ key, command }) =>
      key === "f11" && command.startsWith("jetbrainsStyleGo.bookmarks."),
  ),
  "书签功能不得占用调试单步进入使用的 F11",
);
for (let digit = 0; digit <= 9; digit += 1) {
  requireValue(
    bookmarkKeybindings.some(
      ({ key, command, when }) =>
        key === `ctrl+shift+[Digit${digit}]` &&
        command === `jetbrainsStyleGo.bookmarks.toggle${digit}` &&
        when?.includes("editorTextFocus"),
    ),
    `缺少数字书签切换快捷键 Ctrl+Shift+${digit}`,
  );
  requireValue(
    bookmarkKeybindings.some(
      ({ key, command }) =>
        key === `ctrl+[Digit${digit}]` &&
        command === `jetbrainsStyleGo.bookmarks.goTo${digit}`,
    ),
    `缺少数字书签快捷键 Ctrl+${digit}`,
  );
}
const bookmarkViewContainer = manifest.contributes?.viewsContainers?.activitybar?.find(
  ({ id }) => id === "jetbrainsStyleGo-bookmarks",
);
requireValue(bookmarkViewContainer, "缺少 Bookmarks Activity Bar 容器");
requireValue(
  /^[a-z0-9_-]+$/i.test(bookmarkViewContainer.id),
  "Bookmarks Activity Bar 容器 ID 只能包含字母、数字、下划线和连字符",
);
requireValue(
  manifest.contributes?.views?.["jetbrainsStyleGo-bookmarks"]?.some(
    ({ id }) => id === "jetbrainsStyleGo.bookmarksView",
  ),
  "缺少 Bookmarks 工具窗口",
);

requireValue(defaults && typeof defaults === "object", "缺少默认配置");
const extensionOwnedDefaults = Object.keys(defaults).filter(
  (key) =>
    key === "gopls" ||
    key.startsWith("go.") ||
    key === "[go]" ||
    key === "[go.mod]" ||
    key === "[go.work]",
);
requireValue(
  extensionOwnedDefaults.length === 0,
  `第三方扩展设置不能放入 configurationDefaults：${extensionOwnedDefaults.join(", ")}`,
);
requireValue(
  runtimeSettings && typeof runtimeSettings === "object",
  "缺少 Goland Style 运行时设置",
);
requireValue(
  defaults["workbench.colorTheme"] === "JetBrains New UI Dark (Unofficial)",
  "默认主题不正确",
);
requireValue(
  defaults["workbench.iconTheme"] === "jetbrains-file-icon-theme-dark",
  "默认文件图标主题不正确",
);
requireValue(
  defaults["editor.fontFamily"].includes("JetBrainsMono"),
  "默认字体必须优先使用 JetBrains Mono",
);
requireValue(defaults["editor.fontSize"] === 13.5, "截图基准字号应为 13.5");
requireValue(defaults["editor.lineHeight"] === 21, "截图基准行高应为 21");
requireValue(
  defaults["terminal.integrated.scrollback"] === 100000,
  "集成终端必须保留足够日志行，方便查找上下文",
);
requireValue(defaults["window.zoomLevel"] === 0, "截图基准窗口缩放应为 0");
requireValue(defaults["window.commandCenter"] === true, "应启用顶部 Command Center");
requireValue(
  defaults["debug.toolBarLocation"] === "commandCenter",
  "调试工具栏应显示在顶部 Command Center",
);
requireValue(
  defaults["chat.disableAIFeatures"] === true,
  "应默认关闭内置 AI 功能以精简编辑器右键菜单",
);
requireValue(defaults["workbench.tree.indent"] === 16, "Project 树缩进应为 16");
requireValue(
  defaults["workbench.tree.renderIndentGuides"] === "none",
  "Project 树不应显示竖向缩进线",
);
requireValue(defaults["breadcrumbs.enabled"] === false, "应隐藏 Breadcrumbs");
requireValue(
  defaults["editor.unicodeHighlight.nonBasicASCII"] === false,
  "应关闭中文字符的非 ASCII 高亮框",
);
requireValue(
  defaults["editor.bracketPairColorization.enabled"] === false,
  "应关闭与 GoLand 不一致的彩虹括号",
);
requireValue(
  defaults["problems.decorations.enabled"] === false,
  "Project 树不应使用 Problems 警告颜色覆盖 GoLand 风格的 VCS 状态颜色",
);
requireValue(
  runtimeSettings.gopls?.["ui.diagnostic.staticcheck"] === false,
  "应默认关闭 Staticcheck 风格诊断，避免弱警告波浪线干扰阅读",
);
requireValue(
  runtimeSettings.gopls?.["ui.semanticTokenTypes"]?.namespace === false,
  "应关闭 gopls 的 namespace 语义覆盖，使 import 路径保持统一字符串颜色",
);
requireValue(
  runtimeSettings["[go]"]?.["editor.renderValidationDecorations"] === "off",
  "Go 编辑器应隐藏诊断波浪线",
);
const compactGoContextMenu = runtimeSettings["go.editorContextMenuCommands"];
for (const commandName of [
  "toggleTestFile",
  "addTags",
  "fillStruct",
  "testAtCursor",
  "addImport",
  "debugTestAtCursor",
  "removeTags",
  "implCursor",
  "testFile",
  "testPackage",
  "generateTestForFunction",
  "generateTestForFile",
  "generateTestForPackage",
  "testCoverage",
  "playground",
  "benchmarkAtCursor",
  "compilerDetails",
]) {
  requireValue(
    compactGoContextMenu?.[commandName] === false,
    `官方 Go 扩展顶层右键菜单应隐藏 ${commandName}`,
  );
}
requireValue(
  !Object.hasOwn(defaults, "editor.lineNumbersMinChars"),
  "editor.lineNumbersMinChars 未被 VS Code 注册，不能作为扩展默认配置",
);
const coverageDecorator = runtimeSettings["go.coverageDecorator"];
requireValue(
  coverageDecorator &&
    typeof coverageDecorator === "object" &&
    !Array.isArray(coverageDecorator),
  "go.coverageDecorator 必须提供对象默认值，避免 Go 扩展初始化失败",
);
const themes = manifest.contributes?.themes ?? [];
requireValue(themes.length === 2, "必须同时提供深色和浅色主题");
for (const themeContribution of themes) {
  const themePath = themeContribution.path.replace(/^\.\//, "");
  const theme = await readJson(themePath);
  requireValue(theme.name === themeContribution.label, `${themePath} 名称不匹配`);
  requireValue(theme.semanticHighlighting === true, `${themePath} 未启用语义高亮`);
}

const darkTheme = await readJson("themes/jetbrains-new-ui-dark-color-theme.json");
requireValue(darkTheme.colors["editor.background"] === "#191A1C", "编辑器背景未匹配截图");
requireValue(darkTheme.colors["sideBar.background"] === "#191A1C", "Project 树背景未匹配截图");
requireValue(darkTheme.colors["list.activeSelectionBackground"] === "#33353B", "目录选中色未匹配截图");
requireValue(darkTheme.colors["tab.activeBackground"] === "#233558", "活动页签色未匹配截图");
for (const themePath of [
  "themes/jetbrains-new-ui-dark-color-theme.json",
  "themes/jetbrains-new-ui-light-color-theme.json",
]) {
  const theme = await readJson(themePath);
  for (const colorId of [
    "terminal.findMatchBackground",
    "terminal.findMatchBorder",
    "terminal.findMatchHighlightBackground",
    "terminal.findMatchHighlightBorder",
    "terminalOverviewRuler.findMatchForeground",
  ]) {
    requireValue(theme.colors[colorId], `${themePath} 缺少 ${colorId}`);
  }
  requireValue(
    theme.colors["terminal.findMatchBackground"] !==
      theme.colors["terminal.findMatchHighlightBackground"],
    `${themePath} 当前命中与其他命中必须使用不同颜色`,
  );
}
requireValue(darkTheme.colors["editor.lineHighlightBackground"] === "#1F2024", "当前行颜色未匹配新截图");
requireValue(darkTheme.semanticTokenColors.string === "#6A8759", "GoLand 导入字符串颜色未匹配截图");
requireValue(darkTheme.semanticTokenColors.number === "#6897BB", "GoLand 数字颜色未匹配截图");
requireValue(
  darkTheme.semanticTokenColors["variable.readonly"]?.foreground === "#9876AA" &&
    darkTheme.semanticTokenColors["variable.readonly"]?.fontStyle === "italic",
  "GoLand 常量标识符颜色或样式未匹配截图",
);

const snippets = await readJson("snippets/go.json");
for (const [name, snippet] of Object.entries(snippets)) {
  requireValue(snippet.prefix, `Snippet ${name} 缺少 prefix`);
  requireValue(Array.isArray(snippet.body), `Snippet ${name} 的 body 必须是数组`);
}

const profile = await readJson("profile/jetbrains-style-go.code-profile");
const settingsPayload = JSON.parse(profile.settings);
const profileSettings = JSON.parse(settingsPayload.settings);
const profileExtensions = JSON.parse(profile.extensions);
requireValue(
  JSON.stringify(profileSettings) === JSON.stringify(profileDefaults),
  "Profile 设置与扩展默认配置不同步",
);
requireValue(
  profileExtensions.some(({ identifier }) => identifier.id === "golang.go"),
  "Profile 缺少官方 Go 插件",
);

const fullProfile = await readJson("profile/jetbrains-style-go-full.code-profile");
const fullSettingsPayload = JSON.parse(fullProfile.settings);
const fullProfileSettings = JSON.parse(fullSettingsPayload.settings);
const fullExtensions = JSON.parse(fullProfile.extensions);
requireValue(
  JSON.stringify(fullProfileSettings) === JSON.stringify(profileDefaults),
  "Full Profile 设置与扩展默认配置不同步",
);
for (const extensionId of [...requiredExtensions, ...fullProfileExtensions]) {
  requireValue(
    fullExtensions.some(({ identifier }) => identifier.id === extensionId),
    `Full Profile 缺少 ${extensionId}`,
  );
}
requireValue(
  !fullExtensions.some(
    ({ identifier }) => identifier.id === "streetsidesoftware.code-spell-checker",
  ),
  "Full Profile 不应包含会给 Go 标识符和 import 路径添加拼写波浪线的 Code Spell Checker",
);

const keymapProfile = await readJson(
  "profile/jetbrains-style-go-goland-keymap.code-profile",
);
const keymapSettingsPayload = JSON.parse(keymapProfile.settings);
const keymapProfileSettings = JSON.parse(keymapSettingsPayload.settings);
const keymapPayload = JSON.parse(keymapProfile.keybindings);
const keymapKeybindings = JSON.parse(keymapPayload.keybindings);
requireValue(
  keymapProfileSettings["golandStyle.bookmarks.golandKeybindings"] === true,
  "GoLand Keymap Profile 必须启用书签快捷键",
);
requireValue(keymapPayload.platform === 3, "GoLand Keymap Profile 必须标记为 Windows 键位");
requireValue(
  keymapKeybindings.some(
    ({ key, command, when }) =>
      key === "alt+left" &&
      command === "workbench.action.navigateBack" &&
      when === "canNavigateBack",
  ),
  "GoLand Keymap Profile 必须将返回绑定为 Alt+Left",
);
requireValue(
  keymapKeybindings.some(
    ({ key, command, when }) =>
      key === "alt+right" &&
      command === "workbench.action.navigateForward" &&
      when === "canNavigateForward",
  ),
  "GoLand Keymap Profile 必须将前进绑定为 Alt+Right",
);
requireValue(
  keymapKeybindings.some(
    ({ key, command, when }) =>
      key === "alt+left" &&
      command === "-workbench.action.previousEditor" &&
      when === "!terminalFocus",
  ),
  "GoLand Keymap Profile 必须移除 Alt+Left 的编辑器标签切换",
);
requireValue(
  keymapKeybindings.some(
    ({ key, command, when }) =>
      key === "alt+right" &&
      command === "-workbench.action.nextEditor" &&
      when === "!terminalFocus",
  ),
  "GoLand Keymap Profile 必须移除 Alt+Right 的编辑器标签切换",
);
requireValue(
  keymapKeybindings.some(
    ({ key, command, when }) =>
      key === "alt+f7" &&
      command === "jetbrainsStyleGo.usages.find" &&
      when?.includes("editorLangId == go"),
  ),
  "GoLand Keymap Profile 必须将 Alt+F7 绑定到查找用法",
);
requireValue(
  keymapKeybindings.some(
    ({ key, command, when }) =>
      key === "alt+f7" &&
      command === "-references-view.findReferences" &&
      when === "editorHasReferenceProvider",
  ),
  "GoLand Keymap Profile 必须移除 Alt+F7 的原生引用绑定",
);
requireValue(
  keymapKeybindings.some(
    ({ key, command, when }) =>
      key === "shift+alt+f7" &&
      command === "references-view.findReferences" &&
      when?.includes("editorHasReferenceProvider"),
  ),
  "GoLand Keymap Profile 必须将 Shift+Alt+F7 绑定到原生查找所有引用",
);

for (const relativePath of [
  "assets/icon.png",
  "assets/bookmark.svg",
  "assets/usages.svg",
  "bookmarks.js",
  "find-usages.js",
  "run-config-editor.js",
  "media/run-config-editor.css",
  "media/run-config-editor.js",
  "assets/fonts/JetBrainsMono-Regular.ttf",
  "assets/fonts/JetBrainsMono-Bold.ttf",
  "assets/fonts/JetBrainsMono-Italic.ttf",
  "assets/fonts/JetBrainsMono-BoldItalic.ttf",
  "assets/fonts/OFL.txt",
]) {
  await access(path.join(projectDirectory, relativePath));
}

for (const relativePath of [
  "templates/.vscode/settings.json",
  "templates/.vscode/extensions.json",
  "templates/.vscode/launch.json",
  "templates/.vscode/tasks.json",
]) {
  await access(path.join(projectDirectory, relativePath));
  await readJson(relativePath);
}

const runConfigWebviewScript = await readFile(
  path.join(projectDirectory, "media/run-config-editor.js"),
  "utf8",
);
requireValue(
  runConfigWebviewScript.includes('console: "integratedTerminal"') &&
    runConfigWebviewScript.includes("查找并保留上下文") &&
    runConfigWebviewScript.includes("筛选匹配行"),
  "运行配置编辑器必须默认使用集成终端，并说明不同控制台的查找行为",
);

const templateLaunch = await readJson("templates/.vscode/launch.json");
const localLaunchConfigurations = templateLaunch.configurations.filter(
  ({ type, request }) => type === "go" && request === "launch",
);
requireValue(
  localLaunchConfigurations.length > 0 &&
    localLaunchConfigurations.every(({ console }) => console === "integratedTerminal"),
  "项目模板中的本地 Go 启动配置必须默认输出到集成终端",
);

const templateSettings = await readJson("templates/.vscode/settings.json");
requireValue(
  templateSettings["terminal.integrated.scrollback"] === 100000 &&
    templateSettings.gopls?.["ui.diagnostic.staticcheck"] === false &&
    templateSettings.gopls?.["ui.semanticTokenTypes"]?.namespace === false &&
    templateSettings["[go]"]?.["editor.renderValidationDecorations"] === "off" &&
    templateSettings["go.editorContextMenuCommands"]?.addImport === false &&
    templateSettings["go.editorContextMenuCommands"]?.toggleTestFile === false &&
    templateSettings["go.editorContextMenuCommands"]?.playground === false,
  "项目模板的 gopls 诊断与 import 语义色设置未和扩展默认值同步",
);

console.log(
  `校验通过：${themes.length} 个主题、${manifest.extensionPack.length} 个核心扩展依赖、${fullExtensions.length} 个 Full Profile 扩展、${Object.keys(snippets).length} 个 Go 模板。`,
);
