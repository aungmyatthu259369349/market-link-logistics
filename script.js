// 导航栏功能
document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });

    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 添加粒子效果
    createParticles();
});

// 创建粒子效果
function createParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles-container';
    particlesContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
    `;
    document.body.appendChild(particlesContainer);

    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: var(--primary-color);
            border-radius: 50%;
            opacity: 0.3;
            animation: float ${Math.random() * 10 + 10}s linear infinite;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
        `;
        particlesContainer.appendChild(particle);
    }
}

// 添加浮动动画
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
        }
        10% {
            opacity: 0.3;
        }
        90% {
            opacity: 0.3;
        }
        100% {
            transform: translateY(-100px) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 滚动到指定部分
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// 包裹跟踪功能
function trackPackage() {
    const trackingNumber = document.getElementById('trackingNumber').value;
    const resultDiv = document.getElementById('trackingResult');

    if (!trackingNumber) {
        resultDiv.innerHTML = '<p style="color: #ff6b35; text-shadow: 0 0 10px rgba(255, 107, 53, 0.5);">请输入跟踪号</p>';
        return;
    }

    // 模拟跟踪结果
    const mockResults = {
        'ML123456789': {
            status: '运输中',
            location: '北京市朝阳区配送中心',
            estimatedDelivery: '2024-01-15',
            updates: [
                { time: '2024-01-13 14:30', status: '包裹已到达北京市朝阳区配送中心' },
                { time: '2024-01-12 16:45', status: '包裹正在运输途中' },
                { time: '2024-01-11 09:20', status: '包裹已从上海仓库发出' }
            ]
        },
        'ML987654321': {
            status: '已送达',
            location: '收件人已签收',
            estimatedDelivery: '2024-01-10',
            updates: [
                { time: '2024-01-10 15:30', status: '包裹已送达，收件人已签收' },
                { time: '2024-01-10 09:15', status: '包裹正在派送中' },
                { time: '2024-01-09 18:20', status: '包裹已到达目的地配送中心' }
            ]
        }
    };

    const result = mockResults[trackingNumber];
    if (result) {
        let html = `
            <div class="tracking-info">
                <h3 style="color: var(--primary-color); margin-bottom: 1.5rem; text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);">跟踪结果</h3>
                <div class="tracking-details" style="margin-bottom: 2rem;">
                    <p><strong style="color: var(--primary-color);">跟踪号:</strong> <span style="color: var(--text-primary);">${trackingNumber}</span></p>
                    <p><strong style="color: var(--primary-color);">状态:</strong> <span style="color: var(--primary-color); text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);">${result.status}</span></p>
                    <p><strong style="color: var(--primary-color);">当前位置:</strong> <span style="color: var(--text-primary);">${result.location}</span></p>
                    <p><strong style="color: var(--primary-color);">预计送达:</strong> <span style="color: var(--text-primary);">${result.estimatedDelivery}</span></p>
                </div>
                <div class="tracking-updates">
                    <h4 style="color: var(--primary-color); margin-bottom: 1rem;">运输更新</h4>
                    <div class="updates-list">
        `;
        
        result.updates.forEach((update, index) => {
            html += `
                <div class="update-item" style="
                    padding: 1rem;
                    margin-bottom: 1rem;
                    background: rgba(0, 212, 255, 0.1);
                    border-radius: 10px;
                    border-left: 3px solid var(--primary-color);
                    animation: slideIn 0.5s ease ${index * 0.1}s both;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">${update.time}</span>
                        <span style="color: var(--text-primary);">${update.status}</span>
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        resultDiv.innerHTML = html;
    } else {
        resultDiv.innerHTML = '<p style="color: #ff6b35; text-shadow: 0 0 10px rgba(255, 107, 53, 0.5);">未找到该跟踪号，请检查后重试</p>';
    }
}

// 价格计算功能
function calculatePrice() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const weight = parseFloat(document.getElementById('weight').value);
    const serviceType = document.getElementById('serviceType').value;
    const resultDiv = document.getElementById('priceResult');

    if (!origin || !destination || !weight) {
        resultDiv.innerHTML = '<p style="color: #ff6b35; text-shadow: 0 0 10px rgba(255, 107, 53, 0.5);">请填写所有必填信息</p>';
        return;
    }

    // 模拟价格计算
    let basePrice = weight * 2; // 基础价格：每公斤2元
    let serviceMultiplier = 1;

    switch (serviceType) {
        case 'express':
            serviceMultiplier = 1.5;
            break;
        case 'premium':
            serviceMultiplier = 2;
            break;
        default:
            serviceMultiplier = 1;
    }

    const totalPrice = basePrice * serviceMultiplier;
    const estimatedTime = serviceType === 'express' ? '1-2天' : serviceType === 'premium' ? '24小时内' : '3-5天';

    resultDiv.innerHTML = `
        <div class="price-info" style="text-align: center;">
            <h3 style="color: var(--primary-color); margin-bottom: 2rem; text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);">运费估算结果</h3>
            <div class="price-details" style="
                background: rgba(0, 212, 255, 0.1);
                padding: 2rem;
                border-radius: 15px;
                border: 1px solid var(--border-glow);
            ">
                <div style="display: grid; gap: 1rem; margin-bottom: 2rem;">
                    <p><strong style="color: var(--primary-color);">起始地:</strong> <span style="color: var(--text-primary);">${origin}</span></p>
                    <p><strong style="color: var(--primary-color);">目的地:</strong> <span style="color: var(--text-primary);">${destination}</span></p>
                    <p><strong style="color: var(--primary-color);">重量:</strong> <span style="color: var(--text-primary);">${weight} kg</span></p>
                    <p><strong style="color: var(--primary-color);">服务类型:</strong> <span style="color: var(--text-primary);">${serviceType === 'standard' ? '标准运输' : serviceType === 'express' ? '快速运输' : '优质运输'}</span></p>
                    <p><strong style="color: var(--primary-color);">预计送达时间:</strong> <span style="color: var(--text-primary);">${estimatedTime}</span></p>
                </div>
                <div style="
                    background: var(--gradient-primary);
                    padding: 2rem;
                    border-radius: 15px;
                    box-shadow: var(--shadow-glow-strong);
                ">
                    <p style="margin: 0; font-size: 1.2rem; color: var(--text-primary);"><strong>总运费:</strong></p>
                    <p style="
                        margin: 0;
                        font-size: 3rem;
                        font-weight: 800;
                        color: var(--text-primary);
                        text-shadow: 0 0 20px rgba(0, 212, 255, 0.8);
                    ">¥${totalPrice.toFixed(2)}</p>
                </div>
            </div>
        </div>
    `;
}

// 联系表单提交
document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // 获取表单数据
    const formData = new FormData(this);
    const name = this.querySelector('input[type="text"]').value;
    const email = this.querySelector('input[type="email"]').value;
    const phone = this.querySelector('input[type="tel"]').value;
    const message = this.querySelector('textarea').value;

    // 模拟表单提交
    showNotification(`感谢您的留言，${name}！我们将尽快回复您。`, 'success');
    this.reset();
});

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        background: ${type === 'success' ? 'var(--gradient-primary)' : 'var(--gradient-secondary)'};
        color: var(--text-primary);
        border-radius: 10px;
        box-shadow: var(--shadow-glow-strong);
        z-index: 10000;
        animation: slideInRight 0.5s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}

// 页面滚动效果
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(10, 10, 10, 0.98)';
        navbar.style.boxShadow = 'var(--shadow-glow-strong)';
    } else {
        navbar.style.background = 'rgba(10, 10, 10, 0.95)';
        navbar.style.boxShadow = 'var(--shadow-glow)';
    }
});

// 添加动画效果
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// 观察所有需要动画的元素
document.querySelectorAll('.service-card, .about-content, .contact-item, .stat').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// 添加键盘导航支持
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // 关闭模态框
        const modal = document.getElementById('modal');
        if (modal && modal.style.display === 'block') {
            closeModal();
        }
    }
});

// 添加鼠标跟随效果
document.addEventListener('mousemove', function(e) {
    const cursor = document.querySelector('.cursor-follow');
    if (cursor) {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    }
}); 