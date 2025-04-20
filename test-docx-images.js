// 测试docx文件中图片上传功能
require('dotenv').config();

const supabaseClient = require('./utils/supabaseClient');
const fs = require('fs');
const path = require('path');
const docxConverter = require('./utils/docxConverter');

async function testDocxImageUpload() {
  console.log('测试Word文档图片上传功能...');
  
  try {
    // 创建一个测试图片
    const testImagePath = path.join(__dirname, 'test-docx-image.png');
    // 创建一个简单的测试图片
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const imageBuffer = Buffer.from(base64Image, 'base64');
    fs.writeFileSync(testImagePath, imageBuffer);
    console.log(`创建测试图片: ${testImagePath}`);
    
    // 测试直接调用uploadFile函数
    console.log('\n测试直接上传图片:');
    const uploadPath = `test/direct-upload-${Date.now()}.png`;
    const uploadResult = await supabaseClient.uploadFile(imageBuffer, uploadPath);
    
    if (uploadResult.success) {
      console.log('✅ 直接上传成功!');
      console.log(`文件URL: ${uploadResult.url}`);
    } else {
      console.log('❌ 直接上传失败');
      console.log(`错误: ${uploadResult.error}`);
    }
    
    // 测试docxConverter中的图片处理函数
    console.log('\n测试docxConverter中的图片上传函数:');
    
    // 提取处理图片的函数
    const processImageFn = async () => {
      try {
        const filePath = `images/test-image-${Date.now()}.png`;
        console.log(`尝试通过docxConverter上传图片到: ${filePath}`);
        
        const result = await docxConverter.processBase64Image(base64Image, filePath);
        console.log('处理结果:', result);
        
        if (result && result.src) {
          console.log('✅ docxConverter图片处理成功!');
          console.log(`图片URL: ${result.src}`);
          return true;
        } else {
          console.log('❌ docxConverter图片处理失败');
          return false;
        }
      } catch (error) {
        console.error('图片处理出错:', error);
        return false;
      }
    };
    
    // 如果processBase64Image函数不存在，则尝试实现一个
    if (typeof docxConverter.processBase64Image !== 'function') {
      console.log('docxConverter.processBase64Image函数不存在，实现一个测试版本');
      
      // 手动实现图片处理函数进行测试
      async function uploadBase64Image(base64String, filePath) {
        try {
          // 提取base64数据
          const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          
          console.log(`尝试上传base64图片到: ${filePath}`);
          const uploadResult = await supabaseClient.uploadFile(buffer, filePath);
          
          if (uploadResult.success) {
            console.log('✅ Base64图片上传成功!');
            console.log(`图片URL: ${uploadResult.url}`);
            return {
              src: uploadResult.url,
              alt: "测试图片",
              success: true
            };
          } else {
            console.log('❌ Base64图片上传失败');
            console.log(`错误: ${uploadResult.error}`);
            return {
              success: false,
              error: uploadResult.error
            };
          }
        } catch (error) {
          console.error('处理Base64图片出错:', error);
          return {
            success: false,
            error: error.message
          };
        }
      }
      
      // 测试手动实现的函数
      console.log('\n测试手动实现的Base64图片上传:');
      const testFilePath = `images/manual-test-${Date.now()}.png`;
      const testResult = await uploadBase64Image(
        `data:image/png;base64,${base64Image}`, 
        testFilePath
      );
      
      if (testResult.success) {
        console.log('✅ 手动实现的Base64图片上传成功!');
        console.log(`图片URL: ${testResult.src}`);
      } else {
        console.log('❌ 手动实现的Base64图片上传失败');
        console.log(`错误: ${testResult.error}`);
      }
    } else {
      // 使用已存在的processBase64Image函数
      const processResult = await processImageFn();
      console.log(`processBase64Image测试结果: ${processResult ? '成功' : '失败'}`);
    }
    
    console.log('\n测试完成!');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 执行测试
testDocxImageUpload().catch(err => {
  console.error('测试失败:', err);
}); 