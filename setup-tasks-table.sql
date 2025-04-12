-- 创建任务表
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    data JSONB,
    result JSONB,
    error TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 创建索引
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created_at ON public.tasks(created_at);
CREATE INDEX idx_tasks_expires_at ON public.tasks(expires_at);

-- 设置行级安全策略
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 允许服务角色完全访问
CREATE POLICY "Service role can do anything" 
    ON public.tasks 
    FOR ALL
    TO service_role
    USING (true);
    
-- 允许匿名用户查询任务状态
CREATE POLICY "Anonymous users can only view task status" 
    ON public.tasks 
    FOR SELECT
    TO anon
    USING (true); 