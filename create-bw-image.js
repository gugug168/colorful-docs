const fs = require('fs');
const { createCanvas } = require('canvas');

// 创建一个简单的黑白图像
const width = 200;
const height = 200;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// 绘制黑白图案
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, width, height);

ctx.fillStyle = 'black';
ctx.fillRect(50, 50, 100, 100);

ctx.fillStyle = 'gray';
ctx.beginPath();
ctx.arc(100, 100, 40, 0, 2 * Math.PI);
ctx.fill();

// 保存图片
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('test-bw.png', buffer);

console.log('黑白测试图片已创建: test-bw.png'); 