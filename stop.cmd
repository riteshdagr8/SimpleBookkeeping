@echo off
setlocal enableextensions enabledelayedexpansion
cd /d "%~dp0"

echo Looking for dev server on port 3100...

REM Strategy 1: PID file
if exist dev.pid (
  for /f "delims=" %%P in (dev.pid) do set "PID_FROM_FILE=%%P"
  if defined PID_FROM_FILE (
    powershell -NoProfile -Command "$spid = '!PID_FROM_FILE!' -as [int]; if ($spid -and (Get-Process -Id $spid -ErrorAction SilentlyContinue)) { Stop-Process -Id $spid -Force -ErrorAction SilentlyContinue; Write-Output ('Stopped PID ' + $spid + ' from dev.pid') } else { Write-Output ('No live process for PID ' + $spid + ' from dev.pid') }"
  )
  del /f /q dev.pid >NUL 2>&1
)

REM Strategy 2: anything listening on 3100
powershell -NoProfile -Command "$l = Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($l) { foreach ($p in $l) { try { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Write-Output ('Stopped listener PID ' + $p) } catch {} } } else { Write-Output 'No process was listening on 3100' }"

REM Strategy 3: orphan next-dev node processes
powershell -NoProfile -Command "$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*next*dev*' -and $_.CommandLine -like '*3100*' }; if ($procs) { foreach ($p in $procs) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output ('Stopped node PID ' + $p.ProcessId) } catch {} } }"

echo Done. Port 3100 should be free.
endlocal
exit /b 0
