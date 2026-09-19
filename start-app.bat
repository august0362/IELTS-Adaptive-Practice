@echo off
setlocal

rem Always run from the web/ app folder (Milestone 6: app was moved into web/,
rem chatbot code lives separately in ai/), no matter where this is double-clicked from.
cd /d "%~dp0web"

echo ================================================
echo   IELTS Adaptive Practice - dang khoi dong...
echo ================================================
echo.

if not exist "node_modules" (
    echo [1/3] Chua cai dependencies, dang chay npm install ...
    call npm install
    if errorlevel 1 (
        echo.
        echo Loi: npm install that bai. Kiem tra da cai Node.js chua roi thu lai.
        pause
        exit /b 1
    )
) else (
    echo [1/3] Dependencies da san sang.
)

if not exist "dev.db" (
    echo [2/3] Chua co database, dang tao va nap du lieu mau ...
    call npm run db:migrate
    call npm run db:seed
) else (
    echo [2/3] Database da san sang ^(dev.db^).
)

echo [3/3] Dang khoi dong may chu phat trien ...
echo.
echo Se tu mo trinh duyet vao http://localhost:3000 sau vai giay
echo ^(neu cong 3000 dang ban, xem dong "Local:" ben duoi de biet dia chi thuc te^).
echo Dong cua so nay ^(hoac bam Ctrl+C^) de tat ung dung.
echo.

start "" cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:3000"

call npm run dev

pause
