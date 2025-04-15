/**
 * HTML编码工具函数
 * @param {string} html - 需要编码的HTML字符串
 * @returns {string} - 编码后的HTML字符串
 */
function encodeHTML(html) {
    if (!html) return '';
    return html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

$(document).ready(function() {
    // 当前处理的文件信息
    let currentProcessedFile = null;
    let currentUploadedFile = null;
    let beautificationResults = []; // 新增：用于存储所有美化结果
    let documentImages = []; // 存储文档中的图片
    
    // 将这些变量也附加到window对象上，确保inline脚本可以访问
    window.currentProcessedFile = currentProcessedFile;
    window.currentUploadedFile = currentUploadedFile;
    window.beautificationResults = beautificationResults;
    window.documentImages = documentImages;
    
    // 初始化 - 从会话存储中恢复状态
    function initializeFromSessionStorage() {
        // 尝试恢复上传文件信息
        try {
            const storedUploadedFile = sessionStorage.getItem('uploadedFile');
            if (storedUploadedFile) {
                currentUploadedFile = JSON.parse(storedUploadedFile);
                // 同时更新window对象上的变量
                window.currentUploadedFile = currentUploadedFile;
                console.log('从会话存储恢复上传文件信息:', currentUploadedFile);
                
                // 如果有文件路径，设置到美化按钮上
                if (currentUploadedFile.path) {
                    $('#beautify-btn').attr('data-filepath', currentUploadedFile.path);
                    $('#beautify-btn').attr('data-filename', currentUploadedFile.path.split(/[\/\\]/).pop());
                    $('#beautify-btn').prop('disabled', false);
                    $('#colorize-images-btn').prop('disabled', false);
                }
            }
            
            // 尝试恢复当前文件信息
            const storedCurrentFile = sessionStorage.getItem('currentFile');
            if (storedCurrentFile) {
                const currentFile = JSON.parse(storedCurrentFile);
                console.log('从会话存储恢复当前文件信息:', currentFile);
                
                // 如果有HTML内容，显示预览
                if (currentFile.html) {
                    $('#document-preview').removeClass('d-none');
                    $('#preview-content').html(currentFile.html);
                }
            }
        } catch (e) {
            console.error('从会话存储恢复状态失败:', e);
        }
    }
    
    // 初始化时调用
    initializeFromSessionStorage();
    
    // 全局变量
    let BEAUTIFY_TEMPLATES = {}; // 存储美化模板
    const FIXED_API_KEY = 'sk-8540a084e1774f9980019e37a9086781'; // 使用正确的API密钥
    
    // 页面加载时从服务器获取模板
    $.ajax({
        url: '/api/templates',
        type: 'GET',
        success: function(response) {
            if (response.success && response.templates) {
                // 更新模板变量
                BEAUTIFY_TEMPLATES = response.templates;
                
                // 打印详细的模板数据
                console.log('模板加载成功，详细数据:', response.templates);
                console.log('模板数量:', Object.keys(response.templates).length);
                
                // 检查模板图片路径
                Object.keys(response.templates).forEach(key => {
                    const template = response.templates[key];
                    console.log(`模板 ${key} (${template.name}) 图片路径:`, template.image || '无图片');
                    
                    // 如果有图片路径，预加载图片以检查是否可访问
                    if (template.image) {
                        const img = new Image();
                        img.onload = function() {
                            console.log(`模板 ${key} 图片加载成功:`, template.image);
                        };
                        img.onerror = function() {
                            console.error(`模板 ${key} 图片加载失败:`, template.image);
                        };
                        img.src = template.image;
                    }
                });
                
                // 初始化模板选择功能
                initTemplateSelection();
                
                // 初始化模板图片放大功能
                setTimeout(initTemplatePreviewZoom, 500);
                
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
    
    // 初始化图片上色功能
    initColorizeImagesBtn();
    
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
            console.log('开始更新可用模板，目标格式:', targetFormat);
            console.log('当前所有模板数据:', BEAUTIFY_TEMPLATES);
            
            // 保存当前选择
            const currentSelection = templateSelect.value;
            
            // 清空模板选择器
            templateSelect.innerHTML = '<option value="" selected>-- 请选择美化模板 --</option>';
            
            // 如果没有模板数据，直接返回
            if (!BEAUTIFY_TEMPLATES || Object.keys(BEAUTIFY_TEMPLATES).length === 0) {
                console.log('没有可用的模板数据');
                return;
            }
            
            let availableCount = 0;
            
            // 清空所有动态创建的模板预览
            const templatePreviewContainer = document.querySelector('.template-preview-container');
            // 保留原始的静态预览元素
            const staticPreviews = {};
            document.querySelectorAll('.template-preview').forEach(preview => {
                staticPreviews[preview.id.replace('template-preview-', '')] = preview;
            });
            
            // 清空预览容器
            templatePreviewContainer.innerHTML = '';
            
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
                    availableCount++;
                    
                    console.log('添加模板选项:', key, template.name, '格式:', template.format || 'all');
                    
                    // 创建或恢复该模板的预览元素
                    if (staticPreviews[key]) {
                        // 如果是静态预定义的预览，添加回容器
                        templatePreviewContainer.appendChild(staticPreviews[key]);
                    } else {
                        // 创建动态预览元素
                        const previewElement = document.createElement('div');
                        previewElement.id = `template-preview-${key}`;
                        previewElement.className = 'template-preview d-none';
                        
                        // 如果模板有图片，显示图片
                        if (template.image) {
                            previewElement.innerHTML = `
                                <div class="text-center p-4">
                                    <div class="template-preview-zoom">
                                        <img src="${template.image}" alt="${template.name}" class="img-fluid mb-1">
                                        <div class="template-preview-caption">点我放大查看</div>
                                    </div>
                                    <h5>${template.name}</h5>
                                    <p class="text-muted small">适用于${template.format === 'word' ? 'Word文档' : template.format === 'pdf' ? 'PDF文档' : '所有文档格式'}</p>
                                </div>
                            `;
                        } else {
                            // 没有图片时使用图标
                            previewElement.innerHTML = `
                                <div class="text-center p-4">
                                    <i class="fas fa-file-alt fa-4x text-primary mb-3"></i>
                                    <h5>${template.name}</h5>
                                    <p class="text-muted small">适用于${template.format === 'word' ? 'Word文档' : template.format === 'pdf' ? 'PDF文档' : '所有文档格式'}</p>
                                </div>
                            `;
                        }
                        
                        templatePreviewContainer.appendChild(previewElement);
                        console.log('为模板创建预览元素:', key, '图片路径:', template.image || '无图片');
                    }
                } else {
                    console.log('模板不适用于当前格式，跳过:', key, template.name, '模板格式:', template.format, '当前格式:', targetFormat);
                }
            });
            
            console.log('已添加的可用模板数量:', availableCount);
            
            // 尝试恢复之前的选择
            if (currentSelection && templateSelect.querySelector(`option[value="${currentSelection}"]`)) {
                templateSelect.value = currentSelection;
                console.log('恢复之前的模板选择:', currentSelection);
                
                // 显示对应的预览
                const previewElement = document.getElementById(`template-preview-${currentSelection}`);
                if (previewElement) {
                    previewElement.classList.remove('d-none');
                }
            } else {
                // 如果之前的选择不再可用，则重置
                templateSelect.value = '';
                applyTemplateBtn.disabled = true;
                console.log('之前的选择不可用，已重置选择器');
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
                    console.log('显示模板预览:', selectedValue);
                    
                    // 显示后初始化放大功能
                    setTimeout(initTemplatePreviewZoom, 100);
                } else {
                    console.log('未找到预览元素:', `template-preview-${selectedValue}`);
                    
                    // 如果没有找到预览元素，检查是否有动态模板数据并创建预览
                    if (BEAUTIFY_TEMPLATES[selectedValue]) {
                        const template = BEAUTIFY_TEMPLATES[selectedValue];
                        console.log('尝试为模板创建预览元素:', selectedValue, template);
                        
                        // 创建预览元素
                        const templatePreviewContainer = document.querySelector('.template-preview-container');
                        const newPreviewElement = document.createElement('div');
                        newPreviewElement.id = `template-preview-${selectedValue}`;
                        newPreviewElement.className = 'template-preview';
                        
                        // 如果模板有图片，显示图片
                        if (template.image) {
                            newPreviewElement.innerHTML = `
                                <div class="text-center p-4">
                                    <div class="template-preview-zoom">
                                        <img src="${template.image}" alt="${template.name}" class="img-fluid mb-1">
                                        <div class="template-preview-caption">点我放大查看</div>
                                    </div>
                                    <h5>${template.name}</h5>
                                    <p class="text-muted small">适用于${template.format === 'word' ? 'Word文档' : template.format === 'pdf' ? 'PDF文档' : '所有文档格式'}</p>
                                </div>
                            `;
                        } else {
                            // 没有图片时使用图标
                            newPreviewElement.innerHTML = `
                                <div class="text-center p-4">
                                    <i class="fas fa-file-alt fa-4x text-primary mb-3"></i>
                                    <h5>${template.name}</h5>
                                    <p class="text-muted small">适用于${template.format === 'word' ? 'Word文档' : template.format === 'pdf' ? 'PDF文档' : '所有文档格式'}</p>
                                </div>
                            `;
                        }
                        
                        templatePreviewContainer.appendChild(newPreviewElement);
                        console.log('动态创建了模板预览元素:', selectedValue);
                    }
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
        console.log('表单提交事件触发');
        
        // 获取选择的目标格式
        const targetFormat = $('input[name="targetFormat"]:checked').val();
        console.log('选择的目标格式:', targetFormat);
        
        // 验证文件类型
        const fileInput = $('#fileInput')[0];
        if (!fileInput || fileInput.files.length === 0) {
            console.error('未选择文件');
            showMessage('请选择文件', 'warning');
            return false;
        }
        
        const file = fileInput.files[0];
        console.log('选择的文件:', file.name, '大小:', file.size, 'bytes');
        
        const fileType = file.name.split('.').pop().toLowerCase();
        console.log('文件类型:', fileType);
        
        if (fileType !== 'docx' && fileType !== 'doc' && fileType !== 'pdf') {
            console.error('不支持的文件类型:', fileType);
            showMessage('只支持Word文档(.doc/.docx)和PDF文件', 'warning');
            return false;
        }
        
        // 创建FormData对象
        const formData = new FormData(this);
        formData.append('targetFormat', targetFormat); // 添加目标格式到表单数据
        
        // 显示加载状态
        showLoading('正在上传文件...');
        console.log('开始上传文件:', file.name);
        
        // 发送AJAX请求 - 仅上传
        $.ajax({
            url: '/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            timeout: 60000, // 设置60秒超时
            beforeSend: function() {
                console.log('开始发送上传请求');
            },
            success: function(response) {
                hideLoading();
                console.log('上传成功，服务器响应:', response);
                
                if (response.success && response.uploadedFile) {
                    // 存储目标格式信息到sessionStorage
                    sessionStorage.setItem('targetFormat', targetFormat);
                    
                    // 保存当前上传的文件信息
                    currentUploadedFile = response.uploadedFile;
                    console.log('当前上传文件信息:', currentUploadedFile);
                    
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
                        $('#colorize-images-btn').prop('disabled', false);
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
                console.error('上传请求失败:', {
                    status: status,
                    error: error,
                    responseText: xhr.responseText,
                    statusCode: xhr.status
                });
                
                let errorMsg = '上传出错';
                
                try {
                    // 尝试解析响应JSON
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMsg += ': ' + xhr.responseJSON.message;
                    } else if (xhr.responseText) {
                        // 尝试解析responseText为JSON
                        const jsonResponse = JSON.parse(xhr.responseText);
                        if (jsonResponse.message) {
                            errorMsg += ': ' + jsonResponse.message;
                        }
                    }
                } catch (e) {
                    // 如果解析失败，使用普通错误消息
                    errorMsg += ': ' + (error || '服务器连接失败，请稍后重试');
                    console.error('解析错误响应失败:', e);
                }
                
                if (xhr.status) {
                    errorMsg += ' (状态码: ' + xhr.status + ')';
                }
                
                showMessage(errorMsg, 'danger');
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
                $('#colorize-images-btn').prop('disabled', false);
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
    
    // 美化按钮处理 - 创建美化任务
    $('#beautify-btn').on('click', function() {
        // 获取必要的参数
        const filePath = $(this).attr('data-filepath');
        const filename = $(this).attr('data-filename');
        
        // 确保文件信息存在
        if (!filePath || !filename) {
            console.error('美化按钮缺少必要的文件信息');
            showMessage('无法美化文档：缺少文件信息', 'danger');
            return;
        }
        
        console.log('开始美化文档，文件路径:', filePath);
        
        // 获取美化选项
        const selectedApiType = $('#api-type-select').val() || 'deepseek';
        const selectedTemplate = $('#template-select').val() || '';
        
        // 检查是否有自定义要求
        let customRequirements = '';
        if ($('#custom-requirements').is(':visible')) {
            customRequirements = $('#custom-requirements').val();
        } else if (selectedTemplate) {
            // 如果选择了模板但没有显示自定义要求，获取模板的要求
            const templateOption = $('#template-select option:selected');
            if (templateOption.length > 0) {
                customRequirements = templateOption.attr('data-requirements') || '';
            }
        }
        
        // 获取目标格式
        const targetFormat = $('input[name="targetFormat"]:checked').val() || 'word';
        
        // 显示加载中状态
        showLoading('正在提交美化任务...');
        
        // 创建美化任务
        $.ajax({
            url: '/api/beautify-task',
            type: 'POST',
            contentType: 'application/json',
            timeout: 15000, // 增加超时时间
            cache: false, // 禁用缓存
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            data: JSON.stringify({
                filePath: filePath,
                filename: filename,
                targetFormat: targetFormat,
                apiType: selectedApiType,
                templateId: selectedTemplate,
                customRequirements: customRequirements
            }),
            success: function(response) {
                console.log('美化任务创建成功:', response);
                
                if (response.success && response.taskId) {
                    // 保存任务ID
                    sessionStorage.setItem('currentTaskId', response.taskId);
                    console.log('保存当前任务ID:', response.taskId);
                    
                    // 更新加载提示
                    updateLoading('正在美化文档，请稍候...');
                    
                    // 添加进度条到加载提示
                    $('#progress-container').html(`
                        <div class="mt-3">
                            <div class="progress" style="height: 10px;">
                                <div id="task-progress-bar" class="progress-bar progress-bar-striped progress-bar-animated" 
                                    role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" 
                                    style="width: 0%">
                                </div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-1">
                                <span id="task-status-text" class="small text-muted">等待中...</span>
                                <span id="task-progress-text" class="small text-muted">0%</span>
                            </div>
                        </div>
                    `);
                    
                    // 开始检查任务状态
                    checkTaskStatus(response.taskId);
                } else {
                    hideLoading();
                    showMessage(response.message || '创建美化任务失败', 'danger');
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                console.error('创建美化任务请求失败:', error);
                
                // 尝试备用请求方法
                if (status === 'timeout' || status === 'error') {
                    console.log('尝试使用备用美化任务接口...');
                    // 尝试旧版API端点
                    $.ajax({
                        url: '/beautify',
                        type: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            filename: filename,
                            targetFormat: targetFormat,
                            customRequirements: customRequirements
                        }),
                        success: function(fallbackResponse) {
                            console.log('备用美化任务创建成功:', fallbackResponse);
                            if (fallbackResponse.success && fallbackResponse.taskId) {
                                sessionStorage.setItem('currentTaskId', fallbackResponse.taskId);
                                checkTaskStatus(fallbackResponse.taskId);
                            } else {
                                showMessage('美化任务创建失败，请重试', 'danger');
                            }
                        },
                        error: function() {
                            showMessage('提交美化任务失败，请刷新页面重试', 'danger');
                        }
                    });
                } else {
                    showMessage('提交美化任务失败: ' + (xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : error), 'danger');
                }
            }
        });
    });
    
    // 下载按钮点击事件
    $('#download-btn').on('click', function() {
        if (!currentProcessedFile) {
            // 尝试从会话存储中恢复处理文件信息
            const lastResult = beautificationResults.length > 0 ? beautificationResults[beautificationResults.length - 1] : null;
            
            if (lastResult && lastResult.path) {
                currentProcessedFile = {
                    path: lastResult.path,
                    html: lastResult.html,
                    filename: lastResult.path.split('/').pop(),
                    type: lastResult.targetFormat || 'word'
                };
                console.log('从最后一个结果恢复处理文件信息:', currentProcessedFile);
            } else {
                showMessage('还没有可下载的文件', 'warning');
                return;
            }
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
        const targetFormat = currentProcessedFile.type || $('input[name="targetFormat"]:checked').val();
        
        // 显示加载状态
        showLoading('准备下载文档...');
        
        // 请求下载
        requestDownload(filename, targetFormat);
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
        
        showLoading('正在提交美化任务，请稍候...');
        
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
                customRequirements: customRequirements,
                htmlContent: $('#preview-content').html(), // 添加HTML内容参数
                colorizedImages: currentProcessedFile && currentProcessedFile.colorizedImages ? 
                    currentProcessedFile.colorizedImages : [] // 传递之前上色的图片信息
            })
        })
        .then(response => {
            console.log('收到服务器响应，状态码:', response.status);
            if (!response.ok) {
                return response.json().then(errorData => {
                    // 尝试从响应中获取更详细的错误信息
                    throw new Error(errorData.message || errorData.error || `服务器返回错误状态码: ${response.status}`);
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
            
            // 判断是否是异步任务响应
            if (data.success && data.taskId) {
                console.log('收到异步任务ID:', data.taskId);
                showMessage('文档美化任务已提交，正在处理中...', 'info');
                
                // 显示任务进度弹窗
                showTaskProgressModal();
                
                // 开始轮询任务状态
                startTaskStatusPolling(data.taskId);
                
                // 重新启用美化按钮
                $('#beautify-btn').prop('disabled', false);
                
                return; // 提前返回，后续处理由轮询函数完成
            }
            
            // 兼容旧版直接返回结果的模式
            if (data.success && data.processedFile) {
                showMessage('文档美化完成！', 'success');
                
                // 更新结果文件路径
                const resultFilePath = data.processedFile.path.replace(/\\/g, '/');
                // 从文件路径中提取文件名
                window.processedFilename = resultFilePath.split('/').pop();
                
                console.log('处理后的文件路径:', resultFilePath);
                console.log('处理后的文件名:', window.processedFilename);
                
                // 保存原始图片信息（如果存在）
                const colorizedImages = currentProcessedFile && currentProcessedFile.colorizedImages ? 
                    currentProcessedFile.colorizedImages : [];
                
                // 更新当前处理后的文件
                currentProcessedFile = {
                    path: resultFilePath,
                    html: data.processedFile.html,
                    filename: window.processedFilename,
                    type: data.processedFile.type,
                    originalname: data.processedFile.originalname,
                    prompt: customRequirements, // 保存提示词
                    colorizedImages: colorizedImages // 保留原来上色的图片信息
                };

                // 将新结果添加到数组
                beautificationResults.push({
                    html: data.processedFile.html,
                    path: resultFilePath,
                    prompt: customRequirements, // 记录本次提示词
                    targetFormat: targetFormat, // 记录目标格式
                    colorizedImages: colorizedImages // 保留原来上色的图片信息
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
                    previewIconElement.removeClass('fa-chevron-down').addClass('fa-chevron-up');
                    previewToggleIcon.addClass('collapsed');
                }
                
                // 自动滚动到结果区域，确保最新结果可见
                const resultSectionElement = document.getElementById('result-section');
                if (resultSectionElement) {
                    setTimeout(() => {
                        resultSectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); // 改为滚动到区域顶部
                    }, 400);
                }
            } else {
                console.error('美化失败原因:', data.message || data.error);
                showMessage('美化文档失败: ' + (data.message || data.error || '未知错误'), 'danger');
            }
            
            // 重新启用美化按钮，允许再次美化
            $('#beautify-btn').prop('disabled', false);
            $('#colorize-images-btn').prop('disabled', false);
        })
        .catch(error => {
            hideLoading();
            console.error('处理美化请求时发生错误:', error);
            showMessage('处理请求时发生错误: ' + (error.message || '未知错误'), 'danger');
            // 出错时也要重新启用按钮
            $('#beautify-btn').prop('disabled', false);
            $('#colorize-images-btn').prop('disabled', false);
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

            // 确保提示词被正确处理，强制只保留前十个字符用于显示
            const fullPrompt = result.prompt || '无';
            const displayPrompt = fullPrompt === '无' ? '无' : (fullPrompt.substring(0, 10) + (fullPrompt.length > 10 ? '...' : ''));
            console.log(`结果 ${index+1} 提示词处理: ${fullPrompt.length > 20 ? fullPrompt.substring(0, 20) + '...' : fullPrompt} -> ${displayPrompt}`);

            const cardHtml = `
                <div class="card shadow-sm mb-3 result-card" id="${resultId}">
                    <div class="card-header card-header-result-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">
                                <i class="fas fa-check-circle me-2"></i>美化结果 ${index + 1}
                            </h5>
                            <!-- 移除提示词显示 -->
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
            
            // 向侧边导航栏添加导航项，只显示索引编号，不显示提示词
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
                    
                    // 处理HTML内容，彻底移除提示词显示
                    let processedHtml = result.html || '<p>预览内容加载失败</p>';
                    
                    // 1. 查找紫色背景和提示词区域
                    // 注意：从之前的错误看，通常提示词区域在内容的开头，并且有紫色背景
                    // 我们将尝试识别并彻底删除这个区域
                    let contentStartIndex = 0;
                    let bodyContentStart = processedHtml.indexOf('<body>');
                    if (bodyContentStart !== -1) {
                        // 如果找到<body>标签，我们从这里开始扫描
                        contentStartIndex = bodyContentStart + 6; // '<body>'的长度是6
                    }

                    // 从开始位置扫描1000个字符，查找紫色背景或提示词特征
                    const headPart = processedHtml.substring(contentStartIndex, contentStartIndex + 5000);
                    let purpleBackgroundStart = -1;
                    let purpleBackgroundEnd = -1;

                    // 查找紫色背景的开始位置
                    const bgColorPatterns = [
                        'background-color: purple',
                        'background-color:#',
                        'background-color: rgb',
                        'background: purple',
                        'background:#',
                        'background: rgb'
                    ];

                    for (const pattern of bgColorPatterns) {
                        const idx = headPart.indexOf(pattern);
                        if (idx !== -1) {
                            // 找到紫色背景，现在向前查找最近的div或section开始标签
                            const beforeBg = headPart.substring(0, idx);
                            const divStart = beforeBg.lastIndexOf('<div');
                            const sectionStart = beforeBg.lastIndexOf('<section');
                            
                            if (divStart !== -1 || sectionStart !== -1) {
                                // 使用找到的最靠近的标签开始位置
                                purpleBackgroundStart = Math.max(divStart, sectionStart);
                                break;
                            }
                        }
                    }

                    // 如果找到了开始位置，查找结束位置
                    if (purpleBackgroundStart !== -1) {
                        // 向后查找匹配的结束标签
                        const afterStart = headPart.substring(purpleBackgroundStart);
                        const divEndIdx = afterStart.indexOf('</div>');
                        const sectionEndIdx = afterStart.indexOf('</section>');
                        
                        // 使用找到的最近的结束标签
                        if (divEndIdx !== -1) {
                            purpleBackgroundEnd = purpleBackgroundStart + divEndIdx + 6; // '</div>'的长度是6
                        } else if (sectionEndIdx !== -1) {
                            purpleBackgroundEnd = purpleBackgroundStart + sectionEndIdx + 10; // '</section>'的长度是10
                        }
                    }

                    // 如果找到了紫色背景区域，从HTML中删除它
                    if (purpleBackgroundStart !== -1 && purpleBackgroundEnd !== -1) {
                        // 构建新的HTML，删除紫色背景区域
                        const beforePurple = processedHtml.substring(0, contentStartIndex + purpleBackgroundStart);
                        const afterPurple = processedHtml.substring(contentStartIndex + purpleBackgroundEnd);
                        processedHtml = beforePurple + afterPurple;
                        console.log('已删除紫色背景区域:', purpleBackgroundStart, purpleBackgroundEnd);
                    } else {
                        // 如果未找到明确的紫色背景区域，尝试使用正则表达式
                        console.log('未找到明确的紫色背景区域，尝试使用正则表达式');
                        
                        // 移除可能的大型紫色背景和提示词区域
                        processedHtml = processedHtml.replace(/<div[^>]*style="[^"]*background[^"]*"[^>]*>[\s\S]{100,5000}?<\/div>/gi, '');
                        processedHtml = processedHtml.replace(/<section[^>]*style="[^"]*background[^"]*"[^>]*>[\s\S]{100,5000}?<\/section>/gi, '');
                        
                        // 移除包含提示词或美化要求的大型区块
                        processedHtml = processedHtml.replace(/<div[^>]*>[^<]{0,50}(?:提示词|美化提示|美化要求|使用以下)[^<]{0,5000}?<\/div>/gi, '');
                    }

                    // 再次添加一些额外的过滤，以防万一
                    const purpleBackgroundPatterns = [
                        /<div[^>]*style="[^"]*background(?:-color)?:\s*purple[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
                        /<div[^>]*style="[^"]*background(?:-color)?:\s*#[a-fA-F0-9]{3,6}[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
                        /<div[^>]*style="[^"]*background(?:-color)?:\s*rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)[^"]*"[^>]*>[\s\S]*?<\/div>/gi
                    ];

                    // 应用所有紫色背景移除模式
                    purpleBackgroundPatterns.forEach(pattern => {
                        processedHtml = processedHtml.replace(pattern, '');
                    });

                    // 生成iframe内容
                    iframeDoc.open();
                    iframeDoc.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                                /* 复制必要的样式到iframe中 */
                                body {
                                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                    margin: 0;
                                    padding: 10px;
                                    color: #333;
                                    line-height: 1.6;
                                }
                                img {
                                    max-width: 100% !important;
                                    height: auto !important;
                                    max-height: 150px !important;
                                    display: block;
                                    margin: 10px auto;
                                    border-radius: 4px;
                                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                                    cursor: zoom-in;
                                    transition: max-height 0.3s ease, transform 0.3s ease;
                                    position: relative;
                                }
                                img:hover {
                                    max-height: none !important;
                                    transform: scale(1.05);
                                    z-index: 100;
                                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                                }
                                .image-caption {
                                    text-align: center;
                                    color: #666;
                                    font-size: 12px;
                                    margin-top: 5px;
                                    cursor: zoom-in;
                                }
                                /* 其它样式保持不变 */
                                ${result.css || ''}
                            </style>
                        </head>
                        <body>
                            ${processedHtml}
                        </body>
                        </html>
                    `);
                    iframeDoc.close();
                    
                    // 在iframe加载完成后添加图片说明
                    setTimeout(() => {
                        try {
                            const iframeWindow = iframe.contentWindow;
                            const iframeDoc = iframeWindow.document;
                            
                            // 处理iframe中的所有图片
                            const allImages = iframeDoc.querySelectorAll('img');
                            allImages.forEach(img => {
                                // 为每个图片添加点击放大的文字说明
                                const imageWrapper = iframeDoc.createElement('div');
                                imageWrapper.style.position = 'relative';
                                imageWrapper.style.marginBottom = '20px';
                                
                                // 创建说明文字
                                const caption = iframeDoc.createElement('div');
                                caption.className = 'image-caption';
                                caption.textContent = '点我放大查看';
                                
                                // 将原始图片替换为带有说明的包装
                                img.parentNode.insertBefore(imageWrapper, img);
                                imageWrapper.appendChild(img);
                                imageWrapper.appendChild(caption);
                            });
                            
                            // 获取所有元素以进行后续处理
                            const allElements = iframeDoc.querySelectorAll('*');
                            
                            // 检查第一个大型元素是否可能包含提示词
                            const firstLargeElement = Array.from(allElements).find(el => {
                                const text = el.textContent || '';
                                return text.length > 200 && el.tagName.toLowerCase() === 'div';
                            });
                            
                            if (firstLargeElement) {
                                const text = firstLargeElement.textContent || '';
                                // 检查是否包含常见的提示词特征
                                if (text.includes('提示词') || text.includes('美化要求') || 
                                    text.includes('请将') || text.includes('加粗') || 
                                    text.includes('颜色') || text.includes('高亮')) {
                                    // 移除可能的提示词元素
                                    firstLargeElement.parentNode.removeChild(firstLargeElement);
                                    console.log('已移除可能的提示词元素');
                                }
                            }
                            
                            // 隐藏任何有紫色背景的元素
                            allElements.forEach(element => {
                                const style = element.getAttribute('style') || '';
                                if (style.includes('background') || style.includes('rgb')) {
                                    element.style.display = 'none';
                                }
                            });
                            
                            // 应用已上色图片 - 遍历iframe中的所有图片
                            console.log('处理iframe中的图片，应用上色效果');
                            
                            // 检查是否有上色图片信息
                            if (currentProcessedFile && currentProcessedFile.colorizedImages && 
                                currentProcessedFile.colorizedImages.length > 0) {
                                
                                const colorizedImages = currentProcessedFile.colorizedImages;
                                console.log(`找到 ${colorizedImages.length} 张上色图片记录`);
                                
                                // 获取iframe中的所有图片
                                const iframeImages = doc.querySelectorAll('img');
                                console.log(`iframe中有 ${iframeImages.length} 张图片`);
                                
                                // 处理每张图片
                                iframeImages.forEach(img => {
                                    const imgSrc = img.getAttribute('src');
                                    if (!imgSrc) return;
                                    
                                    // 提取图片文件名
                                    const imgFilename = imgSrc.split('/').pop();
                                    console.log(`检查图片: ${imgFilename}`);
                                    
                                    // 在上色记录中查找匹配
                                    for (const colorized of colorizedImages) {
                                        if (!colorized.success || !colorized.originalPath) continue;
                                        
                                        const originalFilename = colorized.originalPath.split('/').pop().split('\\').pop();
                                        
                                        // 检查文件名是否匹配
                                        if (imgFilename === originalFilename || imgSrc.includes(originalFilename)) {
                                            // 找到匹配，替换图片路径
                                            const colorizedFilename = colorized.colorizedPath.split('/').pop().split('\\').pop();
                                            let newSrc = '';
                                            
                                            // 在public/images/temp目录中查找
                                            newSrc = `/images/temp/${colorizedFilename}`;
                                            console.log(`将图片 ${imgSrc} 替换为 ${newSrc}`);
                                            
                                            // 更新图片属性
                                            img.setAttribute('src', newSrc);
                                            img.setAttribute('data-colorized', 'true');
                                            img.setAttribute('data-original', originalFilename);
                                            
                                            // 添加加载失败时的回退处理
                                            img.onerror = function() {
                                                console.log(`图片加载失败，尝试使用备用路径: ${imgSrc}`);
                                                this.src = imgSrc; // 恢复原始路径
                                                this.onerror = null; // 防止循环
                                            };
                                            
                                            break;
                                        }
                                    }
                                });
                            } else {
                                console.log('没有找到上色图片记录');
                            }
                        } catch (e) {
                            console.error('处理iframe加载后内容时出错:', e);
                        }
                    }, 500);
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
    
    /**
     * 显示消息提示
     * @param {string} message - 要显示的消息内容
     * @param {string} type - 消息类型（success, info, warning, danger）
     * @param {number} duration - 消息显示持续时间（毫秒）
     */
    function showMessage(message, type, duration = 5000) {
        // 确保已有的消息被清除
        clearTimeout(window.messageTimeout);
        
        // 确保有一个用于显示消息的容器
        let messageContainer = $('#message-container');
        if (messageContainer.length === 0) {
            messageContainer = $('<div id="message-container" class="position-fixed top-0 start-50 translate-middle-x p-3" style="z-index: 1080;"></div>');
            $('body').append(messageContainer);
        }
        
        // 创建提示元素
        const alertId = 'custom-alert-' + new Date().getTime();
        const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} shadow-sm alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="关闭"></button>
            </div>
        `;
        
        // 添加到容器
        messageContainer.html(alertHtml);
        
        // 设置自动消失
        window.messageTimeout = setTimeout(() => {
            $(`#${alertId}`).alert('close');
        }, duration);
    }
    
    /**
     * 显示加载提示
     * @param {string} message - 要显示的加载提示消息
     */
    function showLoading(message) {
        // 确保已有的加载提示被清除
        hideLoading();
        
        // 创建加载提示的HTML
        const loadingHtml = `
            <div id="loading-overlay" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="z-index: 1090; background-color: rgba(0, 0, 0, 0.5);">
                <div class="bg-white p-4 rounded shadow">
                    <div class="d-flex align-items-center">
                        <div class="spinner-border text-primary me-3" role="status">
                            <span class="visually-hidden">加载中...</span>
                        </div>
                        <span id="loading-message">${message || '加载中...'}</span>
                    </div>
                    <!-- 进度条将在需要时添加到这里 -->
                    <div id="progress-container"></div>
                </div>
            </div>
        `;
        
        // 添加到body
        $('body').append(loadingHtml);
    }
    
    /**
     * 隐藏加载提示
     */
    function hideLoading() {
        $('#loading-overlay').remove();
    }

    /**
     * 更新加载提示文本
     * @param {string} message - 要显示的加载提示消息
     */
    function updateLoading(message) {
        if ($('#loading-overlay').length) {
            $('#loading-message').text(message || '加载中...');
        } else {
            showLoading(message);
        }
    }

    // 将这些函数附加到window对象上，使它们在全局范围内可用
    window.showMessage = showMessage;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.updateLoading = updateLoading;

    /**
     * 初始化模板预览图片放大功能
     */
    function initTemplatePreviewZoom() {
        // 处理页面加载时已存在的模板预览图片
        const existingImages = document.querySelectorAll('.template-preview img');
        existingImages.forEach(img => {
            if (!img.closest('.template-preview-zoom')) {
                // 如果图片还没有放大功能包装，添加包装
                const parent = img.parentNode;
                
                // 创建包装容器
                const zoomWrapper = document.createElement('div');
                zoomWrapper.className = 'template-preview-zoom';
                
                // 保存原始图片的类和样式
                const imgClasses = img.className;
                const imgStyle = img.getAttribute('style') || '';
                
                // 移除max-height内联样式，让CSS控制
                img.className = 'img-fluid mb-1';
                img.removeAttribute('style');
                
                // 创建说明文字
                const caption = document.createElement('div');
                caption.className = 'template-preview-caption';
                caption.textContent = '点我放大查看';
                
                // 构建新的DOM结构
                parent.insertBefore(zoomWrapper, img);
                zoomWrapper.appendChild(img);
                zoomWrapper.appendChild(caption);
                
                console.log('为已存在的模板预览图片添加了放大功能');
            }
        });
    }

    // 初始化图片上色按钮事件
    function initColorizeImagesBtn() {
        const colorizeImagesBtn = $('#colorize-images-btn');
        
        // 图片上色按钮点击事件
        colorizeImagesBtn.on('click', function() {
            // 获取处理文件信息 - 优先使用currentProcessedFile，如果不存在则尝试使用currentUploadedFile
            let fileToProcess = null;
            
            if (currentProcessedFile) {
                fileToProcess = currentProcessedFile;
            } else if (currentUploadedFile) {
                fileToProcess = currentUploadedFile;
            } else {
                // 尝试从sessionStorage恢复
                try {
                    const storedFile = sessionStorage.getItem('uploadedFile');
                    if (storedFile) {
                        currentUploadedFile = JSON.parse(storedFile);
                        fileToProcess = currentUploadedFile;
                        console.log('从会话存储恢复上传文件信息用于图片上色:', currentUploadedFile);
                    }
                } catch (e) {
                    console.error('从会话存储恢复文件信息失败:', e);
                }
            }
            
            if (!fileToProcess) {
                showMessage('请先上传并处理文档', 'warning');
                return;
            }
            
            // 设置当前处理文件（如果尚未设置）
            if (!currentProcessedFile) {
                currentProcessedFile = fileToProcess;
            }
            
            // 加载文档中的图片
            loadDocumentImages();
        });
        
        // 选择/取消选择图片
        $(document).on('click', '.image-item-checkbox', function() {
            updateSelectedImagesCount();
        });
        
        // 选择全部/取消全部按钮
        $(document).on('click', '#select-all-images', function() {
            const isChecked = $(this).prop('checked');
            $('.image-item-checkbox').prop('checked', isChecked);
            updateSelectedImagesCount();
        });
        
        // 开始上色按钮
        $('#start-colorize-btn').on('click', function() {
            const selectedImages = getSelectedImages();
            if (selectedImages.length === 0) {
                showMessage('请至少选择一张图片进行上色', 'warning');
                return;
            }
            
            // 禁用开始上色按钮，防止重复点击
            $(this).prop('disabled', true);
            
            startImageColorization(selectedImages);
        });
        
        // 重试按钮点击事件
        $('#colorize-retry-btn').on('click', function() {
            // 隐藏重试按钮
            $(this).addClass('d-none');
            // 重新加载图片
            loadDocumentImages();
        });
        
        // 添加预览图片点击可以选择/取消选择功能
        $(document).on('click', '.image-preview-container img', function() {
            const checkbox = $(this).closest('.card').find('.image-item-checkbox');
            checkbox.prop('checked', !checkbox.prop('checked'));
            updateSelectedImagesCount();
        });
    }
    
    // 加载文档中的图片
    function loadDocumentImages() {
        const imagesContainer = $('#images-container');
        imagesContainer.html(`
            <div class="col-12 text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">加载中...</span>
                </div>
                <p class="mt-2">正在加载文档中的图片...</p>
            </div>
        `);
        
        // 重置开始上色按钮状态
        $('#start-colorize-btn').prop('disabled', true);
        $('.selected-count').text('(0)');
        
        // 显示模态框
        const colorizeModal = new bootstrap.Modal(document.getElementById('colorizeImagesModal'));
        colorizeModal.show();
        
        // 获取文档中的图片
        let filePath = '';
        
        // 尝试从不同来源获取文件路径
        if (currentProcessedFile && typeof currentProcessedFile === 'object' && currentProcessedFile.path) {
            filePath = currentProcessedFile.path;
        } else if (typeof currentProcessedFile === 'string') {
            filePath = currentProcessedFile;
        } else if (currentUploadedFile && currentUploadedFile.path) {
            filePath = currentUploadedFile.path;
        } else {
            // 如果尚未从主要变量中找到，尝试从DOM中获取
            filePath = $('#beautify-btn').attr('data-filepath');
        }
        
        if (!filePath) {
            // 如果仍然没有文件路径，尝试从会话存储中恢复
            try {
                const storedFile = JSON.parse(sessionStorage.getItem('uploadedFile') || '{}');
                if (storedFile && storedFile.path) {
                    filePath = storedFile.path;
                    console.log('从会话存储恢复文件路径:', filePath);
                }
            } catch (e) {
                console.error('从会话存储恢复文件路径失败:', e);
            }
        }
        
        if (!filePath) {
            imagesContainer.html(`
                <div class="col-12 text-center py-3">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>无法获取文档路径，请重新上传文档
                    </div>
                </div>
            `);
            return;
        }
        
        console.log('原始文件路径:', filePath);
        
        // 使用简单处理 - 只获取文件名
        const fileName = filePath.split(/[\/\\]/).pop();
        // 构建相对路径 - 假设文件在temp目录下
        const requestPath = `temp/${fileName}`;
        
        // 发送获取图片请求
        $.ajax({
            url: `/api/document/images?path=${encodeURIComponent(requestPath)}`,
            type: 'GET',
            success: function(response) {
                if (response.success && response.images && response.images.length > 0) {
                    // 保存图片数据
                    documentImages = response.images;
                    console.log('文档中的图片:', documentImages);
                    
                    // 显示图片列表
                    displayDocumentImages(documentImages);
                    
                    // 启用开始上色按钮
                    $('#start-colorize-btn').prop('disabled', false);
                    
                    // 隐藏重试按钮，确保状态正确
                    $('#colorize-retry-btn').addClass('d-none');
                } else {
                    imagesContainer.html(`
                        <div class="col-12 text-center py-3">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>${response.message || '未找到可上色的图片'}
                            </div>
                            <button id="colorize-retry-btn" class="btn btn-outline-primary mt-3">
                                <i class="fas fa-redo me-2"></i>重试
                            </button>
                        </div>
                    `);
                }
            },
            error: function(xhr) {
                console.error('获取图片错误:', xhr.responseText);
                imagesContainer.html(`
                    <div class="col-12 text-center py-3">
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle me-2"></i>获取图片失败: ${xhr.status} ${xhr.statusText}
                        </div>
                        <p class="mt-2">${xhr.responseText || '服务器连接失败'}</p>
                        <button id="colorize-retry-btn" class="btn btn-outline-primary mt-3">
                            <i class="fas fa-redo me-2"></i>重试
                        </button>
                    </div>
                `);
            }
        });
    }
    
    // 显示文档中的图片列表
    function displayDocumentImages(images) {
        const imagesContainer = $('#images-container');
        
        if (images.length === 0) {
            imagesContainer.html(`
                <div class="col-12 text-center py-3">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>文档中没有找到图片
                    </div>
                </div>
            `);
            return;
        }
        
        let html = `
            <div class="col-12 mb-3">
                <div class="alert alert-info" role="alert">
                    <i class="fas fa-info-circle me-2"></i>已找到 ${images.length} 张图片，点击图片或选择框可选择/取消选择
                </div>
            </div>
            <div class="col-12 mb-3">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="select-all-images">
                    <label class="form-check-label" for="select-all-images">
                        全选/取消全选
                    </label>
                </div>
            </div>
        `;
        
        // 分批显示图片，避免加载过多
        images.forEach((image, index) => {
            html += `
                <div class="col-md-4 col-sm-6">
                    <div class="card h-100">
                        <div class="card-img-top image-preview-container" style="cursor: pointer;" title="点击选择/取消选择">
                            <img src="${image.src}" class="img-fluid" alt="${image.name}">
                        </div>
                        <div class="card-body">
                            <div class="form-check mb-2">
                                <input class="form-check-input image-item-checkbox" type="checkbox" value="${image.path}" id="img-check-${index}" data-index="${index}">
                                <label class="form-check-label" for="img-check-${index}">
                                    选择上色
                                </label>
                            </div>
                            <h6 class="card-title text-truncate" title="${image.name}">${image.name}</h6>
                            <p class="card-text small">
                                <span class="badge bg-secondary">${image.type.toUpperCase()}</span>
                                <span class="text-muted">${formatFileSize(image.size)}</span>
                            </p>
                        </div>
                    </div>
                </div>
            `;
        });
        
        imagesContainer.html(html);
    }
    
    // 格式化文件大小
    function formatFileSize(size) {
        if (size < 1024) {
            return size + ' B';
        } else if (size < 1024 * 1024) {
            return (size / 1024).toFixed(2) + ' KB';
        } else {
            return (size / (1024 * 1024)).toFixed(2) + ' MB';
        }
    }
    
    // 更新已选择的图片数量
    function updateSelectedImagesCount() {
        const selectedCount = $('.image-item-checkbox:checked').length;
        $('.selected-count').text(`(${selectedCount})`);
        $('#start-colorize-btn').prop('disabled', selectedCount === 0);
        
        // 根据数量更新提示信息
        if (selectedCount > 20) {
            $('#colorize-warning').remove();
            $('.modal-body').prepend(`
                <div id="colorize-warning" class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>一次最多处理20张图片，请减少选择
                </div>
            `);
            $('#start-colorize-btn').prop('disabled', true);
        } else {
            $('#colorize-warning').remove();
        }
    }
    
    // 获取选中的图片
    function getSelectedImages() {
        const selectedImages = [];
        $('.image-item-checkbox:checked').each(function() {
            const imagePath = $(this).val();
            const imageIndex = $(this).data('index');
            if (imagePath && documentImages[imageIndex]) {
                selectedImages.push(documentImages[imageIndex]);
            }
        });
        return selectedImages;
    }
    
    // 开始图片上色处理
    function startImageColorization(selectedImages) {
        // 关闭选择图片的模态框
        const colorizeModal = bootstrap.Modal.getInstance(document.getElementById('colorizeImagesModal'));
        colorizeModal.hide();
        
        // 显示上色进度模态框
        const progressModal = new bootstrap.Modal(document.getElementById('colorizeProgressModal'));
        progressModal.show();
        
        // 收集图片路径
        const imagePaths = selectedImages.map(img => img.path);
        
        // 更新进度状态
        $('#colorize-status').text(`正在处理 ${imagePaths.length} 张图片，请稍候...`);
        $('#colorize-progress-bar').css('width', '30%');
        
        // 发送上色请求
        $.ajax({
            url: '/api/image/colorize',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ imagePaths }),
            success: function(response) {
                if (response.success && response.results) {
                    // 更新进度状态
                    $('#colorize-status').text(response.message || '图片上色成功，正在应用到文档...');
                    $('#colorize-progress-bar').css('width', '70%');
                    
                    // 将上色后的图片应用到文档
                    applyColorizedImages(response.results);
                } else {
                    // 隐藏进度模态框
                    progressModal.hide();
                    
                    showMessage(response.message || '图片上色失败: 未知错误', 'error');
                    
                    // 重新启用上色按钮
                    $('#start-colorize-btn').prop('disabled', false);
                }
            },
            error: function(xhr) {
                // 隐藏进度模态框
                progressModal.hide();
                
                const errorMsg = xhr.responseJSON?.message || '服务器错误';
                showMessage('图片上色请求失败: ' + errorMsg, 'error');
                
                // 重新启用上色按钮
                $('#start-colorize-btn').prop('disabled', false);
            }
        });
    }
    
    // 将上色后的图片应用到文档
    function applyColorizedImages(colorizeResults) {
        const filePath = typeof currentProcessedFile === 'object' ? currentProcessedFile.path : currentProcessedFile;
        
        if (!filePath) {
            const progressModal = bootstrap.Modal.getInstance(document.getElementById('colorizeProgressModal'));
            progressModal.hide();
            showMessage('无法获取文档路径，请重新上传文档', 'error');
            return;
        }
        
        // 处理文件路径，保持与loadDocumentImages函数一致
        let requestPath = filePath;
        
        // 如果是绝对路径，则尝试提取相对于服务器的路径
        if (filePath.includes('colorful-docs')) {
            try {
                // 尝试提取"colorful-docs"之后的部分作为相对路径
                const relativePath = filePath.split('colorful-docs')[1];
                if (relativePath) {
                    requestPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
                    console.log('替换图片时使用相对路径:', requestPath);
                }
            } catch (error) {
                console.error('路径转换失败，使用原始路径:', error);
            }
        }
        
        console.log('应用上色图片，文件路径:', requestPath);
        
        $.ajax({
            url: '/api/document/apply-colorized-images',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                filePath: requestPath,
                imageResults: colorizeResults
            }),
            success: function(response) {
                // 隐藏进度模态框
                const progressModal = bootstrap.Modal.getInstance(document.getElementById('colorizeProgressModal'));
                progressModal.hide();
                
                if (response.success) {
                    $('#colorize-progress-bar').css('width', '100%');
                    
                    if (response.replacedCount > 0) {
                        showMessage(`图片上色成功! ${response.replacedCount}张图片已应用到文档`, 'success');
                        
                        // 保存上色图片信息到当前处理文件
                        if (currentProcessedFile) {
                            // 合并新上色的图片和已有的上色图片
                            currentProcessedFile.colorizedImages = currentProcessedFile.colorizedImages || [];
                            currentProcessedFile.colorizedImages = currentProcessedFile.colorizedImages.concat(colorizeResults);
                            
                            // 更新最后一个美化结果的colorizedImages
                            if (beautificationResults.length > 0) {
                                const lastResultIndex = beautificationResults.length - 1;
                                beautificationResults[lastResultIndex].colorizedImages = currentProcessedFile.colorizedImages;
                            }
                            
                            console.log('更新上色图片记录，当前共有', currentProcessedFile.colorizedImages.length, '张上色图片');
                        }
                        
                        // 刷新预览（如果当前有预览）
                        if ($('#preview-iframe').length > 0) {
                            const iframe = document.getElementById('preview-iframe');
                            iframe.src = iframe.src; // 重新加载iframe以显示更新后的内容
                        }
                        
                        // 刷新结果显示
                        $('.beautified-content').each(function() {
                            if (this.contentWindow) {
                                this.src = this.src;
                            }
                        });
                    } else {
                        showMessage('图片上色过程完成，但没有可应用的图片', 'warning');
                    }
                } else {
                    showMessage('应用上色图片到文档失败: ' + (response.message || '未知错误'), 'error');
                }
                
                // 重新启用上色按钮
                $('#start-colorize-btn').prop('disabled', false);
            },
            error: function(xhr) {
                // 隐藏进度模态框
                const progressModal = bootstrap.Modal.getInstance(document.getElementById('colorizeProgressModal'));
                progressModal.hide();
                
                const errorMsg = xhr.responseJSON?.message || '服务器错误';
                console.error('应用上色图片请求失败:', errorMsg);
                console.error('状态码:', xhr.status);
                console.error('请求路径:', requestPath);
                
                showMessage('应用上色图片请求失败: ' + errorMsg, 'error');
                
                // 重新启用上色按钮
                $('#start-colorize-btn').prop('disabled', false);
            }
        });
    }

    // 在文档上传后（正确位置）启用图片上色按钮
    function updateUiAfterFileUpload(filePath, fileType) {
        // ... 保留现有代码 ...
        
        // 启用美化按钮和图片上色按钮
        $('#beautify-btn').prop('disabled', false);
        $('#colorize-images-btn').prop('disabled', false);
        
        // ... 保留现有代码 ...
    }

    /**
     * 显示任务进度弹窗
     */
    function showTaskProgressModal() {
        // 创建弹窗HTML
        if (!document.getElementById('taskProgressModal')) {
            const modalHtml = `
            <div class="modal fade" id="taskProgressModal" tabindex="-1" aria-labelledby="taskProgressModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="taskProgressModalLabel">文档美化处理中</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭"></button>
                        </div>
                        <div class="modal-body">
                            <div class="task-info">
                                <p id="taskStatusText">正在处理您的文档，请稍候...</p>
                                <div class="progress">
                                    <div id="taskProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
                                </div>
                                <p id="taskTimeInfo" class="text-muted mt-2">预计剩余时间: 计算中...</p>
                            </div>
                            <div id="taskCompleteInfo" class="d-none">
                                <div class="text-center mb-3">
                                    <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
                                    <h4 class="mt-2">处理完成!</h4>
                                </div>
                                <p>您的文档已美化完成，可以下载或查看预览。</p>
                            </div>
                            <div id="taskErrorInfo" class="d-none">
                                <div class="text-center mb-3">
                                    <i class="bi bi-x-circle-fill text-danger" style="font-size: 3rem;"></i>
                                    <h4 class="mt-2">处理失败</h4>
                                </div>
                                <p id="taskErrorText">处理文档时发生错误，请重试。</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                            <button type="button" id="viewPreviewBtn" class="btn btn-primary d-none">查看预览</button>
                            <button type="button" id="downloadResultBtn" class="btn btn-success d-none">下载文档</button>
                        </div>
                    </div>
                </div>
            </div>`;
            
            // 添加到body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        
        // 重置弹窗状态
        $('#taskStatusText').text('正在处理您的文档，请稍候...');
        $('#taskProgressBar').css('width', '0%');
        $('#taskTimeInfo').text('预计剩余时间: 计算中...');
        $('#taskCompleteInfo').addClass('d-none');
        $('#taskErrorInfo').addClass('d-none');
        $('#viewPreviewBtn').addClass('d-none');
        $('#downloadResultBtn').addClass('d-none');
        
        // 显示弹窗
        const modal = new bootstrap.Modal(document.getElementById('taskProgressModal'));
        modal.show();
    }

    // 当前任务ID
    let currentTaskId = null;
    // 任务状态定时器
    let taskCheckTimer = null;

    /**
     * 开始轮询任务状态
     * @param {string} taskId - 任务ID
     */
    function startTaskStatusPolling(taskId) {
        currentTaskId = taskId;
        
        // 清除已有定时器
        if (taskCheckTimer) {
            clearInterval(taskCheckTimer);
        }
        
        // 设置轮询间隔
        const pollingInterval = 3000; // 3秒
        let pollingCount = 0;
        
        // 开始轮询
        taskCheckTimer = setInterval(() => {
            pollingCount++;
            checkTaskStatus(taskId, pollingCount);
        }, pollingInterval);
        
        // 立即检查一次
        checkTaskStatus(taskId, 0);
    }

    /**
     * 检查任务状态
     * @param {string} taskId - 任务ID
     * @param {number} count - 轮询次数
     */
    function checkTaskStatus(taskId, count) {
        fetch(`/check-task/${taskId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器返回错误状态码: ${response.status}`);
            }
            return response.json();
        })
        .then(response => {
            if (response.success) {
                updateTaskProgress(response, count);
                
                // 如果任务完成或失败，停止轮询
                if (response.status === 'completed' || response.status === 'failed') {
                    if (taskCheckTimer) {
                        clearInterval(taskCheckTimer);
                        taskCheckTimer = null;
                    }
                }
            } else {
                // 显示错误
                showTaskError(response.error || '获取任务状态失败');
                
                // 停止轮询
                if (taskCheckTimer) {
                    clearInterval(taskCheckTimer);
                    taskCheckTimer = null;
                }
            }
        })
        .catch(error => {
            // 请求错误
            console.error('检查任务状态出错:', error);
            
            // 如果连续多次失败，停止轮询
            if (count > 5) {
                showTaskError('无法连接到服务器，请检查网络连接');
                if (taskCheckTimer) {
                    clearInterval(taskCheckTimer);
                    taskCheckTimer = null;
                }
            }
        });
    }

    /**
     * 更新任务进度
     * @param {Object} taskData - 任务数据
     * @param {number} count - 轮询次数
     */
    function updateTaskProgress(taskData, count) {
        const status = taskData.status;
        const progress = taskData.progress || 0;
        
        // 更新进度条
        $('#taskProgressBar').css('width', `${progress}%`);
        
        // 更新状态文本
        switch (status) {
            case 'pending':
                $('#taskStatusText').text('任务等待中，即将开始处理...');
                $('#taskTimeInfo').text('排队等待中...');
                break;
                
            case 'processing':
                $('#taskStatusText').text('正在处理您的文档...');
                
                // 计算剩余时间
                const remainingTime = Math.max(5, Math.round((100 - progress) / 5)); // 粗略估计，每5%进度约1秒
                $('#taskTimeInfo').text(`预计剩余时间: 约${remainingTime}秒`);
                break;
                
            case 'completed':
                // 显示完成状态
                $('#taskCompleteInfo').removeClass('d-none');
                $('.task-info').addClass('d-none');
                
                // 显示预览和下载按钮
                $('#viewPreviewBtn').removeClass('d-none');
                $('#downloadResultBtn').removeClass('d-none');
                
                // 保存处理结果
                if (taskData.result) {
                    // 更新当前处理后的文件
                    currentProcessedFile = {
                        path: taskData.result.path,
                        html: taskData.result.html,
                        filename: taskData.result.outputFileName,
                        type: taskData.result.type,
                        originalname: taskData.result.originalname,
                        prompt: taskData.result.prompt || ''
                    };
                    
                    // 将新结果添加到数组
                    beautificationResults.push({
                        html: taskData.result.html,
                        path: taskData.result.path,
                        prompt: taskData.result.prompt || '',
                        targetFormat: taskData.result.type || 'word'
                    });
                    
                    // 设置下载按钮点击事件
                    $('#downloadResultBtn').off('click').on('click', function() {
                        // 关闭弹窗
                        $('#taskProgressModal').modal('hide');
                        
                        // 显示主下载按钮
                        $('#download-btn').removeClass('d-none');
                        
                        // 请求下载
                        requestDownload(taskData.result.outputFileName, taskData.result.type);
                    });
                    
                    // 设置预览按钮点击事件
                    $('#viewPreviewBtn').off('click').on('click', function() {
                        // 关闭弹窗
                        $('#taskProgressModal').modal('hide');
                        
                        // 显示预览
                        displayBeautificationResults();
                    });
                }
                
                // 重新启用美化按钮，允许再次美化
                $('#beautify-btn').prop('disabled', false);
                $('#colorize-images-btn').prop('disabled', false);
                break;
                
            case 'failed':
                // 显示错误状态
                showTaskError(taskData.error || '处理失败，请重试');
                
                // 重新启用美化按钮，允许再次美化
                $('#beautify-btn').prop('disabled', false);
                $('#colorize-images-btn').prop('disabled', false);
                break;
                
            default:
                // 未知状态
                $('#taskStatusText').text(`任务状态: ${status}`);
                break;
        }
    }

    /**
     * 显示任务错误
     * @param {string} errorMessage - 错误信息
     */
    function showTaskError(errorMessage) {
        $('#taskErrorInfo').removeClass('d-none');
        $('#taskErrorText').text(errorMessage);
        $('.task-info').addClass('d-none');
        
        // 重新启用美化按钮
        $('#beautify-btn').prop('disabled', false);
    }

    // 检查任务状态
    function checkTaskStatus(taskId) {
      if (!taskId) return;
      
      // 添加递增延迟，防止过于频繁的请求
      let attempts = 0;
      let maxAttempts = 30; // 最大尝试次数
      
      // 清除之前的检查间隔
      if (window.taskCheckInterval) {
        clearInterval(window.taskCheckInterval);
        window.taskCheckInterval = null;
      }
      
      // 设置超时定时器 - 2分钟后自动失败
      const taskTimeout = setTimeout(function() {
        console.log('任务处理超过2分钟，自动标记为失败');
        hideLoading();
        showMessage('任务处理超时，请稍后重试', 'danger');
        
        // 如果任务进度弹窗存在，更新为失败状态
        if ($('#taskProgressModal').length > 0) {
          $('#taskErrorInfo').removeClass('d-none');
          $('#taskErrorText').text('任务处理超时，服务器可能繁忙');
          $('.task-info').addClass('d-none');
        }
      }, 120000); // 2分钟 = 120秒 = 120000毫秒
      
      function doCheck() {
        // 检查页面是否还在活跃状态
        if (document.hidden) {
          console.log('页面不可见，暂停检查');
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.log('达到最大检查次数，停止检查');
          clearTimeout(taskTimeout); // 清除超时定时器
          showMessage('任务检查超时，请刷新页面或再次尝试', 'warning');
          hideLoading(); // 确保隐藏加载框
          return;
        }
        
        console.log(`检查任务状态: ${taskId}，第${attempts+1}次尝试`);
        
        $.ajax({
          url: `/api/check-task?taskId=${taskId}`, // Vercel API路径
          type: 'GET',
          timeout: 10000, // 添加超时设置
          cache: false, // 禁用缓存
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          success: function(response) {
            console.log('收到任务状态响应:', response);
            
            if (response.success) {
              updateTaskProgressUI(response);
              
              if (response.status === 'completed') {
                clearTimeout(taskTimeout); // 清除超时定时器
                handleTaskComplete(response);
                return; // 完成，停止检查
              } else if (response.status === 'failed') {
                clearTimeout(taskTimeout); // 清除超时定时器
                handleTaskFailure(response);
                return; // 失败，停止检查
              } else {
                // 任务仍在处理中，使用递增延迟
                attempts++;
                const delay = Math.min(2000 + (attempts * 1000), 10000); // 2-10秒递增延迟
                setTimeout(doCheck, delay);
              }
            } else {
              showMessage(response.error || '检查任务状态失败', 'warning');
              hideLoading(); // 确保隐藏加载框
              // 即使出错也继续尝试检查
              attempts++;
              setTimeout(doCheck, 5000);
            }
          },
          error: function(xhr, status, error) {
            console.error('检查任务状态请求失败:', error);
            
            // 如果是网络错误，使用更长延迟重试
            attempts++;
            setTimeout(doCheck, 5000);
          }
        });
      }
      
      // 启动第一次检查
      doCheck();
      
      // 当页面变为可见时恢复检查
      document.addEventListener('visibilitychange', function() {
        if (!document.hidden && attempts < maxAttempts) {
          doCheck();
        }
      });
      
      // 当用户离开页面时清理轮询和超时
      window.addEventListener('beforeunload', function() {
        clearTimeout(taskTimeout);
        if (window.taskCheckInterval) {
          clearInterval(window.taskCheckInterval);
        }
      });
    }

    // 处理任务完成
    function handleTaskComplete(response) {
      console.log('任务完成:', response);
      hideLoading();
      
      // 保存结果信息到会话存储
      if (response.result && response.result.path) {
        const resultData = {
          path: response.result.path,
          outputFileName: response.result.outputFileName,
          type: response.result.type || 'word'
        };
        sessionStorage.setItem('beautifyResult', JSON.stringify(resultData));
        
        // 加载和显示美化结果
        loadBeautifiedResult(response.result.path);
      }
    }

    // 处理任务失败
    function handleTaskFailure(response) {
      console.error('任务失败:', response);
      hideLoading();
      showMessage(response.error || '美化任务失败，请重试', 'danger');
    }

    // 更新任务进度UI
    function updateTaskProgressUI(response) {
      // 如果存在进度条元素，则更新进度
      const progressBar = $('#task-progress-bar');
      if (progressBar.length > 0) {
        const progress = response.progress || 0;
        progressBar.css('width', progress + '%').attr('aria-valuenow', progress);
        $('#task-progress-text').text(progress + '%');
        
        // 更新状态文本
        let statusText = '处理中...';
        if (response.status === 'completed') {
          statusText = '已完成';
        } else if (response.status === 'failed') {
          statusText = '失败';
        } else if (response.status === 'pending') {
          statusText = '等待中...';
        }
        $('#task-status-text').text(statusText);
      }
    }

    // 加载美化结果
    function loadBeautifiedResult(resultPath) {
      console.log('加载美化结果:', resultPath);
      
      // 显示结果区域
      $('#result-section').removeClass('d-none');
      
      // 隐藏预览区域
      $('#document-preview').addClass('d-none');
      
      // 加载结果内容
      $('#result-content').html('<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">正在加载结果...</p></div>');
      
      // 解析路径 - 处理完整URL和相对路径
      let loadPath = resultPath;
      if (resultPath.startsWith('http')) {
        // 这是完整URL，直接使用
        $.ajax({
          url: loadPath,
          type: 'GET',
          success: function(html) {
            $('#result-content').html(html);
            addEntryAnimation('#result-section');
          },
          error: function(xhr, status, error) {
            console.error('加载结果失败:', error);
            $('#result-content').html('<div class="alert alert-danger">加载美化结果失败，请尝试刷新页面。</div>');
          }
        });
      } else {
        // 相对路径，使用预览接口
        const fileName = resultPath.split(/[\/\\]/).pop();
        $.ajax({
          url: '/preview/' + encodeURIComponent(fileName),
          type: 'GET',
          success: function(html) {
            $('#result-content').html(html);
            addEntryAnimation('#result-section');
          },
          error: function(xhr, status, error) {
            console.error('加载结果失败:', error);
            $('#result-content').html('<div class="alert alert-danger">加载美化结果失败，请尝试刷新页面。</div>');
          }
        });
      }
    }

    // 将checkTaskStatus函数附加到window对象，以便在index.html中调用
    window.checkTaskStatus = checkTaskStatus;
});