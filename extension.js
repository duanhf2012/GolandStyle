const vscode = require("vscode");
const { access, copyFile, mkdir } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const { execFile: execFileCallback } = require("node:child_process");

const execFile = promisify(execFileCallback);

const backupKey = "settingsBackup";
const appliedVersionKey = "appliedSettingsVersion";
const automaticApplyDisabledKey = "automaticApplyDisabled";
const fontPromptedVersionKey = "fontPromptedVersion";
const bundledFonts = [
  ["JetBrainsMono-Regular.ttf", "JetBrains Mono (TrueType)"],
  ["JetBrainsMono-Bold.ttf", "JetBrains Mono Bold (TrueType)"],
  ["JetBrainsMono-Italic.ttf", "JetBrains Mono Italic (TrueType)"],
  ["JetBrainsMono-BoldItalic.ttf", "JetBrains Mono Bold Italic (TrueType)"],
];

function fontTargetDirectory() {
  if (process.platform === "win32") {
    if (!process.env.LOCALAPPDATA) {
      throw new Error("LOCALAPPDATA 未定义");
    }
    return path.join(process.env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Fonts");
  }
  return path.join(os.homedir(), ".local", "share", "fonts");
}

async function isJetBrainsMonoInstalled() {
  if (process.platform === "win32") {
    const registryPaths = [
      "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
      "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
    ];
    for (const registryPath of registryPaths) {
      try {
        await execFile("reg.exe", ["QUERY", registryPath, "/f", "JetBrains Mono"]);
        return true;
      } catch {
        // Continue with the next registry location.
      }
    }
    return false;
  }

  try {
    await access(path.join(fontTargetDirectory(), bundledFonts[0][0]));
    return true;
  } catch {
    return false;
  }
}

async function installBundledFonts(context, { confirmed = false } = {}) {
  if (!confirmed) {
    const confirmation = await vscode.window.showWarningMessage(
      "将为当前系统用户安装 JetBrains Mono 2.304 的四个基础字形文件。字体采用 SIL Open Font License 1.1。",
      { modal: true },
      "安装",
    );
    if (confirmation !== "安装") return;
  }

  try {
    const sourceDirectory = path.join(context.extensionPath, "assets", "fonts");
    const targetDirectory = fontTargetDirectory();
    await mkdir(targetDirectory, { recursive: true });

    for (const [fileName, registryName] of bundledFonts) {
      const targetPath = path.join(targetDirectory, fileName);
      await copyFile(
        path.join(sourceDirectory, fileName),
        targetPath,
      );
      if (process.platform === "win32") {
        await execFile("reg.exe", [
          "ADD",
          "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
          "/v",
          registryName,
          "/t",
          "REG_SZ",
          "/d",
          targetPath,
          "/f",
        ]);
      }
    }

    if (process.platform === "linux") {
      try {
        await execFile("fc-cache", ["-f", targetDirectory]);
      } catch {
        // Font files are installed even when fc-cache is unavailable.
      }
    }

    await context.globalState.update(
      fontPromptedVersionKey,
      context.extension.packageJSON.version,
    );
    const reload = await vscode.window.showInformationMessage(
      "JetBrains Mono 已为当前用户安装。重新加载后 VS Code 将不再回退到 Consolas。",
      "重新加载",
    );
    if (reload === "重新加载") {
      await vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
  } catch (error) {
    await vscode.window.showErrorMessage(
      `JetBrains Mono 安装失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function offerFontInstallation(context) {
  const version = context.extension.packageJSON.version;
  if (
    context.globalState.get(fontPromptedVersionKey) === version ||
    (await isJetBrainsMonoInstalled())
  ) {
    return;
  }

  await context.globalState.update(fontPromptedVersionKey, version);
  const choice = await vscode.window.showInformationMessage(
    "未检测到系统字体 JetBrains Mono；VS Code 会回退到 Consolas，代码字形将与 GoLand 不同。",
    "安装字体",
    "稍后",
  );
  if (choice === "安装字体") {
    await installBundledFonts(context, { confirmed: true });
  }
}

async function applySettings(context, { automatic = false } = {}) {
  const configuration = vscode.workspace.getConfiguration();
  const defaults = context.extension.packageJSON.contributes.configurationDefaults;
  const existingBackup = context.globalState.get(backupKey);

  if (!existingBackup) {
    const backup = {};
    for (const key of Object.keys(defaults)) {
      const inspected = configuration.inspect(key);
      backup[key] = {
        hasValue: typeof inspected?.globalValue !== "undefined",
        value: inspected?.globalValue,
      };
    }
    await context.globalState.update(backupKey, backup);
  }

  for (const [key, value] of Object.entries(defaults)) {
    await configuration.update(key, value, vscode.ConfigurationTarget.Global);
  }

  await context.globalState.update(
    appliedVersionKey,
    context.extension.packageJSON.version,
  );
  await context.globalState.update(automaticApplyDisabledKey, false);
  await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
  const reload = await vscode.window.showInformationMessage(
    automatic
      ? "Goland Style 已自动应用新版外观。重新加载后，菜单、图标、字号和目录密度会完全生效。"
      : "GoLand 风格设置已应用。重新加载窗口后，菜单、图标、字号和目录密度会完全生效。",
    "重新加载",
  );
  if (reload === "重新加载") {
    await vscode.commands.executeCommand("workbench.action.reloadWindow");
  }
}

async function restoreSettings(context) {
  const backup = context.globalState.get(backupKey);
  if (!backup) {
    await vscode.window.showInformationMessage("没有找到可恢复的设置备份。");
    return;
  }

  const configuration = vscode.workspace.getConfiguration();
  for (const [key, entry] of Object.entries(backup)) {
    await configuration.update(
      key,
      entry.hasValue ? entry.value : undefined,
      vscode.ConfigurationTarget.Global,
    );
  }
  await context.globalState.update(backupKey, undefined);
  await context.globalState.update(automaticApplyDisabledKey, true);

  const reload = await vscode.window.showInformationMessage(
    "已恢复应用 GoLand 风格前的用户设置。",
    "重新加载",
  );
  if (reload === "重新加载") {
    await vscode.commands.executeCommand("workbench.action.reloadWindow");
  }
}

async function applyCurrentVersionIfNeeded(context) {
  const version = context.extension.packageJSON.version;
  if (
    context.globalState.get(automaticApplyDisabledKey) ||
    context.globalState.get(appliedVersionKey) === version
  ) {
    return;
  }
  await applySettings(context, { automatic: true });
}

async function warnIfWorkspaceIsRestricted() {
  if (!vscode.workspace.workspaceFolders?.length || vscode.workspace.isTrusted) {
    return;
  }
  const choice = await vscode.window.showWarningMessage(
    "当前处于 Restricted Mode：gopls 语义颜色、重构、CodeLens 和部分 Go 扩展会被限制。仅在确认源码可信时管理工作区信任。",
    "管理工作区信任",
  );
  if (choice === "管理工作区信任") {
    await vscode.commands.executeCommand("workbench.trust.manage");
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("jetbrainsStyleGo.applySettings", () =>
      applySettings(context),
    ),
    vscode.commands.registerCommand("jetbrainsStyleGo.restoreSettings", () =>
      restoreSettings(context),
    ),
    vscode.commands.registerCommand("jetbrainsStyleGo.installFont", () =>
      installBundledFonts(context),
    ),
  );
  void applyCurrentVersionIfNeeded(context);
  void offerFontInstallation(context);
  void warnIfWorkspaceIsRestricted();
}

function deactivate() {}

module.exports = { activate, deactivate };
