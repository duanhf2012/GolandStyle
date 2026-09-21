import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const nodeRequire = createRequire(import.meta.url);

const commands = new Map();
const executedCommands = [];
const executedCommandCalls = [];
const globalState = new Map();
const globalSettings = new Map([["editor.fontSize", 15]]);
const updates = [];
let configurationListener;
let bookmarksActivated = false;
let copyReferenceActivated = false;
let findUsagesActivated = false;
let runConfigurationEditorActivated = false;

function configurationFor(section = "") {
  const fullKey = (key) => (section ? `${section}.${key}` : key);
  return {
    inspect(key) {
      return { globalValue: globalSettings.get(fullKey(key)) };
    },
    get(key, fallback) {
      const resolved = fullKey(key);
      return globalSettings.has(resolved) ? globalSettings.get(resolved) : fallback;
    },
    async update(key, value) {
      const resolved = fullKey(key);
      updates.push({ key: resolved, value });
      if (typeof value === "undefined") {
        globalSettings.delete(resolved);
      } else {
        globalSettings.set(resolved, value);
      }
    },
  };
}

const configuration = configurationFor();

const vscode = {
  ConfigurationTarget: { Global: 1 },
  commands: {
    registerCommand(id, callback) {
      commands.set(id, callback);
      return { dispose() {} };
    },
    async executeCommand(id, ...args) {
      executedCommands.push(id);
      executedCommandCalls.push({ id, args });
    },
  },
  window: {
    async showInformationMessage() {
      return "稍后";
    },
    async showWarningMessage() {
      return undefined;
    },
    async showErrorMessage() {
      return undefined;
    },
  },
  workspace: {
    isTrusted: true,
    workspaceFolders: [],
    getConfiguration(section) {
      return section ? configurationFor(section) : configuration;
    },
    onDidChangeConfiguration(callback) {
      configurationListener = callback;
      return { dispose() {} };
    },
  },
};

const source = await readFile(new URL("../extension.js", import.meta.url), "utf8");
const extensionModule = { exports: {} };
const wrapper = vm.runInNewContext(
  `(function (require, module, exports) { ${source}\n })`,
  { process },
);
wrapper(
  (id) => {
    if (id === "vscode") return vscode;
    if (id === "./bookmarks") {
      return {
        activateBookmarks() {
          bookmarksActivated = true;
        },
      };
    }
    if (id === "./copy-reference") {
      return {
        activateCopyReference() {
          copyReferenceActivated = true;
        },
      };
    }
    if (id === "./find-usages") {
      return {
        activateFindUsages() {
          findUsagesActivated = true;
        },
      };
    }
    if (id === "./run-config-editor") {
      return {
        activateRunConfigurationEditor() {
          runConfigurationEditorActivated = true;
        },
      };
    }
    return nodeRequire(id);
  },
  extensionModule,
  extensionModule.exports,
);

const context = {
  extensionPath: new URL("..", import.meta.url).pathname,
  extension: {
    packageJSON: {
      version: "test",
      contributes: {
        configurationDefaults: {
          "chat.disableAIFeatures": true,
          "editor.fontSize": 13.5,
          "editor.lineHeight": 21,
          "search.useIgnoreFiles": false,
          "search.useParentIgnoreFiles": false,
          "search.useGlobalIgnoreFiles": false,
        },
      },
      golandStyle: {
        runtimeSettings: {
          "go.useLanguageServer": true,
        },
      },
    },
  },
  globalState: {
    get(key) {
      return globalState.get(key);
    },
    async update(key, value) {
      if (typeof value === "undefined") globalState.delete(key);
      else globalState.set(key, value);
    },
  },
  subscriptions: { push() {} },
};

extensionModule.exports.activate(context);
assert.equal(bookmarksActivated, true);
assert.equal(copyReferenceActivated, true);
assert.equal(findUsagesActivated, true);
assert.equal(runConfigurationEditorActivated, true);
assert(commands.has("jetbrainsStyleGo.applySettings"));
assert(commands.has("jetbrainsStyleGo.openSettings"));
assert(commands.has("jetbrainsStyleGo.restoreSettings"));
assert(commands.has("jetbrainsStyleGo.installFont"));
assert(commands.has("jetbrainsStyleGo.repairGoNavigation"));
await commands.get("jetbrainsStyleGo.openSettings")();
assert(
  executedCommandCalls.some(
    ({ id, args }) =>
      id === "workbench.action.openSettings" &&
      args[0] === "@ext:goland-style.jetbrains-style-go-vscode",
  ),
);
for (const commandId of [
  "jetbrainsStyleGo.go.addImport",
  "jetbrainsStyleGo.go.addTags",
  "jetbrainsStyleGo.go.toggleTestFile",
  "jetbrainsStyleGo.go.testAtCursor",
  "jetbrainsStyleGo.go.debugTestAtCursor",
]) {
  assert(commands.has(commandId));
}
await commands.get("jetbrainsStyleGo.go.addImport")();
assert(executedCommands.includes("go.import.add"));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(globalSettings.get("editor.fontSize"), 13.5);
assert.equal(globalSettings.get("editor.lineHeight"), 21);
assert.equal(globalSettings.get("chat.disableAIFeatures"), true);
assert.equal(globalSettings.get("go.useLanguageServer"), true);
assert.equal(globalSettings.get("search.useIgnoreFiles"), false);
assert.equal(globalSettings.get("search.useParentIgnoreFiles"), false);
assert.equal(globalSettings.get("search.useGlobalIgnoreFiles"), false);
assert.equal(globalSettings.get("debug.toolBarLocation"), "commandCenter");
assert.equal(globalSettings.get("terminal.integrated.scrollback"), 100000);
assert.equal(globalState.get("appliedSettingsVersion"), "test");

globalSettings.set("golandStyle.search.includeIgnoredFiles", false);
globalSettings.set("golandStyle.editor.hideGoDiagnostics", false);
globalSettings.set("golandStyle.menus.compactEditorContextMenu", false);
globalSettings.set("golandStyle.debug.toolbarInCommandCenter", false);
globalSettings.set("golandStyle.terminalFind.scrollback", 25000);
configurationListener({ affectsConfiguration: (key) => key === "golandStyle" });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(globalSettings.get("search.useIgnoreFiles"), true);
assert.equal(globalSettings.get("[go]")["editor.renderValidationDecorations"], "on");
assert.equal(globalSettings.get("chat.disableAIFeatures"), false);
assert.equal(globalSettings.get("debug.toolBarLocation"), "floating");
assert.equal(globalSettings.get("window.commandCenter"), false);
assert.equal(globalSettings.get("terminal.integrated.scrollback"), 25000);

await commands.get("jetbrainsStyleGo.applySettings")();
assert.equal(globalSettings.get("editor.fontSize"), 13.5);
assert.equal(globalSettings.get("editor.lineHeight"), 21);
assert.equal(globalSettings.get("chat.disableAIFeatures"), false);
assert.equal(globalSettings.get("go.useLanguageServer"), true);
assert.equal(globalSettings.get("search.useIgnoreFiles"), true);
assert.equal(globalSettings.get("search.useParentIgnoreFiles"), true);
assert.equal(globalSettings.get("search.useGlobalIgnoreFiles"), true);
assert.equal(globalSettings.get("debug.toolBarLocation"), "floating");
assert.equal(globalSettings.get("terminal.integrated.scrollback"), 25000);
assert(executedCommands.includes("workbench.action.closeAuxiliaryBar"));

await commands.get("jetbrainsStyleGo.restoreSettings")();
assert.equal(globalSettings.get("editor.fontSize"), 15);
assert.equal(globalSettings.has("editor.lineHeight"), false);
assert.equal(globalSettings.has("chat.disableAIFeatures"), false);
assert.equal(globalSettings.has("go.useLanguageServer"), false);
assert.equal(globalSettings.has("search.useIgnoreFiles"), false);
assert.equal(globalSettings.has("search.useParentIgnoreFiles"), false);
assert.equal(globalSettings.has("search.useGlobalIgnoreFiles"), false);
assert.equal(globalState.has("settingsBackup"), false);
assert(updates.length >= 4);

console.log("扩展设置应用与恢复测试通过。");
