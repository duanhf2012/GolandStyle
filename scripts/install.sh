#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
package_path="$project_dir/dist/Goland-Style.vsix"
code_command=${CODE_COMMAND:-code}

# 检查 VS Code 命令行。
if ! command -v "$code_command" >/dev/null 2>&1; then
  echo "未找到 VS Code 命令行。请安装 VS Code 并将 code 加入 PATH。" >&2
  exit 1
fi

# Release 未携带 VSIX 时，从当前源码构建安装包。
if [ ! -f "$package_path" ]; then
  cd "$project_dir"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  npm run package
fi

# 安装扩展包；VS Code 会继续安装清单中声明的依赖扩展。
"$code_command" --install-extension "$package_path" --force

# 检查 Go SDK，语言工具由官方 Go 扩展按兼容版本提示安装。
if command -v go >/dev/null 2>&1; then
  go version
else
  echo "警告：未找到 Go SDK，请从 https://go.dev/dl/ 安装后重新打开 VS Code。" >&2
fi

echo "扩展已安装。下一步在 VS Code 中运行 Profiles: Import Profile，并选择："
echo "$project_dir/profile/jetbrains-style-go.code-profile"
