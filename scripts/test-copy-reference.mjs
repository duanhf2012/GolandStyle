import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { activateCopyReference, copyReference, createReference } = require("../copy-reference.js");

const registeredCommands = new Map();
let clipboardText;
let statusMessage;
let warningMessage;

function uri(fsPath, scheme = "file") {
  const normalized = fsPath.replace(/\\/g, "/");
  return {
    fsPath,
    path: normalized,
    scheme,
    toString() {
      return `${scheme}://${normalized}`;
    },
  };
}

const projectRoot = path.resolve("test-project");
const workspaceFolder = { uri: uri(projectRoot), name: "test-project" };
const vscode = {
  commands: {
    registerCommand(id, callback) {
      registeredCommands.set(id, callback);
      return { dispose() {} };
    },
  },
  env: {
    clipboard: {
      async writeText(value) {
        clipboardText = value;
      },
    },
  },
  window: {
    activeTextEditor: undefined,
    setStatusBarMessage(value) {
      statusMessage = value;
    },
    async showWarningMessage(value) {
      warningMessage = value;
    },
  },
  workspace: {
    getWorkspaceFolder(documentUri) {
      const relativePath = path.relative(workspaceFolder.uri.fsPath, documentUri.fsPath);
      return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
        ? workspaceFolder
        : undefined;
    },
  },
};

function editor(filePath, startLine, endLine = startLine, endCharacter = 0) {
  return {
    document: { uri: uri(filePath) },
    selection: {
      start: { line: startLine, character: 0 },
      end: { line: endLine, character: endCharacter },
      isEmpty: startLine === endLine && endCharacter === 0,
    },
  };
}

const userFile = path.join(projectRoot, "service", "user.go");
const mainFile = path.join(projectRoot, "main.go");

assert.equal(createReference(vscode, editor(userFile, 41)), "service/user.go:42");
assert.equal(
  createReference(vscode, editor(userFile, 4, 7, 3)),
  "service/user.go:5-8",
);
assert.equal(
  createReference(vscode, editor(userFile, 4, 8, 0)),
  "service/user.go:5-8",
);

const context = { subscriptions: { push() {} } };
activateCopyReference(vscode, context);
assert(registeredCommands.has("jetbrainsStyleGo.copyReference"));

vscode.window.activeTextEditor = editor(mainFile, 9);
await registeredCommands.get("jetbrainsStyleGo.copyReference")();
assert.equal(clipboardText, "main.go:10");
assert(statusMessage.includes("main.go:10"));

vscode.window.activeTextEditor = undefined;
await copyReference(vscode);
assert.equal(warningMessage, "请先打开已保存的文件，再复制代码引用。");

console.log("复制代码引用路径、行范围与剪贴板测试通过。");
