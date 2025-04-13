// API 索引文件
module.exports = (req, res) => {
  res.status(200).json({
    message: 'API服务正常运行',
    endpoints: [
      {
        path: '/api/check-task',
        method: 'GET',
        description: '查询任务状态',
        parameters: ['taskId']
      }
    ]
  });
}; 