import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const nodeRequire = createRequire(import.meta.url);

const commands = new Map();
const executedCommands = [];
const globalState = new Map();
const globalSettings = new Map([["editor.fontSize", 15]]);
const updates = [];
let bookmarksActivated = false;
let copyReferenceActivated = false;
let runConfigurationEditorActivated = false;

const configuration = {
  inspect(key) {
    return { globalValue: globalSettings.get(key) };
  },
  async update(key, value) {
    updates.push({ key, value });
    if (typeof value === "undefined") {
      globalSettings.delete(key);
    } else {
      globalSettings.set(key, value);
    }
  },
};

const vscode = {
  ConfigurationTarget: { Global: 1 },
  commands: {
    registerCommand(id, callback) {
      commands.set(id, callback);
      return { dispose() {} };
    },
    async executeCommand(id) {
      executedCommands.push(id);
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
    getConfiguration() {
      return configuration;
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
          "editor.fontSize": 13.5,
          "editor.lineHeight": 21,
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
assert.equal(runConfigurationEditorActivated, true);
assert(commands.has("jetbrainsStyleGo.applySettings"));
assert(commands.has("jetbrainsStyleGo.restoreSettings"));
assert(commands.has("jetbrainsStyleGo.installFont"));
assert(commands.has("jetbrainsStyleGo.repairGoNavigation"));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(globalSettings.get("editor.fontSize"), 13.5);
assert.equal(globalSettings.get("editor.lineHeight"), 21);
assert.equal(globalSettings.get("go.useLanguageServer"), true);
assert.equal(globalState.get("appliedSettingsVersion"), "test");

await commands.get("jetbrainsStyleGo.applySettings")();
assert.equal(globalSettings.get("editor.fontSize"), 13.5);
assert.equal(globalSettings.get("editor.lineHeight"), 21);
assert.equal(globalSettings.get("go.useLanguageServer"), true);
assert(executedCommands.includes("workbench.action.closeAuxiliaryBar"));

await commands.get("jetbrainsStyleGo.restoreSettings")();
assert.equal(globalSettings.get("editor.fontSize"), 15);
assert.equal(globalSettings.has("editor.lineHeight"), false);
assert.equal(globalSettings.has("go.useLanguageServer"), false);
assert.equal(globalState.has("settingsBackup"), false);
assert(updates.length >= 4);

console.log("扩展设置应用与恢复测试通过。");
