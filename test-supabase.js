// 测试Supabase连接和上传功能
require('dotenv').config();

const supabaseClient = require('./utils/supabaseClient');
const fs = require('fs');
const path = require('path');

async function testSupabaseConnection() {
  console.log('测试Supabase连接...');
  
  // 检查环境变量
  console.log('Supabase环境变量:');
  console.log(`- URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '已配置' : '未配置'}`);
  console.log(`- 匿名密钥: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已配置' : '未配置'}`);
  console.log(`- 服务密钥: ${process.env.SUPABASE_SERVICE_KEY ? '已配置' : '未配置'}`);
  
  // 列出可用函数
  console.log('\nSupabase客户端导出的函数:');
  console.log(Object.keys(supabaseClient));
  
  try {
    // 测试文件上传
    console.log('\n测试文件上传:');
    // 创建一个测试文件
    const testFilePath = path.join(__dirname, 'test-image.png');
    // 如果文件不存在，创建一个简单的测试文件
    if (!fs.existsSync(testFilePath)) {
      // 创建一个简单的1x1像素的PNG图片
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const imageBuffer = Buffer.from(base64Image, 'base64');
      fs.writeFileSync(testFilePath, imageBuffer);
      console.log(`创建测试图片: ${testFilePath}`);
    }
    
    // 读取测试文件
    const fileBuffer = fs.readFileSync(testFilePath);
    console.log(`测试文件大小: ${fileBuffer.length} 字节`);
    
    // 上传到Supabase
    const uploadPath = `test/test-image-${Date.now()}.png`;
    console.log(`尝试上传文件到: ${uploadPath}`);
    
    const uploadResult = await supabaseClient.uploadFile(fileBuffer, uploadPath);
    console.log('上传结果:', uploadResult);
    
    if (uploadResult.success) {
      console.log('\n✅ 上传成功！');
      console.log(`文件URL: ${uploadResult.url}`);
    } else {
      console.log('\n❌ 上传失败');
      console.log(`错误: ${uploadResult.error}`);
      console.log(`详情: ${uploadResult.details || '无详情'}`);
    }
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 执行测试
testSupabaseConnection()
  .then(() => console.log('测试完成'))
  .catch(err => console.error('测试失败:', err)); 