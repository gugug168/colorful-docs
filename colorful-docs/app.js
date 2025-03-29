
const express = require(" express\);
const path = require(" path\);
const multer = require(" multer\);
const fs = require(" fs\);

// 初始化应用
const app = express();
const port = 3000;

// 设置静态文件目录
app.use(express.static(path.join(__dirname, " public\)));
app.use(" /uploads\, express.static(path.join(__dirname, \uploads\)));
app.use(" /downloads\, express.static(path.join(__dirname, \downloads\)));

// 确保目录存在
[" uploads\, \downloads\, \temp\, \public/images/temp\].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 注册路由
app.get(" /\, (req, res) => {
