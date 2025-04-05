/**
 * 图片重新上色功能模块
 * 负责为已上色的图片添加重新上色按钮和处理相关交互
 */

document.addEventListener('DOMContentLoaded', function() {
    // 初始化重新上色按钮
    initRecolorButtons();
    
    // 监听动态添加的图片元素
    observeNewImages();
});

/**
 * 初始化页面上所有已上色图片的重新上色按钮
 */
function initRecolorButtons() {
    // 查找所有已上色的图片（带有data-colorized属性的图片）
    const colorizedImages = document.querySelectorAll('img[data-colorized="true"]');
    console.log(`找到 ${colorizedImages.length} 张已上色的图片`);
    
    // 为每张已上色图片添加重新上色按钮
    colorizedImages.forEach(image => {
        addRecolorButtonToImage(image);
    });
}

/**
 * 为图片添加重新上色按钮
 * @param {HTMLElement} imageElement 图片元素
 */
function addRecolorButtonToImage(imageElement) {
    // 检查是否已经添加了按钮
    const parentElement = imageElement.parentElement;
    if (parentElement.querySelector('.recolor-button')) {
        return; // 已经有按钮了，避免重复添加
    }
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'recolor-button-container';
    buttonContainer.style.position = 'relative';
    buttonContainer.style.display = 'inline-block';
    
    // 将图片包装到这个容器中
    imageElement.parentNode.insertBefore(buttonContainer, imageElement);
    buttonContainer.appendChild(imageElement);
    
    // 创建重新上色按钮
    const recolorButton = document.createElement('button');
    recolorButton.className = 'recolor-button';
    recolorButton.innerHTML = '重新上色';
    recolorButton.style.position = 'absolute';
    recolorButton.style.top = '5px';
    recolorButton.style.right = '5px';
    recolorButton.style.backgroundColor = '#6200EA';
    recolorButton.style.color = 'white';
    recolorButton.style.border = 'none';
    recolorButton.style.borderRadius = '4px';
    recolorButton.style.padding = '5px 10px';
    recolorButton.style.fontSize = '12px';
    recolorButton.style.cursor = 'pointer';
    recolorButton.style.opacity = '0.8';
    recolorButton.style.transition = 'opacity 0.3s';
    recolorButton.style.zIndex = '10';
    
    // 鼠标悬停效果
    recolorButton.addEventListener('mouseover', function() {
        this.style.opacity = '1';
    });
    
    recolorButton.addEventListener('mouseout', function() {
        this.style.opacity = '0.8';
    });
    
    // 点击事件处理
    recolorButton.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // 获取图片路径信息
        const imageSrc = imageElement.getAttribute('src');
        const originalSrc = imageElement.getAttribute('data-original') || '';
        
        // 调用重新上色函数
        recolorImage(imageElement, imageSrc, originalSrc);
    });
    
    // 添加按钮到图片容器
    buttonContainer.appendChild(recolorButton);
}

/**
 * 重新上色图片
 * @param {HTMLElement} imageElement 图片元素
 * @param {string} currentImagePath 当前图片路径
 * @param {string} originalImagePath 原始图片路径（如果有）
 */
async function recolorImage(imageElement, currentImagePath, originalImagePath) {
    try {
        // 显示加载状态
        imageElement.style.opacity = '0.5';
        
        // 构造服务器文件路径 - 将Web路径转换为服务器文件路径
        let serverImagePath = currentImagePath;
        if (serverImagePath.startsWith('/')) {
            serverImagePath = serverImagePath.substring(1); // 移除前导斜杠
        }
        
        let serverOriginalPath = '';
        if (originalImagePath) {
            if (originalImagePath.startsWith('/')) {
                serverOriginalPath = originalImagePath.substring(1); // 移除前导斜杠
            } else {
                serverOriginalPath = originalImagePath;
            }
        }
        
        console.log(`请求重新上色: ${serverImagePath}, 原始图片: ${serverOriginalPath}`);
        
        // 发送重新上色请求
        const response = await fetch('/api/image/recolorize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imagePath: serverImagePath,
                originalPath: serverOriginalPath
            })
        });
        
        // 检查响应状态
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '重新上色请求失败');
        }
        
        // 解析响应数据
        const data = await response.json();
        
        if (data.success && data.result && data.result.colorizedPath) {
            // 生成新的Web路径
            let newWebPath = '';
            const fileName = data.result.colorizedPath.split('/').pop().split('\\').pop();
            
            // 根据文件路径构造Web URL
            if (data.result.colorizedPath.includes('public/images') || 
                data.result.colorizedPath.includes('public\\images')) {
                newWebPath = `/images/temp/${fileName}`;
            } else {
                newWebPath = `/temp/${fileName}`;
            }
            
            console.log(`重新上色成功，新图片路径: ${newWebPath}`);
            
            // 更新图片显示
            imageElement.setAttribute('src', newWebPath + '?t=' + Date.now()); // 添加时间戳避免缓存
            imageElement.setAttribute('data-original', originalImagePath || currentImagePath);
            
            // 显示成功消息
            showNotification('图片重新上色成功', 'success');
        } else {
            throw new Error(data.message || '重新上色处理失败');
        }
    } catch (error) {
        console.error('重新上色图片失败:', error);
        showNotification(`重新上色失败: ${error.message}`, 'error');
    } finally {
        // 恢复图片显示
        imageElement.style.opacity = '1';
    }
}

/**
 * 显示通知消息
 * @param {string} message 消息内容
 * @param {string} type 消息类型 ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
    // 检查页面是否已有通知容器
    let notificationContainer = document.querySelector('.notification-container');
    
    if (!notificationContainer) {
        // 创建通知容器
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        document.body.appendChild(notificationContainer);
    }
    
    // 创建新通知
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;
    
    // 设置通知样式
    notification.style.backgroundColor = type === 'success' ? '#4CAF50' : 
                                         type === 'error' ? '#F44336' : '#2196F3';
    notification.style.color = 'white';
    notification.style.padding = '12px 16px';
    notification.style.margin = '0 0 10px 0';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    notification.style.minWidth = '200px';
    notification.style.transition = 'opacity 0.5s ease-in-out';
    notification.style.opacity = '0';
    
    // 添加通知到容器
    notificationContainer.appendChild(notification);
    
    // 显示通知（添加淡入效果）
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);
    
    // 设置通知自动消失
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notificationContainer.removeChild(notification);
        }, 500);
    }, 5000);
}

/**
 * 监听页面上动态添加的新图片
 */
function observeNewImages() {
    // 创建 MutationObserver 实例
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            // 检查是否有新的节点添加
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    // 检查是否是图片元素
                    if (node.nodeType === 1 && node.tagName === 'IMG' && 
                        node.getAttribute('data-colorized') === 'true') {
                        addRecolorButtonToImage(node);
                    }
                    
                    // 如果是其他元素，检查其中是否包含图片
                    if (node.nodeType === 1 && node.querySelectorAll) {
                        const images = node.querySelectorAll('img[data-colorized="true"]');
                        images.forEach(img => addRecolorButtonToImage(img));
                    }
                });
            }
        });
    });
    
    // 配置观察选项
    const config = { 
        childList: true,  // 观察目标子节点的变化
        subtree: true     // 观察后代节点的变化
    };
    
    // 开始观察document.body的变化
    observer.observe(document.body, config);
} 