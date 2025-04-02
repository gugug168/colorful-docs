$(document).ready(function() {
    // 当前处理的文件信息
    let currentProcessedFile = null;
    let currentUploadedFile = null;
    let beautificationResults = []; // 新增：用于存储所有美化结果
    
    // 全局变量
    const BEAUTIFY_TEMPLATES = {}; // 存储美化模板
    const FIXED_API_KEY = 'sk-8540a084e1774f9980019e37a9086781'; // 使用正确的API密钥
    
    // 页面加载时从服务器获取模板
    $.ajax({
        url: '/api/templates',
        type: 'GET',
        success: function(response) {
            if (response.success && response.templates) {
                // 更新模板变量
                BEAUTIFY_TEMPLATES = response.templates;
                
                // 初始化模板选择功能
                initTemplateSelection();
                
                console.log('从服务器加载模板成功', BEAUTIFY_TEMPLATES);
            } else {
                console.error('加载模板失败:', response.message);
                // 使用默认模板作为备选
                initTemplateSelection();
            }
        },
        error: function(xhr) {
            console.error('加载模板请求失败:', xhr);
            // 使用默认模板作为备选
            initTemplateSelection();
        }
    });
    
    // 初始化上传区域交互效果
    initUploadZone();
    
    // 初始化预览区域折叠功能
    initTogglePreview();
    
    // 绑定上传按钮的点击事件
    $('#uploadBtn').on('click', function() {
        // 触发表单提交
        $('#upload-form').submit();
    });
    
    // 初始化模板选择功能
    function initTemplateSelection() {
        const templateSelect = document.getElementById('template-select');
        const applyTemplateBtn = document.getElementById('apply-template-btn');
        const customRequirements = document.getElementById('custom-requirements');
        const targetFormatRadios = document.querySelectorAll('input[name="targetFormat"]');
        
        // 如果模板选择器不存在，直接返回
        if (!templateSelect) return;
        
        // 监听目标格式变化，更新可用模板
        targetFormatRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                updateAvailableTemplates(this.value);
            });
        });
        
        // 初始更新可用模板
        const initialFormat = document.querySelector('input[name="targetFormat"]:checked');
        if (initialFormat) {
            updateAvailableTemplates(initialFormat.value);
        }
        
        // 更新可用模板的函数
        function updateAvailableTemplates(targetFormat) {
            // 保存当前选择
            const currentSelection = templateSelect.value;
            
            // 清空模板选择器
            templateSelect.innerHTML = '<option value="" selected>-- 请选择美化模板 --</option>';
            
            // 如果没有模板数据，直接返回
            if (!BEAUTIFY_TEMPLATES || Object.keys(BEAUTIFY_TEMPLATES).length === 0) {
                console.log('没有可用的模板数据');
                return;
            }
            
            // 根据当前格式筛选模板
            Object.keys(BEAUTIFY_TEMPLATES).forEach(key => {
                const template = BEAUTIFY_TEMPLATES[key];
                
                // 检查模板是否适用于当前格式
                if (!template.format || template.format === 'all' || template.format === targetFormat) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = template.name;
                    
                    // 添加格式标记
                    if (template.format && template.format !== 'all') {
                        option.textContent += ' (' + (template.format === 'word' ? 'Word' : 'PDF') + ')';
                    }
                    
                    templateSelect.appendChild(option);
                }
            });
            
            // 尝试恢复之前的选择
            if (currentSelection && templateSelect.querySelector(`option[value="${currentSelection}"]`)) {
                templateSelect.value = currentSelection;
            } else {
                // 如果之前的选择不再可用，则重置
                templateSelect.value = '';
                applyTemplateBtn.disabled = true;
            }
        }
        
        // 添加预览图显示/隐藏逻辑
        templateSelect.addEventListener('change', function() {
            // 首先隐藏所有预览图
            document.querySelectorAll('.template-preview').forEach(preview => {
                preview.classList.add('d-none');
            });
            
            const selectedValue = this.value;
            
            // 如果选择了模板，显示对应预览图
            if (selectedValue) {
                const previewElement = document.getElementById(`template-preview-${selectedValue}`);
                if (previewElement) {
                    previewElement.classList.remove('d-none');
                }
                
                // 启用应用按钮
                applyTemplateBtn.disabled = false;
            } else {
                // 未选择模板时禁用应用按钮
                applyTemplateBtn.disabled = true;
            }
        });
        
        // 应用模板按钮点击事件
        applyTemplateBtn.addEventListener('click', function() {
            const selectedTemplate = templateSelect.value;
            if (selectedTemplate && BEAUTIFY_TEMPLATES[selectedTemplate]) {
                // 将模板要求填入自定义要求文本框
                customRequirements.value = BEAUTIFY_TEMPLATES[selectedTemplate].requirements;
                
                // 显示一个成功消息
                showMessage(`已应用"${BEAUTIFY_TEMPLATES[selectedTemplate].name}"模板`, 'success');
            }
        });
    }
    
    // 初始化预览区域折叠/展开功能
    function initTogglePreview() {
        // 预览区域折叠/展开
        $('.toggle-preview').on('click', function(e) {
            e.stopPropagation(); // 防止事件冒泡
            e.preventDefault(); // 阻止默认行为
            
            // 不要直接操作DOM，使用变量先获取元素
            const previewBody = $('.preview-content-wrapper');
            const toggleIcon = $(this).find('.toggle-icon i');
            
            // 首先确保标题和图标可见
            ensureVisibility();
            
            // 保存当前状态以便切换
            const isCollapsed = previewBody.hasClass('collapsed');
            
            // 切换折叠状态
            if (isCollapsed) {
                // 展开
                previewBody.removeClass('collapsed');
                toggleIcon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
                toggleIcon.parent().removeClass('collapsed');
            } else {
                // 折叠
                previewBody.addClass('collapsed');
                toggleIcon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
                toggleIcon.parent().addClass('collapsed');
            }
            
            // 存储折叠状态到本地存储
            localStorage.setItem('preview_collapsed', !isCollapsed);
            
            // 确保交互结束后标题仍然可见
            ensureVisibility();
            
            // 再次检查所有元素是否可见
            setTimeout(ensureVisibility, 50);
            setTimeout(ensureVisibility, 200);
        });
        
        // 结果区域折叠/展开
        $('.toggle-result').on('click', function(e) {
            e.stopPropagation(); // 防止事件冒泡
            e.preventDefault(); // 阻止默认行为
            
            // 不要直接操作DOM，使用变量先获取元素
            const resultBody = $('.result-content-wrapper');
            const toggleIcon = $(this).find('.toggle-icon i');
            
            // 首先确保标题和图标可见
            ensureVisibility();
            
            // 保存当前状态以便切换
            const isCollapsed = resultBody.hasClass('collapsed');
            
            // 切换折叠状态
            if (isCollapsed) {
                // 展开
                resultBody.removeClass('collapsed');
                toggleIcon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
                toggleIcon.parent().removeClass('collapsed');
            } else {
                // 折叠
                resultBody.addClass('collapsed');
                toggleIcon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
                toggleIcon.parent().addClass('collapsed');
            }
            
            // 存储折叠状态到本地存储
            localStorage.setItem('result_collapsed', !isCollapsed);
            
            // 确保交互结束后标题仍然可见
            ensureVisibility();
            
            // 再次检查所有元素是否可见
            setTimeout(ensureVisibility, 50);
            setTimeout(ensureVisibility, 200);
        });
        
        // 恢复上次的折叠状态
        const previewCollapsed = localStorage.getItem('preview_collapsed') === 'true';
        const resultCollapsed = localStorage.getItem('result_collapsed') === 'true';
        
        if (previewCollapsed) {
            $('.preview-content-wrapper').addClass('collapsed');
            $('.toggle-preview .toggle-icon').addClass('collapsed');
            $('.toggle-preview .toggle-icon i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        }
        
        if (resultCollapsed) {
            $('.result-content-wrapper').addClass('collapsed');
            $('.toggle-result .toggle-icon').addClass('collapsed');
            $('.toggle-result .toggle-icon i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        }
        
        // 确保初始化时标题始终可见
        ensureVisibility();
        
        // 添加鼠标悬停监听，确保标题文字始终可见
        $('.toggle-preview, .toggle-result').on('mouseenter mouseleave', function() {
            ensureVisibility();
        });
        
        // 通用函数：确保标题和图标可见
        function ensureVisibility() {
            // 设置强制样式确保标题和图标可见
            $('.card-header-preview').css({
                'background-color': 'var(--info-color)',
                'opacity': '1'
            });
            
            $('.card-header-result').css({
                'background-color': 'var(--result-color)',
                'opacity': '1'
            });
            
            $('.header-title, .header-text').css({
                'opacity': '1',
                'visibility': 'visible',
                'color': 'white',
                'text-shadow': '0px 0px 4px rgba(0, 0, 0, 0.5)'
            });
            
            $('.toggle-icon, .toggle-icon i').css({
                'opacity': '1',
                'visibility': 'visible',
                'color': 'white'
            });
        }
    }
    
    // 初始化上传区域交互效果
    function initUploadZone() {
        const uploadZone = $('.upload-zone');
        const fileInput = $('#fileInput');
        const uploadPrompt = $('.upload-prompt');
        
        // 显示上传提示
        uploadPrompt.removeClass('d-none');
        
        // 点击上传区域时触发文件选择
        uploadZone.on('click', function(e) {
            if (e.target !== fileInput[0]) {
                fileInput.click();
            }
        });
        
        // 处理拖放效果
        uploadZone.on('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).addClass('border-primary').css('background-color', 'rgba(212, 224, 255, 0.7)');
        });
        
        uploadZone.on('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('border-primary').css('background-color', '');
        });
        
        uploadZone.on('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('border-primary').css('background-color', '');
            
            if (e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files.length) {
                fileInput[0].files = e.originalEvent.dataTransfer.files;
                // 更新文件名显示
                const fileName = fileInput[0].files[0].name;
                updateFileNameDisplay(fileName);
            }
        });
        
        // 文件选择变化时显示文件名
        fileInput.on('change', function() {
            if (this.files && this.files.length) {
                const fileName = this.files[0].name;
                updateFileNameDisplay(fileName);
            }
        });
        
        // 更新文件名显示
        function updateFileNameDisplay(fileName) {
            // 创建或更新文件名显示元素
            let fileNameDisplay = uploadZone.find('.selected-file');
            if (fileNameDisplay.length === 0) {
                uploadPrompt.html(`
                    <i class="fas fa-file-alt fs-2 mb-2 text-primary"></i>
                    <p class="selected-file mb-0">${fileName}</p>
                    <p class="text-muted small mt-1">点击重新选择</p>
                `);
            } else {
                fileNameDisplay.text(fileName);
            }
        }
    }
    
    // 表单提交处理 - 仅上传文件
    $('#upload-form').on('submit', function(e) {
        e.preventDefault();
        
        // 获取选择的目标格式
        const targetFormat = $('input[name="targetFormat"]:checked').val();
        
        const formData = new FormData(this);
        formData.append('targetFormat', targetFormat); // 添加目标格式到表单数据
        
        // 验证文件类型
        const fileInput = $('#fileInput')[0]; // 修正为正确的文件输入元素ID
        if (fileInput.files.length === 0) {
            showMessage('请选择文件', 'warning');
            return;
        }
        
        const file = fileInput.files[0];
        const fileType = file.name.split('.').pop().toLowerCase();
        
        if (fileType !== 'docx' && fileType !== 'pdf') {
            showMessage('只支持Word文档(.docx)和PDF文件', 'warning');
            return;
        }
        
        // 显示加载状态
        showLoading('正在上传文件...');
        
        // 发送AJAX请求 - 仅上传
        $.ajax({
            url: '/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                hideLoading();
                console.log('上传成功，服务器响应:', response); // 添加调试日志
                
                if (response.success && response.uploadedFile) {
                    // 存储目标格式信息到sessionStorage
                    sessionStorage.setItem('targetFormat', targetFormat);
                    
                    // 保存当前上传的文件信息
                    currentUploadedFile = response.uploadedFile;
                    console.log('当前上传文件信息:', currentUploadedFile); // 添加调试日志
                    
                    // 处理文件路径 - 兼容不同的API响应格式
                    // 如果uploadedFile没有path属性，则使用filename属性构建路径
                    const filePath = response.uploadedFile.path || 
                                    (response.uploadedFile.filename ? 
                                     (response.uploadedFile.filename.startsWith('/') ? 
                                      response.uploadedFile.filename : 
                                      `/temp/${response.uploadedFile.filename}`) : 
                                    null);
                    
                    const fileName = filePath ? 
                                    filePath.split(/[\/\\]/).pop() : 
                                    response.uploadedFile.filename || response.uploadedFile.originalname;
                    
                    console.log('解析的文件路径和文件名:', { path: filePath, name: fileName });
                    
                    // 保存文件信息到全局变量，避免依赖DOM或会话存储
                    window.currentFilePath = filePath;
                    window.currentFileName = fileName;
                    
                    // 确保文件路径信息存在
                    if (filePath && fileName) {
                        // 使用HTML属性而不是jQuery的data方法
                        $('#beautify-btn').attr('data-filepath', filePath);
                        $('#beautify-btn').attr('data-filename', fileName);
                        // 确保保存成功
                        console.log('设置美化按钮属性:', {
                            filepath: $('#beautify-btn').attr('data-filepath'),
                            filename: $('#beautify-btn').attr('data-filename')
                        });
                        
                        // 设置标志表示文档已上传并准备好美化
                        sessionStorage.setItem('documentReady', 'true');
                    }
                    
                    // 保存到会话存储中 - 为了兼容性保留，但添加路径
                    sessionStorage.setItem('currentFile', JSON.stringify({
                        path: filePath,
                        filename: fileName,
                        type: response.uploadedFile.type,
                        html: response.uploadedFile.html
                    }));
                    
                    // 将整个上传文件响应也保存到会话存储，确保所有信息都可用
                    let uploadedFileWithPath = {...response.uploadedFile};
                    if (!uploadedFileWithPath.path && filePath) {
                        uploadedFileWithPath.path = filePath;
                    }
                    sessionStorage.setItem('uploadedFile', JSON.stringify(uploadedFileWithPath));
                    
                    // 显示上传成功消息
                    showMessage('文档上传成功！', 'success');
                    
                    // 直接使用返回的HTML显示预览
                    if (currentUploadedFile && currentUploadedFile.html) {
                        // 显示预览区域
                        $('#document-preview').removeClass('d-none');
                        
                        // 隐藏美化结果区域
                        $('#result-section').addClass('d-none');
                        
                        // 在预览区域显示内容
                        $('#preview-content').html(currentUploadedFile.html);
                        
                        // 添加漂亮的加载动画
                        addEntryAnimation('#document-preview');
                        
                        // 确保预览区域处于展开状态
                        $('.preview-content-wrapper').removeClass('collapsed');
                        $('.toggle-preview .toggle-icon i').removeClass('fa-chevron-down').addClass('fa-chevron-up');
                        $('.toggle-preview .toggle-icon').removeClass('collapsed');
                        
                        // 启用美化按钮
                        $('#beautify-btn').prop('disabled', false);
                    } else if (filePath) {
                        // 尝试加载原始文档预览
                        loadOriginalPreview(filePath);
                    } else {
                        // 无法获取路径和HTML
                        showMessage('无法显示文档预览，但文件已上传成功', 'warning');
                    }
                } else {
                    showMessage(response.message || '上传失败', 'danger');
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                showMessage('上传出错: ' + (xhr.responseJSON?.message || error), 'danger');
            }
        });
    });
    
    // 添加元素出现动画
    function addEntryAnimation(selector) {
        const element = $(selector);
        element.css('opacity', 0);
        element.animate({
            opacity: 1
        }, 400);
    }
    
    // 加载原始文档预览
    function loadOriginalPreview(filePath) {
        console.log('加载预览，文件路径:', filePath); // 添加调试日志
        
        // 只获取文件名部分，不包含路径
        const filename = filePath ? filePath.split(/[\/\\]/).pop() : '';
        console.log('提取的文件名:', filename); // 添加调试日志
        
        if (!filename) {
            console.error('无法从路径中提取文件名');
            $('#preview-content').html('<div class="alert alert-danger">无法加载预览：文件名无效</div>');
            return;
        }
        
        // 显示加载中状态
        $('#preview-content').html('<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">正在加载预览...</p></div>');
        
        // 显示预览区域
        $('#document-preview').removeClass('d-none');
        
        // 添加漂亮的加载动画
        addEntryAnimation('#document-preview');
        
        // 确保预览区域处于展开状态
        $('.preview-content-wrapper').removeClass('collapsed');
        $('.toggle-preview .toggle-icon i').removeClass('fa-chevron-down').addClass('fa-chevron-up');
        $('.toggle-preview .toggle-icon').removeClass('collapsed');
        
        // 隐藏美化结果区域
        $('#result-section').addClass('d-none');
        
        // 获取预览内容
        $.ajax({
            url: '/preview/' + encodeURIComponent(filename),
            type: 'GET',
            success: function(html) {
                console.log('预览请求成功'); // 添加调试日志
                // 在预览区域显示内容
                $('#preview-content').html(html);
                
                // 将文件路径保存为HTML属性
                $('#beautify-btn').attr('data-filepath', filePath);
                $('#beautify-btn').attr('data-filename', filename);
                
                // 保存到全局变量
                window.currentFilePath = filePath;
                window.currentFileName = filename;
                
                // 设置标志表示文档已上传并准备好美化
                sessionStorage.setItem('documentReady', 'true');
                
                // 确保保存成功
                console.log('预览后设置美化按钮属性:', {
                    filepath: $('#beautify-btn').attr('data-filepath'),
                    filename: $('#beautify-btn').attr('data-filename')
                });
                
                // 确保美化按钮启用
                $('#beautify-btn').prop('disabled', false);
            },
            error: function(xhr, status, error) {
                console.error('预览加载失败:', error, xhr.status, xhr.responseText);
                $('#preview-content').html('<div class="alert alert-danger">加载预览失败: ' + (xhr.status ? xhr.status + ' ' + error : error) + '</div>');
                
                // 如果预览API失败，尝试直接使用会话存储中的HTML
                const currentFile = JSON.parse(sessionStorage.getItem('currentFile') || '{}');
                if (currentFile.html) {
                    console.log('使用会话存储中的HTML作为备选'); // 添加调试日志
                    $('#preview-content').html(currentFile.html);
                    
                    // 同样绑定文件信息到按钮
                    if (currentFile.path) {
                        $('#beautify-btn').attr('data-filepath', currentFile.path);
                        $('#beautify-btn').attr('data-filename', currentFile.path.split(/[\/\\]/).pop());
                        $('#beautify-btn').prop('disabled', false);
                    }
                }
            }
        });
    }
    
    // 美化文档按钮点击事件
    $('#beautify-btn').on('click', function() {
        // 获取自定义美化要求
        const customRequirements = $('#custom-requirements').val().trim();
        
        // 检查是否已上传文件
        if (!currentUploadedFile) {
            showMessage('请先上传文档', 'danger');
            return;
        }
        
        // 禁用按钮，防止重复点击
        $(this).prop('disabled', true); // 取消注释此行
        
        // 显示加载状态
        showLoading('正在使用AI美化文档...');
        
        // 启动美化处理
        processBeautification(currentUploadedFile.path, currentUploadedFile.originalname);
    });
    
    // 下载按钮点击事件
    $('#download-btn').on('click', function() {
        if (!currentProcessedFile) {
            showMessage('还没有可下载的文件', 'warning');
            return;
        }
        
        // 安全处理路径，提取文件名
        let filename = '';
        try {
            if (typeof currentProcessedFile.path === 'string') {
                filename = currentProcessedFile.path.split('/').pop().split('\\').pop();
            } else {
                console.error('当前处理文件路径无效:', currentProcessedFile.path);
                showMessage('文件路径无效，请重新上传文档', 'danger');
                return;
            }
        } catch (error) {
            console.error('处理文件路径出错:', error);
            showMessage('文件路径处理出错，请重新上传文档', 'danger');
            return;
        }

        // 获取用户选择的目标格式
        const targetFormat = $('input[name="targetFormat"]:checked').val();
        
        // 显示加载状态
        showLoading('准备下载文档...');
        
        // 请求导出文件
        $.ajax({
            url: `/export?htmlFile=${encodeURIComponent(filename)}&format=${targetFormat}`,
            type: 'GET',
            success: function(response) {
                hideLoading();
                
                if (response.success && response.downloadUrl) {
                    showMessage('文档准备完成，即将开始下载', 'success');
                    
                    // 使用临时链接元素来下载文件
                    const downloadLink = document.createElement('a');
                    downloadLink.href = response.downloadUrl;
                    downloadLink.download = response.filename || `document.${targetFormat}`;
                    downloadLink.style.display = 'none';
                    document.body.appendChild(downloadLink);
                    
                    // 延迟一点点再触发下载，确保UI更新
                    setTimeout(function() {
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                    }, 500);
                } else {
                    showMessage('导出文档失败：' + (response.message || '未知错误'), 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                showMessage('导出文档请求失败：' + (xhr.responseText || '服务器错误'), 'danger');
            }
        });
    });
    
    // 查看完整页面按钮点击事件
    $('#view-complete-btn').on('click', function() {
        if (!currentProcessedFile) {
            showMessage('还没有可查看的文件', 'warning');
            return;
        }
        
        // 安全处理路径
        let filename = '';
        try {
            // 尝试提取文件名
            if (typeof currentProcessedFile.path === 'string') {
                // 从路径中提取文件名
                filename = currentProcessedFile.path.split('/').pop().split('\\').pop();
            } else {
                console.error('当前处理文件路径无效:', currentProcessedFile.path);
                showMessage('文件路径无效，请重新上传文档', 'danger');
                return;
            }
        } catch (error) {
            console.error('处理文件路径出错:', error);
            showMessage('文件路径处理出错，请重新上传文档', 'danger');
            return;
        }
        
        // 打开新窗口查看AI处理后的HTML文档
        window.open(`/view-document/${filename}`, '_blank');
    });
    
    // 下载完整文档按钮点击事件
    $('#download-complete-btn').on('click', function() {
        if (!currentProcessedFile) {
            showMessage('还没有可下载的文件', 'warning');
            return;
        }
        
        // 安全处理路径
        let filename = '';
        try {
            // 尝试提取文件名
            if (typeof currentProcessedFile.path === 'string') {
                // 从路径中提取文件名
                filename = currentProcessedFile.path.split('/').pop().split('\\').pop();
            } else {
                console.error('当前处理文件路径无效:', currentProcessedFile.path);
                showMessage('文件路径无效，请重新上传文档', 'danger');
                return;
            }
        } catch (error) {
            console.error('处理文件路径出错:', error);
            showMessage('文件路径处理出错，请重新上传文档', 'danger');
            return;
        }
        
        const targetFormat = $('input[name="targetFormat"]:checked').val();
        
        // 显示加载状态
        showLoading('准备下载文档...');
        
        // 请求导出文件
        $.ajax({
            url: `/export?htmlFile=${filename}&format=${targetFormat}`,
            type: 'GET',
            success: function(response) {
                hideLoading();
                
                if (response.success && response.downloadUrl) {
                    showMessage('文档准备完成，即将开始下载', 'success');
                    
                    // 使用临时链接元素来下载文件，而不是通过window.location跳转
                    const downloadLink = document.createElement('a');
                    downloadLink.href = response.downloadUrl;
                    downloadLink.download = response.filename || `document.${targetFormat}`;
                    downloadLink.style.display = 'none';
                    document.body.appendChild(downloadLink);
                    
                    // 延迟一点点再触发下载，确保UI更新
                    setTimeout(function() {
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                    }, 500);
                } else {
                    showMessage('导出文档失败：' + (response.message || '未知错误'), 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                showMessage('导出文档请求失败：' + (xhr.responseText || '服务器错误'), 'danger');
            }
        });
    });
    
    /**
     * 处理文档美化
     * @param {string} filePath - 上传文件路径
     * @param {string} filename - 原始文件名
     */
    function processBeautification(filePath, filename) {
        if (!filePath) {
            showMessage('无法处理文件，文件路径丢失', 'danger');
            // 确保按钮在出错时重新启用
            $('#beautify-btn').prop('disabled', false);
            return;
        }
        
        const targetFormat = document.querySelector('input[name="targetFormat"]:checked').value;
        const customRequirements = document.getElementById('custom-requirements').value;
        
        // 从路径中提取HTML文件名，不使用原始文件名
        let htmlFilename = '';
        try {
            htmlFilename = filePath.split('/').pop().split('\\').pop();
            console.log('美化请求使用HTML文件名:', htmlFilename);
        } catch (error) {
            console.error('提取HTML文件名出错:', error);
            htmlFilename = filename; // 如果提取失败，回退到原始文件名
        }
        
        // 确保API密钥可用且有效
        if (!FIXED_API_KEY || FIXED_API_KEY.length < 10 || FIXED_API_KEY === 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
            console.error('API密钥无效或未设置:', FIXED_API_KEY);
            showMessage('API密钥无效或未设置，无法使用AI美化功能', 'danger');
            $('#beautify-btn').prop('disabled', false);
            return;
        }
        
        console.log('发送美化请求:', { 
            filename: htmlFilename, // 使用HTML文件名
            targetFormat: targetFormat,
            customRequirements: customRequirements,
            apiKey: FIXED_API_KEY ? `${FIXED_API_KEY.substring(0, 5)}...` : '未设置' // 日志中只显示部分密钥，保护隐私
        });
        
        showLoading('正在使用AI美化您的文档，这可能需要一些时间...');
        
        // 准备美化请求
        fetch('/beautify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: htmlFilename, // 使用HTML文件名
                targetFormat: targetFormat,
                apiKey: FIXED_API_KEY, // 使用固定的API密钥
                customRequirements: customRequirements
            })
        })
        .then(response => {
            console.log('收到服务器响应，状态码:', response.status);
            if (!response.ok) {
                return response.json().then(errorData => {
                    // 尝试从响应中获取更详细的错误信息
                    throw new Error(errorData.message || `服务器返回错误状态码: ${response.status}`);
                }).catch(jsonError => {
                    // 如果解析JSON失败，则使用原始错误
                    throw new Error(`服务器返回错误状态码: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            hideLoading();
            console.log('美化响应数据:', data);
            
            if (data.success) {
                showMessage('文档美化完成！', 'success');
                
                // 更新结果文件路径
                const resultFilePath = data.processedFile.path.replace(/\\/g, '/');
                // 从文件路径中提取文件名
                window.processedFilename = resultFilePath.split('/').pop();
                
                console.log('处理后的文件路径:', resultFilePath);
                console.log('处理后的文件名:', window.processedFilename);
                
                // 更新当前处理后的文件（可能仍用于某些地方，暂时保留）
                currentProcessedFile = {
                    path: resultFilePath,
                    html: data.processedFile.html,
                    filename: window.processedFilename,
                    type: data.processedFile.type,
                    originalname: data.processedFile.originalname,
                    prompt: customRequirements // 保存提示词
                };

                // 将新结果添加到数组
                beautificationResults.push({
                    html: data.processedFile.html,
                    path: resultFilePath,
                    prompt: customRequirements, // 记录本次提示词
                    targetFormat: targetFormat // 记录目标格式
                });

                // 显示主下载按钮（曾经被隐藏的）
                $('#download-btn').removeClass('d-none');
                
                // 调用新的函数来展示所有结果
                displayBeautificationResults();
                
                // 折叠原始文档预览区域，让美化结果更显眼
                const previewWrapper = $('#document-preview .preview-content-wrapper');
                const previewToggleIcon = $('#document-preview .toggle-preview .toggle-icon');
                const previewIconElement = previewToggleIcon.find('i');

                if (!previewWrapper.hasClass('collapsed')) { // 仅在未折叠时执行
                    previewWrapper.addClass('collapsed');
                    previewIconElement.removeClass('fa-chevron-up').addClass('fa-chevron-down');
                    previewToggleIcon.addClass('collapsed');
                }
                
                // 自动滚动到结果区域，确保最新结果可见
                const resultSectionElement = document.getElementById('result-section');
                if (resultSectionElement) {
                    setTimeout(() => {
                        resultSectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); // 改为滚动到区域顶部
                    }, 400);
                }

                // 重新启用美化按钮，允许再次美化
                $('#beautify-btn').prop('disabled', false);
            } else {
                console.error('美化失败原因:', data.message);
                showMessage('美化文档失败: ' + data.message, 'danger');
                 // 美化失败时也要重新启用按钮
                $('#beautify-btn').prop('disabled', false);
            }
        })
        .catch(error => {
            hideLoading();
            console.error('处理美化请求时发生错误:', error);
            showMessage('处理请求时发生错误: ' + error.message, 'danger');
             // 出错时也要重新启用按钮
            $('#beautify-btn').prop('disabled', false);
        });
    }
    
    /**
     * 显示所有美化结果
     * @param {string} filePath - 美化后HTML文件的路径
     * @param {string} prompt - 本次美化使用的提示词
     */
    function displayBeautificationResults() {
        const resultsList = $('#beautified-results-list');
        resultsList.empty(); // 清空现有列表
        
        // 清空侧边导航栏
        const sidebarNav = $('#results-sidebar');
        sidebarNav.empty();
        
        console.log('准备显示美化结果，数量:', beautificationResults.length);

        // 确保body可以滚动
        $('body').css({
            'overflow-y': 'auto !important',
            'height': 'auto !important',
            'position': 'relative !important'
        });
        
        // 确保页面可滚动
        ensurePageScrollable();

        beautificationResults.forEach((result, index) => {
            const resultId = `result-${index}`;
            let filename = '无效文件名';
            try {
                if (typeof result.path === 'string') {
                    filename = result.path.split('/').pop().split('\\').pop();
                    console.log(`结果 ${index+1} 文件名:`, filename);
                } else {
                    console.error(`结果 ${index+1} 文件路径无效:`, result.path);
                }
            } catch (error) {
                console.error(`处理结果 ${index+1} 文件路径出错:`, error);
            }

            const cardHtml = `
                <div class="card shadow-sm mb-3 result-card" id="${resultId}">
                    <div class="card-header card-header-result-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">
                                <i class="fas fa-check-circle me-2"></i>美化结果 ${index + 1}
                            </h5>
                            <span class="badge bg-secondary">提示词: ${result.prompt || '无'}</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="beautified-content-container border p-3 rounded content-display">
                            <!-- Iframe 容器 -->
                            <div class="iframe-container mb-3">
                               <iframe class="preview-iframe" frameborder="0" style="width: 100%; min-height: 400px; height: auto;"></iframe>
                            </div>
                            <div class="text-center">
                                 <p class="small text-muted mb-2">可下载或在新页面查看完整效果</p>
                                 <button class="btn btn-sm btn-outline-secondary view-complete-single-btn" data-filename="${filename}">
                                    <i class="fas fa-external-link-alt me-1"></i> 查看
                                </button>
                                <button class="btn btn-sm btn-primary download-single-btn" data-filename="${filename}" data-format="${result.targetFormat || 'word'}">
                                    <i class="fas fa-download me-1"></i> 下载
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const cardElement = $(cardHtml);
            resultsList.append(cardElement);
            
            // 向侧边导航栏添加导航项
            const navItemHtml = `<div class="result-nav-item" data-target="${resultId}" data-index="${index + 1}">${index + 1}</div>`;
            sidebarNav.append(navItemHtml);

            // 每添加一个卡片，确保页面可滚动
            ensurePageScrollable();

            // 加载Iframe内容
            const iframe = cardElement.find('iframe')[0];
            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const baseUrl = window.location.origin;
                    
                    iframeDoc.open();
                    iframeDoc.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <base href="${baseUrl}">
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    margin: 10px; 
                                    overflow-y: visible;
                                }
                                img { max-width: 100%; height: auto; }
                                ::-webkit-scrollbar {
                                    width: 8px;
                                    height: 8px;
                                }
                                ::-webkit-scrollbar-track {
                                    background: #f1f1f1;
                                    border-radius: 4px;
                                }
                                ::-webkit-scrollbar-thumb {
                                    background: #888;
                                    border-radius: 4px;
                                }
                                ::-webkit-scrollbar-thumb:hover {
                                    background: #555;
                                }
                            </style>
                        </head>
                        <body>${result.html || '<p>预览内容加载失败</p>'}</body>
                        </html>
                    `);
                    iframeDoc.close();
                    
                    // 调整iframe高度
                    setTimeout(() => {
                        try {
                            // 获取iframe内容实际高度
                            const scrollHeight = iframeDoc.body.scrollHeight;
                            
                            // 设置最小高度为400px，最大高度可以更高以适应内容
                            const iframeHeight = Math.max(scrollHeight, 400);
                            $(iframe).css('height', iframeHeight + 'px');
                            
                            // 移除iframe容器的最大高度限制
                            const iframeContainer = cardElement.find('.iframe-container');
                            iframeContainer.css({
                                'height': 'auto !important',
                                'max-height': 'none !important',
                                'overflow-y': 'visible !important',
                                'border': '1px solid #e0e0e0',
                                'border-radius': '4px'
                            });

                            // 在每个iframe加载后，确保页面可以滚动
                            ensurePageScrollable();
                        } catch (e) {
                            console.warn(`调整结果 ${index+1} iframe高度时出错:`, e);
                            $(iframe).css('height', '400px'); // 回退到默认高度
                            
                            // 即使调整失败，也要确保页面可滚动
                            ensurePageScrollable();
                        }
                    }, 300);
                } catch (error) {
                    console.error(`设置结果 ${index+1} iframe内容时出错:`, error);
                    // 如果iframe操作失败，尝试直接在容器中显示HTML
                    const container = cardElement.find('.iframe-container');
                    container.css({
                        'height': 'auto !important',
                        'max-height': 'none !important',
                        'overflow-y': 'visible !important',
                        'padding': '10px'
                    }).html(`<div class="content-fallback">${result.html || '内容加载失败'}</div>`);
                    
                    // 即使显示失败，也要确保页面可滚动
                    ensurePageScrollable();
                }
            }

            // 绑定按钮事件
            cardElement.find('.view-complete-single-btn').on('click', function() {
                const fname = $(this).data('filename');
                if (fname && fname !== '无效文件名') {
                    window.open(`/view-document/${fname}`, '_blank');
                } else {
                    showMessage('无法查看，文件名无效', 'warning');
                }
            });

            cardElement.find('.download-single-btn').on('click', function() {
                const fname = $(this).data('filename');
                const format = $(this).data('format');
                if (fname && fname !== '无效文件名') {
                    requestDownload(fname, format);
                } else {
                    showMessage('无法下载，文件名无效', 'warning');
                }
            });
        });

        // 显示结果区域
        const resultSection = $('#result-section');
        if (resultSection.hasClass('d-none')) {
            resultSection.removeClass('d-none');
            addEntryAnimation('#result-section');
            console.log('结果区域显示完成');
            // 结果区域显示后再次确保可滚动
            ensurePageScrollable();
        }

        // 确保结果区域展开
        const resultWrapper = $('.result-content-wrapper');
        const resultToggleIcon = $('.toggle-result .toggle-icon');
        const resultIconElement = resultToggleIcon.find('i');
        if (resultWrapper.hasClass('collapsed')) {
            resultWrapper.removeClass('collapsed');
            resultIconElement.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            resultToggleIcon.removeClass('collapsed');
            // 展开后再次确保可滚动
            ensurePageScrollable();
        }
        
        // 如果有美化结果，显示侧边导航栏
        if (beautificationResults.length > 0) {
            sidebarNav.removeClass('d-none');
            
            // 默认选中第一个导航项
            sidebarNav.find('.result-nav-item:first').addClass('active');
            
            // 绑定导航项点击事件
            $('.result-nav-item').on('click', function() {
                const targetId = $(this).data('target');
                if (targetId) {
                    // 移除所有导航项的active类
                    $('.result-nav-item').removeClass('active');
                    // 给当前点击的导航项添加active类
                    $(this).addClass('active');
                    // 滚动到目标元素
                    $('html, body').animate({
                        scrollTop: $(`#${targetId}`).offset().top - 80 // 80px的偏移量，避免被导航栏遮挡
                    }, 500);
                    
                    // 滚动动画完成后确保页面仍然可滚动
                    setTimeout(ensurePageScrollable, 600);
                }
            });
            
            // 监听滚动事件，更新导航项的active状态
            $(window).on('scroll', debounce(function() {
                if (beautificationResults.length > 0) {
                    const scrollTop = $(window).scrollTop();
                    const windowHeight = $(window).height();
                    const scrollMid = scrollTop + windowHeight / 2; // 取窗口中点作为参考
                    
                    let closestCard = null;
                    let minDistance = Infinity;
                    
                    // 查找距离窗口中点最近的结果卡片
                    $('.result-card').each(function() {
                        const cardTop = $(this).offset().top;
                        const cardCenter = cardTop + $(this).outerHeight() / 2;
                        const distance = Math.abs(cardCenter - scrollMid);
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestCard = $(this);
                        }
                    });
                    
                    // 如果找到了最近的卡片，更新激活状态
                    if (closestCard) {
                        const cardId = closestCard.attr('id');
                        
                        // 只有当当前激活项不是目标项时才更新
                        const currentActive = $('.result-nav-item.active').data('target');
                        if (currentActive !== cardId) {
                            // 移除所有导航项的active类
                            $('.result-nav-item').removeClass('active');
                            // 给对应的导航项添加active类
                            $(`.result-nav-item[data-target="${cardId}"]`).addClass('active');
                        }
                    }
                    
                    // 滚动时确保页面可以滚动
                    ensurePageScrollable();
                }
            }, 100)); // 使用100ms的防抖
        } else {
            sidebarNav.addClass('d-none');
        }

        // 滚动到最新结果
        if (beautificationResults.length > 0) {
            const lastResultId = `result-${beautificationResults.length - 1}`;
            const lastResultElement = $(`#${lastResultId}`);
            if (lastResultElement.length > 0) {
                setTimeout(() => {
                    lastResultElement[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
                    
                    // 额外滚动一点，确保完全可见
                    setTimeout(() => {
                        window.scrollBy(0, -80); // 向上滚动80px以显示标题
                        
                        // 再次确保页面可滚动
                        ensurePageScrollable();
                    }, 300);
                }, 400);
            }
        }

        // 根据结果数量更新消息
        if (beautificationResults.length > 0) {
            showMessage(`已生成 ${beautificationResults.length} 个美化版本`, 'info', 3000);
        } else {
            showMessage('没有可显示的美化结果', 'warning');
        }

        // 确保页面可以滚动，使用多个定时器确保在各种情况下都能正常滚动
        ensurePageScrollable();
        setTimeout(ensurePageScrollable, 500);
        setTimeout(ensurePageScrollable, 1000);
        setTimeout(ensurePageScrollable, 2000);
        setTimeout(ensurePageScrollable, 3000);
        
        // 监听窗口大小变化事件，确保滚动正常
        $(window).on('resize', debounce(ensurePageScrollable, 100));
    }

    // 确保页面可以滚动的辅助函数
    function ensurePageScrollable() {
        // 移除可能阻止滚动的样式
        $('html, body').css({
            'height': 'auto !important',
            'overflow-y': 'auto !important',
            'min-height': '100% !important',
            'position': 'relative !important'
        });
        
        // 确保内容区域可以滚动
        $('.content-area, #result-section, #beautified-results-list').css({
            'overflow': 'visible !important',
            'height': 'auto !important',
            'max-height': 'none !important'
        });
        
        // 确保iframe容器可见
        $('.iframe-container').css({
            'height': 'auto !important',
            'max-height': 'none !important',
            'overflow': 'visible !important'
        });
        
        // 检查文档高度是否超过窗口高度
        if ($(document).height() > $(window).height()) {
            console.log('文档高度超过窗口高度，确保可滚动');
            
            // 强制应用可滚动样式
            $('html, body').css({
                'overflow-y': 'auto !important',
                'height': 'auto !important'
            });
            
            // 强制设置滚动样式到所有结果卡片
            $('.result-card, .result-card .card-body').css({
                'overflow': 'visible !important',
                'height': 'auto !important'
            });
            
            // 确保容器和布局可见
            $('.container-fluid, .row').css({
                'overflow': 'visible !important',
                'height': 'auto !important'
            });
            
            // 尝试触发窗口resize事件
            $(window).trigger('resize');
        }
        
        // 检查body的样式是否被覆盖
        const bodyStyles = window.getComputedStyle(document.body);
        if (bodyStyles.overflow === 'hidden' || bodyStyles.overflowY === 'hidden') {
            console.log('检测到body滚动被禁用，强制启用滚动');
            document.body.style.setProperty('overflow', 'auto', 'important');
            document.body.style.setProperty('overflow-y', 'auto', 'important');
            document.body.style.setProperty('height', 'auto', 'important');
        }
        
        // 确保html元素也可滚动
        const htmlStyles = window.getComputedStyle(document.documentElement);
        if (htmlStyles.overflow === 'hidden' || htmlStyles.overflowY === 'hidden') {
            console.log('检测到html滚动被禁用，强制启用滚动');
            document.documentElement.style.setProperty('overflow', 'auto', 'important');
            document.documentElement.style.setProperty('overflow-y', 'auto', 'important');
            document.documentElement.style.setProperty('height', 'auto', 'important');
        }
    }

    // 辅助函数：请求下载
    function requestDownload(filename, format) {
        showLoading('准备下载文档...');
        $.ajax({
            url: `/export?htmlFile=${encodeURIComponent(filename)}&format=${format}`,
            type: 'GET',
            success: function(response) {
                hideLoading();
                if (response.success && response.downloadUrl) {
                    showMessage('文档准备完成，即将开始下载', 'success');
                    const downloadLink = document.createElement('a');
                    downloadLink.href = response.downloadUrl;
                    downloadLink.download = response.filename || `document.${format}`;
                    downloadLink.style.display = 'none';
                    document.body.appendChild(downloadLink);
                    setTimeout(function() {
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                    }, 500);
                } else {
                    showMessage('导出文档失败：' + (response.message || '未知错误'), 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                showMessage('导出文档请求失败：' + (xhr.responseText || '服务器错误'), 'danger');
            }
        });
    }
    
    // 显示消息
    function showMessage(message, type, duration = 5000) {
        // 检查消息容器是否存在
        let messageContainer = $('#message-container');
        if (messageContainer.length === 0) {
            // 创建消息容器
            $('<div id="message-container" class="position-fixed top-0 start-50 translate-middle-x p-3" style="z-index: 1050;"></div>').appendTo('body');
            messageContainer = $('#message-container');
        }
        
        // 创建消息元素
        const messageId = 'msg-' + Date.now();
        const icons = {
            success: '<i class="fas fa-check-circle me-2"></i>',
            warning: '<i class="fas fa-exclamation-triangle me-2"></i>',
            danger: '<i class="fas fa-times-circle me-2"></i>',
            info: '<i class="fas fa-info-circle me-2"></i>'
        };
        
        const icon = icons[type] || '';
        const messageHtml = `
            <div id="${messageId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${icon}${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        // 添加消息到容器
        const alert = $(messageHtml).appendTo(messageContainer);
        
        // 添加动画
        alert.css('transform', 'translateY(-20px)');
        alert.css('opacity', '0');
        setTimeout(() => {
            alert.css('transition', 'all 0.3s ease');
            alert.css('transform', 'translateY(0)');
            alert.css('opacity', '1');
        }, 10);
        
        // 设置自动消失
        setTimeout(function() {
            alert.css('transform', 'translateY(-20px)');
            alert.css('opacity', '0');
            setTimeout(() => {
                alert.remove();
            }, 300);
        }, duration);
    }
    
    // 显示加载中状态
    function showLoading(message) {
        // 检查加载容器是否存在
        let loadingContainer = $('#loading-container');
        if (loadingContainer.length === 0) {
            // 创建加载容器
            $('<div id="loading-container" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background-color: rgba(0,0,0,0.5); z-index: 2000;"></div>').appendTo('body');
            loadingContainer = $('#loading-container');
        }
        
        // 创建加载内容
        const loadingHtml = `
            <div class="bg-white p-4 rounded shadow-lg text-center">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mb-0">${message || '正在处理...'}</p>
            </div>
        `;
        
        // 显示加载状态
        loadingContainer.html(loadingHtml).removeClass('d-none');
        
        // 添加动画
        const loadingBox = loadingContainer.find('div').first();
        loadingBox.css('transform', 'scale(0.8)');
        loadingBox.css('opacity', '0');
        setTimeout(() => {
            loadingBox.css('transition', 'all 0.3s ease');
            loadingBox.css('transform', 'scale(1)');
            loadingBox.css('opacity', '1');
        }, 10);
    }
    
    // 隐藏加载中状态
    function hideLoading() {
        const loadingContainer = $('#loading-container');
        const loadingBox = loadingContainer.find('div').first();
        
        loadingBox.css('transform', 'scale(0.8)');
        loadingBox.css('opacity', '0');
        
        setTimeout(() => {
            loadingContainer.addClass('d-none');
        }, 300);
    }
    
    // 向CSS添加按钮脉冲动画和滚动条样式
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes pulse-animation {
            0% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(var(--pulse-color, 94, 124, 226), 0.7);
            }
            
            70% {
                transform: scale(0.98);
                box-shadow: 0 0 0 10px rgba(var(--pulse-color, 94, 124, 226), 0);
            }
            
            100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(var(--pulse-color, 94, 124, 226), 0);
            }
        }
        
        .pulse-animation {
            animation: pulse-animation 0.5s ease-out;
        }
        
        .btn-success-custom.pulse-animation {
            --pulse-color: 66, 184, 131;
        }
        
        .btn-download.pulse-animation {
            --pulse-color: 255, 125, 69;
        }
        
        /* 添加滚动条样式 */
        .content-display {
            overflow: visible;
        }
        
        .iframe-container {
            position: relative;
            overflow: auto;
        }
        
        .result-card {
            overflow: visible;
        }
        
        .beautified-content-container {
            overflow: visible;
        }
        
        /* 美化滚动条 */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
    `;
    document.head.appendChild(style);

    // debounce工具函数:延迟调用函数直到一段时间后才执行
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(context, args);
            }, wait);
        };
    }
});