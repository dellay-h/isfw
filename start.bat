@echo off
rem Starts the ISFW server (server.py) at http://localhost:8000; it opens the browser itself.
cd /d "%~dp0"
where python >nul 2>nul && (python server.py 8000 & goto :end)
where py >nul 2>nul && (py server.py 8000 & goto :end)
echo Python is required to run the ISFW server (https://www.python.org/downloads/).
:end
pause
