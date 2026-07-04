@echo off
chcp 65001 >nul
REM 学习陪跑 - Windows 局域网启动脚本
REM 双击运行即可。第一次用请先在本目录执行： npm install 然后 npm run build

cd /d "%~dp0.."

echo ============================================
echo   学习陪跑 正在启动...
echo   家人手机连同一个 Wi-Fi，浏览器打开下面的地址
echo ============================================
echo.

REM 显示本机局域网 IP，方便在手机上输入
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo   手机访问:  http:%%a:3000
echo.

npm run start:lan
pause
