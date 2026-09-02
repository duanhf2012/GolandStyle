const assert = require("node:assert/strict");
const vscode = require("vscode");

async function run() {
  const extension = vscode.extensions.getExtension(
    "goland-style.jetbrains-style-go-vscode",
  );
  assert(extension, "Goland Style extension was not discovered");
  await extension.activate();

  const commands = new Set(await vscode.commands.getCommands(true));
  for (const command of [
    "jetbrainsStyleGo.bookmarks.openView",
    "jetbrainsStyleGo.bookmarksView.focus",
    "workbench.view.extension.jetbrainsStyleGo-bookmarks",
    "jetbrainsStyleGo.runConfigurations.open",
  ]) {
    assert(commands.has(command), `VS Code did not register command: ${command}`);
  }

  await vscode.commands.executeCommand("jetbrainsStyleGo.bookmarks.openView");
  console.log("Goland Style Alt+2 Bookmarks view integration test passed.");

  const folder = vscode.workspace.workspaceFolders?.[0];
  assert(folder, "Integration test workspace folder was not opened");
  await vscode.commands.executeCommand("jetbrainsStyleGo.runConfigurations.open");
  const launchUri = vscode.Uri.joinPath(folder.uri, ".vscode", "launch.json");
  const launchDocument = await vscode.workspace.openTextDocument(launchUri);
  assert.match(launchDocument.getText(), /"configurations"\s*:\s*\[\]/);
  console.log("Goland Style run configuration custom editor integration test passed.");
}

module.exports = { run };
