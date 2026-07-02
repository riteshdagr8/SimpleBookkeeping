@echo off
REM start.cmd - launch the dev server detached, on port 3100.
REM Logs to dev.log in this folder. Survives closing this window.
REM Stop with stop.cmd

setlocal
cd /d "%~dp0"

REM Refuse to start if port 3100 already has a listener.
powershell -NoProfile -Command "$l = Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue; if ($l) { Write-Output ('Port 3100 is already in use (PID ' + ($l | Select-Object -ExpandProperty OwningProcess -Unique) + '). Run stop.cmd first.'); exit 1 } else { exit 0 }"
if errorlevel 1 exit /b 1

if exist dev.log (
  if exist dev.prev.log del /f /q dev.prev.log >NUL
  move /y dev.log dev.prev.log >NUL
)

echo Starting dev server on port 3100... logs: dev.log

REM Launch npx in a fully detached process. Start-Process returns the
REM PID of the new process; we save that as dev.pid for stop.cmd.
powershell -NoProfile -Command "$p = Start-Process -FilePath 'npx.cmd' -ArgumentList 'next','dev','-H','0.0.0.0','-p','3100' -WorkingDirectory '%CD%' -RedirectStandardOutput 'dev.out.log' -RedirectStandardError 'dev.err.log' -WindowStyle Hidden -PassThru; Set-Content -Path 'dev.pid' -Value $p.Id; Write-Output ('Launched PID ' + $p.Id)"

echo Waiting up to 30s for it to come up...
set ATTEMPTS=0
:wait
set /a ATTEMPTS+=1
if %ATTEMPTS% GTR 30 goto failed
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://localhost:3100/login; if ($r.StatusCode -ge 200) { exit 0 } } catch { } exit 1" >NUL 2>&1
if not errorlevel 1 goto ready
ping -n 1 127.0.0.1 >NUL
goto wait

:ready
echo.
echo Dev server is up. Open http://localhost:3100
echo Logs: %CD%\dev.out.log, dev.err.log
echo To stop: stop.cmd
endlocal
exit /b 0

:failed
echo.
echo WARNING: server started (PID from dev.pid) but did not respond to HTTP within 30s.
echo It may still be compiling. Check the log:
echo   %CD%\dev.out.log
echo   %CD%\dev.err.log
endlocal
exit /b 0
