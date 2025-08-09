// 客户专区功能
document.addEventListener('DOMContentLoaded', function() {
    // 初始化客户专区
    initializeClientArea();
    
    // 添加表单验证
    setupFormValidation();
    
    // 添加动画效果
    setupAnimations();
});

// 初始化客户专区
function initializeClientArea() {
    // 检查是否已登录
    const isLoggedIn = localStorage.getItem('clientLoggedIn');
    if (isLoggedIn) {
        showDashboard();
    } else {
        window.location.href = 'client-login.html';
        return;
    }
    
    // 设置默认显示登录表单
    showTab('login');
}

// 显示认证区域
function showAuthSection() {
    const authSection = document.querySelector('.client-auth');
    const dashboard = document.getElementById('dashboard');
    
    if (authSection) authSection.style.display = 'block';
    if (dashboard) dashboard.style.display = 'none';
}

// 显示控制台
function showDashboard() {
    const authSection = document.querySelector('.client-auth');
    const dashboard = document.getElementById('dashboard');
    
    if (authSection) authSection.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';
    
    // 加载用户数据
    loadUserData();
}

// 切换认证标签
function showTab(tabName) {
    // 隐藏所有表单
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    // 移除所有标签的激活状态
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 显示选中的表单
    const selectedForm = document.getElementById(tabName);
    const selectedTab = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    
    if (selectedForm) selectedForm.classList.add('active');
    if (selectedTab) selectedTab.classList.add('active');
}

// 设置表单验证
function setupFormValidation() {
    // 登录表单
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 注册表单
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // 忘记密码表单
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', handleForgotPassword);
    }
}

// 处理登录
async function handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const username = formData.get('username') || event.target.querySelector('input[type="text"]').value;
    const password = formData.get('password') || event.target.querySelector('input[type="password"]').value;
    
    if (!username || !password) {
        showNotification('请填写用户名和密码', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // 保存登录信息
        localStorage.setItem('clientLoggedIn', 'true');
            localStorage.setItem('clientUsername', data.user.username);
            localStorage.setItem('clientToken', data.token);
            localStorage.setItem('clientUser', JSON.stringify(data.user));
        
        showNotification('登录成功！', 'success');
        showDashboard();
        
        // 更新用户名显示
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
                userNameElement.textContent = data.user.username;
            }
        } else {
            showNotification(data.error || '登录失败', 'error');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showNotification('登录失败，请检查网络连接', 'error');
    }
}

// 处理注册
async function handleRegister(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const companyName = formData.get('companyName') || event.target.querySelector('input[type="text"]').value;
    const contactName = formData.get('contactName') || event.target.querySelectorAll('input[type="text"]')[1].value;
    const email = formData.get('email') || event.target.querySelector('input[type="email"]').value;
    const phone = formData.get('phone') || event.target.querySelector('input[type="tel"]').value;
    const password = formData.get('password') || event.target.querySelector('input[type="password"]').value;
    const confirmPassword = formData.get('confirmPassword') || event.target.querySelectorAll('input[type="password"]')[1].value;
    
    // 验证密码
    if (password !== confirmPassword) {
        showNotification('密码不一致，请重新输入', 'error');
        return;
    }
    
    if (!companyName || !contactName || !email || !phone || !password) {
        showNotification('请填写所有必填信息', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: email, // 使用邮箱作为用户名
                email,
                password,
                company_name: companyName,
                contact_name: contactName,
                phone
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
        showNotification('注册成功！请登录', 'success');
        showTab('login');
    } else {
            showNotification(data.error || '注册失败', 'error');
        }
    } catch (error) {
        console.error('注册失败:', error);
        showNotification('注册失败，请检查网络连接', 'error');
    }
}

// 处理忘记密码
function handleForgotPassword(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email') || event.target.querySelector('input[type="email"]').value;
    
    if (email) {
        showNotification('重置链接已发送到您的邮箱', 'success');
        showTab('login');
    } else {
        showNotification('请输入邮箱地址', 'error');
    }
}

// 加载用户数据
function loadUserData() {
    const username = localStorage.getItem('clientUsername') || '客户';
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = username;
    }
    
    // 模拟加载用户统计数据
    updateUserStats();
}

// 更新用户统计
function updateUserStats() {
    // 这里可以添加真实的数据加载逻辑
    console.log('更新用户统计数据');
}

// 退出登录
function logout() {
    localStorage.removeItem('clientLoggedIn');
    localStorage.removeItem('clientUsername');
    
    showNotification('已退出登录', 'info');
    showAuthSection();
    showTab('login');
}

// 显示模态框
function showModal(modalType) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    if (!modal) return;
    
    let title = '';
    let content = '';
    
    switch(modalType) {
        case 'newOrder':
            title = '新建订单';
            content = createNewOrderForm();
            break;
        case 'tracking':
            title = '包裹跟踪';
            content = createTrackingForm();
            break;
        case 'invoice':
            title = '下载发票';
            content = createInvoiceForm();
            break;
        case 'support':
            title = '联系客服';
            content = createSupportForm();
            break;
        default:
            title = '信息';
            content = '<p>功能开发中...</p>';
    }
    
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = content;
    
    modal.style.display = 'block';
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 创建新订单表单
function createNewOrderForm() {
    return `
        <form id="newOrderForm" onsubmit="submitNewOrder(event)">
            <div class="form-group">
                <label>收货人姓名</label>
                <input type="text" name="receiverName" required>
            </div>
            <div class="form-group">
                <label>收货地址</label>
                <textarea name="address" rows="3" required></textarea>
            </div>
            <div class="form-group">
                <label>联系电话</label>
                <input type="tel" name="phone" required>
            </div>
            <div class="form-group">
                <label>商品名称</label>
                <input type="text" name="productName" required>
            </div>
            <div class="form-group">
                <label>商品重量 (kg)</label>
                <input type="number" name="weight" step="0.1" required>
            </div>
            <div class="form-group">
                <label>服务类型</label>
                <select name="serviceType" required>
                    <option value="">选择服务类型</option>
                    <option value="standard">标准运输</option>
                    <option value="express">快速运输</option>
                    <option value="premium">优质运输</option>
                </select>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" rows="2"></textarea>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">提交订单</button>
            </div>
        </form>
    `;
}

// 创建跟踪表单
function createTrackingForm() {
    return `
        <div>
            <div class="form-group">
                <label>跟踪号</label>
                <input type="text" id="modalTrackingNumber" placeholder="请输入跟踪号">
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="button" class="btn btn-primary" onclick="trackPackageModal()">跟踪</button>
            </div>
            <div id="modalTrackingResult" style="margin-top: 2rem;"></div>
        </div>
    `;
}

// 创建发票表单
function createInvoiceForm() {
    return `
        <div>
            <div class="form-group">
                <label>订单号</label>
                <input type="text" id="invoiceOrderNumber" placeholder="请输入订单号">
            </div>
            <div class="form-group">
                <label>发票类型</label>
                <select id="invoiceType">
                    <option value="electronic">电子发票</option>
                    <option value="paper">纸质发票</option>
                </select>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="button" class="btn btn-primary" onclick="downloadInvoice()">下载发票</button>
            </div>
        </div>
    `;
}

// 创建客服表单
function createSupportForm() {
    return `
        <form id="supportForm" onsubmit="submitSupport(event)">
            <div class="form-group">
                <label>问题类型</label>
                <select name="issueType" required>
                    <option value="">选择问题类型</option>
                    <option value="order">订单问题</option>
                    <option value="delivery">配送问题</option>
                    <option value="payment">支付问题</option>
                    <option value="other">其他问题</option>
                </select>
            </div>
            <div class="form-group">
                <label>问题描述</label>
                <textarea name="description" rows="4" required placeholder="请详细描述您遇到的问题"></textarea>
            </div>
            <div class="form-group">
                <label>联系电话</label>
                <input type="tel" name="phone" required>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">提交</button>
            </div>
        </form>
    `;
}

// 提交新订单
function submitNewOrder(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const orderData = Object.fromEntries(formData);
    
    // 模拟订单提交
    console.log('新订单数据:', orderData);
    
    showNotification('订单提交成功！', 'success');
    closeModal();
    
    // 刷新订单列表
    setTimeout(() => {
        loadUserData();
    }, 1000);
}

// 模态框中的包裹跟踪
function trackPackageModal() {
    const trackingNumber = document.getElementById('modalTrackingNumber').value;
    const resultDiv = document.getElementById('modalTrackingResult');
    
    if (!trackingNumber) {
        showNotification('请输入跟踪号', 'error');
        return;
    }
    
    // 模拟跟踪结果
    const mockResult = {
        trackingNumber: trackingNumber,
        status: '运输中',
        location: '仰光配送中心',
        estimatedDelivery: '2024-01-20'
    };
    
    resultDiv.innerHTML = `
        <div style="background: rgba(0, 212, 255, 0.1); padding: 1.5rem; border-radius: 10px; border-left: 3px solid var(--primary-color);">
            <h4 style="color: var(--primary-color); margin-bottom: 1rem;">跟踪结果</h4>
            <p><strong>跟踪号:</strong> ${mockResult.trackingNumber}</p>
            <p><strong>状态:</strong> <span style="color: var(--primary-color);">${mockResult.status}</span></p>
            <p><strong>当前位置:</strong> ${mockResult.location}</p>
            <p><strong>预计送达:</strong> ${mockResult.estimatedDelivery}</p>
        </div>
    `;
}

// 下载发票
function downloadInvoice() {
    const orderNumber = document.getElementById('invoiceOrderNumber').value;
    const invoiceType = document.getElementById('invoiceType').value;
    
    if (!orderNumber) {
        showNotification('请输入订单号', 'error');
        return;
    }
    
    // 模拟发票下载
    showNotification(`正在生成${invoiceType === 'electronic' ? '电子' : '纸质'}发票...`, 'info');
    
    setTimeout(() => {
        showNotification('发票下载完成！', 'success');
        closeModal();
    }, 2000);
}

// 提交客服请求
function submitSupport(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const supportData = Object.fromEntries(formData);
    
    // 模拟客服请求提交
    console.log('客服请求:', supportData);
    
    showNotification('您的问题已提交，我们会尽快回复！', 'success');
    closeModal();
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: 10px;
        color: var(--text-primary);
        z-index: 10000;
        box-shadow: var(--shadow-glow-strong);
        animation: slideInRight 0.5s ease;
    `;
    
    switch(type) {
        case 'success':
            notification.style.background = 'var(--gradient-primary)';
            break;
        case 'error':
            notification.style.background = 'var(--gradient-secondary)';
            break;
        case 'info':
        default:
            notification.style.background = 'var(--gradient-dark)';
            notification.style.border = '1px solid var(--border-glow)';
            break;
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 500);
    }, 3000);
}

// 设置动画效果
function setupAnimations() {
    // 添加滚动动画
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
    
    // 观察需要动画的元素
    document.querySelectorAll('.service-card, .stat, .contact-item').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// 点击模态框外部关闭
window.addEventListener('click', function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
});

// 键盘事件处理
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}); 