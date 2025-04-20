// 检查Supabase存储桶配置
require('dotenv').config();

const supabaseClient = require('./utils/supabaseClient');

async function checkBuckets() {
  console.log('检查Supabase存储桶配置...');
  
  try {
    const { supabase } = supabaseClient;
    
    // 列出所有可用的存储桶
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('获取存储桶列表失败:', error);
      return;
    }
    
    console.log('\n存储桶列表:');
    for (const bucket of buckets) {
      console.log(`- ${bucket.name} (${bucket.public ? '公开' : '私有'})`);
      
      // 尝试获取存储桶中的文件
      try {
        const { data: files, error: filesError } = await supabase.storage
          .from(bucket.name)
          .list();
          
        if (filesError) {
          console.error(`  获取 ${bucket.name} 中的文件列表失败:`, filesError);
        } else {
          console.log(`  文件数量: ${files.length}`);
          if (files.length > 0) {
            console.log(`  示例文件: ${files[0].name}`);
          }
        }
      } catch (bucketError) {
        console.error(`  访问 ${bucket.name} 失败:`, bucketError);
      }
    }
    
    // 检查 uploads 桶是否存在，如果不存在则创建
    const uploadsBucket = buckets.find(b => b.name === 'uploads');
    if (!uploadsBucket) {
      console.log('\n创建 uploads 存储桶...');
      const { data, error: createError } = await supabase.storage.createBucket('uploads', {
        public: true
      });
      
      if (createError) {
        console.error('创建 uploads 存储桶失败:', createError);
      } else {
        console.log('uploads 存储桶创建成功!');
      }
    }
    
    // 检查策略
    if (uploadsBucket) {
      console.log('\n检查 uploads 存储桶策略...');
      
      // 无法直接获取策略，但可以尝试上传一个测试文件来验证权限
      const testContent = Buffer.from('test');
      const testPath = `test/permission-test-${Date.now()}.txt`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(testPath, testContent, {
          contentType: 'text/plain',
          upsert: true
        });
        
      if (uploadError) {
        console.error('上传测试文件失败，可能存在权限问题:', uploadError);
      } else {
        console.log('上传测试文件成功，权限正常');
        
        // 获取公共URL
        const { data: urlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(testPath);
          
        console.log('公共URL可访问性:', urlData.publicUrl);
      }
    }
  } catch (error) {
    console.error('检查过程中出错:', error);
  }
}

// 执行检查
checkBuckets()
  .then(() => console.log('检查完成'))
  .catch(err => console.error('检查失败:', err)); 