@echo off
setlocal

set "ROOT=%~dp0"

start "tracker api dev" cmd /k "cd /d ""%ROOT%api"" && npm run dev"
start "tracker client dev" cmd /k "cd /d ""%ROOT%client"" && npm run dev"

echo Started dev servers in separate windows:
echo - api
echo - client

endlocal
