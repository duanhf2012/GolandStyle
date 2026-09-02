import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  initialLaunchJson,
  parseLaunchText,
  updateLaunchText,
  validateLaunchModel,
  viewType,
} = require("../run-config-editor");

assert.equal(viewType, "jetbrainsStyleGo.runConfigurationEditor");
assert.deepEqual(parseLaunchText(initialLaunchJson()).errors, []);

const source = `{
  // 顶层注释必须保留
  "version": "0.2.0",
  "configurations": [
    {
      // 配置内部注释也必须保留
      "name": "Old name",
      "type": "go",
      "request": "launch",
      "program": "\${workspaceFolder}",
      "customDebuggerField": { "enabled": true }
    }
  ],
  "customRootField": "keep-me"
}
`;

const parsed = parseLaunchText(source);
assert.deepEqual(parsed.errors, []);
const nextModel = {
  version: "0.2.0",
  configurations: [
    {
      ...parsed.value.configurations[0],
      name: "Go: Launch Package",
      cwd: "${workspaceFolder}/cmd/server",
      args: ["--config", "dev.yaml"],
    },
  ],
  compounds: [],
};
const updated = updateLaunchText(source, nextModel);
assert(updated.includes("// 顶层注释必须保留"));
assert(updated.includes("// 配置内部注释也必须保留"));
const updatedParsed = parseLaunchText(updated);
assert.deepEqual(updatedParsed.errors, []);
assert.equal(updatedParsed.value.customRootField, "keep-me");
assert.deepEqual(updatedParsed.value.configurations[0].customDebuggerField, {
  enabled: true,
});
assert.equal(updatedParsed.value.configurations[0].name, "Go: Launch Package");
assert.equal(updatedParsed.value.configurations[0].cwd, "${workspaceFolder}/cmd/server");
assert.deepEqual(updatedParsed.value.configurations[0].args, ["--config", "dev.yaml"]);

const withSecondConfiguration = updateLaunchText(updated, {
  ...nextModel,
  configurations: [
    ...nextModel.configurations,
    {
      name: "Go: Attach",
      type: "go",
      request: "attach",
      mode: "remote",
      host: "127.0.0.1",
      port: 2345,
    },
  ],
});
assert.equal(parseLaunchText(withSecondConfiguration).value.configurations.length, 2);
assert(withSecondConfiguration.includes("// 顶层注释必须保留"));

assert.deepEqual(
  validateLaunchModel({ version: "0.2.0", configurations: [] }),
  [],
);
assert(validateLaunchModel({ configurations: [{}] }).some((error) => error.includes("name")));
assert.throws(
  () => updateLaunchText("{ broken", { configurations: [] }),
  /语法错误/,
);

console.log("运行/调试配置 JSONC 保真与校验测试通过。");
