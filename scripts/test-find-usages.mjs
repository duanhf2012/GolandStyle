import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  activateFindUsages,
  accessKindForLocation,
  buildUsageTree,
  deduplicateLocations,
} = require("../find-usages");

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(startLine, startCharacter, endLine, endCharacter) {
    this.start = new Position(startLine, startCharacter);
    this.end = new Position(endLine, endCharacter);
  }
}

class Uri {
  constructor(fsPath) {
    this.fsPath = fsPath;
    this.path = fsPath.replace(/\\/g, "/");
  }

  toString() {
    return `file:///${this.path.replace(/^\/+/, "")}`;
  }
}

class EventEmitter {
  constructor() {
    this.event = () => ({ dispose() {} });
  }

  fire() {}
  dispose() {}
}

class TreeItem {
  constructor(label, collapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

class ThemeIcon {
  constructor(id) {
    this.id = id;
  }
}

class Selection {
  constructor(start, end) {
    this.start = start;
    this.end = end;
    this.active = end;
  }
}

function createDocument(uri, lines) {
  const text = lines.join("\n");
  return {
    uri,
    languageId: "go",
    lineAt(line) {
      return { text: lines[line] };
    },
    getText(range) {
      if (!range) return text;
      if (range.start.line === range.end.line) {
        return lines[range.start.line].slice(range.start.character, range.end.character);
      }
      return lines
        .slice(range.start.line, range.end.line + 1)
        .map((line, index, selected) => {
          if (index === 0) return line.slice(range.start.character);
          if (index === selected.length - 1) return line.slice(0, range.end.character);
          return line;
        })
        .join("\n");
    },
    getWordRangeAtPosition(position) {
      const line = lines[position.line];
      const pattern = /[A-Za-z_]\w*/g;
      for (const match of line.matchAll(pattern)) {
        if (position.character >= match.index && position.character <= match.index + match[0].length) {
          return new Range(
            position.line,
            match.index,
            position.line,
            match.index + match[0].length,
          );
        }
      }
      return undefined;
    },
  };
}

const definitionUri = new Uri("E:\\workspace\\common\\Arena.go");
const usageUri = new Uri("E:\\workspace\\service\\PlayerArena.go");
const definitionLines = [
  "type ArenaInfo struct {",
  "  SeasonScore int32",
  "}",
  "func (a *ArenaInfo) Reset() {",
  "  a.SeasonScore = 1",
  "}",
];
const usageLines = [
  "func Read(ai *ArenaInfo) int32 {",
  "  return ai.SeasonScore",
  "}",
];
const documents = new Map([
  [definitionUri.toString(), createDocument(definitionUri, definitionLines)],
  [usageUri.toString(), createDocument(usageUri, usageLines)],
]);
const atWord = (uri, lines, line) => {
  const start = lines[line].indexOf("SeasonScore");
  return { uri, range: new Range(line, start, line, start + "SeasonScore".length) };
};
const declaration = atWord(definitionUri, definitionLines, 1);
const write = atWord(definitionUri, definitionLines, 4);
const read = atWord(usageUri, usageLines, 1);

const SymbolKind = {
  Class: 4,
  Method: 5,
  Function: 11,
  Struct: 22,
  Interface: 10,
  Enum: 9,
};
const DocumentHighlightKind = { Text: 0, Read: 1, Write: 2 };
const symbols = new Map([
  [
    definitionUri.toString(),
    [
      { name: "ArenaInfo", kind: SymbolKind.Struct, range: new Range(0, 0, 2, 1) },
      { name: "Reset", kind: SymbolKind.Method, range: new Range(3, 0, 5, 1) },
    ],
  ],
  [
    usageUri.toString(),
    [{ name: "Read", kind: SymbolKind.Function, range: new Range(0, 0, 2, 1) }],
  ],
]);

const registeredCommands = new Map();
const executedCommands = [];
let treeProvider;
let shownEditor;
const vscode = {
  Position,
  Range,
  Selection,
  EventEmitter,
  TreeItem,
  ThemeIcon,
  SymbolKind,
  DocumentHighlightKind,
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  TextEditorRevealType: { InCenterIfOutsideViewport: 0 },
  ProgressLocation: { Window: 10 },
  commands: {
    registerCommand(id, callback) {
      registeredCommands.set(id, callback);
      return { dispose() {} };
    },
    async executeCommand(id, uri) {
      executedCommands.push(id);
      if (id === "vscode.executeReferenceProvider") return [declaration, write, read, read];
      if (id === "vscode.executeDefinitionProvider") return [declaration];
      if (id === "vscode.executeDocumentSymbolProvider") return symbols.get(uri.toString());
      if (id === "vscode.executeDocumentHighlights") {
        return uri.toString() === definitionUri.toString()
          ? [
              { range: declaration.range, kind: DocumentHighlightKind.Write },
              { range: write.range, kind: DocumentHighlightKind.Write },
            ]
          : [{ range: read.range, kind: DocumentHighlightKind.Read }];
      }
      return undefined;
    },
  },
  workspace: {
    async openTextDocument(uri) {
      return documents.get(uri.toString());
    },
    getWorkspaceFolder() {
      return { name: "mp1server", uri: new Uri("E:\\workspace") };
    },
    asRelativePath(uri) {
      return uri.toString() === definitionUri.toString()
        ? "common/Arena.go"
        : "service/PlayerArena.go";
    },
  },
  window: {
    activeTextEditor: {
      document: documents.get(definitionUri.toString()),
      selection: { active: declaration.range.start },
    },
    createTreeView(_id, options) {
      treeProvider = options.treeDataProvider;
      return { message: undefined, description: undefined, dispose() {} };
    },
    async withProgress(_options, callback) {
      return callback();
    },
    async showInformationMessage() {},
    async showErrorMessage(message) {
      throw new Error(message);
    },
    async showTextDocument() {
      shownEditor = { selection: undefined, revealRange() {} };
      return shownEditor;
    },
  },
};
const context = { subscriptions: { push() {} } };
const manager = activateFindUsages(vscode, context);
await registeredCommands.get("jetbrainsStyleGo.usages.find")();

assert.equal(manager.provider.root.label, "SeasonScore");
assert.equal(manager.provider.root.count, 3);
assert.deepEqual(
  manager.provider.root.children.map(({ label, count }) => [label, count]),
  [
    ["声明", 1],
    ["写入值", 1],
    ["读取值", 1],
  ],
);
const writeCategory = manager.provider.root.children[1];
const writeFile = writeCategory.children[0].children[0].children[0];
assert.equal(writeFile.label, "Arena.go");
assert.equal(writeFile.children[0].label, "ArenaInfo");
assert.equal(writeFile.children[0].children[0].label, "Reset");
const readCategory = manager.provider.root.children[2];
const readFile = readCategory.children[0].children[0].children[0];
assert.equal(readFile.children[0].label, "Read");
assert(executedCommands.includes("jetbrainsStyleGo.findUsagesView.focus"));

const locationNode = readFile.children[0].children[0];
const treeItem = treeProvider.getTreeItem(locationNode);
assert.equal(treeItem.command.command, "jetbrainsStyleGo.usages.open");
await registeredCommands.get("jetbrainsStyleGo.usages.open")(locationNode.occurrence);
assert.equal(shownEditor.selection.start.line, 1);

assert.equal(deduplicateLocations([read, read]).length, 1);
assert.equal(
  accessKindForLocation(
    vscode,
    documents.get(definitionUri.toString()),
    write,
    [{ range: write.range, kind: DocumentHighlightKind.Write }],
  ),
  "write",
);
assert.equal(
  buildUsageTree("Empty", []).count,
  0,
);

console.log("GoLand 风格查找用法的读写分类、符号分组与跳转测试通过。");
