const fs = require('fs');

// 创建一个简单的黑白图片数据
// 这是一个1x1像素的PNG图片的base64编码
const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// 保存图片
const imageBuffer = Buffer.from(minimalPngBase64, 'base64');
fs.writeFileSync('test-bw.png', imageBuffer);

console.log('简单的测试图片已保存到: test-bw.png'); 