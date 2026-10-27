@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules" (
  echo [MoodTunes] 首次运行，正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo [MoodTunes] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)
echo [MoodTunes] 启动本地服务 http://localhost:5173
call npm run dev
