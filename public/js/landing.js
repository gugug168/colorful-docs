/**
 * 文档排版与美化系统 - 首页专用脚本
 */
document.addEventListener('DOMContentLoaded', function() {
    // 初始化图片对比滑块
    initImageSliders();
    
    // 平滑滚动导航
    initSmoothScroll();
});

/**
 * 初始化图片对比滑块
 */
function initImageSliders() {
    const sliders = document.querySelectorAll('.image-slider');
    if (sliders.length === 0) return;
    
    sliders.forEach((slider, index) => {
        const sliderLine = slider.querySelector('.slider-line');
        const imgAfter = slider.querySelector('.img-after');
        const sliderId = `slider-${index}`;
        slider.setAttribute('id', sliderId);
        
        // 设置滑块位置
        function setSliderPosition(x) {
            const sliderRect = slider.getBoundingClientRect();
            const position = Math.max(0, Math.min(1, (x - sliderRect.left) / sliderRect.width));
            imgAfter.style.clipPath = `polygon(0 0, ${position * 100}% 0, ${position * 100}% 100%, 0 100%)`;
            sliderLine.style.left = `${position * 100}%`;
        }
        
        // 鼠标事件
        function onMouseDown(e) {
            e.preventDefault();
            // 停止自动滑动
            clearInterval(window[`autoSlideInterval_${sliderId}`]);
            
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            slider.classList.add('active');
        }
        
        function onMouseMove(e) {
            setSliderPosition(e.clientX);
        }
        
        function onMouseUp() {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            slider.classList.remove('active');
            
            // 手动控制后延迟恢复自动滑动
            setTimeout(() => {
                startAutoSlide(slider, sliderLine, imgAfter, sliderId);
            }, 5000);
        }
        
        // 触摸事件
        function onTouchStart(e) {
            // 停止自动滑动
            clearInterval(window[`autoSlideInterval_${sliderId}`]);
            
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onTouchEnd);
            slider.classList.add('active');
        }
        
        function onTouchMove(e) {
            e.preventDefault(); // 防止滚动
            setSliderPosition(e.touches[0].clientX);
        }
        
        function onTouchEnd() {
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            slider.classList.remove('active');
            
            // 手动控制后延迟恢复自动滑动
            setTimeout(() => {
                startAutoSlide(slider, sliderLine, imgAfter, sliderId);
            }, 5000);
        }
        
        // 绑定事件
        sliderLine.addEventListener('mousedown', onMouseDown);
        sliderLine.addEventListener('touchstart', onTouchStart, { passive: false });
        
        // 设置初始位置为100%（完全显示before图）
        imgAfter.style.clipPath = `polygon(0 0, 100% 0, 100% 100%, 0 100%)`;
        sliderLine.style.left = `100%`;
        
        // 启动自动滑动（错开启动时间）
        setTimeout(() => {
            startAutoSlide(slider, sliderLine, imgAfter, sliderId);
        }, 1500 + index * 1000);
    });
}

/**
 * 启动自动滑动
 */
function startAutoSlide(slider, sliderLine, imgAfter, sliderId) {
    // 清除之前的定时器
    if (window[`autoSlideInterval_${sliderId}`]) {
        clearInterval(window[`autoSlideInterval_${sliderId}`]);
    }
    
    let direction = -1; // -1 = 向左滑动，1 = 向右滑动
    let position = 1; // 开始位置100%
    
    window[`autoSlideInterval_${sliderId}`] = setInterval(() => {
        position += direction * 0.01;
        
        // 边界检查与方向变更
        if (position <= 0) {
            position = 0;
            direction = 1; // 改变方向
            // 到达边界时稍微暂停
            clearInterval(window[`autoSlideInterval_${sliderId}`]);
            setTimeout(() => {
                startAutoSlide(slider, sliderLine, imgAfter, sliderId);
            }, 1000);
            return;
        } else if (position >= 1) {
            position = 1;
            direction = -1; // 改变方向
            // 到达边界时稍微暂停
            clearInterval(window[`autoSlideInterval_${sliderId}`]);
            setTimeout(() => {
                startAutoSlide(slider, sliderLine, imgAfter, sliderId);
            }, 1000);
            return;
        }
        
        // 更新位置
        imgAfter.style.clipPath = `polygon(0 0, ${position * 100}% 0, ${position * 100}% 100%, 0 100%)`;
        sliderLine.style.left = `${position * 100}%`;
    }, 30);
}

/**
 * 初始化平滑滚动
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;
            
            window.scrollTo({
                top: targetElement.offsetTop - 80, // 考虑导航栏高度
                behavior: 'smooth'
            });
            
            // 如果是在小屏幕上，且菜单是展开的，则点击后收起菜单
            const navbarToggler = document.querySelector('.navbar-toggler');
            const navbarCollapse = document.querySelector('.navbar-collapse');
            if (window.innerWidth < 992 && navbarToggler && navbarCollapse && 
                navbarCollapse.classList.contains('show')) {
                navbarToggler.click();
            }
        });
    });
    
    // 滚动时导航高亮显示当前部分
    window.addEventListener('scroll', function() {
        const scrollPosition = window.scrollY + 100; // 考虑偏移量
        
        document.querySelectorAll('section[id]').forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    });
}

/**
 * 当图片加载失败时显示占位符（防止滑块显示异常）
 */
document.addEventListener('error', function(e) {
    if (e.target.tagName.toLowerCase() === 'img') {
        console.warn('Image loading failed:', e.target.src);
        // 可以设置一个默认图片
        // e.target.src = '/images/landing/placeholder.jpg';
    }
}, true); 