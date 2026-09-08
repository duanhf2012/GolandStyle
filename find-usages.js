const path = require("node:path");

const viewId = "jetbrainsStyleGo.findUsagesView";
const commandPrefix = "jetbrainsStyleGo.usages";

function comparePositions(left, right) {
  return left.line - right.line || left.character - right.character;
}

function rangeContainsPosition(range, position) {
  return (
    comparePositions(range.start, position) <= 0 &&
    comparePositions(position, range.end) <= 0
  );
}

function rangeSize(range) {
  return (range.end.line - range.start.line) * 1_000_000 +
    range.end.character - range.start.character;
}

function normalizeLocation(location) {
  if (!location) return undefined;
  if (location.uri && location.range) return location;
  if (location.targetUri && (location.targetSelectionRange || location.targetRange)) {
    return {
      uri: location.targetUri,
      range: location.targetSelectionRange || location.targetRange,
    };
  }
  return undefined;
}

function locationKey(location) {
  const { start, end } = location.range;
  return `${location.uri.toString()}:${start.line}:${start.character}:${end.line}:${end.character}`;
}

function sameLocation(left, right) {
  return (
    left.uri.toString() === right.uri.toString() &&
    rangeContainsPosition(right.range, left.range.start)
  );
}

function deduplicateLocations(locations) {
  const unique = new Map();
  for (const candidate of locations || []) {
    const location = normalizeLocation(candidate);
    if (location) unique.set(locationKey(location), location);
  }
  return [...unique.values()];
}

function findContainingContext(vscode, document, symbols, position) {
  const candidates = [];
  const visit = (symbol, depth = 0) => {
    const range = symbol.range || symbol.location?.range;
    if (!range || !rangeContainsPosition(range, position)) return;
    candidates.push({ symbol, range, depth });
    for (const child of symbol.children || []) visit(child, depth + 1);
  };
  for (const symbol of symbols || []) visit(symbol);
  candidates.sort(
    (left, right) => right.depth - left.depth || rangeSize(left.range) - rangeSize(right.range),
  );

  const kinds = vscode.SymbolKind;
  const typeKinds = new Set([kinds.Struct, kinds.Class, kinds.Interface, kinds.Enum]);
  const callableKinds = new Set([kinds.Function, kinds.Method, kinds.Constructor]);
  const type = candidates.find(({ symbol }) => typeKinds.has(symbol.kind))?.symbol;
  const callable = candidates.find(({ symbol }) => callableKinds.has(symbol.kind))?.symbol;
  let typeName = type?.name;
  let callableName = callable?.name;

  if (callable && !typeName) {
    const range = callable.range || callable.location?.range;
    const firstLines = document
      .getText(range)
      .slice(0, 500)
      .replace(/\r?\n/g, " ");
    const receiver = firstLines.match(
      /\bfunc\s*\(\s*(?:[A-Za-z_]\w*\s+)?\*?\s*([A-Za-z_]\w*)/,
    );
    if (receiver) typeName = receiver[1];
  }

  if (callableName) {
    const qualified = callableName.match(/^\(\*?([^)]+)\)\.([^\s(]+)/);
    if (qualified) {
      typeName ||= qualified[1];
      callableName = qualified[2];
    }
  }

  return {
    typeName,
    callableName,
    callableKind: callable?.kind,
  };
}

function fallbackAccessKind(document, location) {
  const line = document.lineAt(location.range.start.line).text;
  const after = line.slice(location.range.end.character);
  if (
    /^\s*(?:\+\+|--|(?:<<|>>|&\^|[+\-*/%&|^])?=(?!=)|:=(?!=)|:)/.test(after)
  ) {
    return "write";
  }
  if (/^\s*[({]/.test(after)) return "other";
  return "read";
}

function accessKindForLocation(vscode, document, location, highlights) {
  const highlight = (highlights || []).find(({ range }) =>
    rangeContainsPosition(range, location.range.start),
  );
  if (highlight?.kind === vscode.DocumentHighlightKind.Write) return "write";
  if (highlight?.kind === vscode.DocumentHighlightKind.Read) return "read";
  return fallbackAccessKind(document, location);
}

function addGroup(parent, key, properties) {
  parent.groupIndex ||= new Map();
  if (!parent.groupIndex.has(key)) {
    const group = { ...properties, key, children: [] };
    parent.groupIndex.set(key, group);
    parent.children.push(group);
  }
  return parent.groupIndex.get(key);
}

function countLeaves(node) {
  if (node.kind === "location") return 1;
  node.count = node.children.reduce((total, child) => total + countLeaves(child), 0);
  delete node.groupIndex;
  return node.count;
}

function buildUsageTree(symbolName, occurrences) {
  const root = {
    kind: "symbol",
    label: symbolName,
    icon: "references",
    expanded: true,
    children: [],
  };
  const categories = {
    declaration: { label: "声明", icon: "symbol-field", order: 0 },
    write: { label: "写入值", icon: "edit", order: 1 },
    read: { label: "读取值", icon: "eye", order: 2 },
    other: { label: "其他用法", icon: "question", order: 3 },
  };

  const sorted = [...occurrences].sort((left, right) => {
    const categoryDifference =
      (categories[left.access] || categories.other).order -
      (categories[right.access] || categories.other).order;
    return (
      categoryDifference ||
      left.uri.toString().localeCompare(right.uri.toString()) ||
      comparePositions(left.range.start, right.range.start)
    );
  });

  for (const occurrence of sorted) {
    const categoryInfo = categories[occurrence.access] || categories.other;
    let parent = addGroup(root, `category:${occurrence.access}`, {
      kind: "category",
      label: categoryInfo.label,
      icon: categoryInfo.icon,
      order: categoryInfo.order,
      expanded: occurrence.access === "write" || occurrence.access === "read",
    });
    parent = addGroup(parent, `workspace:${occurrence.workspaceName}`, {
      kind: "workspace",
      label: occurrence.workspaceName,
      icon: "root-folder",
      expanded: true,
    });
    if (occurrence.directory) {
      parent = addGroup(parent, `directory:${occurrence.directory}`, {
        kind: "directory",
        label: occurrence.directory,
        icon: "folder",
        expanded: true,
      });
    }
    parent = addGroup(parent, `file:${occurrence.uri.toString()}`, {
      kind: "file",
      label: occurrence.fileName,
      icon: "file-code",
      resourceUri: occurrence.uri,
      expanded: false,
    });
    if (occurrence.typeName) {
      parent = addGroup(parent, `type:${occurrence.typeName}`, {
        kind: "type",
        label: occurrence.typeName,
        icon: "symbol-struct",
        expanded: false,
      });
    }
    if (occurrence.callableName) {
      parent = addGroup(parent, `callable:${occurrence.callableName}`, {
        kind: "callable",
        label: occurrence.callableName,
        icon: "symbol-method",
        expanded: false,
      });
    }
    parent.children.push({
      kind: "location",
      label: `${occurrence.range.start.line + 1}: ${occurrence.lineText.trim()}`,
      icon: occurrence.access === "write" ? "arrow-right" : "search",
      occurrence,
    });
  }

  root.children.sort((left, right) => left.order - right.order);
  countLeaves(root);
  return root;
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

class FindUsagesTreeProvider {
  constructor(vscode) {
    this.vscode = vscode;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
    this.root = undefined;
  }

  setRoot(root) {
    this.root = root;
    this.emitter.fire(undefined);
  }

  clear() {
    this.setRoot(undefined);
  }

  getChildren(element) {
    if (!element) return this.root ? [this.root] : [];
    return element.children || [];
  }

  getTreeItem(element) {
    const { vscode } = this;
    const hasChildren = Array.isArray(element.children) && element.children.length > 0;
    const collapsibleState = hasChildren
      ? element.expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(element.label, collapsibleState);
    item.contextValue = `findUsages.${element.kind}`;
    item.iconPath = new vscode.ThemeIcon(element.icon || "symbol-reference");
    if (element.resourceUri) item.resourceUri = element.resourceUri;
    if (hasChildren) item.description = `${element.count} 个结果`;
    if (element.kind === "location") {
      const occurrence = element.occurrence;
      item.tooltip = `${occurrence.uri.fsPath || occurrence.uri.toString()}:${occurrence.range.start.line + 1}`;
      item.command = {
        command: `${commandPrefix}.open`,
        title: "打开引用",
        arguments: [occurrence],
      };
    }
    return item;
  }

  dispose() {
    this.emitter.dispose();
  }
}

class FindUsagesManager {
  constructor(vscode, context) {
    this.vscode = vscode;
    this.context = context;
    this.provider = new FindUsagesTreeProvider(vscode);
    this.lastQuery = undefined;
    this.requestNumber = 0;
  }

  activate() {
    const { vscode, context } = this;
    this.treeView = vscode.window.createTreeView(viewId, {
      treeDataProvider: this.provider,
      showCollapseAll: true,
    });
    this.treeView.message = "在 Go 标识符上按 Alt+F7 查找用法";
    const register = (name, handler) =>
      context.subscriptions.push(
        vscode.commands.registerCommand(`${commandPrefix}.${name}`, handler),
      );
    register("find", () => this.findFromActiveEditor());
    register("refresh", () => this.refresh());
    register("clear", () => this.clear());
    register("open", (occurrence) => this.openOccurrence(occurrence));
    context.subscriptions.push(this.treeView, this.provider);
  }

  async findFromActiveEditor() {
    const editor = this.vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "go") {
      await this.vscode.window.showInformationMessage("请先将光标放到 Go 标识符上。");
      return;
    }
    const position = editor.selection.active;
    const wordRange = editor.document.getWordRangeAtPosition(position);
    if (!wordRange) {
      await this.vscode.window.showInformationMessage("当前光标位置没有可查找的标识符。");
      return;
    }
    this.lastQuery = { uri: editor.document.uri, position };
    await this.find(editor.document.uri, position, editor.document.getText(wordRange));
  }

  async refresh() {
    if (!this.lastQuery) return this.findFromActiveEditor();
    const document = await this.vscode.workspace.openTextDocument(this.lastQuery.uri);
    const wordRange = document.getWordRangeAtPosition(this.lastQuery.position);
    const symbolName = wordRange ? document.getText(wordRange) : "引用";
    await this.find(this.lastQuery.uri, this.lastQuery.position, symbolName);
  }

  clear() {
    this.provider.clear();
    this.lastQuery = undefined;
    this.treeView.message = "在 Go 标识符上按 Alt+F7 查找用法";
    this.treeView.description = undefined;
  }

  async find(uri, position, symbolName) {
    const requestNumber = ++this.requestNumber;
    const run = async () => {
      const [rawReferences, rawDefinitions] = await Promise.all([
        this.vscode.commands.executeCommand(
          "vscode.executeReferenceProvider",
          uri,
          position,
        ),
        this.vscode.commands.executeCommand(
          "vscode.executeDefinitionProvider",
          uri,
          position,
        ),
      ]);
      if (requestNumber !== this.requestNumber) return;

      const definitions = deduplicateLocations(rawDefinitions);
      const references = deduplicateLocations(rawReferences).filter(
        (reference) => !definitions.some((definition) => sameLocation(reference, definition)),
      );
      const occurrences = await this.analyzeLocations(references, definitions);
      if (requestNumber !== this.requestNumber) return;
      const root = buildUsageTree(symbolName, occurrences);
      // 首次使用时先让底部视图完成创建，再发布树数据。否则隐藏视图可能
      // 只渲染出父节点计数，却错过默认展开节点的首轮子节点刷新。
      await this.vscode.commands.executeCommand(`${viewId}.focus`);
      if (requestNumber !== this.requestNumber) return;
      this.provider.setRoot(root);
      this.treeView.message = undefined;
      this.treeView.description = `${root.count}`;
      if (references.length === 0) {
        await this.vscode.window.showInformationMessage(`未找到“${symbolName}”的用法。`);
      }
    };

    try {
      if (typeof this.vscode.window.withProgress === "function") {
        await this.vscode.window.withProgress(
          {
            location: this.vscode.ProgressLocation.Window,
            title: `正在查找 ${symbolName} 的用法…`,
          },
          run,
        );
      } else {
        await run();
      }
    } catch (error) {
      await this.vscode.window.showErrorMessage(
        `查找用法失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async analyzeLocations(references, definitions) {
    const definitionKeys = new Set(definitions.map(locationKey));
    const allLocations = deduplicateLocations([...definitions, ...references]);
    const byUri = new Map();
    for (const location of allLocations) {
      const key = location.uri.toString();
      if (!byUri.has(key)) byUri.set(key, []);
      byUri.get(key).push(location);
    }

    const batches = await mapLimit([...byUri.values()], 4, async (locations) => {
      const document = await this.vscode.workspace.openTextDocument(locations[0].uri);
      const firstReference = locations.find((location) => !definitionKeys.has(locationKey(location)));
      const [symbols, highlights] = await Promise.all([
        Promise.resolve(
          this.vscode.commands.executeCommand(
            "vscode.executeDocumentSymbolProvider",
            document.uri,
          ),
        ).catch(() => []),
        firstReference
          ? Promise.resolve(
              this.vscode.commands.executeCommand(
                "vscode.executeDocumentHighlights",
                document.uri,
                firstReference.range.start,
              ),
            ).catch(() => [])
          : Promise.resolve([]),
      ]);
      return locations.map((location) => {
        const context = findContainingContext(
          this.vscode,
          document,
          symbols || [],
          location.range.start,
        );
        const workspaceFolder = this.vscode.workspace.getWorkspaceFolder(location.uri);
        let workspaceName = workspaceFolder?.name || "外部文件";
        let relativePath;
        if (workspaceFolder) {
          relativePath = this.vscode.workspace.asRelativePath(location.uri, false);
        } else {
          relativePath = location.uri.fsPath || location.uri.path;
        }
        relativePath = relativePath.replace(/\\/g, "/");
        const directory = path.posix.dirname(relativePath);
        const isDefinition = definitionKeys.has(locationKey(location));
        return {
          ...location,
          ...context,
          access: isDefinition
            ? "declaration"
            : accessKindForLocation(this.vscode, document, location, highlights),
          workspaceName,
          directory: directory === "." ? "" : directory,
          fileName: path.posix.basename(relativePath),
          lineText: document.lineAt(location.range.start.line).text,
        };
      });
    });
    return batches.flat();
  }

  async openOccurrence(occurrence) {
    if (!occurrence?.uri || !occurrence?.range) return;
    const editor = await this.vscode.window.showTextDocument(occurrence.uri, {
      preview: true,
      preserveFocus: false,
    });
    editor.selection = new this.vscode.Selection(
      occurrence.range.start,
      occurrence.range.end,
    );
    editor.revealRange(
      occurrence.range,
      this.vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
  }
}

function activateFindUsages(vscode, context) {
  const manager = new FindUsagesManager(vscode, context);
  manager.activate();
  return manager;
}

module.exports = {
  accessKindForLocation,
  activateFindUsages,
  buildUsageTree,
  deduplicateLocations,
  findContainingContext,
  FindUsagesManager,
  FindUsagesTreeProvider,
  viewId,
};
