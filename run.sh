#!/data/data/com.termux/files/usr/bin/bash
# 启动脚本：数据存在项目目录之外的 ~/sas_plan_data，升级换代码时永远不碰它。
# 开机自启（Termux:Boot）时环境 PATH 很精简，显式补上 Termux 程序目录，否则找不到 node/npm/next
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
set -e

APP_DIR="$HOME/sas_plan"
DATA_DIR="$HOME/sas_plan_data"
export DB_PATH="$DATA_DIR/app.db"

mkdir -p "$DATA_DIR"
cd "$APP_DIR"

# 幂等：先停掉可能已在运行的旧服务，等端口 3000 释放，避免 EADDRINUSE
# 注意：next 启动后的进程名是 next-server，不是 "next start"
if pgrep -f "next-server" >/dev/null 2>&1; then
  echo "[run] 检测到已在运行的服务，先停止…"
  pkill -9 -f "next-server" || true
  for i in $(seq 1 10); do
    if curl -sS http://127.0.0.1:3000 >/dev/null 2>&1; then
      sleep 1
    else
      break
    fi
  done
fi

# 首次运行且数据库不存在 → 初始化两个孩子/示例模板/奖励
if [ ! -f "$DB_PATH" ]; then
  echo "[run] 首次启动，初始化数据到 $DB_PATH"
  npm run seed
fi

echo "[run] 启动服务，数据库：$DB_PATH"
# 直接用 node 绝对路径运行 next，绕开 npm/PATH，确保开机自启（精简环境）也能拉起
exec /data/data/com.termux/files/usr/bin/node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
