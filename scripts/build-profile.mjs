import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");

const packageJson = JSON.parse(
  await readFile(path.join(projectDirectory, "package.json"), "utf8"),
);
const configurationDefaults = packageJson.contributes?.configurationDefaults;
const runtimeSettings = packageJson.golandStyle?.runtimeSettings;
if (!configurationDefaults || typeof configurationDefaults !== "object") {
  throw new Error("package.json 缺少 contributes.configurationDefaults");
}
if (!runtimeSettings || typeof runtimeSettings !== "object") {
  throw new Error("package.json 缺少 golandStyle.runtimeSettings");
}
const settings = { ...configurationDefaults, ...runtimeSettings };
const windowsPlatform = 3;
const golandNavigationKeybindings = [
  {
    key: "alt+left",
    command: "-workbench.action.previousEditor",
    when: "!terminalFocus",
  },
  {
    key: "alt+right",
    command: "-workbench.action.nextEditor",
    when: "!terminalFocus",
  },
  {
    key: "alt+left",
    command: "workbench.action.navigateBack",
    when: "canNavigateBack",
  },
  {
    key: "alt+right",
    command: "workbench.action.navigateForward",
    when: "canNavigateForward",
  },
  {
    key: "ctrl+alt+left",
    command: "-workbench.action.navigateBack",
    when: "canNavigateBack",
  },
  {
    key: "ctrl+alt+right",
    command: "-workbench.action.navigateForward",
    when: "canNavigateForward",
  },
];

const profileDefinitions = [
  {
    name: "Goland Style",
    shortName: "Go",
    source: "extensions.json",
    output: "jetbrains-style-go.code-profile",
  },
  {
    name: "Goland Style Full",
    shortName: "Go Full",
    source: "extensions-full.json",
    output: "jetbrains-style-go-full.code-profile",
  },
  {
    name: "Goland Style + GoLand Keymap",
    shortName: "Go Keymap",
    source: "extensions-goland-keymap.json",
    output: "jetbrains-style-go-goland-keymap.code-profile",
    keybindings: golandNavigationKeybindings,
  },
];

for (const definition of profileDefinitions) {
  const extensions = JSON.parse(
    await readFile(
      path.join(projectDirectory, "profile", definition.source),
      "utf8",
    ),
  );
  const exportedExtensions = extensions.map(({ id, displayName }) => ({
    identifier: { id },
    displayName,
  }));
  const profile = {
    name: definition.name,
    shortName: definition.shortName,
    settings: JSON.stringify({
      settings: JSON.stringify(settings, null, 4),
    }),
    extensions: JSON.stringify(exportedExtensions),
    ...(definition.keybindings
      ? {
          keybindings: JSON.stringify({
            platform: windowsPlatform,
            keybindings: JSON.stringify(definition.keybindings, null, 4),
          }),
        }
      : {}),
  };
  const outputPath = path.join(projectDirectory, "profile", definition.output);
  await writeFile(outputPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  console.log(`已生成 ${path.relative(projectDirectory, outputPath)}`);
}
