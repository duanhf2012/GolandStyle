@echo off
setlocal EnableExtensions
title Goland Style Builder

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found. Install Node.js 22 or later first.
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found. Reinstall Node.js with npm enabled.
    exit /b 1
)

echo [1/3] Installing locked dependencies...
if exist package-lock.json (
    call npm ci
) else (
    call npm install
)
if errorlevel 1 goto :failed

echo [2/3] Validating and packaging Goland Style...
call npm run package
if errorlevel 1 goto :failed

echo [3/3] Goland Style build completed.
echo VSIX: %CD%\dist\Goland-Style.vsix
echo Core profile: %CD%\profile\jetbrains-style-go.code-profile
echo Full profile: %CD%\profile\jetbrains-style-go-full.code-profile
exit /b 0

:failed
set "BUILD_EXIT_CODE=%ERRORLEVEL%"
if "%BUILD_EXIT_CODE%"=="0" set "BUILD_EXIT_CODE=1"
echo [ERROR] Goland Style build failed with exit code %BUILD_EXIT_CODE%.
exit /b %BUILD_EXIT_CODE%
