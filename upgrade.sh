#!/data/data/com.termux/files/usr/bin/bash
# 升级脚本：只替换代码，数据目录 ~/sas_plan_data 完全不参与。
# 用法：bash upgrade.sh <新代码zip的路径>
#   例：bash upgrade.sh ~/storage/downloads/WeiXin/sas_plan_deploy.zip
set -e

APP_DIR="$HOME/sas_plan"
DATA_DIR="$HOME/sas_plan_data"
ZIP="$1"

if [ -z "$ZIP" ] || [ ! -f "$ZIP" ]; then
  echo "用法：bash upgrade.sh <新代码zip路径>"
  echo "示例：bash upgrade.sh ~/storage/downloads/WeiXin/sas_plan_deploy.zip"
  exit 1
fi

echo "[1/6] 停止正在运行的服务…"
# 结束正在运行的 next 服务（进程名是 next-server）
pkill -9 -f "next-server" 2>/dev/null || true
sleep 1

echo "[2/6] 额外备份一次数据库（双保险）…"
if [ -f "$DATA_DIR/app.db" ]; then
  mkdir -p "$DATA_DIR/backups"
  STAMP=$(date +%Y%m%d-%H%M%S)
  cp "$DATA_DIR/app.db" "$DATA_DIR/backups/app.db.preupgrade-$STAMP.bak"
  echo "      已备份到 $DATA_DIR/backups/app.db.preupgrade-$STAMP.bak"
else
  echo "      （尚无数据库，跳过）"
fi

echo "[3/6] 解压新代码到 $APP_DIR（数据目录不受影响）…"
mkdir -p "$APP_DIR"
unzip -o "$ZIP" -d "$APP_DIR" >/dev/null

echo "[4/6] 安装依赖…"
cd "$APP_DIR"
npm config set registry https://registry.npmmirror.com >/dev/null 2>&1 || true
npm install

echo "[5/6] 构建…"
npm run build

echo "[6/6] 完成！用下面命令启动新版本："
echo "      bash ~/sas_plan/run.sh"
