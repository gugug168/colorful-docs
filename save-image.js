const fs = require('fs');

// 图片的base64数据（通常会从外部输入获取，这里为了示例使用硬编码）
// 这里应该替换为实际的base64编码的图片数据
const imageData = '此处需要填入图片的base64数据';

// 保存图片
const imageBuffer = Buffer.from(imageData, 'base64');
fs.writeFileSync('test-image.png', imageBuffer);

console.log('图片已保存到: test-image.png'); 