$(document).ready(function() {
    // 当前处理的文件信息
    let currentProcessedFile = null;
    let currentUploadedFile = null;
    
    // 绑定上传按钮的点击事件
    $('#uploadBtn').on('click', function() {
        // 触发表单提交
        $('#upload-form').submit();
    });
    
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
            alert('请选择文件');
            return;
        }
        
        const file = fileInput.files[0];
        const fileType = file.name.split('.').pop().toLowerCase();
        
        if (fileType !== 'docx' && fileType !== 'pdf') {
            alert('只支持Word文档(.docx)和PDF文件');
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
                    
                    // 直接使用返回的HTML显示预览
                    if (currentUploadedFile && currentUploadedFile.html) {
                        // 显示预览区域
                        $('#document-preview').removeClass('d-none');
                        
                        // 隐藏美化结果区域
                        $('#result-section').addClass('d-none');
                        
                        // 在预览区域显示内容
                        $('#preview-content').html(currentUploadedFile.html);
                        
                        // 滚动到预览区域
                        $('html, body').animate({
                            scrollTop: $('#document-preview').offset().top - 50
                        }, 500);
                        
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
        
        // 隐藏美化结果区域
        $('#result-section').addClass('d-none');
        
        // 滚动到预览区域
        $('html, body').animate({
            scrollTop: $('#document-preview').offset().top - 50
        }, 500);
        
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
    
    // 美化按钮点击处理
    $('#beautify-btn').on('click', function() {
        console.log('美化按钮被点击');
        
        // 尝试从全局变量获取（最可靠）
        if (window.currentFilePath && window.currentFileName) {
            console.log('从全局变量获取文件信息:', {
                path: window.currentFilePath,
                name: window.currentFileName
            });
            processBeautification(window.currentFilePath, window.currentFileName);
            return;
        }
        
        // 尝试从HTML属性获取
        const buttonFilePath = $(this).attr('data-filepath');
        const buttonFileName = $(this).attr('data-filename');
        
        console.log('从HTML属性获取美化按钮文件信息:', {
            path: buttonFilePath, 
            name: buttonFileName,
            hasAttributes: $(this).attr('data-filepath') !== undefined
        });
        
        // 如果按钮上有文件信息，直接使用
        if (buttonFilePath && buttonFileName) {
            processBeautification(buttonFilePath, buttonFileName);
            return;
        }
        
        // 检查会话存储中的准备标志
        const documentReady = sessionStorage.getItem('documentReady') === 'true';
        console.log('会话中的文档准备状态:', documentReady);
        
        // 如果文档已准备好，尝试从会话存储获取文件信息
        if (documentReady) {
            // 尝试从会话存储获取
            const currentFile = JSON.parse(sessionStorage.getItem('currentFile') || '{}');
            const uploadedFile = JSON.parse(sessionStorage.getItem('uploadedFile') || '{}');
            
            // 使用任一有效的文件信息
            const filePath = 
                (currentFile && currentFile.path) ? currentFile.path : 
                (uploadedFile && uploadedFile.path) ? uploadedFile.path : null;
                
            if (filePath) {
                const filename = filePath.split(/[\/\\]/).pop();
                console.log('从会话存储获取文件信息:', { path: filePath, name: filename });
                processBeautification(filePath, filename);
                return;
            }
        }
        
        // 所有尝试都失败，才显示上传文档提示
        console.log('无法获取文件信息，提示上传文档');
        showMessage('请先上传文件', 'warning');
    });
    
    // 提取美化处理逻辑到单独的函数
    function processBeautification(filePath, filename) {
        // 如果没有提供有效的文件路径或文件名，尝试从会话中恢复
        if (!filePath || !filename) {
            const currentFile = JSON.parse(sessionStorage.getItem('currentFile') || '{}');
            
            // 尝试使用会话中的信息
            if (currentFile) {
                filePath = filePath || currentFile.path || null;
                filename = filename || currentFile.filename || null;
            }
            
            // 仍然无法获取有效信息，则提示错误并返回
            if (!filePath || !filename) {
                console.error('无法获取有效的文件信息进行美化');
                showMessage('无法获取文件信息，请重新上传文档', 'danger');
                return;
            }
        }
        
        const targetFormat = sessionStorage.getItem('targetFormat') || 'word';
        
        // 获取API密钥
        const apiKeyInput = $('#deepseek-api-key').val() || '';
        // 确保API密钥格式正确，加上前缀sk-
        const apiKey = apiKeyInput.startsWith('sk-') ? apiKeyInput : `sk-${apiKeyInput}`;

        if (apiKey && apiKey.length > 10) {
            console.log(`使用API密钥: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length-5)}`);
            sessionStorage.setItem('deepseekApiKey', apiKey);
        } else {
            console.warn('未提供有效的API密钥，这可能导致高级美化功能不可用');
        }
        
        // 处理文件名 - 去除可能的路径前缀，确保只发送文件名部分
        let cleanFilename = filename;
        if (cleanFilename.includes('/')) {
            cleanFilename = cleanFilename.split('/').pop();
        }
        if (cleanFilename.includes('\\')) {
            cleanFilename = cleanFilename.split('\\').pop();
        }
        
        // 获取HTML内容 - 优先使用会话存储中的内容
        const uploadedFile = JSON.parse(sessionStorage.getItem('uploadedFile') || '{}');
        const currentFile = JSON.parse(sessionStorage.getItem('currentFile') || '{}');
        
        // 尝试获取HTML内容
        const htmlContent = 
            (uploadedFile && uploadedFile.html) ? uploadedFile.html : 
            (currentFile && currentFile.html) ? currentFile.html : null;
        
        if (!htmlContent) {
            console.log('未找到HTML内容，将尝试通过文件名请求美化');
        } else {
            console.log('找到HTML内容，将直接发送HTML进行美化');
        }
        
        // 显示正在处理的文件信息
        console.log('发送给服务器的信息:', {
            filename: cleanFilename,
            hasHtmlContent: !!htmlContent,
            hasApiKey: !!apiKey
        });
        showLoading('正在美化文档...');
        
        // 发送美化请求
        $.ajax({
            url: '/beautify',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                filename: cleanFilename,
                targetFormat: targetFormat,
                htmlContent: htmlContent, // 直接发送HTML内容
                apiKey: apiKey // 添加API密钥
            }),
            success: function(response) {
                hideLoading();
                console.log('美化成功，服务器响应:', response);
                
                if (response.success) {
                    showMessage('文档美化成功！', 'success');
                    // 保存当前处理的文件信息
                    currentProcessedFile = response.processedFile;
                    
                    // 保存到会话存储
                    sessionStorage.setItem('processedFile', JSON.stringify(response.processedFile));
                    
                    // 确保处理后的文件有路径信息
                    if (response.processedFile && response.processedFile.path) {
                        // 加载美化后的预览
                        loadBeautifiedPreview(response.processedFile.path);
                    } else if (response.processedFile && response.processedFile.html) {
                        // 如果没有路径但有HTML，直接显示HTML
                        $('#result-section').removeClass('d-none');
                        $('#beautified-content').html(response.processedFile.html);
                        
                        // 滚动到结果区域
                        $('html, body').animate({
                            scrollTop: $('#result-section').offset().top - 50
                        }, 500);
                    } else {
                        showMessage('美化成功，但无法显示预览', 'warning');
                    }
                } else {
                    showMessage(response.message || '美化失败', 'danger');
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                console.error('美化请求失败:', error, xhr.status, xhr.responseText);
                
                let errorMsg = '美化出错';
                try {
                    // 尝试解析错误响应
                    const errorResponse = JSON.parse(xhr.responseText);
                    if (errorResponse && errorResponse.message) {
                        errorMsg += ': ' + errorResponse.message;
                    }
                } catch (e) {
                    errorMsg += ': ' + error;
                }
                
                showMessage(errorMsg, 'danger');
                
                // 如果是"找不到文件"错误，提供更明确的提示和恢复选项
                if (xhr.status === 404 && xhr.responseText.includes('找不到指定的文件')) {
                    // 尝试再次发送，但此次直接从会话存储中提取HTML内容
                    if (htmlContent) {
                        showMessage('找不到指定文件，但我们有HTML内容。正在重试...', 'info');
                        
                        // 等待1秒后重试
                        setTimeout(() => {
                            $.ajax({
                                url: '/beautify',
                                type: 'POST',
                                contentType: 'application/json',
                                data: JSON.stringify({
                                    targetFormat: targetFormat,
                                    htmlContent: htmlContent // 只发送HTML内容，不指定文件名
                                }),
                                success: function(response) {
                                    hideLoading();
                                    if (response.success) {
                                        showMessage('文档美化成功！', 'success');
                                        // 保存当前处理的文件信息
                                        currentProcessedFile = response.processedFile;
                                        
                                        // 保存到会话存储
                                        sessionStorage.setItem('processedFile', JSON.stringify(response.processedFile));
                                        
                                        // 显示美化结果
                                        if (response.processedFile && response.processedFile.html) {
                                            $('#result-section').removeClass('d-none');
                                            $('#beautified-content').html(response.processedFile.html);
                                            
                                            // 滚动到结果区域
                                            $('html, body').animate({
                                                scrollTop: $('#result-section').offset().top - 50
                                            }, 500);
                                        }
                                    } else {
                                        showMessage(response.message || '美化失败', 'danger');
                                    }
                                },
                                error: function() {
                                    hideLoading();
                                    showMessage('所有尝试都失败，请重新上传文档', 'danger');
                                    
                                    // 清除可能过期的文件信息
                                    sessionStorage.removeItem('documentReady');
                                    $('#beautify-btn').removeAttr('data-filepath');
                                    $('#beautify-btn').removeAttr('data-filename');
                                }
                            });
                        }, 1000);
                    } else {
                        showMessage('找不到文件，可能是因为文件路径不正确或文件已被移除。请重新上传文档。', 'warning');
                        
                        // 清除可能过期的文件信息
                        sessionStorage.removeItem('documentReady');
                        $('#beautify-btn').removeAttr('data-filepath');
                        $('#beautify-btn').removeAttr('data-filename');
                    }
                }
            }
        });
    }
    
    // 加载美化后的文档预览
    function loadBeautifiedPreview(filePath) {
        console.log('加载美化后预览，文件路径:', filePath);
        
        // 只获取文件名部分，不包含路径
        const filename = filePath ? filePath.split(/[\/\\]/).pop() : '';
        console.log('美化后预览文件名:', filename);
        
        if (!filename) {
            console.error('无法从路径中提取美化后文件名');
            $('#beautified-content').html('<div class="alert alert-danger">无法加载预览：文件名无效</div>');
            return;
        }
        
        // 显示加载中状态
        $('#beautified-content').html('<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">正在加载预览...</p></div>');
        
        // 显示结果区域
        $('#result-section').removeClass('d-none');
        
        // 滚动到结果区域
        $('html, body').animate({
            scrollTop: $('#result-section').offset().top - 50
        }, 500);
        
        // 获取预览内容
        $.ajax({
            url: '/preview/' + encodeURIComponent(filename),
            type: 'GET',
            success: function(html) {
                console.log('美化后预览请求成功');
                // 在预览区域显示内容
                $('#beautified-content').html(html);
            },
            error: function(xhr, status, error) {
                console.error('美化后预览加载失败:', error, xhr.status, xhr.responseText);
                $('#beautified-content').html('<div class="alert alert-danger">加载预览失败: ' + (xhr.status ? xhr.status + ' ' + error : error) + '</div>');
                
                // 如果预览API失败，尝试直接使用会话存储中的HTML内容
                const processedFile = JSON.parse(sessionStorage.getItem('processedFile') || '{}');
                if (processedFile && processedFile.html) {
                    console.log('使用会话存储中的HTML作为美化后预览');
                    $('#beautified-content').html(processedFile.html);
                }
            }
        });
    }
    
    // 下载按钮处理
    $('#download-btn').on('click', function() {
        // 先尝试从内存中获取
        let fileToDownload = currentProcessedFile;
        
        // 如果内存中没有，则尝试从会话存储获取
        if (!fileToDownload || !fileToDownload.path) {
            fileToDownload = JSON.parse(sessionStorage.getItem('processedFile') || '{}');
        }
        
        const targetFormat = sessionStorage.getItem('targetFormat') || 'word';
        
        console.log('下载按钮被点击，文件信息:', fileToDownload);
        
        if (!fileToDownload || !fileToDownload.path) {
            showMessage('请先完成文档美化', 'warning');
            return;
        }
        
        // 显示加载状态
        showLoading('正在准备下载...');
        
        // 根据目标格式设置文件扩展名
        const format = targetFormat === 'word' ? 'docx' : 'pdf';
        const filename = fileToDownload.path.split(/[\/\\]/).pop();
        
        // 触发下载
        const exportUrl = `/export?htmlFile=${encodeURIComponent(filename)}&format=${format}`;
        console.log('导出URL:', exportUrl);
        
        // 使用AJAX请求获取导出结果
        $.ajax({
            url: exportUrl,
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                hideLoading();
                
                if (response.success && response.downloadUrl) {
                    console.log('导出成功，下载URL:', response.downloadUrl);
                    showMessage('文件已准备好，正在下载...', 'success');
                    
                    // 创建一个临时的a标签并触发点击
                    const downloadLink = document.createElement('a');
                    downloadLink.href = response.downloadUrl;
                    downloadLink.download = response.filename || 'document.' + format;
                    downloadLink.style.display = 'none';
                    document.body.appendChild(downloadLink);
                    
                    // 延迟一点点再触发下载，确保UI更新
                    setTimeout(function() {
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                    }, 500);
                    
                    // 也可以作为备用尝试直接访问下载路由
                    setTimeout(function() {
                        if (confirm('如果下载未自动开始，请点击确定尝试直接下载')) {
                            window.location.href = '/download/' + encodeURIComponent(response.filename);
                        }
                    }, 3000);
                } else {
                    showMessage(response.message || '导出失败，请稍后重试', 'danger');
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                console.error('导出请求失败:', error, xhr.status, xhr.responseText);
                
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    showMessage(errorResponse.message || '导出失败: ' + error, 'danger');
                } catch (e) {
                    showMessage('导出失败: ' + error, 'danger');
                }
            }
        });
    });
    
    // 辅助函数 - 显示消息提示
    function showMessage(message, type) {
        const alertClass = `alert-${type}`;
        const alertHtml = `
            <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        // 清除现有提示并添加新提示
        $('.alert').remove();
        $('.container').prepend(alertHtml);
        
        // 自动消失
        setTimeout(() => {
            $('.alert').alert('close');
        }, 5000);
    }
    
    // 辅助函数 - 显示加载状态
    function showLoading(message) {
        // 如果已存在加载提示则移除
        hideLoading();
        
        const loadingHtml = `
            <div id="loading-indicator" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background-color: rgba(0,0,0,0.5); z-index: 9999;">
                <div class="card p-4 text-center">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mb-0">${message}</p>
                </div>
            </div>
        `;
        
        $('body').append(loadingHtml);
    }
    
    // 辅助函数 - 隐藏加载状态
    function hideLoading() {
        $('#loading-indicator').remove();
    }
});