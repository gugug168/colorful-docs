// 修复文件名长度问题脚本
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 清理文件名以避免长度问题
function sanitizeFilePath(filePath) {
  // 分离文件路径和扩展名
  const extname = path.extname(filePath);
  const basename = path.basename(filePath, extname);
  const dirname = path.dirname(filePath);
  
  // 生成MD5哈希作为文件名
  const hash = crypto.createHash('md5').update(basename).digest('hex');
  
  // 重建文件路径，只使用哈希作为文件名
  const sanitizedBasename = hash.substring(0, 20); // 使用部分哈希值
  const sanitizedFilePath = path.join(dirname, sanitizedBasename + extname);
  
  // 确保路径分隔符是正斜杠（/）
  return sanitizedFilePath.replace(/\\/g, '/');
}

console.log('文件名长度修复工具');
console.log('================================================');

console.log('\n问题：');
console.log('上传包含中文或特殊字符的长文件名时，虽然文件可以上传到Supabase存储，');
console.log('但在创建本地临时文件时使用的是URL编码后的原始文件名，导致文件名过长错误。');

console.log('\n解决方案：');
console.log('修改app.js文件，在创建临时文件时也使用清理后的短文件名（与Supabase上传使用的相同方法）。');

console.log('\n需要修改的地方：');
console.log('1. app.js中的上传处理代码（大约在290行附近）');

console.log('\n修改步骤：');
console.log('1. 找到创建临时文件的代码');
console.log('2. 将原始长文件名替换为使用清理后的短文件名');
console.log('3. 重启服务以应用更改');

console.log('\n要修改的代码片段：');
console.log(`
  const timestamp = Date.now();
  const filename = \`document-\${timestamp}-\${safeFileName}\`;
  const filePath = \`uploads/\${filename}\`;
  
  // 上传原始文件到 Supabase
  const uploadResult = await supabaseClient.uploadFile(buffer, filePath);
  
  // 保存到本地临时文件用于处理
  const tempDir = path.join(os.tmpdir(), 'uploads');
  
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (mkdirError) {
    console.error(\`创建临时目录失败: \${mkdirError}\`);
  }
  
  // 确保使用可用的目录
  const finalTempDir = fs.existsSync(tempDir) ? tempDir : os.tmpdir();
  const tempFilePath = path.join(finalTempDir, filename); // 这里使用的是原始长文件名
`);

console.log('\n修改后的代码应该是：');
console.log(`
  const timestamp = Date.now();
  const filename = \`document-\${timestamp}-\${safeFileName}\`;
  const filePath = \`uploads/\${filename}\`;
  
  // 上传原始文件到 Supabase
  const uploadResult = await supabaseClient.uploadFile(buffer, filePath);
  
  // 保存到本地临时文件用于处理
  const tempDir = path.join(os.tmpdir(), 'uploads');
  
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (mkdirError) {
    console.error(\`创建临时目录失败: \${mkdirError}\`);
  }
  
  // 清理文件名以避免超长问题
  const shortFilename = \`doc-\${timestamp}-\${crypto.createHash('md5').update(safeFileName).digest('hex').substring(0, 10)}\${path.extname(safeFileName) || '.tmp'}\`;
  
  // 确保使用可用的目录
  const finalTempDir = fs.existsSync(tempDir) ? tempDir : os.tmpdir();
  const tempFilePath = path.join(finalTempDir, shortFilename); // 使用短文件名
`);

console.log('\n实施建议：');
console.log('1. 备份当前的app.js文件');
console.log('2. 使用上述修改更新app.js文件');
console.log('3. 重启服务器以应用更改');
console.log('4. 测试上传中文长文件名的文件');

console.log('\n测试方法：');
console.log('上传一个包含中文或特殊字符的长文件名文档，确认可以正常处理。');

// 示例实施
console.log('\n自动修复代码生成：');
const sampleCode = `
// 修复文件名长度问题的函数
function sanitizeFileName(fileName, timestamp) {
  // 获取文件扩展名
  const extname = path.extname(fileName) || '.tmp';
  
  // 生成短文件名 - 使用时间戳和哈希
  return \`doc-\${timestamp}-\${crypto.createHash('md5').update(fileName).digest('hex').substring(0, 10)}\${extname}\`;
}

// 在上传处理代码中使用：
const shortFilename = sanitizeFileName(safeFileName, timestamp);
const tempFilePath = path.join(finalTempDir, shortFilename);
`;

console.log(sampleCode);
console.log('\n================================================');
console.log('执行以上修改后，文件名长度问题应该得到解决。'); 