@echo off
setlocal

set "PORT=4281"
set "PROJECT_DIR=%~dp0"
set "DASHBOARD_DIR=%PROJECT_DIR%dashboard"

if not exist "%DASHBOARD_DIR%\server.js" (
  echo Nao encontrei a pasta dashboard neste local:
  echo %DASHBOARD_DIR%
  echo.
  echo Coloque este arquivo dentro da pasta do projeto, junto da pasta dashboard.
  echo Exemplo recomendado: C:\dash-exp\rodar-dev-local.bat
  echo.
  pause
  exit /b 1
)

cd /d "%DASHBOARD_DIR%"

set "NODE_EXE="

if exist "%PROJECT_DIR%node\node.exe" set "NODE_EXE=%PROJECT_DIR%node\node.exe"
if not defined NODE_EXE if exist "%DASHBOARD_DIR%\node\node.exe" set "NODE_EXE=%DASHBOARD_DIR%\node\node.exe"
if not defined NODE_EXE if exist "C:\dash-exp\node\node.exe" set "NODE_EXE=C:\dash-exp\node\node.exe"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE for %%N in (node.exe) do set "NODE_EXE=%%~$PATH:N"

if not defined NODE_EXE (
  echo Node.js nao foi encontrado neste computador.
  echo.
  echo Instale o Node.js LTS em https://nodejs.org/ e rode este arquivo novamente.
  echo.
  pause
  exit /b 1
)

echo Projeto: %PROJECT_DIR%
echo Usando Node em: %NODE_EXE%
echo Abrindo dashboard em http://localhost:%PORT%
echo.

start "" "http://localhost:%PORT%"

set "PORT=%PORT%"
"%NODE_EXE%" server.js

echo.
echo Se apareceu algum erro acima, me mande uma foto ou copie a mensagem.
pause
