@echo off
setlocal enabledelayedexpansion

rem Always run from this script's own folder, no matter where it's double-clicked from.
cd /d "%~dp0"

echo ================================================
echo   IELTS Adaptive Practice - Pull code tu GitHub
echo ================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo Loi: thu muc nay khong phai la git repo.
    pause
    exit /b 1
)

set "dirty="
for /f "delims=" %%i in ('git status --porcelain') do set "dirty=1"
if defined dirty (
    echo CANH BAO: may nay dang co thay doi CHUA COMMIT.
    echo Pull ve co the bi tu choi hoac de bi xung dot voi cac thay doi do.
    echo.
)

set "confirm="
set /p "confirm=Ban co chac muon PULL code moi nhat tu GitHub ve khong? (Y/N): "
if /i not "!confirm!"=="Y" (
    echo.
    echo Da huy, khong pull gi ca.
    pause
    exit /b 0
)

echo.
echo Dang pull tu GitHub ...
git pull
if errorlevel 1 (
    echo.
    echo Loi: pull that bai. Co the do xung dot hoac mat ket noi mang.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Da pull xong!
echo ================================================
pause
