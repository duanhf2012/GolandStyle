const path = require("node:path");

const stateKey = "golandStyle.bookmarks.state.v1";
const viewId = "jetbrainsStyleGo.bookmarksView";
const dragMimeType = "application/vnd.code.tree.jetbrainsstylegobookmarks";
const commandPrefix = "jetbrainsStyleGo.bookmarks";

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeState(raw, defaultName = "Bookmarks") {
  const lists = Array.isArray(raw?.lists)
    ? raw.lists
        .filter((list) => list && typeof list.id === "string")
        .map((list) => ({
          id: list.id,
          name: typeof list.name === "string" && list.name.trim() ? list.name.trim() : defaultName,
          bookmarks: Array.isArray(list.bookmarks)
            ? list.bookmarks.filter(
                (bookmark) =>
                  bookmark &&
                  typeof bookmark.id === "string" &&
                  typeof bookmark.uri === "string",
              )
            : [],
        }))
    : [];

  if (lists.length === 0) {
    const id = createId("list");
    return { version: 1, defaultListId: id, lists: [{ id, name: defaultName, bookmarks: [] }] };
  }

  const defaultListId = lists.some((list) => list.id === raw?.defaultListId)
    ? raw.defaultListId
    : lists[0].id;
  return { version: 1, defaultListId, lists };
}

function adjustOffset(offset, changes) {
  let nextOffset = offset;
  const orderedChanges = [...changes].sort((left, right) => right.rangeOffset - left.rangeOffset);
  for (const change of orderedChanges) {
    const start = change.rangeOffset;
    const end = start + change.rangeLength;
    const insertedLength = change.text.length;
    if (nextOffset < start) continue;
    if (nextOffset > end || (nextOffset === end && end > start)) {
      nextOffset += insertedLength - change.rangeLength;
      continue;
    }
    nextOffset = start + insertedLength;
  }
  return Math.max(0, nextOffset);
}

function captureAnchor(document, line) {
  if (document.lineCount === 0) return { text: "", before: "", after: "" };
  const safeLine = Math.max(0, Math.min(line, document.lineCount - 1));
  return {
    text: document.lineAt(safeLine).text,
    before: safeLine > 0 ? document.lineAt(safeLine - 1).text : "",
    after: safeLine + 1 < document.lineCount ? document.lineAt(safeLine + 1).text : "",
  };
}

function findAnchoredLine(document, bookmark) {
  if (document.lineCount === 0) return 0;
  const originalLine = Math.max(0, Math.min(bookmark.line ?? 0, document.lineCount - 1));
  const anchor = bookmark.anchor;
  if (!anchor || typeof anchor.text !== "string") return originalLine;
  if (document.lineAt(originalLine).text === anchor.text) return originalLine;

  let bestLine = originalLine;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let line = 0; line < document.lineCount; line += 1) {
    if (document.lineAt(line).text !== anchor.text) continue;
    let score = -Math.abs(line - originalLine);
    if (line > 0 && document.lineAt(line - 1).text === anchor.before) score += 1000;
    if (line + 1 < document.lineCount && document.lineAt(line + 1).text === anchor.after) {
      score += 1000;
    }
    if (score > bestScore) {
      bestLine = line;
      bestScore = score;
    }
  }
  return bestLine;
}

function uriIsEqualOrChild(vscode, candidateValue, parentValue) {
  const candidate = vscode.Uri.parse(candidateValue);
  const parent = vscode.Uri.parse(parentValue);
  if (candidate.scheme !== parent.scheme || candidate.authority !== parent.authority) return false;
  if (candidate.path === parent.path) return true;
  const prefix = parent.path.endsWith("/") ? parent.path : `${parent.path}/`;
  return candidate.path.startsWith(prefix);
}

function replaceUriPrefix(vscode, candidateValue, oldValue, newValue) {
  if (!uriIsEqualOrChild(vscode, candidateValue, oldValue)) return candidateValue;
  const candidate = vscode.Uri.parse(candidateValue);
  const oldUri = vscode.Uri.parse(oldValue);
  const newUri = vscode.Uri.parse(newValue);
  const suffix = candidate.path.slice(oldUri.path.length);
  return candidate.with({ path: `${newUri.path}${suffix}` }).toString();
}

function mnemonicValues() {
  return [..."0123456789", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
}

class BookmarksTreeProvider {
  constructor(vscode, manager) {
    this.vscode = vscode;
    this.manager = manager;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
  }

  refresh() {
    this.emitter.fire(undefined);
  }

  getTreeItem(element) {
    const { vscode } = this;
    if (element.kind === "list") {
      const isDefault = element.list.id === this.manager.state.defaultListId;
      const item = new vscode.TreeItem(
        isDefault ? `${element.list.name} (Default)` : element.list.name,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = "bookmarkList";
      item.iconPath = new vscode.ThemeIcon(isDefault ? "star-full" : "list-tree");
      item.description = `${element.list.bookmarks.length}`;
      return item;
    }

    if (element.kind === "breakpoints") {
      const item = new vscode.TreeItem(
        "Breakpoints",
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.contextValue = "bookmarkBreakpoints";
      item.iconPath = new vscode.ThemeIcon("debug-breakpoint");
      item.description = `${this.vscode.debug.breakpoints.length}`;
      return item;
    }

    if (element.kind === "breakpoint") {
      const location = element.breakpoint.location;
      const item = new vscode.TreeItem(
        `${path.basename(location.uri.fsPath || location.uri.path)}:${location.range.start.line + 1}`,
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon("debug-breakpoint");
      item.description = location.uri.fsPath || location.uri.path;
      item.command = {
        command: `${commandPrefix}.openBreakpoint`,
        title: "Open Breakpoint",
        arguments: [element.breakpoint],
      };
      return item;
    }

    const bookmark = element.bookmark;
    const item = new vscode.TreeItem(
      this.manager.bookmarkLabel(bookmark),
      vscode.TreeItemCollapsibleState.None,
    );
    item.contextValue = bookmark.mnemonic ? "mnemonicBookmark" : "bookmark";
    item.iconPath = bookmark.mnemonic
      ? new vscode.ThemeIcon("bookmark", new vscode.ThemeColor("charts.blue"))
      : new vscode.ThemeIcon("bookmark");
    item.description = this.manager.bookmarkLocation(bookmark);
    item.tooltip = this.manager.bookmarkTooltip(bookmark, element.listId);
    item.command = {
      command: `${commandPrefix}.open`,
      title: "Open Bookmark",
      arguments: [bookmark],
    };
    return item;
  }

  getChildren(element) {
    if (!element) {
      const roots = this.manager.state.lists.map((list) => ({ kind: "list", list }));
      if (this.vscode.debug.breakpoints.length > 0) roots.push({ kind: "breakpoints" });
      return roots;
    }
    if (element.kind === "list") {
      return element.list.bookmarks.map((bookmark) => ({
        kind: "bookmark",
        bookmark,
        listId: element.list.id,
      }));
    }
    if (element.kind === "breakpoints") {
      return this.vscode.debug.breakpoints
        .filter((breakpoint) => breakpoint.location?.uri)
        .map((breakpoint) => ({ kind: "breakpoint", breakpoint }));
    }
    return [];
  }

  dispose() {
    this.emitter.dispose();
  }
}

class BookmarksDragAndDropController {
  constructor(vscode, manager) {
    this.vscode = vscode;
    this.manager = manager;
    this.dragMimeTypes = [dragMimeType];
    this.dropMimeTypes = [dragMimeType];
  }

  handleDrag(source, dataTransfer) {
    const bookmarkIds = source
      .filter((item) => item.kind === "bookmark")
      .map((item) => item.bookmark.id);
    if (bookmarkIds.length > 0) {
      dataTransfer.set(dragMimeType, new this.vscode.DataTransferItem(bookmarkIds));
    }
  }

  async handleDrop(target, dataTransfer) {
    if (!target || target.kind !== "list") return;
    const item = dataTransfer.get(dragMimeType);
    const bookmarkIds = item?.value;
    if (!Array.isArray(bookmarkIds)) return;
    for (const bookmarkId of bookmarkIds) {
      await this.manager.moveBookmarkById(bookmarkId, target.list.id, false);
    }
    await this.manager.commitChanges();
  }
}

class BookmarkManager {
  constructor(vscode, context) {
    this.vscode = vscode;
    this.context = context;
    this.state = normalizeState(
      context.workspaceState.get(stateKey),
      vscode.workspace.name || "Bookmarks",
    );
    this.provider = new BookmarksTreeProvider(vscode, this);
    this.offsets = new Map();
    this.decorationTypes = new Map();
    this.saveChain = Promise.resolve();
  }

  activate() {
    const { vscode, context } = this;
    this.treeView = vscode.window.createTreeView(viewId, {
      treeDataProvider: this.provider,
      dragAndDropController: new BookmarksDragAndDropController(vscode, this),
      canSelectMany: true,
      showCollapseAll: true,
    });
    context.subscriptions.push(this.treeView, this.provider);

    const register = (name, handler) =>
      context.subscriptions.push(
        vscode.commands.registerCommand(`${commandPrefix}.${name}`, handler),
      );

    register("toggle", (...args) =>
      this.toggleCurrentLine(false, this.lineFromCommandArguments(args)),
    );
    register("toggleMnemonic", (...args) =>
      this.toggleCurrentLine(true, this.lineFromCommandArguments(args)),
    );
    register("show", () => this.showBookmarksPopup());
    register("next", () => this.navigateRelative(1, false));
    register("previous", () => this.navigateRelative(-1, false));
    register("nextInEditor", () => this.navigateRelative(1, true));
    register("previousInEditor", () => this.navigateRelative(-1, true));
    register("openView", () =>
      vscode.commands.executeCommand(`${viewId}.focus`),
    );
    register("open", (bookmark) => this.openBookmark(bookmark));
    register("openBreakpoint", (breakpoint) => this.openBreakpoint(breakpoint));
    register("addResource", (uri, selectedUris) =>
      this.toggleResources(selectedUris?.length ? selectedUris : [uri], false),
    );
    register("addResourceMnemonic", (uri) => this.toggleResources([uri], true));
    register("renameBookmark", (node) => this.renameBookmark(node?.bookmark));
    register("removeMnemonic", (node) => this.removeMnemonic(node?.bookmark));
    register("deleteBookmark", (node) => this.deleteBookmark(node?.bookmark));
    register("moveBookmark", (node) => this.moveBookmark(node?.bookmark));
    register("moveBookmarkUp", (node) => this.moveBookmarkWithinList(node?.bookmark, -1));
    register("moveBookmarkDown", (node) => this.moveBookmarkWithinList(node?.bookmark, 1));
    register("createList", () => this.createList());
    register("renameList", (node) => this.renameList(node?.list));
    register("deleteList", (node) => this.deleteList(node?.list));
    register("setDefaultList", (node) => this.setDefaultList(node?.list));
    register("bookmarkOpenTabs", () => this.bookmarkOpenTabs());
    for (let digit = 0; digit <= 9; digit += 1) {
      register(`toggle${digit}`, () => this.toggleNumberedBookmark(String(digit)));
      register(`goTo${digit}`, () => this.goToMnemonic(String(digit)));
    }

    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.renderDecorations()),
      vscode.window.onDidChangeVisibleTextEditors(() => this.renderDecorations()),
      vscode.workspace.onDidOpenTextDocument((document) => {
        this.initializeOffsets(document);
        void this.relocateDocumentBookmarks(document);
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.offsets.delete(document.uri.toString());
      }),
      vscode.workspace.onDidChangeTextDocument((event) => this.handleDocumentChange(event)),
      vscode.workspace.onDidRenameFiles((event) => this.handleRenamedFiles(event)),
      vscode.workspace.onDidDeleteFiles((event) => this.handleDeletedFiles(event)),
      vscode.debug.onDidChangeBreakpoints(() => this.provider.refresh()),
    );

    for (const document of vscode.workspace.textDocuments) {
      this.initializeOffsets(document);
      void this.relocateDocumentBookmarks(document);
    }
    this.renderDecorations();
  }

  allBookmarks() {
    return this.state.lists.flatMap((list) =>
      list.bookmarks.map((bookmark) => ({ bookmark, list })),
    );
  }

  lineFromCommandArguments(args) {
    const lineNumber = args.find((value) => Number.isInteger(value));
    return typeof lineNumber === "number" ? Math.max(0, lineNumber - 1) : undefined;
  }

  defaultList() {
    return (
      this.state.lists.find((list) => list.id === this.state.defaultListId) ||
      this.state.lists[0]
    );
  }

  findBookmark(bookmarkId) {
    for (const list of this.state.lists) {
      const index = list.bookmarks.findIndex((bookmark) => bookmark.id === bookmarkId);
      if (index >= 0) return { bookmark: list.bookmarks[index], list, index };
    }
    return undefined;
  }

  findAt(uri, line) {
    const uriValue = uri.toString();
    return this.allBookmarks().find(
      ({ bookmark }) => bookmark.uri === uriValue && bookmark.line === line,
    );
  }

  bookmarkLabel(bookmark) {
    const marker = bookmark.mnemonic ? `[${bookmark.mnemonic}] ` : "";
    if (bookmark.description?.trim()) return `${marker}${bookmark.description.trim()}`;
    if (bookmark.kind === "line") {
      const text = bookmark.anchor?.text?.trim();
      return `${marker}${text || `Line ${(bookmark.line ?? 0) + 1}`}`;
    }
    const uri = this.vscode.Uri.parse(bookmark.uri);
    return `${marker}${path.basename(uri.fsPath || uri.path) || uri.toString()}`;
  }

  bookmarkLocation(bookmark) {
    const uri = this.vscode.Uri.parse(bookmark.uri);
    const resourcePath = this.vscode.workspace.asRelativePath(uri, false);
    return bookmark.kind === "line" ? `${resourcePath}:${(bookmark.line ?? 0) + 1}` : resourcePath;
  }

  bookmarkTooltip(bookmark, listId) {
    const list = this.state.lists.find((candidate) => candidate.id === listId);
    const lines = [this.bookmarkLabel(bookmark), this.bookmarkLocation(bookmark)];
    if (list) lines.push(`List: ${list.name}`);
    return lines.join("\n");
  }

  async persist() {
    const snapshot = JSON.parse(JSON.stringify(this.state));
    this.saveChain = this.saveChain.then(() => this.context.workspaceState.update(stateKey, snapshot));
    await this.saveChain;
  }

  async commitChanges() {
    await this.persist();
    this.provider.refresh();
    this.renderDecorations();
  }

  decorationType(mnemonic) {
    const key = mnemonic || "anonymous";
    if (this.decorationTypes.has(key)) return this.decorationTypes.get(key);
    const svg = mnemonic
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect x="1" y="1" width="16" height="16" rx="3" fill="#4B6EAF"/><text x="9" y="13" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#fff">${mnemonic}</text></svg>`
      : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h7A1.5 1.5 0 0 1 14 2.5V17l-5-3-5 3z" fill="#4B6EAF"/></svg>';
    const type = this.vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svg)}`),
      gutterIconSize: "contain",
      overviewRulerColor: "#4B6EAF",
      overviewRulerLane: this.vscode.OverviewRulerLane.Right,
    });
    this.decorationTypes.set(key, type);
    this.context.subscriptions.push(type);
    return type;
  }

  renderDecorations() {
    for (const editor of this.vscode.window.visibleTextEditors) {
      for (const type of this.decorationTypes.values()) editor.setDecorations(type, []);
      const bookmarks = this.allBookmarks()
        .map(({ bookmark }) => bookmark)
        .filter(
          (bookmark) =>
            bookmark.kind === "line" && bookmark.uri === editor.document.uri.toString(),
        );
      const byType = new Map();
      for (const bookmark of bookmarks) {
        const line = Math.max(0, Math.min(bookmark.line ?? 0, editor.document.lineCount - 1));
        const type = this.decorationType(bookmark.mnemonic);
        const options = {
          range: editor.document.lineAt(line).range,
          hoverMessage: this.bookmarkLabel(bookmark),
        };
        const entries = byType.get(type) || [];
        entries.push(options);
        byType.set(type, entries);
      }
      for (const [type, options] of byType) editor.setDecorations(type, options);
    }
  }

  initializeOffsets(document) {
    const offsets = new Map();
    for (const { bookmark } of this.allBookmarks()) {
      if (bookmark.kind !== "line" || bookmark.uri !== document.uri.toString()) continue;
      const line = Math.max(0, Math.min(bookmark.line ?? 0, document.lineCount - 1));
      const character = Math.max(
        0,
        Math.min(bookmark.character ?? 0, document.lineAt(line).text.length),
      );
      offsets.set(bookmark.id, document.offsetAt(new this.vscode.Position(line, character)));
    }
    this.offsets.set(document.uri.toString(), offsets);
  }

  async relocateDocumentBookmarks(document) {
    let changed = false;
    for (const { bookmark } of this.allBookmarks()) {
      if (bookmark.kind !== "line" || bookmark.uri !== document.uri.toString()) continue;
      const line = findAnchoredLine(document, bookmark);
      if (line !== bookmark.line) {
        bookmark.line = line;
        bookmark.character = Math.min(bookmark.character ?? 0, document.lineAt(line).text.length);
        changed = true;
      }
      bookmark.anchor = captureAnchor(document, line);
    }
    this.initializeOffsets(document);
    if (changed) await this.commitChanges();
    else this.renderDecorations();
  }

  handleDocumentChange(event) {
    const uriValue = event.document.uri.toString();
    let offsets = this.offsets.get(uriValue);
    if (!offsets) {
      this.initializeOffsets(event.document);
      offsets = this.offsets.get(uriValue);
    }
    let changed = false;
    for (const { bookmark } of this.allBookmarks()) {
      if (bookmark.kind !== "line" || bookmark.uri !== uriValue) continue;
      const oldOffset = offsets.get(bookmark.id) ?? 0;
      const newOffset = adjustOffset(oldOffset, event.contentChanges);
      offsets.set(bookmark.id, newOffset);
      const position = event.document.positionAt(newOffset);
      bookmark.line = position.line;
      bookmark.character = position.character;
      bookmark.anchor = captureAnchor(event.document, position.line);
      changed = true;
    }
    if (changed) void this.commitChanges();
  }

  async handleRenamedFiles(event) {
    let changed = false;
    for (const { oldUri, newUri } of event.files) {
      for (const { bookmark } of this.allBookmarks()) {
        const nextUri = replaceUriPrefix(
          this.vscode,
          bookmark.uri,
          oldUri.toString(),
          newUri.toString(),
        );
        if (nextUri !== bookmark.uri) {
          bookmark.uri = nextUri;
          changed = true;
        }
      }
    }
    if (changed) await this.commitChanges();
  }

  async handleDeletedFiles(event) {
    let changed = false;
    for (const list of this.state.lists) {
      const previousLength = list.bookmarks.length;
      list.bookmarks = list.bookmarks.filter(
        (bookmark) =>
          !event.files.some((uri) =>
            uriIsEqualOrChild(this.vscode, bookmark.uri, uri.toString()),
          ),
      );
      changed ||= list.bookmarks.length !== previousLength;
    }
    if (changed) await this.commitChanges();
  }

  async toggleCurrentLine(withMnemonic, requestedLine) {
    const editor = this.vscode.window.activeTextEditor;
    if (!editor) {
      await this.vscode.window.showInformationMessage("Open an editor to add a bookmark.");
      return;
    }
    const line = Math.max(
      0,
      Math.min(requestedLine ?? editor.selection.active.line, editor.document.lineCount - 1),
    );
    const existing = this.findAt(editor.document.uri, line);
    if (!withMnemonic) {
      if (existing) {
        existing.list.bookmarks.splice(existing.list.bookmarks.indexOf(existing.bookmark), 1);
      } else {
        this.defaultList().bookmarks.push({
          id: createId("bookmark"),
          kind: "line",
          uri: editor.document.uri.toString(),
          line,
          character: editor.selection.active.character,
          anchor: captureAnchor(editor.document, line),
          createdAt: Date.now(),
        });
      }
      this.initializeOffsets(editor.document);
      await this.commitChanges();
      return;
    }
    await this.assignMnemonic(
      existing?.bookmark,
      {
        kind: "line",
        uri: editor.document.uri.toString(),
        line,
        character: editor.selection.active.character,
        anchor: captureAnchor(editor.document, line),
      },
    );
    this.initializeOffsets(editor.document);
  }

  async toggleResources(uris, withMnemonic) {
    const candidates = (uris || []).filter((uri) => uri?.scheme);
    if (candidates.length === 0) return;
    if (withMnemonic) {
      await this.assignMnemonic(undefined, {
        kind: "resource",
        uri: candidates[0].toString(),
      });
      return;
    }
    for (const uri of candidates) {
      const uriValue = uri.toString();
      const existing = this.allBookmarks().find(
        ({ bookmark }) => bookmark.kind === "resource" && bookmark.uri === uriValue,
      );
      if (existing) {
        existing.list.bookmarks.splice(existing.list.bookmarks.indexOf(existing.bookmark), 1);
      } else {
        this.defaultList().bookmarks.push({
          id: createId("bookmark"),
          kind: "resource",
          uri: uriValue,
          createdAt: Date.now(),
        });
      }
    }
    await this.commitChanges();
  }

  async chooseMnemonic(currentMnemonic) {
    const choices = mnemonicValues().map((value) => ({
      label: value,
      description: value === currentMnemonic ? "Current mnemonic" : undefined,
    }));
    const picked = await this.vscode.window.showQuickPick(choices, {
      placeHolder: "Choose a bookmark mnemonic (0-9 or A-Z)",
      matchOnDescription: true,
    });
    return picked?.label;
  }

  async assignMnemonic(existingBookmark, target) {
    const mnemonic = await this.chooseMnemonic(existingBookmark?.mnemonic);
    if (!mnemonic) return;
    const description = await this.vscode.window.showInputBox({
      title: `Bookmark ${mnemonic}`,
      prompt: "Optional bookmark description",
      value: existingBookmark?.description || "",
      ignoreFocusOut: true,
    });
    if (typeof description === "undefined") return;

    const occupied = this.allBookmarks().find(
      ({ bookmark }) => bookmark.mnemonic === mnemonic && bookmark.id !== existingBookmark?.id,
    );
    if (occupied) {
      const ask = this.vscode.workspace
        .getConfiguration("golandStyle.bookmarks")
        .get("askBeforeReplacingMnemonic", true);
      if (ask) {
        const choice = await this.vscode.window.showWarningMessage(
          `Bookmark ${mnemonic} is already assigned to ${this.bookmarkLocation(occupied.bookmark)}. Replace it?`,
          { modal: true },
          "Replace",
        );
        if (choice !== "Replace") return;
      }
      occupied.list.bookmarks.splice(occupied.list.bookmarks.indexOf(occupied.bookmark), 1);
    }

    const bookmark = existingBookmark || {
      id: createId("bookmark"),
      createdAt: Date.now(),
      ...target,
    };
    Object.assign(bookmark, target, {
      mnemonic,
      description: description.trim() || undefined,
    });
    if (!existingBookmark) this.defaultList().bookmarks.push(bookmark);
    await this.commitChanges();
  }

  async showBookmarksPopup() {
    const onlyLines = this.vscode.workspace
      .getConfiguration("golandStyle.bookmarks")
      .get("showOnlyLineBookmarksInPopup", true);
    const entries = this.allBookmarks().filter(
      ({ bookmark }) => !onlyLines || bookmark.kind === "line",
    );
    if (entries.length === 0) {
      await this.vscode.window.showInformationMessage("No bookmarks in this workspace.");
      return;
    }

    const picker = this.vscode.window.createQuickPick();
    picker.placeholder = "Select a bookmark; type its mnemonic to jump directly";
    picker.matchOnDescription = true;
    picker.matchOnDetail = true;
    picker.items = entries.map(({ bookmark, list }) => ({
      label: `${bookmark.mnemonic ? `[${bookmark.mnemonic}] ` : ""}${this.bookmarkLabel(bookmark).replace(/^\[[0-9A-Z]\] /, "")}`,
      description: list.name,
      detail: this.bookmarkLocation(bookmark),
      bookmark,
    }));

    let opened = false;
    const open = async (item) => {
      if (!item || opened) return;
      opened = true;
      picker.hide();
      await this.openBookmark(item.bookmark);
    };
    const disposables = [
      picker.onDidAccept(() => void open(picker.selectedItems[0])),
      picker.onDidChangeValue((value) => {
        if (value.length !== 1) return;
        const mnemonic = value.toUpperCase();
        const item = picker.items.find((candidate) => candidate.bookmark.mnemonic === mnemonic);
        if (item) void open(item);
      }),
      picker.onDidHide(() => {
        for (const disposable of disposables) disposable.dispose();
        picker.dispose();
      }),
    ];
    picker.show();
  }

  async goToMnemonic(mnemonic) {
    const entry = this.allBookmarks().find(
      ({ bookmark }) => bookmark.mnemonic === mnemonic.toUpperCase(),
    );
    if (!entry) {
      await this.vscode.window.showInformationMessage(`Bookmark ${mnemonic} is not assigned.`);
      return;
    }
    await this.openBookmark(entry.bookmark);
  }

  async toggleNumberedBookmark(mnemonic) {
    const editor = this.vscode.window.activeTextEditor;
    if (!editor) {
      await this.vscode.window.showInformationMessage("Open an editor to add a bookmark.");
      return;
    }
    const line = editor.selection.active.line;
    const atCurrentLine = this.findAt(editor.document.uri, line);
    if (atCurrentLine?.bookmark.mnemonic === mnemonic) {
      atCurrentLine.list.bookmarks.splice(
        atCurrentLine.list.bookmarks.indexOf(atCurrentLine.bookmark),
        1,
      );
      this.initializeOffsets(editor.document);
      await this.commitChanges();
      return;
    }

    const occupied = this.allBookmarks().find(
      ({ bookmark }) => bookmark.mnemonic === mnemonic,
    );
    if (occupied) {
      const ask = this.vscode.workspace
        .getConfiguration("golandStyle.bookmarks")
        .get("askBeforeReplacingMnemonic", true);
      if (ask) {
        const choice = await this.vscode.window.showWarningMessage(
          `Bookmark ${mnemonic} is already assigned to ${this.bookmarkLocation(occupied.bookmark)}. Move it here?`,
          { modal: true },
          "Move",
        );
        if (choice !== "Move") return;
      }
      occupied.list.bookmarks.splice(occupied.list.bookmarks.indexOf(occupied.bookmark), 1);
    }

    const bookmark = atCurrentLine?.bookmark || {
      id: createId("bookmark"),
      kind: "line",
      uri: editor.document.uri.toString(),
      line,
      character: editor.selection.active.character,
      anchor: captureAnchor(editor.document, line),
      createdAt: Date.now(),
    };
    Object.assign(bookmark, {
      kind: "line",
      uri: editor.document.uri.toString(),
      line,
      character: editor.selection.active.character,
      anchor: captureAnchor(editor.document, line),
      mnemonic,
    });
    if (!atCurrentLine) this.defaultList().bookmarks.push(bookmark);
    this.initializeOffsets(editor.document);
    await this.commitChanges();
  }

  async navigateRelative(direction, currentDocumentOnly) {
    const editor = this.vscode.window.activeTextEditor;
    const activeUri = editor?.document.uri.toString();
    const activeLine = editor?.selection.active.line ?? -1;
    let bookmarks = this.allBookmarks()
      .map(({ bookmark }) => bookmark)
      .filter((bookmark) => bookmark.kind === "line");
    if (currentDocumentOnly) {
      bookmarks = bookmarks.filter((bookmark) => bookmark.uri === activeUri);
    }
    bookmarks.sort(
      (left, right) =>
        left.uri.localeCompare(right.uri) ||
        (left.line ?? 0) - (right.line ?? 0) ||
        left.id.localeCompare(right.id),
    );
    if (bookmarks.length === 0) {
      await this.vscode.window.showInformationMessage("No matching line bookmarks.");
      return;
    }

    let target;
    if (direction > 0) {
      target = bookmarks.find(
        (bookmark) =>
          !activeUri ||
          bookmark.uri.localeCompare(activeUri) > 0 ||
          (bookmark.uri === activeUri && (bookmark.line ?? 0) > activeLine),
      );
      target ||= bookmarks[0];
    } else {
      target = [...bookmarks]
        .reverse()
        .find(
          (bookmark) =>
            !activeUri ||
            bookmark.uri.localeCompare(activeUri) < 0 ||
            (bookmark.uri === activeUri && (bookmark.line ?? 0) < activeLine),
        );
      target ||= bookmarks[bookmarks.length - 1];
    }
    await this.openBookmark(target);
  }

  async openBookmark(bookmark) {
    if (!bookmark?.uri) return;
    const uri = this.vscode.Uri.parse(bookmark.uri);
    if (bookmark.kind !== "line") {
      try {
        const stat = await this.vscode.workspace.fs.stat(uri);
        if (stat.type & this.vscode.FileType.Directory) {
          await this.vscode.commands.executeCommand("workbench.view.explorer");
          await this.vscode.commands.executeCommand("revealInExplorer", uri);
          return;
        }
      } catch {
        // Let openTextDocument report a useful error for missing resources.
      }
    }

    try {
      const document = await this.vscode.workspace.openTextDocument(uri);
      let line = bookmark.kind === "line" ? findAnchoredLine(document, bookmark) : 0;
      line = Math.max(0, Math.min(line, document.lineCount - 1));
      const character = Math.max(
        0,
        Math.min(bookmark.character ?? 0, document.lineAt(line).text.length),
      );
      if (bookmark.kind === "line") {
        bookmark.line = line;
        bookmark.character = character;
        bookmark.anchor = captureAnchor(document, line);
        await this.persist();
      }
      const editor = await this.vscode.window.showTextDocument(document, { preview: false });
      const position = new this.vscode.Position(line, character);
      editor.selection = new this.vscode.Selection(position, position);
      editor.revealRange(
        new this.vscode.Range(position, position),
        this.vscode.TextEditorRevealType.InCenterIfOutsideViewport,
      );
    } catch (error) {
      await this.vscode.window.showErrorMessage(
        `Cannot open bookmark: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async openBreakpoint(breakpoint) {
    const location = breakpoint?.location;
    if (!location) return;
    const document = await this.vscode.workspace.openTextDocument(location.uri);
    const editor = await this.vscode.window.showTextDocument(document, { preview: false });
    editor.selection = new this.vscode.Selection(location.range.start, location.range.start);
    editor.revealRange(location.range, this.vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  async renameBookmark(bookmark) {
    if (!bookmark) return;
    const description = await this.vscode.window.showInputBox({
      title: "Rename Bookmark",
      prompt: "Enter a bookmark description",
      value: bookmark.description || "",
      ignoreFocusOut: true,
    });
    if (typeof description === "undefined") return;
    bookmark.description = description.trim() || undefined;
    await this.commitChanges();
  }

  async removeMnemonic(bookmark) {
    if (!bookmark) return;
    bookmark.mnemonic = undefined;
    await this.commitChanges();
  }

  async deleteBookmark(bookmark) {
    if (!bookmark) return;
    const found = this.findBookmark(bookmark.id);
    if (!found) return;
    found.list.bookmarks.splice(found.index, 1);
    await this.commitChanges();
  }

  async createList() {
    const name = await this.vscode.window.showInputBox({
      title: "Create Bookmark List",
      prompt: "List name",
      validateInput: (value) => (value.trim() ? undefined : "Enter a list name"),
      ignoreFocusOut: true,
    });
    if (!name?.trim()) return;
    const list = { id: createId("list"), name: name.trim(), bookmarks: [] };
    this.state.lists.push(list);
    const choice = await this.vscode.window.showQuickPick(["Yes", "No"], {
      placeHolder: "Use this as the default bookmark list?",
    });
    if (choice === "Yes") this.state.defaultListId = list.id;
    await this.commitChanges();
  }

  async renameList(list) {
    if (!list) return;
    const name = await this.vscode.window.showInputBox({
      title: "Rename Bookmark List",
      value: list.name,
      validateInput: (value) => (value.trim() ? undefined : "Enter a list name"),
      ignoreFocusOut: true,
    });
    if (!name?.trim()) return;
    list.name = name.trim();
    await this.commitChanges();
  }

  async deleteList(list) {
    if (!list) return;
    if (list.bookmarks.length > 0) {
      const choice = await this.vscode.window.showWarningMessage(
        `Delete “${list.name}” and its ${list.bookmarks.length} bookmark(s)?`,
        { modal: true },
        "Delete",
      );
      if (choice !== "Delete") return;
    }
    this.state.lists = this.state.lists.filter((candidate) => candidate.id !== list.id);
    if (this.state.lists.length === 0) {
      this.state = normalizeState(undefined, this.vscode.workspace.name || "Bookmarks");
    } else if (this.state.defaultListId === list.id) {
      this.state.defaultListId = this.state.lists[0].id;
    }
    await this.commitChanges();
  }

  async setDefaultList(list) {
    if (!list) return;
    this.state.defaultListId = list.id;
    await this.commitChanges();
  }

  async moveBookmark(bookmark) {
    if (!bookmark || this.state.lists.length < 2) return;
    const found = this.findBookmark(bookmark.id);
    const choices = this.state.lists
      .filter((list) => list.id !== found?.list.id)
      .map((list) => ({ label: list.name, list }));
    const picked = await this.vscode.window.showQuickPick(choices, {
      placeHolder: "Move bookmark to list",
    });
    if (!picked) return;
    await this.moveBookmarkById(bookmark.id, picked.list.id);
  }

  async moveBookmarkById(bookmarkId, targetListId, commit = true) {
    const found = this.findBookmark(bookmarkId);
    const targetList = this.state.lists.find((list) => list.id === targetListId);
    if (!found || !targetList || found.list.id === targetList.id) return;
    found.list.bookmarks.splice(found.index, 1);
    targetList.bookmarks.push(found.bookmark);
    if (commit) await this.commitChanges();
  }

  async moveBookmarkWithinList(bookmark, direction) {
    if (!bookmark) return;
    const found = this.findBookmark(bookmark.id);
    if (!found) return;
    const nextIndex = Math.max(
      0,
      Math.min(found.index + direction, found.list.bookmarks.length - 1),
    );
    if (nextIndex === found.index) return;
    found.list.bookmarks.splice(found.index, 1);
    found.list.bookmarks.splice(nextIndex, 0, found.bookmark);
    await this.commitChanges();
  }

  async bookmarkOpenTabs() {
    const uris = [];
    const seen = new Set();
    for (const group of this.vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const uri = tab.input?.uri;
        if (!uri || seen.has(uri.toString())) continue;
        seen.add(uri.toString());
        uris.push(uri);
      }
    }
    if (uris.length === 0) {
      await this.vscode.window.showInformationMessage("No file tabs are open.");
      return;
    }
    const name = await this.vscode.window.showInputBox({
      title: "Bookmark Open Tabs",
      prompt: "New bookmark list name",
      value: `Open Tabs ${new Date().toLocaleDateString()}`,
      ignoreFocusOut: true,
    });
    if (!name?.trim()) return;
    const list = {
      id: createId("list"),
      name: name.trim(),
      bookmarks: uris.map((uri) => ({
        id: createId("bookmark"),
        kind: "resource",
        uri: uri.toString(),
        createdAt: Date.now(),
      })),
    };
    this.state.lists.push(list);
    await this.commitChanges();
  }
}

function activateBookmarks(vscode, context) {
  const manager = new BookmarkManager(vscode, context);
  manager.activate();
  return manager;
}

module.exports = {
  activateBookmarks,
  adjustOffset,
  captureAnchor,
  findAnchoredLine,
  normalizeState,
};
