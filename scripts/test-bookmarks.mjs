import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const {
  activateBookmarks,
  adjustOffset,
  captureAnchor,
  findAnchoredLine,
  normalizeState,
} = require("../bookmarks");

function documentFromLines(lines) {
  return {
    lineCount: lines.length,
    lineAt(line) {
      return { text: lines[line] };
    },
  };
}

const emptyState = normalizeState(undefined, "Demo");
assert.equal(emptyState.lists.length, 1);
assert.equal(emptyState.lists[0].name, "Demo");
assert.equal(emptyState.defaultListId, emptyState.lists[0].id);

const repairedState = normalizeState(
  {
    defaultListId: "missing",
    lists: [{ id: "one", name: "Primary", bookmarks: [] }],
  },
  "Demo",
);
assert.equal(repairedState.defaultListId, "one");

assert.equal(
  adjustOffset(10, [{ rangeOffset: 3, rangeLength: 0, text: "abc" }]),
  13,
);
assert.equal(
  adjustOffset(6, [{ rangeOffset: 4, rangeLength: 5, text: "x" }]),
  5,
);
assert.equal(
  adjustOffset(20, [
    { rangeOffset: 3, rangeLength: 2, text: "" },
    { rangeOffset: 12, rangeLength: 0, text: "four" },
  ]),
  22,
);

const original = documentFromLines(["before", "target", "after"]);
assert.deepEqual(captureAnchor(original, 1), {
  text: "target",
  before: "before",
  after: "after",
});

const moved = documentFromLines(["target", "noise", "before", "target", "after"]);
assert.equal(
  findAnchoredLine(moved, {
    line: 1,
    anchor: { text: "target", before: "before", after: "after" },
  }),
  3,
);

class MockEventEmitter {
  constructor() {
    this.event = () => ({ dispose() {} });
  }

  fire() {}

  dispose() {}
}

class MockUri {
  constructor(value) {
    this.value = value;
    const match = /^([^:]+):\/\/(.*)$/.exec(value);
    this.scheme = match?.[1] || "file";
    this.authority = "";
    this.path = match ? `/${match[2].replace(/^\//, "")}` : value;
    this.fsPath = this.path;
  }

  toString() {
    return this.value;
  }

  with({ path }) {
    return new MockUri(`${this.scheme}://${path}`);
  }

  static parse(value) {
    return new MockUri(value);
  }
}

const registeredCommands = new Map();
const executedCommands = [];
const event = () => ({ dispose() {} });
const mockVscode = {
  EventEmitter: MockEventEmitter,
  Uri: MockUri,
  OverviewRulerLane: { Right: 4 },
  window: {
    activeTextEditor: undefined,
    visibleTextEditors: [],
    tabGroups: { all: [] },
    createTreeView() {
      return { dispose() {}, reveal() {} };
    },
    createTextEditorDecorationType() {
      return { dispose() {} };
    },
    onDidChangeActiveTextEditor: event,
    onDidChangeVisibleTextEditors: event,
  },
  workspace: {
    name: "Test Workspace",
    textDocuments: [],
    onDidOpenTextDocument: event,
    onDidCloseTextDocument: event,
    onDidChangeTextDocument: event,
    onDidRenameFiles: event,
    onDidDeleteFiles: event,
  },
  debug: {
    breakpoints: [],
    onDidChangeBreakpoints: event,
  },
  commands: {
    registerCommand(id, callback) {
      registeredCommands.set(id, callback);
      return { dispose() {} };
    },
    async executeCommand(command, ...args) {
      executedCommands.push([command, ...args]);
    },
  },
};
const persisted = new Map();
const bookmarkContext = {
  workspaceState: {
    get(key) {
      return persisted.get(key);
    },
    async update(key, value) {
      persisted.set(key, value);
    },
  },
  subscriptions: { push() {} },
};
activateBookmarks(mockVscode, bookmarkContext);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const contributedBookmarkCommands = packageJson.contributes.commands
  .map(({ command }) => command)
  .filter((command) => command.startsWith("jetbrainsStyleGo.bookmarks."));
for (const command of contributedBookmarkCommands) {
  assert(registeredCommands.has(command), `Missing runtime command: ${command}`);
}
await registeredCommands.get("jetbrainsStyleGo.bookmarks.openView")();
assert.deepEqual(executedCommands.at(-1), ["jetbrainsStyleGo.bookmarksView.focus"]);

console.log("书签状态、位置跟随与锚点恢复测试通过。");
