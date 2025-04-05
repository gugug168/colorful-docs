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

// 测试图片上色API
async function testColorizeApiWithRealImage(imagePath) {
    try {
        // 1. 检查图片是否存在
        if (!fs.existsSync(imagePath)) {
            console.error(`图片文件不存在: ${imagePath}`);
            return;
        }
        
        // 2. 获取access_token
        const accessToken = await getAccessToken(API_KEY, SECRET_KEY);
        console.log('Access Token:', accessToken);

        // 3. 读取图片
        const imageBuffer = fs.readFileSync(imagePath);
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
        console.log('API响应:', result);
        
        // 5. 处理结果
        if (result.error_code) {
            console.error('图片上色API返回错误:', result);
            return;
        }

        // 6. 保存上色后的图片
        if (result.image) {
            const colorizedImageBuffer = Buffer.from(result.image, 'base64');
            const colorizedImagePath = path.join(path.dirname(imagePath), `${path.basename(imagePath, path.extname(imagePath))}_colorized${path.extname(imagePath)}`);
            fs.writeFileSync(colorizedImagePath, colorizedImageBuffer);
            console.log(`上色成功! 上色后的图片已保存到: ${colorizedImagePath}`);
        } else {
            console.error('API返回的数据中没有图片');
        }

    } catch (error) {
        console.error('测试过程中发生错误:', error);
    }
}

// 请提供一张本地黑白图片的路径作为参数
const imagePath = process.argv[2];
if (!imagePath) {
    console.error('请提供一张黑白图片的路径作为参数');
    console.log('使用方法: node test-colorize-api-simple.js 图片路径');
} else {
    console.log(`将要对以下图片进行上色测试: ${imagePath}`);
    testColorizeApiWithRealImage(imagePath);
} 