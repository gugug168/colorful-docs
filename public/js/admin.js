$(document).ready(function() {
    // 初始化API类型切换
    initApiTypeToggle();

    // 初始化API配置表单提交
    initApiConfigForm();

    // 初始化模板管理功能
    initTemplateManagement();

    // 初始化密码切换显示功能
    initPasswordToggle();

    // 获取并显示当前配置
    loadCurrentConfig();

    // 获取并显示模板列表
    loadTemplates();

    /**
     * 初始化API类型切换功能
     */
    function initApiTypeToggle() {
        // 初始隐藏所有API配置部分
        $('.api-config-section').hide();

        // API类型切换时显示相应的配置部分
        $('#current-api-type').on('change', function() {
            const selectedType = $(this).val();
            $('.api-config-section').hide();
            $(`#${selectedType}-config`).show();
        });
    }

    /**
     * 初始化密码切换显示功能
     */
    function initPasswordToggle() {
        $('.toggle-password').on('click', function() {
            const passwordInput = $(this).siblings('input');
            const passwordType = passwordInput.attr('type');
            
            // 切换密码显示/隐藏
            if (passwordType === 'password') {
                passwordInput.attr('type', 'text');
                $(this).html('<i class="fas fa-eye-slash"></i>');
            } else {
                passwordInput.attr('type', 'password');
                $(this).html('<i class="fas fa-eye"></i>');
            }
        });
    }

    /**
     * 初始化API配置表单提交
     */
    function initApiConfigForm() {
        $('#api-config-form').on('submit', function(e) {
            e.preventDefault();
            
            // 获取当前选择的API类型
            const apiType = $('#current-api-type').val();
            
            // 获取对应类型的模型选择
            const apiModel = $(`#${apiType}-model`).val();
            
            // 获取对应的API密钥
            const apiKey = $(`#${apiType}-api-key`).val();
            
            // 获取高级参数
            const apiParams = {};
            
            // 获取OpenAI参数
            apiParams.openai = {
                temperature: parseFloat($('#openai-temperature').val()),
                max_tokens: parseInt($('#openai-max-tokens').val())
            };
            
            // 获取DeepSeek参数
            apiParams.deepseek = {
                temperature: parseFloat($('#deepseek-temperature').val()),
                max_tokens: parseInt($('#deepseek-max-tokens').val())
            };
            
            // 获取通义千问参数
            apiParams.qianwen = {
                temperature: parseFloat($('#qianwen-temperature').val()),
                max_tokens: parseInt($('#qianwen-max-tokens').val())
            };
            
            // 创建请求数据
            const configData = {
                apiType: apiType,
                apiModel: apiModel,
                apiKey: apiKey, // 如果为空，后端将使用已保存的密钥
                apiParams: apiParams // 添加高级参数
            };
            
            // 发送API配置更新请求
            $.ajax({
                url: '/api/config',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(configData),
                success: function(response) {
                    if (response.success) {
                        showMessage('API配置已成功更新', 'success');
                    } else {
                        showMessage('更新API配置失败: ' + response.message, 'danger');
                    }
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON ? xhr.responseJSON.message : '服务器错误';
                    showMessage('更新API配置失败: ' + errorMsg, 'danger');
                }
            });
        });
    }

    /**
     * 加载当前API配置
     */
    function loadCurrentConfig() {
        showLoading();
        
        $.ajax({
            url: '/api/config',
            type: 'GET',
            success: function(response) {
                hideLoading();
                
                if (response.success) {
                    // 设置当前API类型
                    $('#current-api-type').val(response.config.apiType);
                    
                    // 触发change事件以显示相应的配置区域
                    $('#current-api-type').trigger('change');
                    
                    // 设置各个API类型的模型选择
                    if (response.config.apiModels) {
                        Object.keys(response.config.apiModels).forEach(type => {
                            $(`#${type}-model`).val(response.config.apiModels[type]);
                        });
                    }
                    
                    // 设置高级参数
                    if (response.config.apiParams) {
                        // 设置OpenAI参数
                        if (response.config.apiParams.openai) {
                            $('#openai-temperature').val(response.config.apiParams.openai.temperature || 0.7);
                            $('#openai-max-tokens').val(response.config.apiParams.openai.max_tokens || 4000);
                        }
                        
                        // 设置DeepSeek参数
                        if (response.config.apiParams.deepseek) {
                            $('#deepseek-temperature').val(response.config.apiParams.deepseek.temperature || 0.7);
                            $('#deepseek-max-tokens').val(response.config.apiParams.deepseek.max_tokens || 4000);
                        }
                        
                        // 设置通义千问参数
                        if (response.config.apiParams.qianwen) {
                            $('#qianwen-temperature').val(response.config.apiParams.qianwen.temperature || 0.7);
                            $('#qianwen-max-tokens').val(response.config.apiParams.qianwen.max_tokens || 4000);
                        }
                    }
                    
                    // 显示API密钥配置状态（不显示实际密钥）
                    if (response.config.hasKeys) {
                        Object.keys(response.config.hasKeys).forEach(type => {
                            if (response.config.hasKeys[type]) {
                                $(`#${type}-api-key`).attr('placeholder', '******** (已配置)');
                            }
                        });
                    }
                } else {
                    showMessage('加载API配置失败: ' + response.message, 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.message : '服务器错误';
                showMessage('加载API配置失败: ' + errorMsg, 'danger');
            }
        });
    }

    /**
     * 初始化模板管理功能
     */
    function initTemplateManagement() {
        // 模板图片预览
        $('#template-image').on('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    $('#template-image-preview').attr('src', e.target.result);
                    $('#template-image-preview').parent().removeClass('d-none');
                };
                reader.readAsDataURL(file);
            }
        });
        
        // 编辑模板按钮点击
        $(document).on('click', '.edit-template', function() {
            const templateId = $(this).data('id');
            editTemplate(templateId);
        });
        
        // 删除模板按钮点击
        $(document).on('click', '.delete-template', function() {
            const templateId = $(this).data('id');
            // 设置删除确认按钮的模板ID
            $('#confirm-delete-btn').data('id', templateId);
            // 显示确认对话框
            $('#confirm-delete-modal').modal('show');
        });
        
        // 确认删除按钮点击
        $('#confirm-delete-btn').on('click', function() {
            const templateId = $(this).data('id');
            deleteTemplate(templateId);
            // 隐藏确认对话框
            $('#confirm-delete-modal').modal('hide');
        });
        
        // 添加模板按钮点击
        $('#add-template-modal').on('show.bs.modal', function(e) {
            // 如果不是通过编辑按钮触发的，则清空表单
            if (!$(e.relatedTarget).hasClass('edit-template')) {
                resetTemplateForm();
            }
        });
        
        // 保存模板按钮点击
        $('#save-template-btn').on('click', function() {
            saveTemplate();
        });
    }

    /**
     * 重置模板表单
     */
    function resetTemplateForm() {
        $('#template-form')[0].reset();
        $('#template-id').val('');
        $('#template-modal-title').text('添加模板');
        $('#template-image-preview').attr('src', '');
        $('#template-image-preview').parent().addClass('d-none');
    }

    /**
     * 编辑模板
     * @param {string} templateId 模板ID
     */
    function editTemplate(templateId) {
        showLoading();
        
        $.ajax({
            url: '/api/templates',
            type: 'GET',
            success: function(response) {
                hideLoading();
                
                if (response.success && response.templates && response.templates[templateId]) {
                    const template = response.templates[templateId];
                    
                    // 填充表单
                    $('#template-id').val(templateId);
                    $('#template-name').val(template.name);
                    $('#template-requirements').val(template.requirements);
                    
                    // 设置模板格式
                    if (template.format) {
                        $('#template-format').val(template.format);
                    } else {
                        $('#template-format').val('all'); // 默认值
                    }
                    
                    // 显示预览图
                    if (template.image) {
                        $('#template-image-preview').attr('src', template.image);
                        $('#template-image-preview').parent().removeClass('d-none');
                    } else {
                        $('#template-image-preview').parent().addClass('d-none');
                    }
                    
                    // 更新模态框标题
                    $('#template-modal-title').text('编辑模板');
                    
                    // 显示模态框
                    $('#add-template-modal').modal('show');
                } else {
                    showMessage('加载模板数据失败', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.message : '服务器错误';
                showMessage('加载模板数据失败: ' + errorMsg, 'danger');
            }
        });
    }

    /**
     * 保存模板
     */
    function saveTemplate() {
        // 获取表单数据
        const templateId = $('#template-id').val() || generateId($('#template-name').val());
        const templateName = $('#template-name').val();
        const templateRequirements = $('#template-requirements').val();
        const templateFormat = $('#template-format').val();
        
        if (!templateName || !templateRequirements) {
            showMessage('请填写模板名称和要求', 'danger');
            return;
        }
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('id', templateId);
        formData.append('name', templateName);
        formData.append('requirements', templateRequirements);
        formData.append('format', templateFormat);
        
        // 添加图片（如果有）
        const imageFile = $('#template-image')[0].files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        showLoading();
        
        // 发送保存请求
        $.ajax({
            url: '/api/templates',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                hideLoading();
                
                if (response.success) {
                    // 隐藏模态框
                    $('#add-template-modal').modal('hide');
                    
                    // 重新加载模板列表
                    loadTemplates();
                    
                    showMessage('模板已成功保存', 'success');
                } else {
                    showMessage('保存模板失败: ' + response.message, 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.message : '服务器错误';
                showMessage('保存模板失败: ' + errorMsg, 'danger');
            }
        });
    }

    /**
     * 删除模板
     * @param {string} templateId 模板ID
     */
    function deleteTemplate(templateId) {
        showLoading();
        
        $.ajax({
            url: `/api/templates/${templateId}`,
            type: 'DELETE',
            success: function(response) {
                hideLoading();
                
                if (response.success) {
                    // 重新加载模板列表
                    loadTemplates();
                    
                    showMessage('模板已成功删除', 'success');
                } else {
                    showMessage('删除模板失败: ' + response.message, 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.message : '服务器错误';
                showMessage('删除模板失败: ' + errorMsg, 'danger');
            }
        });
    }

    /**
     * 加载模板列表
     */
    function loadTemplates() {
        showLoading();
        
        $.ajax({
            url: '/api/templates',
            type: 'GET',
            success: function(response) {
                hideLoading();
                
                if (response.success && response.templates) {
                    // 清空模板列表
                    $('#template-list').empty();
                    
                    // 添加模板到列表
                    Object.keys(response.templates).forEach(id => {
                        const template = response.templates[id];
                        
                        // 格式标签
                        let formatBadge = '';
                        if (template.format === 'word') {
                            formatBadge = '<span class="badge bg-primary ms-2">Word</span>';
                        } else if (template.format === 'pdf') {
                            formatBadge = '<span class="badge bg-success ms-2">PDF</span>';
                        } else {
                            formatBadge = '<span class="badge bg-secondary ms-2">通用</span>';
                        }
                        
                        const templateHtml = `
                            <tr>
                                <td>${template.name} ${formatBadge}</td>
                                <td>
                                    <img src="${template.image || '/images/templates/default.jpg'}" alt="${template.name}" class="template-thumb">
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-info edit-template" data-id="${id}">
                                        <i class="fas fa-edit"></i> 编辑
                                    </button>
                                    <button class="btn btn-sm btn-danger delete-template" data-id="${id}">
                                        <i class="fas fa-trash"></i> 删除
                                    </button>
                                </td>
                            </tr>
                        `;
                        $('#template-list').append(templateHtml);
                    });
                } else {
                    showMessage('加载模板列表失败: ' + response.message, 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.message : '服务器错误';
                showMessage('加载模板列表失败: ' + errorMsg, 'danger');
            }
        });
    }

    /**
     * 生成唯一ID
     * @param {string} name 名称
     * @returns {string} 生成的ID
     */
    function generateId(name) {
        // 将名称转换为小写，替换空格为连字符，并添加时间戳
        return name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    }

    /**
     * 显示消息提示
     * @param {string} message 消息内容
     * @param {string} type 消息类型 (success, danger, warning, info)
     */
    function showMessage(message, type = 'info') {
        // 如果已存在提示，先移除
        $('.alert').remove();
        
        // 创建提示元素
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                <strong>${message}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        // 添加到页面顶部
        $('.container').prepend(alertHtml);
        
        // 3秒后自动关闭
        setTimeout(() => {
            $('.alert').alert('close');
        }, 3000);
    }

    /**
     * 显示加载中
     */
    function showLoading() {
        // 如果已存在加载中元素，则不重复创建
        if ($('.spinner-overlay').length === 0) {
            const spinnerHtml = `
                <div class="spinner-overlay">
                    <div class="spinner-container">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">加载中...</span>
                        </div>
                        <p class="mt-2">加载中，请稍候...</p>
                    </div>
                </div>
            `;
            $('body').append(spinnerHtml);
        }
    }

    /**
     * 隐藏加载中
     */
    function hideLoading() {
        $('.spinner-overlay').remove();
    }
}); 