/**
 * 文档排版与美化系统 - 首页专用脚本
 */
document.addEventListener('DOMContentLoaded', function() {
    // 初始化图片对比滑块
    initImageSlider();
    
    // 平滑滚动导航
    initSmoothScroll();
});

/**
 * 初始化图片对比滑块
 */
function initImageSlider() {
    const slider = document.querySelector('.image-slider');
    if (!slider) return;
    
    const sliderLine = document.querySelector('.slider-line');
    const imgAfter = document.querySelector('.img-after');
    
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
    }
    
    // 触摸事件
    function onTouchStart(e) {
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
    }
    
    // 绑定事件
    sliderLine.addEventListener('mousedown', onMouseDown);
    sliderLine.addEventListener('touchstart', onTouchStart, { passive: false });
    
    // 动画效果 - 自动演示一次滑动效果
    setTimeout(() => {
        // 从右到左滑动动画
        let position = 1;
        const interval = setInterval(() => {
            position -= 0.01;
            imgAfter.style.clipPath = `polygon(0 0, ${position * 100}% 0, ${position * 100}% 100%, 0 100%)`;
            sliderLine.style.left = `${position * 100}%`;
            
            if (position <= 0.3) {
                clearInterval(interval);
                // 动画结束后回到50%位置
                setTimeout(() => {
                    position = 0.5;
                    imgAfter.style.clipPath = `polygon(0 0, ${position * 100}% 0, ${position * 100}% 100%, 0 100%)`;
                    sliderLine.style.left = `${position * 100}%`;
                }, 500);
            }
        }, 20);
    }, 1500);
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