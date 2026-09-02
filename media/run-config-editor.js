(() => {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");
  const persisted = vscode.getState() || {};
  let sourceText = "";
  let model = { version: "0.2.0", configurations: [], compounds: [] };
  let selectedIndex = Number.isInteger(persisted.selectedIndex) ? persisted.selectedIndex : 0;
  let activeTab = persisted.activeTab === "raw" ? "raw" : "form";
  let tasks = [];
  let file = "";
  let workspace = "";
  let parseErrors = [];
  let dirty = false;
  let statusText = "";

  const knownFields = new Set([
    "name", "type", "request", "mode", "program", "cwd", "output", "envFile",
    "buildFlags", "args", "env", "preLaunchTask", "host", "port", "stopOnEntry",
    "showLog", "console",
  ]);

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function currentConfiguration() {
    return model.configurations[selectedIndex];
  }

  function option(value, label, current) {
    return `<option value="${escapeHtml(value)}"${current === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function textValue(value) {
    return value === undefined || value === null ? "" : String(value);
  }

  function argsValue(value) {
    return Array.isArray(value) ? value.map(textValue).join("\n") : "";
  }

  function envValue(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    return Object.entries(value)
      .map(([key, item]) => `${key}=${textValue(item)}`)
      .join("\n");
  }

  function field(label, name, value, { placeholder = "", button = "", kind = "" } = {}) {
    const input = `<input data-field="${name}" value="${escapeHtml(textValue(value))}" placeholder="${escapeHtml(placeholder)}">`;
    return `<label for="field-${name}">${escapeHtml(label)}</label>
      ${button
        ? `<div class="field-with-button">${input}<button class="secondary icon" data-action="pick" data-field="${name}" data-kind="${kind}" title="${escapeHtml(button)}">…</button></div>`
        : input}`;
  }

  function renderForm() {
    const config = currentConfiguration();
    if (!config) {
      return `<div class="empty">还没有运行配置。单击左上角的“＋”创建一个 Go 配置。</div>`;
    }
    const advancedCount = Object.keys(config).filter((key) => !knownFields.has(key)).length;
    return `<div class="form">
      ${field("名称", "name", config.name, { placeholder: "Go: Launch Package" })}
      <label>调试器类型</label>
      <input data-field="type" list="debug-types" value="${escapeHtml(textValue(config.type || "go"))}">
      <datalist id="debug-types"><option value="go"></option><option value="node"></option><option value="python"></option></datalist>
      <label>请求类型</label>
      <select data-field="request">
        ${option("launch", "启动 (launch)", config.request)}
        ${option("attach", "附加 (attach)", config.request)}
      </select>
      <div class="section-title">配置</div>
      <label>Go 运行模式</label>
      <select data-field="mode">
        ${option("auto", "自动", config.mode || "auto")}
        ${option("debug", "调试源码/包", config.mode)}
        ${option("test", "测试", config.mode)}
        ${option("exec", "可执行文件", config.mode)}
        ${option("remote", "远程", config.mode)}
        ${option("core", "Core dump", config.mode)}
      </select>
      ${field("程序/软件包", "program", config.program, { placeholder: "${workspaceFolder}", button: "选择文件或目录", kind: "either" })}
      ${field("工作目录", "cwd", config.cwd, { placeholder: "${workspaceFolder}", button: "选择目录", kind: "folder" })}
      ${field("调试二进制输出", "output", config.output, { placeholder: "可选", button: "选择输出位置", kind: "either" })}
      ${field("环境变量文件", "envFile", config.envFile, { placeholder: "可选 .env 文件", button: "选择文件", kind: "file" })}
      <label>Go 构建参数</label>
      <input data-field="buildFlags" value="${escapeHtml(textValue(config.buildFlags))}" placeholder="例如：-tags integration">
      <label>程序参数</label>
      <textarea data-field="args" placeholder="每行一个参数">${escapeHtml(argsValue(config.args))}</textarea>
      <div class="hint">每一行会保存为 launch.json 的一个 args 数组元素。</div>
      <label>环境变量</label>
      <textarea data-field="env" placeholder="每行 KEY=VALUE">${escapeHtml(envValue(config.env))}</textarea>
      <div class="hint">值中可以继续包含等号；空行会被忽略。</div>
      <label>启动前任务</label>
      <input data-field="preLaunchTask" list="task-list" value="${escapeHtml(textValue(config.preLaunchTask))}" placeholder="tasks.json 中的任务名称">
      <datalist id="task-list">${tasks.map((task) => `<option value="${escapeHtml(task)}"></option>`).join("")}</datalist>
      <label>控制台</label>
      <select data-field="console">
        ${option("", "调试器默认", config.console || "")}
        ${option("integratedTerminal", "集成终端", config.console)}
        ${option("internalConsole", "调试控制台", config.console)}
        ${option("externalTerminal", "外部终端", config.console)}
      </select>
      <div class="section-title">附加与远程</div>
      ${field("主机", "host", config.host, { placeholder: "127.0.0.1" })}
      ${field("端口", "port", config.port, { placeholder: "2345" })}
      <label>选项</label>
      <div>
        <div class="checkbox-field"><input type="checkbox" data-field="stopOnEntry"${config.stopOnEntry ? " checked" : ""}><span>在入口处暂停</span></div>
        <div class="checkbox-field"><input type="checkbox" data-field="showLog"${config.showLog ? " checked" : ""}><span>显示 Delve 日志</span></div>
      </div>
      <div class="hint">${advancedCount ? `另有 ${advancedCount} 个高级字段会原样保留，可在“原始 JSON”中编辑。` : "未识别字段会原样保留。"}</div>
    </div>`;
  }

  function renderSidebar() {
    const items = model.configurations.map((config, index) => `
      <li class="${index === selectedIndex ? "selected" : ""}" data-action="select" data-index="${index}">
        <span>${config.type === "go" ? "Go" : "◆"}</span>
        <span class="name">${escapeHtml(config.name || `未命名配置 ${index + 1}`)}</span>
      </li>`).join("");
    return `<aside class="sidebar">
      <div class="toolbar">
        <button class="icon" data-action="add" title="新增">＋</button>
        <button class="icon" data-action="delete" title="删除"${currentConfiguration() ? "" : " disabled"}>−</button>
        <button class="icon" data-action="duplicate" title="复制"${currentConfiguration() ? "" : " disabled"}>⧉</button>
        <button class="icon" data-action="up" title="上移"${selectedIndex > 0 ? "" : " disabled"}>↑</button>
        <button class="icon" data-action="down" title="下移"${selectedIndex >= 0 && selectedIndex < model.configurations.length - 1 ? "" : " disabled"}>↓</button>
      </div>
      <ul class="config-list">${items}</ul>
    </aside>`;
  }

  function render() {
    if (selectedIndex >= model.configurations.length) selectedIndex = model.configurations.length - 1;
    if (selectedIndex < 0 && model.configurations.length) selectedIndex = 0;
    vscode.setState({ selectedIndex, activeTab });
    const errors = parseErrors.length
      ? `<div class="error-panel">launch.json 有语法错误（${escapeHtml(parseErrors[0].code)}）。请切换到“原始 JSON”修复。</div>`
      : "";
    app.innerHTML = `<div class="shell">
      <header class="titlebar">
        <h1>运行/调试配置</h1>
        ${workspace ? `<span class="workspace">${escapeHtml(workspace)}</span>` : ""}
        <span class="file" title="${escapeHtml(file)}">${escapeHtml(file)}</span>
        <button class="secondary" data-action="openText">打开 JSON</button>
      </header>
      <main class="main">
        ${renderSidebar()}
        <section class="content">
          <nav class="tabs">
            <button class="tab ${activeTab === "form" ? "active" : ""}" data-action="tab" data-tab="form">配置</button>
            <button class="tab ${activeTab === "raw" ? "active" : ""}" data-action="tab" data-tab="raw">原始 JSON</button>
          </nav>
          ${activeTab === "raw"
            ? `<div class="raw-wrap"><textarea class="raw-editor" data-raw spellcheck="false">${escapeHtml(sourceText)}</textarea></div>`
            : errors || renderForm()}
        </section>
      </main>
      <footer class="footer">
        <span class="status ${dirty ? "dirty" : ""}">${escapeHtml(statusText || (dirty ? "有尚未应用的更改" : "配置已同步"))}</span>
        <button class="secondary" data-action="run"${currentConfiguration() && !parseErrors.length ? "" : " disabled"}>运行</button>
        <button class="secondary" data-action="debug"${currentConfiguration() && !parseErrors.length ? "" : " disabled"}>调试</button>
        <button data-action="ok"${parseErrors.length ? " disabled" : ""}>确定</button>
        <button class="secondary" data-action="cancel">取消</button>
        <button class="secondary" data-action="apply"${parseErrors.length ? " disabled" : ""}>应用</button>
      </footer>
    </div>`;
  }

  function markDirty(message = "有尚未应用的更改") {
    dirty = true;
    statusText = message;
    const status = document.querySelector(".status");
    if (status) {
      status.textContent = statusText;
      status.classList.add("dirty");
    }
  }

  function parseArgs(value) {
    return value.split(/\r?\n/).filter((line) => line.length > 0);
  }

  function parseEnv(value) {
    const result = {};
    for (const line of value.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      result[line.slice(0, separator).trim()] = line.slice(separator + 1);
    }
    return result;
  }

  function updateField(element) {
    const config = currentConfiguration();
    if (!config) return;
    const name = element.dataset.field;
    let value;
    if (element.type === "checkbox") value = element.checked;
    else if (name === "args") value = parseArgs(element.value);
    else if (name === "env") value = parseEnv(element.value);
    else if (name === "port") value = element.value.trim() ? Number(element.value) : undefined;
    else value = element.value;

    const required = new Set(["name", "type", "request"]);
    if (!required.has(name) && (value === "" || value === undefined || (Array.isArray(value) && !value.length) || (name === "env" && !Object.keys(value).length))) {
      delete config[name];
    } else {
      config[name] = value;
    }
    if (name === "name") {
      const rowName = document.querySelector(`li[data-index="${selectedIndex}"] .name`);
      if (rowName) rowName.textContent = value || `未命名配置 ${selectedIndex + 1}`;
    }
    markDirty();
  }

  function addConfiguration() {
    model.configurations.push({
      name: `Go: Launch Package${model.configurations.length ? ` ${model.configurations.length + 1}` : ""}`,
      type: "go",
      request: "launch",
      mode: "auto",
      program: "${workspaceFolder}",
    });
    selectedIndex = model.configurations.length - 1;
    markDirty("已新增配置，单击“应用”保存");
    render();
  }

  function apply(close = false) {
    const raw = activeTab === "raw"
      ? document.querySelector("[data-raw]")?.value ?? sourceText
      : undefined;
    if (raw !== undefined) sourceText = raw;
    statusText = "正在保存…";
    render();
    if (activeTab === "raw") {
      vscode.postMessage({ type: "applyRaw", text: raw, close });
    } else {
      vscode.postMessage({ type: "applyStructured", model: clone(model), close });
    }
  }

  function start(noDebug) {
    if (!currentConfiguration()) return;
    statusText = noDebug ? "正在启动运行配置…" : "正在启动调试配置…";
    render();
    vscode.postMessage({
      type: "start",
      model: clone(model),
      index: selectedIndex,
      noDebug,
    });
  }

  app.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-field]")) updateField(target);
    if (target.matches("[data-raw]")) markDirty();
  });

  app.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("select[data-field], input[type=checkbox][data-field]")) updateField(target);
  });

  app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "select") {
      selectedIndex = Number(button.dataset.index);
      render();
    } else if (action === "add") {
      addConfiguration();
    } else if (action === "delete" && currentConfiguration()) {
      model.configurations.splice(selectedIndex, 1);
      selectedIndex = Math.min(selectedIndex, model.configurations.length - 1);
      markDirty("已删除配置，单击“应用”保存");
      render();
    } else if (action === "duplicate" && currentConfiguration()) {
      const copy = clone(currentConfiguration());
      copy.name = `${copy.name || "未命名配置"} Copy`;
      model.configurations.splice(selectedIndex + 1, 0, copy);
      selectedIndex += 1;
      markDirty("已复制配置，单击“应用”保存");
      render();
    } else if ((action === "up" || action === "down") && currentConfiguration()) {
      const next = selectedIndex + (action === "up" ? -1 : 1);
      if (next >= 0 && next < model.configurations.length) {
        [model.configurations[selectedIndex], model.configurations[next]] = [model.configurations[next], model.configurations[selectedIndex]];
        selectedIndex = next;
        markDirty("已调整配置顺序，单击“应用”保存");
        render();
      }
    } else if (action === "tab") {
      const nextTab = button.dataset.tab;
      if (nextTab !== activeTab && dirty && !window.confirm("切换编辑模式会放弃尚未应用的更改，是否继续？")) return;
      if (dirty) vscode.postMessage({ type: "reload" });
      dirty = false;
      statusText = "";
      activeTab = nextTab;
      render();
    } else if (action === "pick") {
      vscode.postMessage({ type: "pickPath", field: button.dataset.field, kind: button.dataset.kind });
    } else if (action === "apply") {
      apply(false);
    } else if (action === "ok") {
      apply(true);
    } else if (action === "cancel") {
      vscode.postMessage({ type: "cancel" });
    } else if (action === "debug") {
      start(false);
    } else if (action === "run") {
      start(true);
    } else if (action === "openText") {
      vscode.postMessage({ type: "openText" });
    }
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type === "state") {
      sourceText = message.text;
      model = clone(message.model);
      tasks = message.tasks || [];
      file = message.file || "";
      workspace = message.workspace || "";
      parseErrors = message.errors || [];
      if (message.selectedName) {
        const requestedIndex = model.configurations.findIndex(
          (configuration) => configuration.name === message.selectedName,
        );
        if (requestedIndex >= 0) selectedIndex = requestedIndex;
      }
      selectedIndex = Math.min(Math.max(selectedIndex, 0), model.configurations.length - 1);
      dirty = false;
      statusText = parseErrors.length ? "请在原始 JSON 中修复语法错误" : "配置已同步";
      if (parseErrors.length) activeTab = "raw";
      render();
    } else if (message?.type === "pickedPath") {
      const input = document.querySelector(`[data-field="${CSS.escape(message.field)}"]`);
      if (input) {
        input.value = message.value;
        updateField(input);
      }
    } else if (message?.type === "applied") {
      dirty = false;
      statusText = "已保存到 launch.json";
      render();
    } else if (message?.type === "operationError") {
      statusText = `操作失败：${message.message || "未知错误"}`;
      dirty = true;
      render();
    }
  });

  vscode.postMessage({ type: "ready" });
})();
