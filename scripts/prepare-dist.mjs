import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distributionDirectory = path.resolve(scriptDirectory, "..", "dist");

await mkdir(distributionDirectory, { recursive: true });
for (const artifactName of [
  "jetbrains-style-go-vscode.vsix",
  "Goland-Style.vsix",
]) {
  await rm(path.join(distributionDirectory, artifactName), { force: true });
}
console.log(`已准备 ${distributionDirectory}`);
