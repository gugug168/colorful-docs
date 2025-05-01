/**
 * 修复app.js中重复的路由定义问题的脚本
 */

const fs = require('fs');
const path = require('path');

// 应用路径
const appPath = path.join(__dirname, 'app.js');

console.log('开始修复app.js中重复的路由定义问题...');

// 备份原始文件
const backupPath = path.join(__dirname, 'app.js.bak');
fs.copyFileSync(appPath, backupPath);
console.log(`原文件已备份到: ${backupPath}`);

// 读取app.js文件
let appContent = fs.readFileSync(appPath, 'utf8');

// 定义要查找的第一个路由函数的开始和结束标记
const routeStartMarker = "app.post('/beautify-task', async (req, res) => {";
const checkTaskMarker = "app.get('/check-task/:taskId', async (req, res) => {";

// 寻找第一个路由定义的范围
const firstRouteStart = appContent.indexOf(routeStartMarker);
const checkTaskStart = appContent.indexOf(checkTaskMarker);

if (firstRouteStart !== -1 && checkTaskStart !== -1 && firstRouteStart < checkTaskStart) {
    // 截取需要替换的部分前后的内容
    const beforeRoute = appContent.substring(0, firstRouteStart);
    const afterRoute = appContent.substring(checkTaskStart);
    
    // 创建替换内容（注释说明）
    const replacementContent = `// 注意：此处的'/beautify-task'路由定义已删除，以防止重复路由
// 实际路由定义保留在app.js的后面部分

`;
    
    // 构建新内容
    const newContent = beforeRoute + replacementContent + afterRoute;
    
    // 写入修改后的内容到app.js
    fs.writeFileSync(appPath, newContent, 'utf8');
    console.log('已成功删除第一个重复的路由定义');
    
    console.log('修复完成! app.js文件已更新');
} else {
    console.log('无法找到需要替换的路由定义，可能文件结构已经改变');
    console.log(`查找到的位置：firstRouteStart=${firstRouteStart}, checkTaskStart=${checkTaskStart}`);
} 