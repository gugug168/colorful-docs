$(document).ready(function() {
    // 当前处理的文件信息
    let currentProcessedFile = null;
    let currentUploadedFile = null;
    
    // 表单提交处理 - 仅上传文件
    $('#upload-form').on('submit', function(e) {
        e.preventDefault();
        
        // 获取表单数据
        const formData = new FormData(this);
        const fileInput = $('#document')[0];
        
        // 验证文件类型
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
        $('button[type="submit"]').html('<span class="loading"></span> 上传中...').prop('disabled', true);
        
        // 发送AJAX请求 - 仅上传
        $.ajax({
            url: '/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                // 恢复按钮状态
                $('button[type="submit"]').html('上传文档').prop('disabled', false);
                
                if (response.success) {
                    // 保存当前上传的文件信息
                    currentUploadedFile = response.uploadedFile || response.processedFile;
                    
                    // 加载原始文档预览
                    loadOriginalPreview(currentUploadedFile.path);
                } else {
                    alert('上传失败: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                // 恢复按钮状态
                $('button[type="submit"]').html('上传文档').prop('disabled', false);
                alert('上传失败: ' + (xhr.responseText || error));
            }
        });
    });
    
    // 加载原始文档预览
    function loadOriginalPreview(filePath) {
        // 只获取文件名部分，不包含路径
        const filename = filePath.split(/[\/\\]/).pop();
        
        // 显示加载中状态
        $('#preview-content').html('<div class="text-center py-5"><span class="loading me-2"></span> 正在加载预览...</div>');
        
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
            url: '/preview/' + filename,
            type: 'GET',
            success: function(html) {
                // 在预览区域显示内容
                $('#preview-content').html(html);
            },
            error: function(xhr, status, error) {
                console.error('预览加载失败:', error, xhr.status, xhr.responseText);
                $('#preview-content').html('<div class="alert alert-danger">加载预览失败，请重试</div>');
            }
        });
    }
    
    // 美化按钮点击处理
    $('#beautify-btn').on('click', function() {
        if (!currentUploadedFile) {
            alert('请先上传文档');
            return;
        }
        
        // 显示加载状态
        $(this).html('<span class="loading"></span> 美化中...').prop('disabled', true);
        
        // 获取文件名
        const filename = currentUploadedFile.path.split(/[\/\\]/).pop();
        
        // 发送美化请求
        $.ajax({
            url: '/beautify',
            type: 'POST',
            data: {
                filename: filename
            },
            success: function(response) {
                // 恢复按钮状态
                $('#beautify-btn').html('美化文档').prop('disabled', false);
                
                if (response.success) {
                    // 保存当前处理的文件信息
                    currentProcessedFile = response.processedFile;
                    
                    // 加载美化后的预览
                    loadBeautifiedPreview(currentProcessedFile.path);
                } else {
                    alert('美化失败: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                // 恢复按钮状态
                $('#beautify-btn').html('美化文档').prop('disabled', false);
                alert('美化失败: ' + (xhr.responseText || error));
            }
        });
    });
    
    // 加载美化后的文档预览
    function loadBeautifiedPreview(filePath) {
        // 只获取文件名部分，不包含路径
        const filename = filePath.split(/[\/\\]/).pop();
        
        // 显示加载中状态
        $('#beautified-content').html('<div class="text-center py-5"><span class="loading me-2"></span> 正在加载预览...</div>');
        
        // 显示结果区域
        $('#result-section').removeClass('d-none');
        
        // 滚动到结果区域
        $('html, body').animate({
            scrollTop: $('#result-section').offset().top - 50
        }, 500);
        
        // 获取预览内容
        $.ajax({
            url: '/preview/' + filename,
            type: 'GET',
            success: function(html) {
                // 在预览区域显示内容
                $('#beautified-content').html(html);
            },
            error: function(xhr, status, error) {
                console.error('预览加载失败:', error, xhr.status, xhr.responseText);
                $('#beautified-content').html('<div class="alert alert-danger">加载预览失败，请重试</div>');
            }
        });
    }
    
    // 下载按钮处理
    $('#download-btn').on('click', function() {
        if (!currentProcessedFile) {
            alert('请先上传并美化文档');
            return;
        }
        
        // 显示下载选项对话框
        showDownloadOptions();
    });
    
    // 显示下载选项对话框
    function showDownloadOptions() {
        // 创建模态对话框
        const modal = $(`
            <div class="modal fade" id="downloadOptionsModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title">选择导出格式</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>请选择要导出的文件格式：</p>
                            <div class="d-grid gap-3">
                                <button type="button" class="btn btn-outline-primary export-btn" data-format="docx">
                                    <i class="bi bi-file-earmark-word"></i> Word文档 (.docx)
                                </button>
                                <button type="button" class="btn btn-outline-danger export-btn" data-format="pdf">
                                    <i class="bi bi-file-earmark-pdf"></i> PDF文档 (.pdf)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        // 添加到页面并显示
        $('body').append(modal);
        const modalElement = new bootstrap.Modal(document.getElementById('downloadOptionsModal'));
        modalElement.show();
        
        // 绑定导出按钮点击事件
        $('.export-btn').on('click', function() {
            const format = $(this).data('format');
            exportDocument(format);
            modalElement.hide();
        });
        
        // 模态框关闭时移除
        $('#downloadOptionsModal').on('hidden.bs.modal', function() {
            $(this).remove();
        });
    }
    
    // 导出文档
    function exportDocument(format) {
        if (!currentProcessedFile) {
            alert('没有可导出的文档');
            return;
        }
        
        // 显示加载状态
        $('#download-btn').html('<span class="loading"></span> 正在导出...').prop('disabled', true);
        
        // 获取文件名，不包含路径
        const filename = currentProcessedFile.path.split(/[\/\\]/).pop();
        
        // 发送导出请求
        $.ajax({
            url: '/export',
            type: 'GET',
            data: {
                htmlFile: filename,
                format: format
            },
            success: function(response) {
                // 恢复按钮状态
                $('#download-btn').html('下载美化后的文档').prop('disabled', false);
                
                if (response.success) {
                    // 自动下载文件
                    window.location.href = response.downloadUrl;
                } else {
                    alert('导出失败: ' + response.message);
                }
            },
            error: function(xhr) {
                // 恢复按钮状态
                $('#download-btn').html('下载美化后的文档').prop('disabled', false);
                
                // 显示错误信息
                let errorMsg = '导出失败';
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.message) {
                        errorMsg = response.message;
                    }
                } catch (e) {
                    errorMsg += ': ' + xhr.status + ' ' + xhr.statusText;
                }
                
                alert(errorMsg);
            }
        });
    }
});