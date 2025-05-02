-- 向tasks表添加type列
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS type TEXT;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tasks_type 
ON public.tasks(type);

-- 更新已有任务的type列（可选，基于逻辑推断）
UPDATE public.tasks
SET type = 
    CASE
        WHEN data->>'taskType' = 'beautify' THEN 'beautify_html'
        WHEN data->>'taskType' IS NOT NULL THEN data->>'taskType'
        WHEN data->>'type' IS NOT NULL THEN data->>'type'
        WHEN data->'targetFormat' IS NOT NULL THEN 'beautify_html'
        WHEN data->'htmlContent' IS NOT NULL AND data->'filename' IS NOT NULL THEN 'beautify_html'
        ELSE 'beautify_html'
    END
WHERE type IS NULL; 