const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const querystring = require('querystring');

// 百度云API参数
const API_KEY = 'NWmiAKgZHFsGA8nDM4G73gYf';
const SECRET_KEY = 'k3MC9rB09alEpCUiksiXiqcOJebtP8ay';

// 获取access_token
async function getAccessToken(apiKey, secretKey) {
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
    
    try {
        const response = await fetch(tokenUrl);
        const data = await response.json();
        
        if (data.access_token) {
            console.log('获取access_token成功');
            return data.access_token;
        } else {
            console.error('获取access_token失败:', data);
            throw new Error('获取access_token失败: ' + JSON.stringify(data));
        }
    } catch (error) {
        console.error('请求access_token出错:', error);
        throw error;
    }
}

// 创建一个简单的黑白测试图片
function createTestImage(imagePath) {
    // 将在网上找到的一张黑白图片的base64编码保存为文件
    const sampleImageBase64 = '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';
    try {
        const imageBuffer = Buffer.from(sampleImageBase64, 'base64');
        fs.writeFileSync(imagePath, imageBuffer);
        console.log(`测试图片已保存到: ${imagePath}`);
        return true;
    } catch (error) {
        console.error('创建测试图片失败:', error);
        return false;
    }
}

// 测试图片上色API
async function testColorizeApi() {
    try {
        // 1. 创建测试图片
        const testImagePath = path.join(__dirname, 'test-bw-image.jpg');
        if (!createTestImage(testImagePath)) {
            return;
        }

        // 2. 获取access_token
        const accessToken = await getAccessToken(API_KEY, SECRET_KEY);
        console.log('Access Token:', accessToken);

        // 3. 读取图片
        const imageBuffer = fs.readFileSync(testImagePath);
        const imageBase64 = imageBuffer.toString('base64');

        // 4. 调用图片上色API
        console.log('正在调用图片上色API...');
        const colorizeUrl = `https://aip.baidubce.com/rest/2.0/image-process/v1/colourize?access_token=${accessToken}`;
        
        const response = await fetch(colorizeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: querystring.stringify({
                'image': imageBase64
            })
        });

        const result = await response.json();
        
        // 5. 处理结果
        if (result.error_code) {
            console.error('图片上色API返回错误:', result);
            return;
        }

        // 6. 保存上色后的图片
        if (result.image) {
            const colorizedImageBuffer = Buffer.from(result.image, 'base64');
            const colorizedImagePath = path.join(__dirname, 'test-colorized-image.jpg');
            fs.writeFileSync(colorizedImagePath, colorizedImageBuffer);
            console.log(`上色成功! 上色后的图片已保存到: ${colorizedImagePath}`);
        } else {
            console.error('API返回的数据中没有图片');
        }

    } catch (error) {
        console.error('测试过程中发生错误:', error);
    }
}

// 运行测试
testColorizeApi(); 