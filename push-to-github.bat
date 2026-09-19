@echo off
setlocal enabledelayedexpansion

rem Always run from this script's own folder, no matter where it's double-clicked from.
cd /d "%~dp0"

echo ================================================
echo   IELTS Adaptive Practice - Day code len GitHub
echo ================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo Loi: thu muc nay khong phai la git repo.
    pause
    exit /b 1
)

echo [1/3] Dang gom cac thay doi ...
git add -A

git diff --cached --quiet
if errorlevel 1 (
    set "commitmsg="
    set /p "commitmsg=Nhap noi dung commit ^(Enter de dung noi dung mac dinh^): "
    if "!commitmsg!"=="" set "commitmsg=Cap nhat %date% %time%"

    echo [2/3] Dang commit: !commitmsg!
    git commit -m "!commitmsg!"
    if errorlevel 1 (
        echo.
        echo Loi: commit that bai.
        pause
        exit /b 1
    )
) else (
    echo [2/3] Khong co thay doi moi de commit, chi kiem tra day len GitHub.
)

echo [3/3] Dang day len GitHub ...
git push
if errorlevel 1 (
    echo.
    echo Loi: day len GitHub that bai. Kiem tra ket noi mang / dang nhap Git roi thu lai.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Da day len GitHub thanh cong!
echo ================================================
pause
