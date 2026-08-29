[CmdletBinding()]
param(
    [string]$CodeCommand = "code",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$projectDirectory = Split-Path -Parent $PSScriptRoot
$packagePath = Join-Path $projectDirectory "dist\Goland-Style.vsix"

# 查找 VS Code 命令行，兼容默认用户级和系统级安装目录。
$codeExecutable = Get-Command $CodeCommand -ErrorAction SilentlyContinue
if ($null -eq $codeExecutable) {
    $candidatePaths = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\bin\code.cmd"),
        (Join-Path $env:ProgramFiles "Microsoft VS Code\bin\code.cmd")
    )
    $resolvedPath = $candidatePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($null -eq $resolvedPath) {
        throw "未找到 VS Code 命令行。请安装 VS Code，并在安装时启用 Add to PATH。"
    }
    $codeCommandPath = $resolvedPath
} else {
    $codeCommandPath = $codeExecutable.Source
}

# Release 未携带 VSIX 时，从当前源码构建安装包。
if (-not (Test-Path -LiteralPath $packagePath)) {
    if ($SkipBuild) {
        throw "未找到 $packagePath，且已指定 -SkipBuild。"
    }
    Push-Location $projectDirectory
    try {
        if (Test-Path -LiteralPath (Join-Path $projectDirectory "package-lock.json")) {
            npm ci
        } else {
            npm install
        }
        if ($LASTEXITCODE -ne 0) {
            throw "npm 依赖安装失败。"
        }
        npm run package
        if ($LASTEXITCODE -ne 0) {
            throw "VSIX 构建失败。"
        }
    } finally {
        Pop-Location
    }
}

# 安装扩展包；VS Code 会继续安装清单中声明的依赖扩展。
& $codeCommandPath --install-extension $packagePath --force
if ($LASTEXITCODE -ne 0) {
    throw "扩展安装失败。"
}

# 检查 Go SDK，语言工具由官方 Go 扩展按兼容版本提示安装。
$goExecutable = Get-Command go -ErrorAction SilentlyContinue
if ($null -eq $goExecutable) {
    Write-Warning "未找到 Go SDK，请从 https://go.dev/dl/ 安装后重新打开 VS Code。"
} else {
    go version
}

$profilePath = Join-Path $projectDirectory "profile\jetbrains-style-go.code-profile"
Write-Host "扩展已安装。下一步在 VS Code 中运行 Profiles: Import Profile，并选择："
Write-Host $profilePath
