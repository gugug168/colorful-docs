const fs = require('fs');

// 创建一个简单的灰度JPG图像数据
// 这是一个更简单的100x100像素的灰度图像
const grayImageData = Buffer.alloc(100 * 100);

// 填充灰度值（简单的灰度渐变）
for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
        const index = y * 100 + x;
        // 简单的灰度渐变模式
        grayImageData[index] = Math.floor((x + y) * 255 / 200);
    }
}

// 生成PGM格式（简单的灰度图像格式）
const pgmHeader = `P5\n100 100\n255\n`;
const pgmBuffer = Buffer.concat([Buffer.from(pgmHeader), grayImageData]);
fs.writeFileSync('standard-test-bw.pgm', pgmBuffer);

console.log('标准黑白测试图片已保存到: standard-test-bw.pgm');

// 提示用户
console.log('注意：由于技术限制，我们使用了PGM格式的灰度图像。');
console.log('如果API仍不接受，您可能需要使用其他工具将图像转换为JPG或PNG格式。'); 