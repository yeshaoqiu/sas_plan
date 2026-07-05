@echo off
cd /d D:\code\sas_plan
set NODE_ENV=production
set "NODE_EXE=C:\Users\Administrator\AppData\Local\OpenClaw\deps\portable-node\node.exe"
echo [%date% %time%] starting sas_plan (system) >> "D:\code\sas_plan\server.log"
"%NODE_EXE%" "D:\code\sas_plan\node_modules\next\dist\bin\next" start -H 0.0.0.0 -p 3000 >> "D:\code\sas_plan\server.log" 2>&1
