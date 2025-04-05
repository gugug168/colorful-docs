const fetch = require('node-fetch');

// 百度云API参数
const API_KEY = 'NWmiAKgZHFsGA8nDM4G73gYf';
const SECRET_KEY = 'k3MC9rB09alEpCUiksiXiqcOJebtP8ay';

// 获取access_token
async function getAccessToken(apiKey, secretKey) {
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
    
    try {
        const response = await fetch(tokenUrl);
        const data = await response.json();
        
        console.log('API响应:', data);
        
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

// 测试获取access_token
async function testApi() {
    try {
        const accessToken = await getAccessToken(API_KEY, SECRET_KEY);
        console.log('Access Token:', accessToken);
        console.log('API凭证有效，可以正常使用。');
    } catch (error) {
        console.error('API凭证测试失败:', error);
    }
}

testApi(); 