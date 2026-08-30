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
const requiredExtensions = [
  "MS-CEINTL.vscode-language-pack-zh-hans",
  "EditorConfig.EditorConfig",
  "bufbuild.vscode-buf",
  "golang.go",
  "gruntfuggly.todo-tree",
  "humao.rest-client",
  "ms-vscode.makefile-tools",
  "redhat.vscode-yaml",
  "tamasfe.even-better-toml",
  "usernamehw.errorlens",
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
  "streetsidesoftware.code-spell-checker",
];

requireValue(manifest.name === "jetbrains-style-go-vscode", "扩展名称不正确");
requireValue(manifest.publisher === "goland-style", "Publisher ID 必须为 goland-style");
requireValue(Array.isArray(manifest.extensionPack), "extensionPack 必须是数组");
for (const extensionId of requiredExtensions) {
  requireValue(
    manifest.extensionPack.includes(extensionId),
    `extensionPack 缺少 ${extensionId}`,
  );
}

requireValue(defaults && typeof defaults === "object", "缺少默认配置");
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
requireValue(defaults["window.zoomLevel"] === 0, "截图基准窗口缩放应为 0");
requireValue(defaults["workbench.tree.indent"] === 16, "Project 树缩进应为 16");
requireValue(
  defaults["workbench.tree.renderIndentGuides"] === "none",
  "Project 树不应显示竖向缩进线",
);
requireValue(
  defaults["jetbrains-file-icon-theme.enableGoTestIcons"] === true,
  "应启用 Go 测试文件专用图标",
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
requireValue(defaults["editor.lineNumbersMinChars"] === 3, "行号栏宽度应为 3");
requireValue(
  defaults["[yaml]"]?.["editor.defaultFormatter"] === "redhat.vscode-yaml",
  "YAML 默认格式化器不正确",
);
requireValue(
  defaults["[toml]"]?.["editor.defaultFormatter"] ===
    "tamasfe.even-better-toml",
  "TOML 默认格式化器不正确",
);
requireValue(
  defaults["[proto]"]?.["editor.defaultFormatter"] === "bufbuild.vscode-buf",
  "Proto 默认格式化器不正确",
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
requireValue(darkTheme.colors["editor.lineHighlightBackground"] === "#1F2024", "当前行颜色未匹配新截图");

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
  JSON.stringify(profileSettings) === JSON.stringify(defaults),
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
  JSON.stringify(fullProfileSettings) === JSON.stringify(defaults),
  "Full Profile 设置与扩展默认配置不同步",
);
for (const extensionId of [...requiredExtensions, ...fullProfileExtensions]) {
  requireValue(
    fullExtensions.some(({ identifier }) => identifier.id === extensionId),
    `Full Profile 缺少 ${extensionId}`,
  );
}

for (const relativePath of [
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

console.log(
  `校验通过：${themes.length} 个主题、${manifest.extensionPack.length} 个核心扩展依赖、${fullExtensions.length} 个 Full Profile 扩展、${Object.keys(snippets).length} 个 Go 模板。`,
);
