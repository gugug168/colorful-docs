$(document).ready(function() {
    // 当前处理的文件信息
    let currentProcessedFile = null;
    let currentUploadedFile = null;
    
    // 初始化上传区域交互效果
    initUploadZone();
    
    // 初始化预览区域折叠功能
    initTogglePreview();
    
    // 绑定上传按钮的点击事件
    $('#uploadBtn').on('click', function() {
        // 触发表单提交
        $('#upload-form').submit();
    });
    
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
    
    // 绑定美化按钮的点击事件
    $('#beautify-btn').on('click', function() {
        // 添加点击效果
        const btn = $(this);
        btn.addClass('pulse-animation');
        setTimeout(() => {
            btn.removeClass('pulse-animation');
        }, 500);
        
        // 禁用美化按钮，防止重复点击
        $(this).prop('disabled', true);
        
        // 获取文件路径
        const filePath = $(this).attr('data-filepath');
        const filename = $(this).attr('data-filename');
        
        console.log('美化按钮点击，文件路径:', filePath, '文件名:', filename);
        
        // 验证文件信息
        if (!filePath || !filename) {
            console.error('美化按钮缺少有效的文件信息');
            
            // 尝试从会话存储获取
            const storedFileJson = sessionStorage.getItem('currentFile');
            if (storedFileJson) {
                try {
                    const storedFile = JSON.parse(storedFileJson);
                    if (storedFile.path && storedFile.filename) {
                        console.log('从会话存储恢复文件信息:', storedFile);
                        processBeautification(storedFile.path, storedFile.filename);
                        return;
                    }
                } catch (e) {
                    console.error('解析会话存储文件信息失败:', e);
                }
            }
            
            // 如果还是失败，尝试从全局变量获取
            if (window.currentFilePath && window.currentFileName) {
                console.log('从全局变量恢复文件信息');
                processBeautification(window.currentFilePath, window.currentFileName);
                return;
            }
            
            // 所有尝试都失败
            showMessage('无法获取文件信息，请重新上传文档', 'danger');
            $(this).prop('disabled', false);
            return;
        }
        
        // 处理美化
        processBeautification(filePath, filename);
    });
    
    // 处理美化请求
    function processBeautification(filePath, filename) {
        // 显示加载状态
        showLoading('正在进行文档美化，这可能需要一些时间...');
        
        // 获取当前HTML内容
        const htmlContent = $('#preview-content').html();
        
        // 获取目标格式
        const targetFormat = sessionStorage.getItem('targetFormat') || 
                           $('input[name="targetFormat"]:checked').val() || 
                           'word';
        
        // 获取API密钥
        let apiKey = $('#deepseek-api-key').val() || '';
        if (apiKey && !apiKey.startsWith('sk-')) {
            apiKey = 'sk-' + apiKey;
        }
        
        // 准备请求数据
        const requestData = {
            filename: filename,
            targetFormat: targetFormat,
            apiKey: apiKey
        };
        
        // 如果有HTML内容，添加到请求
        if (htmlContent && htmlContent.trim().length > 0) {
            requestData.htmlContent = htmlContent;
        }
        
        console.log('发送美化请求:', {
            filename,
            targetFormat,
            hasApiKey: !!apiKey,
            hasHtmlContent: !!htmlContent
        });
        
        // 发送请求到服务器
        $.ajax({
            url: '/beautify',
            type: 'POST',
            data: JSON.stringify(requestData),
            contentType: 'application/json',
            success: function(response) {
                hideLoading();
                console.log('美化成功，服务器响应:', response);
                
                if (response.success) {
                    // 显示美化成功消息
                    showMessage('文档美化成功！', 'success');
                    
                    // 保存处理后的文件信息
                    currentProcessedFile = response.processedFile;
                    
                    // 保存信息到会话存储
                    sessionStorage.setItem('processedFile', JSON.stringify(currentProcessedFile));
                    
                    // 加载美化后的预览
                    if (currentProcessedFile && currentProcessedFile.path) {
                        loadBeautifiedPreview(currentProcessedFile.path);
                    } else if (response.html) {
                        // 如果响应中直接包含HTML，显示它
                        // 确保文档预览区域不被隐藏
                        // $('#document-preview').addClass('d-none'); // 删除这行，保留文档预览
                        $('#result-section').removeClass('d-none');
                        $('#beautified-content').html(response.html);
                        
                        // 添加漂亮的加载动画
                        addEntryAnimation('#result-section');
                        
                        // 滚动到结果区域
                        $('html, body').animate({
                            scrollTop: $('#result-section').offset().top - 50
                        }, 500);
                        
                        // 显示下载按钮
                        $('#download-btn').removeClass('d-none');
                    }
                } else {
                    // 美化失败
                    $('#beautify-btn').prop('disabled', false);
                    showMessage(response.message || '文档美化失败', 'danger');
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                $('#beautify-btn').prop('disabled', false);
                showMessage('美化出错: ' + (xhr.responseJSON?.message || error), 'danger');
            }
        });
    }
    
    // 加载美化后的预览
    function loadBeautifiedPreview(filePath) {
        console.log('加载美化后预览，文件路径:', filePath);
        
        // 获取文件名
        const filename = filePath.split(/[\/\\]/).pop();
        
        if (!filename) {
            console.error('无法从路径中提取文件名');
            showMessage('无法加载美化后的预览：文件名无效', 'danger');
            $('#beautify-btn').prop('disabled', false);
            return;
        }
        
        // 显示加载中状态
        $('#beautified-content').html('<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">正在加载美化后的结果...</p></div>');
        
        // 显示结果区域，但不隐藏文档预览区域
        // $('#document-preview').addClass('d-none'); // 删除这行，保留文档预览
        $('#result-section').removeClass('d-none');
        
        // 添加漂亮的加载动画
        addEntryAnimation('#result-section');
        
        // 确保结果区域处于展开状态
        $('.result-content-wrapper').removeClass('collapsed');
        $('.toggle-result .toggle-icon i').removeClass('fa-chevron-down').addClass('fa-chevron-up');
        $('.toggle-result .toggle-icon').removeClass('collapsed');
        
        // 设置下载按钮链接
        $('#download-btn').attr('data-filepath', filePath).removeClass('d-none');
        
        // 获取美化后的预览
        $.ajax({
            url: '/preview/' + encodeURIComponent(filename),
            type: 'GET',
            success: function(html) {
                // 在预览区域显示内容
                $('#beautified-content').html(html);
                
                // 启用美化按钮，允许重新美化
                $('#beautify-btn').prop('disabled', false);
                
                // 滚动到结果区域
                $('html, body').animate({
                    scrollTop: $('#result-section').offset().top - 50
                }, 500);
            },
            error: function(xhr, status, error) {
                console.error('加载美化后预览出错:', error);
                $('#beautified-content').html('<div class="alert alert-danger">加载预览失败: ' + error + '</div>');
                $('#beautify-btn').prop('disabled', false);
            }
        });
    }
    
    // 绑定下载按钮的点击事件
    $('#download-btn').on('click', function() {
        // 添加点击效果
        const btn = $(this);
        btn.addClass('pulse-animation');
        setTimeout(() => {
            btn.removeClass('pulse-animation');
        }, 500);
        
        // 获取文件路径
        const filePath = $(this).attr('data-filepath');
        
        if (!filePath) {
            // 尝试从会话存储获取
            const processedFileJson = sessionStorage.getItem('processedFile');
            if (processedFileJson) {
                try {
                    const processedFile = JSON.parse(processedFileJson);
                    if (processedFile.path) {
                        window.location.href = '/download?path=' + encodeURIComponent(processedFile.path);
                        return;
                    }
                } catch (e) {
                    console.error('解析会话存储处理文件信息失败:', e);
                }
            }
            
            showMessage('无法找到要下载的文件', 'danger');
            return;
        }
        
        // 执行下载
        window.location.href = '/download?path=' + encodeURIComponent(filePath);
    });
    
    // 显示消息
    function showMessage(message, type) {
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
        }, 5000);
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
    
    // 向CSS添加按钮脉冲动画
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
    `;
    document.head.appendChild(style);
});