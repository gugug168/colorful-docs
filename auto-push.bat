@echo off
echo ======= 自动Git推送脚本 =======
echo.

echo 1. 获取最新更改...
git pull gitee main

echo 2. 添加所有更改到暂存区...
git add .

echo 3. 提交更改...
set /p commit_msg="请输入提交信息 (默认: 更新代码): "
if "%commit_msg%"=="" set commit_msg=更新代码
git commit -m "%commit_msg%"

echo 4. 推送到Gitee...
git push gitee main

echo.
echo ======= 推送完成 =======
pause 