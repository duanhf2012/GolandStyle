@echo off
rem Backward-compatible entry point. The primary builder is Goland Style.bat.
call "%~dp0Goland Style.bat" %*
exit /b %ERRORLEVEL%
