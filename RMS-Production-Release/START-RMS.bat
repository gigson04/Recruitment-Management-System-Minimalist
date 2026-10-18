@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 start_rms.py
    goto :done
)
where python >nul 2>nul
if %errorlevel%==0 (
    python start_rms.py
    goto :done
)
echo Python 3 was not found.
echo Install Python 3 from https://www.python.org/downloads/ and enable the PATH option,
echo then double-click START-RMS.bat again.
pause
:done
endlocal
