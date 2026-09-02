const path = require("node:path");
const { randomBytes } = require("node:crypto");
const {
  applyEdits,
  modify,
  parse,
  printParseErrorCode,
} = require("jsonc-parser");

const viewType = "jetbrainsStyleGo.runConfigurationEditor";
const openCommand = "jetbrainsStyleGo.runConfigurations.open";

function parseLaunchText(text) {
  const parseErrors = [];
  const value = parse(text, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: false,
  });
  return {
    value,
    errors: parseErrors.map((error) => ({
      code: printParseErrorCode(error.error),
      offset: error.offset,
      length: error.length,
    })),
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateLaunchModel(model) {
  const errors = [];
  if (!isPlainObject(model)) return ["launch.json 根节点必须是对象。"]; 
  if (!Array.isArray(model.configurations)) {
    return ["configurations 必须是数组。"]; 
  }

  model.configurations.forEach((configuration, index) => {
    if (!isPlainObject(configuration)) {
      errors.push(`第 ${index + 1} 个运行配置必须是对象。`);
      return;
    }
    for (const field of ["name", "type", "request"]) {
      if (typeof configuration[field] !== "string" || !configuration[field].trim()) {
        errors.push(`第 ${index + 1} 个运行配置缺少 ${field}。`);
      }
    }
    if (configuration.args !== undefined && !Array.isArray(configuration.args)) {
      errors.push(`配置“${configuration.name || index + 1}”的 args 必须是数组。`);
    }
    if (configuration.env !== undefined && !isPlainObject(configuration.env)) {
      errors.push(`配置“${configuration.name || index + 1}”的 env 必须是对象。`);
    }
  });

  if (model.compounds !== undefined && !Array.isArray(model.compounds)) {
    errors.push("compounds 必须是数组。");
  }
  return errors;
}

function applyValue(text, jsonPath, value, formattingOptions, options = {}) {
  return applyEdits(
    text,
    modify(text, jsonPath, value, {
      formattingOptions,
      ...options,
    }),
  );
}

function updateJsonValue(text, jsonPath, current, next, formattingOptions) {
  if (sameValue(current, next)) return text;

  if (isPlainObject(current) && isPlainObject(next)) {
    let updated = text;
    for (const key of Object.keys(current)) {
      if (!Object.hasOwn(next, key)) {
        updated = applyValue(updated, [...jsonPath, key], undefined, formattingOptions);
      }
    }
    for (const [key, nextValue] of Object.entries(next)) {
      updated = updateJsonValue(
        updated,
        [...jsonPath, key],
        current[key],
        nextValue,
        formattingOptions,
      );
    }
    return updated;
  }

  if (
    Array.isArray(current) &&
    Array.isArray(next) &&
    current.length === next.length &&
    current.every(isPlainObject) &&
    next.every(isPlainObject)
  ) {
    let updated = text;
    for (let index = 0; index < next.length; index += 1) {
      updated = updateJsonValue(
        updated,
        [...jsonPath, index],
        current[index],
        next[index],
        formattingOptions,
      );
    }
    return updated;
  }

  return applyValue(text, jsonPath, next, formattingOptions);
}

function updateLaunchText(text, proposedModel, formattingOptions = {}) {
  const parsed = parseLaunchText(text);
  if (parsed.errors.length) {
    throw new Error(`launch.json 存在语法错误：${parsed.errors[0].code}`);
  }
  const validationErrors = validateLaunchModel(proposedModel);
  if (validationErrors.length) throw new Error(validationErrors.join("\n"));

  const current = isPlainObject(parsed.value) ? parsed.value : {};
  const next = cloneJson(proposedModel);
  next.version = typeof next.version === "string" ? next.version : "0.2.0";
  next.compounds = Array.isArray(next.compounds) ? next.compounds : [];
  const format = {
    insertSpaces: true,
    tabSize: 2,
    eol: "\n",
    ...formattingOptions,
  };

  let updated = text;
  updated = updateJsonValue(updated, ["version"], current.version, next.version, format);
  updated = updateJsonValue(
    updated,
    ["configurations"],
    current.configurations,
    next.configurations,
    format,
  );
  if (current.compounds !== undefined || next.compounds.length) {
    updated = updateJsonValue(
      updated,
      ["compounds"],
      current.compounds,
      next.compounds,
      format,
    );
  }
  return updated;
}

function initialLaunchJson() {
  return `{
  // 使用 GoLand 风格运行/调试配置编辑器，或直接编辑此 JSONC 文件。
  "version": "0.2.0",
  "configurations": []
}
`;
}

function nonce() {
  return randomBytes(18).toString("base64");
}

function pathForLaunch(folderUri, vscode) {
  return vscode.Uri.joinPath(folderUri, ".vscode", "launch.json");
}

async function chooseWorkspaceFolder(vscode) {
  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 1) return folders[0];
  if (folders.length === 0) return undefined;
  const selected = await vscode.window.showQuickPick(
    folders.map((folder) => ({
      label: folder.name,
      description: folder.uri.fsPath || folder.uri.toString(),
      folder,
    })),
    { placeHolder: "选择要编辑运行/调试配置的工作区目录" },
  );
  return selected?.folder;
}

async function ensureLaunchJson(vscode, uri) {
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(initialLaunchJson(), "utf8"));
  }
}

function workspaceDisplayPath(uri, folder) {
  if (!folder || uri.scheme !== folder.uri.scheme) return uri.fsPath || uri.toString();
  const relative = path.relative(folder.uri.fsPath, uri.fsPath).replaceAll("\\", "/");
  if (!relative || relative === ".") return "${workspaceFolder}";
  if (!relative.startsWith("../")) return `\${workspaceFolder}/${relative}`;
  return uri.fsPath || uri.toString();
}

class RunConfigurationEditorProvider {
  constructor(vscode, context) {
    this.vscode = vscode;
    this.context = context;
    this.editChain = Promise.resolve();
  }

  async resolveCustomTextEditor(document, panel) {
    const { vscode, context } = this;
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
    };
    panel.webview.html = this.html(panel.webview);

    const sendState = () => this.sendState(document, panel.webview);
    const documentListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) void sendState();
    });
    const messageListener = panel.webview.onDidReceiveMessage((message) => {
      this.editChain = this.editChain
        .then(() => this.handleMessage(document, panel, message))
        .catch(async (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await panel.webview.postMessage({ type: "operationError", message: errorMessage });
          await vscode.window.showErrorMessage(`运行/调试配置操作失败：${errorMessage}`);
        });
    });
    panel.onDidDispose(() => {
      documentListener.dispose();
      messageListener.dispose();
    });
  }

  async taskNames() {
    try {
      return [...new Set((await this.vscode.tasks.fetchTasks()).map((task) => task.name))]
        .sort((left, right) => left.localeCompare(right));
    } catch {
      return [];
    }
  }

  async sendState(document, webview) {
    const text = document.getText();
    const parsed = parseLaunchText(text);
    const model = isPlainObject(parsed.value)
      ? {
          ...parsed.value,
          version: parsed.value.version || "0.2.0",
          configurations: Array.isArray(parsed.value.configurations)
            ? parsed.value.configurations
            : [],
          compounds: Array.isArray(parsed.value.compounds) ? parsed.value.compounds : [],
        }
      : { version: "0.2.0", configurations: [], compounds: [] };
    const folder = this.vscode.workspace.getWorkspaceFolder(document.uri);
    await webview.postMessage({
      type: "state",
      text,
      model,
      errors: parsed.errors,
      file: document.uri.fsPath || document.uri.toString(),
      workspace: folder?.name || "",
      tasks: await this.taskNames(),
    });
  }

  async replaceDocument(document, nextText) {
    if (document.getText() === nextText) return;
    const edit = new this.vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new this.vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
      nextText,
    );
    if (!(await this.vscode.workspace.applyEdit(edit))) {
      throw new Error("VS Code 拒绝了 launch.json 编辑操作。");
    }
    if (!(await document.save())) throw new Error("launch.json 保存失败。");
  }

  async applyStructured(document, model) {
    const eol = document.eol === this.vscode.EndOfLine.CRLF ? "\r\n" : "\n";
    const nextText = updateLaunchText(document.getText(), model, { eol });
    await this.replaceDocument(document, nextText);
  }

  async applyRaw(document, text) {
    const parsed = parseLaunchText(text);
    if (parsed.errors.length) {
      throw new Error(`原始 JSONC 存在语法错误：${parsed.errors[0].code}`);
    }
    const validationErrors = validateLaunchModel(parsed.value);
    if (validationErrors.length) throw new Error(validationErrors.join("\n"));
    await this.replaceDocument(document, text);
  }

  async pickPath(document, panel, message) {
    const folder = this.vscode.workspace.getWorkspaceFolder(document.uri);
    const selected = await this.vscode.window.showOpenDialog({
      defaultUri: folder?.uri,
      canSelectFiles: message.kind !== "folder",
      canSelectFolders: message.kind !== "file",
      canSelectMany: false,
      openLabel: "选择",
    });
    if (!selected?.[0]) return;
    await panel.webview.postMessage({
      type: "pickedPath",
      field: message.field,
      value: workspaceDisplayPath(selected[0], folder),
    });
  }

  async start(document, model, index, noDebug) {
    await this.applyStructured(document, model);
    const configuration = model.configurations?.[index];
    if (!configuration?.name) throw new Error("请先选择有效的运行配置。");
    const folder = this.vscode.workspace.getWorkspaceFolder(document.uri);
    const started = await this.vscode.debug.startDebugging(folder, configuration.name, {
      noDebug,
    });
    if (!started) throw new Error(`无法启动配置“${configuration.name}”。`);
  }

  async handleMessage(document, panel, message) {
    switch (message?.type) {
      case "ready":
      case "reload":
        await this.sendState(document, panel.webview);
        break;
      case "applyStructured":
        await this.applyStructured(document, message.model);
        await panel.webview.postMessage({ type: "applied" });
        if (message.close) {
          await this.vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }
        break;
      case "applyRaw":
        await this.applyRaw(document, message.text);
        await panel.webview.postMessage({ type: "applied" });
        if (message.close) {
          await this.vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }
        break;
      case "cancel":
        await this.vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        break;
      case "openText":
        await this.vscode.commands.executeCommand("vscode.openWith", document.uri, "default");
        break;
      case "pickPath":
        await this.pickPath(document, panel, message);
        break;
      case "start":
        await this.start(document, message.model, message.index, Boolean(message.noDebug));
        break;
      default:
        break;
    }
  }

  html(webview) {
    const styleUri = webview.asWebviewUri(
      this.vscode.Uri.joinPath(this.context.extensionUri, "media", "run-config-editor.css"),
    );
    const scriptUri = webview.asWebviewUri(
      this.vscode.Uri.joinPath(this.context.extensionUri, "media", "run-config-editor.js"),
    );
    const scriptNonce = nonce();
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${scriptNonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>运行/调试配置</title>
</head>
<body>
  <div id="app" aria-live="polite"></div>
  <script nonce="${scriptNonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function activateRunConfigurationEditor(vscode, context) {
  const provider = new RunConfigurationEditorProvider(vscode, context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(viewType, provider, {
      supportsMultipleEditorsPerDocument: false,
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand(openCommand, async (resourceUri) => {
      let launchUri;
      if (resourceUri?.scheme && path.basename(resourceUri.path || "") === "launch.json") {
        launchUri = resourceUri;
      } else {
        const folder = await chooseWorkspaceFolder(vscode);
        if (!folder) {
          await vscode.window.showWarningMessage("请先打开一个工作区目录，再编辑运行/调试配置。");
          return;
        }
        launchUri = pathForLaunch(folder.uri, vscode);
      }
      await ensureLaunchJson(vscode, launchUri);
      await vscode.commands.executeCommand("vscode.openWith", launchUri, viewType);
    }),
  );
  return provider;
}

module.exports = {
  activateRunConfigurationEditor,
  initialLaunchJson,
  parseLaunchText,
  updateLaunchText,
  validateLaunchModel,
  viewType,
};
