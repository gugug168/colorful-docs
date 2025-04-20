// 检查和修复Supabase图片上传问题
require('dotenv').config();

const supabaseClient = require('./utils/supabaseClient');
const fs = require('fs');
const path = require('path');

async function checkAndFixSupabaseStorage() {
  console.log('==== Supabase图片上传问题诊断工具 ====');
  
  try {
    // 1. 检查Supabase配置
    console.log('\n1. 检查Supabase配置');
    console.log(`- URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '已配置' : '未配置'}`);
    console.log(`- 匿名密钥: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已配置' : '未配置'}`);
    console.log(`- 服务密钥: ${process.env.SUPABASE_SERVICE_KEY ? '已配置(独立)' : '未配置或使用匿名密钥'}`);
    
    // 2. 检查存储桶
    console.log('\n2. 检查存储桶');
    const { supabase } = supabaseClient;
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('获取存储桶列表失败:', bucketsError);
      console.log('建议检查Supabase API密钥和URL配置');
      return;
    }
    
    console.log(`发现 ${buckets.length} 个存储桶:`);
    const uploadsBucket = buckets.find(b => b.name === 'uploads');
    
    if (!uploadsBucket) {
      console.log('未找到"uploads"存储桶，尝试创建...');
      const { error: createError } = await supabase.storage.createBucket('uploads', { public: true });
      
      if (createError) {
        console.error('创建"uploads"存储桶失败:', createError);
        return;
      }
      
      console.log('✅ "uploads"存储桶创建成功');
    } else {
      console.log(`✅ "uploads"存储桶已存在 (${uploadsBucket.public ? '公开' : '私有'})`);
      
      // 如果不是公开的，尝试更新为公开
      if (!uploadsBucket.public) {
        console.log('尝试将"uploads"存储桶设为公开...');
        try {
          const { error: updateError } = await supabase.storage.updateBucket('uploads', { public: true });
          
          if (updateError) {
            console.error('更新存储桶为公开失败:', updateError);
          } else {
            console.log('✅ 已将"uploads"存储桶设为公开');
          }
        } catch (e) {
          console.error('更新存储桶权限失败:', e);
        }
      }
    }
    
    // 3. 创建必要的文件夹
    console.log('\n3. 创建必要的文件夹');
    const folders = ['images', 'images/doc-images', 'images/html-images', 'images/extracted', 'test'];
    
    for (const folder of folders) {
      console.log(`检查文件夹: ${folder}`);
      
      try {
        // 检查文件夹是否存在
        const { data, error } = await supabase.storage
          .from('uploads')
          .list(folder);
          
        if (error) {
          // 错误可能是因为文件夹不存在，尝试创建
          console.log(`- 创建文件夹: ${folder}`);
          
          // Supabase需要通过上传空文件来创建文件夹
          const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(`${folder}/.keep`, Buffer.from(''), { upsert: true });
            
          if (uploadError) {
            console.error(`- 创建文件夹失败: ${folder}`, uploadError);
          } else {
            console.log(`- ✅ 成功创建文件夹: ${folder}`);
          }
        } else {
          console.log(`- ✅ 文件夹已存在: ${folder} (包含 ${data.length} 个文件)`);
        }
      } catch (folderError) {
        console.error(`处理文件夹时出错: ${folder}`, folderError);
      }
    }
    
    // 4. 测试上传文件
    console.log('\n4. 测试上传文件');
    
    // 创建一个测试图片
    const testImagePath = path.join(__dirname, 'test-fix-image.png');
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const imageBuffer = Buffer.from(base64Image, 'base64');
    fs.writeFileSync(testImagePath, imageBuffer);
    console.log(`创建测试图片: ${testImagePath}`);
    
    // 测试上传
    const uploadPath = `test/fix-test-${Date.now()}.png`;
    console.log(`尝试上传文件到: ${uploadPath}`);
    
    const uploadResult = await supabaseClient.uploadFile(imageBuffer, uploadPath);
    
    if (uploadResult.success) {
      console.log('✅ 上传测试成功!');
      console.log(`文件URL: ${uploadResult.url}`);
    } else {
      console.log('❌ 上传测试失败!');
      console.log(`错误: ${uploadResult.error}`);
      console.log('请检查Supabase存储桶权限和API密钥');
    }
    
    // 5. 修复建议
    console.log('\n5. 修复建议');
    
    const suggestions = [];
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      suggestions.push('- 确保在.env文件中设置了NEXT_PUBLIC_SUPABASE_URL和NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    
    if (!uploadResult.success) {
      suggestions.push('- 检查Supabase存储桶的策略，确保允许公开读取和写入');
      suggestions.push('- 确保使用了正确的服务角色密钥(SUPABASE_SERVICE_KEY)或匿名密钥具有足够权限');
    }
    
    if (suggestions.length > 0) {
      console.log('发现潜在问题，建议：');
      suggestions.forEach(s => console.log(s));
    } else {
      console.log('✅ 所有测试通过，Supabase图片上传功能应该正常工作!');
      console.log('如果仍然有问题，请检查以下内容:');
      console.log('- 在使用图片上传功能的代码中，确保正确处理错误');
      console.log('- 检查网络连接和防火墙设置');
      console.log('- 查看Supabase控制台中的存储桶策略和使用限制');
    }
    
  } catch (error) {
    console.error('诊断过程中出错:', error);
  }
}

// 执行检查和修复
checkAndFixSupabaseStorage()
  .then(() => console.log('\n诊断完成'))
  .catch(err => console.error('诊断失败:', err)); 