const path = require("node:path");

const commandId = "jetbrainsStyleGo.copyReference";

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function referencePath(vscode, document) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (workspaceFolder) {
    const relativePath =
      document.uri.scheme === "file" && workspaceFolder.uri.scheme === "file"
        ? path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
        : path.posix.relative(workspaceFolder.uri.path, document.uri.path);
    return normalizePath(relativePath);
  }

  if (document.uri.scheme === "file") {
    return normalizePath(document.uri.fsPath);
  }

  return document.uri.path ? normalizePath(document.uri.path) : document.uri.toString();
}

function selectedLines(selection) {
  const start = selection.start.line + 1;
  if (selection.isEmpty) return String(start);

  const inclusiveEndLine =
    selection.end.character === 0 && selection.end.line > selection.start.line
      ? selection.end.line
      : selection.end.line + 1;
  return inclusiveEndLine === start ? String(start) : `${start}-${inclusiveEndLine}`;
}

function createReference(vscode, editor) {
  return `${referencePath(vscode, editor.document)}:${selectedLines(editor.selection)}`;
}

async function copyReference(vscode) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme === "untitled") {
    await vscode.window.showWarningMessage("请先打开已保存的文件，再复制代码引用。");
    return;
  }

  const reference = createReference(vscode, editor);
  await vscode.env.clipboard.writeText(reference);
  vscode.window.setStatusBarMessage(`已复制引用：${reference}`, 3000);
}

function activateCopyReference(vscode, context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, () => copyReference(vscode)),
  );
}

module.exports = {
  activateCopyReference,
  copyReference,
  createReference,
  referencePath,
  selectedLines,
};
