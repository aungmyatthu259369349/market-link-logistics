// 后台管理系统功能
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminSystem();
    setupEventListeners();
    loadDashboardData();
});

// 初始化后台系统
function initializeAdminSystem() {
    // 检查登录状态
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    if (!isLoggedIn) {
        // 未登录则跳转到后台登录页
        window.location.href = 'admin-login.html';
        return;
    }
    
    // 初始化侧边栏
    initializeSidebar();
    
    // 初始化图表
    initializeCharts();
}

// 设置事件监听器
function setupEventListeners() {
    // 侧边栏菜单点击事件
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            switchTab(tabId);
        });
    });
    
    // 搜索功能
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch(this.value);
            }
        });
    }
    
    // 模态框关闭事件
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('modal');
        if (e.target === modal) {
            closeModal();
        }
    });
}

// 初始化侧边栏
function initializeSidebar() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            // 移除所有活动状态
            menuItems.forEach(i => i.classList.remove('active'));
            // 添加当前活动状态
            this.classList.add('active');
        });
    });
}

// 切换标签页
function switchTab(tabId) {
    // 隐藏所有标签页内容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 显示选中的标签页
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // 更新页面标题
    updatePageTitle(tabId);
    
    // 加载对应页面的数据
    loadTabData(tabId);
}

// 更新页面标题
function updatePageTitle(tabId) {
    const titles = {
        'dashboard': '控制台',
        'inbound': '入库管理',
        'outbound': '出库管理',
        'inventory': '库存管理',
        'orders': '订单管理',
        'tracking': '物流跟踪',
        'reports': '报表统计',
        'settings': '系统设置'
    };
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle && titles[tabId]) {
        pageTitle.textContent = titles[tabId];
    }
}

// 加载标签页数据
function loadTabData(tabId) {
    switch(tabId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'inbound':
            loadInboundData();
            break;
        case 'outbound':
            loadOutboundData();
            break;
        case 'inventory':
            loadInventoryData();
            break;
        case 'orders':
            loadOrdersData();
            break;
        case 'tracking':
            loadTrackingData();
            break;
        case 'reports':
            loadReportsData();
            break;
        case 'settings':
            loadSettingsData();
            break;
    }
}

// 加载控制台数据
function loadDashboardData() {
    // 模拟加载统计数据
    updateStatCards();
    loadRecentActivities();
}

// 更新统计卡片
function updateStatCards() {
    // 这里可以添加实时数据更新逻辑
    console.log('更新统计卡片数据');
}

// 加载最近活动
function loadRecentActivities() {
    // 模拟加载最近活动数据
    console.log('加载最近活动数据');
}

// 入库管理功能
function loadInboundData() {
    // 加载入库数据
    console.log('加载入库数据');
}

// 出库管理功能
function loadOutboundData() {
    // 加载出库数据
    console.log('加载出库数据');
}

// 库存管理功能
function loadInventoryData() {
    // 加载库存数据
    console.log('加载库存数据');
}

// 订单管理功能
function loadOrdersData() {
    // 加载订单数据
    console.log('加载订单数据');
}

// 物流跟踪功能
function loadTrackingData() {
    // 加载跟踪数据
    console.log('加载跟踪数据');
}

// 报表统计功能
function loadReportsData() {
    // 加载报表数据
    console.log('加载报表数据');
    initializeCharts();
}

// 系统设置功能
function loadSettingsData() {
    // 加载设置数据
    console.log('加载设置数据');
}

// 初始化图表
function initializeCharts() {
    // 这里可以集成Chart.js或其他图表库
    console.log('初始化图表');
}

// 显示模态框
function showModal(modalType) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    // 根据模态框类型设置内容和标题
    switch(modalType) {
        case 'inbound-modal':
            modalTitle.textContent = '新建入库';
            modalBody.innerHTML = createInboundForm();
            break;
        case 'outbound-modal':
            modalTitle.textContent = '新建出库';
            modalBody.innerHTML = createOutboundForm();
            break;
        case 'order-modal':
            modalTitle.textContent = '新建订单';
            modalBody.innerHTML = createOrderForm();
            break;
        case 'tracking-modal':
            modalTitle.textContent = '物流跟踪';
            modalBody.innerHTML = createTrackingForm();
            break;
        case 'inventory-modal':
            modalTitle.textContent = '添加商品';
            modalBody.innerHTML = createInventoryForm();
            break;
    }
    
    modal.style.display = 'block';
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 创建入库表单
function createInboundForm() {
    return `
        <form id="inbound-form" onsubmit="submitInbound(event)">
            <div class="form-grid">
                <div class="form-group">
                    <label>供应商</label>
                    <input type="text" name="supplier" required>
                </div>
                <div class="form-group">
                    <label>入库单号</label>
                    <input type="text" name="inboundNumber" required>
                </div>
                <div class="form-group">
                    <label>商品名称</label>
                    <input type="text" name="productName" required>
                </div>
                <div class="form-group">
                    <label>商品数量</label>
                    <input type="number" name="quantity" required>
                </div>
                <div class="form-group">
                    <label>商品分类</label>
                    <select name="category" required>
                        <option value="">选择分类</option>
                        <option value="electronics">电子产品</option>
                        <option value="clothing">服装</option>
                        <option value="food">食品</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>入库时间</label>
                    <input type="datetime-local" name="inboundTime" required>
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" rows="3"></textarea>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">确认入库</button>
            </div>
        </form>
    `;
}

// 创建出库表单
function createOutboundForm() {
    return `
        <form id="outbound-form" onsubmit="submitOutbound(event)">
            <div class="form-grid">
                <div class="form-group">
                    <label>客户</label>
                    <input type="text" name="customer" required>
                </div>
                <div class="form-group">
                    <label>出库单号</label>
                    <input type="text" name="outboundNumber" required>
                </div>
                <div class="form-group">
                    <label>商品名称</label>
                    <input type="text" name="productName" required>
                </div>
                <div class="form-group">
                    <label>商品数量</label>
                    <input type="number" name="quantity" required>
                </div>
                <div class="form-group">
                    <label>目的地</label>
                    <input type="text" name="destination" required>
                </div>
                <div class="form-group">
                    <label>出库时间</label>
                    <input type="datetime-local" name="outboundTime" required>
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" rows="3"></textarea>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">确认出库</button>
            </div>
        </form>
    `;
}

// 创建订单表单
function createOrderForm() {
    return `
        <form id="order-form" onsubmit="submitOrder(event)">
            <div class="form-grid">
                <div class="form-group">
                    <label>客户名称</label>
                    <input type="text" name="customerName" required>
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
                    <label>商品数量</label>
                    <input type="number" name="quantity" required>
                </div>
                <div class="form-group">
                    <label>收货地址</label>
                    <input type="text" name="address" required>
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
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" rows="3"></textarea>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">创建订单</button>
            </div>
        </form>
    `;
}

// 创建跟踪表单
function createTrackingForm() {
    return `
        <div class="tracking-form">
            <div class="form-group">
                <label>跟踪号</label>
                <input type="text" id="tracking-number" placeholder="请输入跟踪号">
            </div>
            <div class="form-group">
                <label>订单号</label>
                <input type="text" id="order-number" placeholder="请输入订单号">
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="button" class="btn btn-primary" onclick="searchTracking()">搜索</button>
            </div>
        </div>
    `;
}

// 创建库存表单
function createInventoryForm() {
    return `
        <form id="inventory-form" onsubmit="submitInventory(event)">
            <div class="form-grid">
                <div class="form-group">
                    <label>商品编码</label>
                    <input type="text" name="sku" required>
                </div>
                <div class="form-group">
                    <label>商品名称</label>
                    <input type="text" name="productName" required>
                </div>
                <div class="form-group">
                    <label>商品分类</label>
                    <select name="category" required>
                        <option value="">选择分类</option>
                        <option value="electronics">电子产品</option>
                        <option value="clothing">服装</option>
                        <option value="food">食品</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>初始库存</label>
                    <input type="number" name="initialStock" required>
                </div>
                <div class="form-group">
                    <label>安全库存</label>
                    <input type="number" name="safetyStock" required>
                </div>
                <div class="form-group">
                    <label>单位</label>
                    <input type="text" name="unit" required>
                </div>
            </div>
            <div class="form-group">
                <label>商品描述</label>
                <textarea name="description" rows="3"></textarea>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">添加商品</button>
            </div>
        </form>
    `;
}

// 提交入库表单
function submitInbound(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // 模拟提交数据
    console.log('入库数据:', data);
    
    // 显示成功消息
    showNotification('入库单创建成功！', 'success');
    closeModal();
    
    // 刷新入库列表
    loadInboundData();
}

// 提交出库表单
function submitOutbound(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // 模拟提交数据
    console.log('出库数据:', data);
    
    // 显示成功消息
    showNotification('出库单创建成功！', 'success');
    closeModal();
    
    // 刷新出库列表
    loadOutboundData();
}

// 提交订单表单
function submitOrder(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // 模拟提交数据
    console.log('订单数据:', data);
    
    // 显示成功消息
    showNotification('订单创建成功！', 'success');
    closeModal();
    
    // 刷新订单列表
    loadOrdersData();
}

// 提交库存表单
function submitInventory(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // 模拟提交数据
    console.log('库存数据:', data);
    
    // 显示成功消息
    showNotification('商品添加成功！', 'success');
    closeModal();
    
    // 刷新库存列表
    loadInventoryData();
}

// 搜索跟踪
function searchTracking() {
    const trackingNumber = document.getElementById('tracking-number')?.value;
    const orderNumber = document.getElementById('order-number')?.value;
    
    if (!trackingNumber && !orderNumber) {
        showNotification('请输入跟踪号或订单号', 'error');
        return;
    }
    
    // 模拟搜索
    console.log('搜索跟踪:', { trackingNumber, orderNumber });
    
    // 显示搜索结果
    showNotification('搜索完成', 'success');
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 切换侧边栏
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

// 退出登录
function logout() {
    localStorage.removeItem('adminLoggedIn');
    window.location.href = 'index.html';
}

// 执行搜索
function performSearch(query) {
    console.log('执行搜索:', query);
    // 实现搜索逻辑
}

function buildPagination(elId, page, pageSize, total, onPage) {
  const el = document.getElementById(elId);
  if (!el) return;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const prev = Math.max(1, page - 1);
  const next = Math.min(pages, page + 1);
  el.innerHTML = `
    <button class="btn btn-small" ${page===1?'disabled':''} onclick="${onPage}(${prev})">上一页</button>
    <span style="padding:0 8px;">第 ${page} / ${pages} 页，共 ${total} 条</span>
    <button class="btn btn-small" ${page===pages?'disabled':''} onclick="${onPage}(${next})">下一页</button>
  `;
}

// 入库
let inboundPage = 1, inboundPageSize = 10;
let inboundSort = 'created_at DESC';
function setInboundPageSize(v){ inboundPageSize = parseInt(v,10)||10; filterInbound(1); }
function sortInbound(field){ inboundSort = field + (inboundSort.includes('DESC')?' ASC':' DESC'); filterInbound(); }
function loadInboundData(){
  const search = document.getElementById('inbound-search')?.value || '';
  const status = document.getElementById('inbound-status-filter')?.value || '';
  const startDate = document.getElementById('inbound-date-start')?.value || '';
  const endDate = document.getElementById('inbound-date-end')?.value || '';
  const qs = new URLSearchParams({ page: inboundPage, pageSize: inboundPageSize, search, status, startDate, endDate, sort: inboundSort }).toString();
  fetch(`/api/admin/inbound?${qs}`, { headers: authHeader() })
    .then(r=>r.json()).then(d=>{
      const tbody = document.getElementById('inbound-table-body');
      tbody.innerHTML = (d.rows||[]).map(r => `
        <tr>
          <td><input type="checkbox" class="row-select" value="${r.inbound_number||''}"></td>
          <td>${r.inbound_number||''}</td>
          <td>${r.supplier||''}</td>
          <td>${r.quantity||''}</td>
          <td>${r.created_at||''}</td>
          <td><span class="status-badge ${r.status||''}">${r.status||''}</span></td>
          <td>
            <button class="btn btn-small" onclick="viewInbound('${r.inbound_number||''}')">查看</button>
          </td>
        </tr>`).join('');
      buildPagination('inbound-pagination', d.page, d.pageSize, d.total, 'filterInbound');
    });
}

// 出库
let outboundPage = 1, outboundPageSize = 10;
let outboundSort = 'created_at DESC';
function setOutboundPageSize(v){ outboundPageSize = parseInt(v,10)||10; filterOutbound(1); }
function sortOutbound(field){ outboundSort = field + (outboundSort.includes('DESC')?' ASC':' DESC'); filterOutbound(); }
function loadOutboundData(){
  const search = document.getElementById('outbound-search')?.value || '';
  const status = document.getElementById('outbound-status-filter')?.value || '';
  const startDate = document.getElementById('outbound-date-start')?.value || '';
  const endDate = document.getElementById('outbound-date-end')?.value || '';
  const qs = new URLSearchParams({ page: outboundPage, pageSize: outboundPageSize, search, status, startDate, endDate, sort: outboundSort }).toString();
  fetch(`/api/admin/outbound?${qs}`, { headers: authHeader() })
    .then(r=>r.json()).then(d=>{
      const tbody = document.getElementById('outbound-table-body');
      tbody.innerHTML = (d.rows||[]).map(r => `
        <tr>
          <td><input type="checkbox" class="row-select" value="${r.outbound_number||''}"></td>
          <td>${r.outbound_number||''}</td>
          <td>${r.customer||''}</td>
          <td>${r.quantity||''}</td>
          <td>${r.created_at||''}</td>
          <td><span class="status-badge ${r.status||''}">${r.status||''}</span></td>
          <td>
            <button class="btn btn-small" onclick="viewOutbound('${r.outbound_number||''}')">查看</button>
          </td>
        </tr>`).join('');
      buildPagination('outbound-pagination', d.page, d.pageSize, d.total, 'filterOutbound');
    });
}

// 库存
let inventoryPage = 1, inventoryPageSize = 10;
let inventorySort = 'p.created_at DESC';
function setInventoryPageSize(v){ inventoryPageSize = parseInt(v,10)||10; filterInventory(1); }
function sortInventory(field){ inventorySort = field + (inventorySort.includes('DESC')?' ASC':' DESC'); filterInventory(); }
function loadInventoryData(){
  const search = document.getElementById('inventory-search')?.value || '';
  const category = document.getElementById('inventory-category-filter')?.value || '';
  const qs = new URLSearchParams({ page: inventoryPage, pageSize: inventoryPageSize, search, category, sort: inventorySort }).toString();
  fetch(`/api/admin/inventory?${qs}`, { headers: authHeader() })
    .then(r=>r.json()).then(d=>{
      const tbody = document.getElementById('inventory-table-body');
      tbody.innerHTML = (d.rows||[]).map(r => `
        <tr>
          <td><input type="checkbox" class="row-select" value="${r.sku||''}"></td>
          <td>${r.sku||''}</td>
          <td>${r.name||''}</td>
          <td>${r.category||''}</td>
          <td>${r.current_stock||0}</td>
          <td>${r.safety_stock||0}</td>
          <td><span class="status-badge ${r.stock_status||''}">${r.stock_status||''}</span></td>
          <td>
            <button class="btn btn-small" onclick="viewInventory('${r.sku||''}')">查看</button>
          </td>
        </tr>`).join('');
      buildPagination('inventory-pagination', d.page, d.pageSize, d.total, 'filterInventory');
    });
}

// 订单
let ordersPage = 1, ordersPageSize = 10;
let ordersSort = 'created_at DESC';
function setOrdersPageSize(v){ ordersPageSize = parseInt(v,10)||10; filterOrders(1); }
function sortOrders(field){ ordersSort = field + (ordersSort.includes('DESC')?' ASC':' DESC'); filterOrders(); }
function loadOrdersData(){
  const search = document.getElementById('orders-search')?.value || '';
  const status = document.getElementById('order-status-filter')?.value || '';
  const startDate = document.getElementById('order-date-start')?.value || '';
  const endDate = document.getElementById('order-date-end')?.value || '';
  const qs = new URLSearchParams({ page: ordersPage, pageSize: ordersPageSize, search, status, startDate, endDate, sort: ordersSort }).toString();
  fetch(`/api/admin/orders?${qs}`, { headers: authHeader() })
    .then(r=>r.json()).then(d=>{
      const tbody = document.getElementById('orders-table-body');
      tbody.innerHTML = (d.rows||[]).map(r => `
        <tr>
          <td><input type="checkbox" class="row-select" value="${r.order_number||''}"></td>
          <td>${r.order_number||''}</td>
          <td>${r.customer_name||''}</td>
          <td>${r.service_type||''}</td>
          <td>${r.total_weight||0}</td>
          <td>¥${r.total_amount||0}</td>
          <td><span class="status-badge ${r.status||''}">${r.status||''}</span></td>
          <td>
            <button class="btn btn-small" onclick="viewOrder('${r.order_number||''}')">查看</button>
          </td>
        </tr>`).join('');
      buildPagination('orders-pagination', d.page, d.pageSize, d.total, 'filterOrders');
    });
}

function authHeader(){
  const token = localStorage.getItem('adminToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// 初始化加载默认tab的数据
// dashboard默认已有
// 其它tab在切换时调用loadTabData，会触发上述加载
// 查看入库详情
function viewInbound(id) {
    console.log('查看入库详情:', id);
    // 实现查看详情逻辑
}

// 编辑入库
function editInbound(id) {
    console.log('编辑入库:', id);
    // 实现编辑逻辑
}

// 查看出库详情
function viewOutbound(id) {
    console.log('查看出库详情:', id);
    // 实现查看详情逻辑
}

// 编辑出库
function editOutbound(id) {
    console.log('编辑出库:', id);
    // 实现编辑逻辑
}

// 查看库存详情
function viewInventory(id) {
    console.log('查看库存详情:', id);
    // 实现查看详情逻辑
}

// 编辑库存
function editInventory(id) {
    console.log('编辑库存:', id);
    // 实现编辑逻辑
}

// 查看订单详情
function viewOrder(id) {
    console.log('查看订单详情:', id);
    // 实现查看详情逻辑
}

// 编辑订单
function editOrder(id) {
    console.log('编辑订单:', id);
    // 实现编辑逻辑
}

// 导出报表
function exportReport() {
    console.log('导出报表');
    showNotification('报表导出中...', 'info');
}

// 生成报表
function generateReport() {
    console.log('生成报表');
    showNotification('报表生成中...', 'info');
} 

function toggleSelectAll(prefix){
  const all = document.getElementById(`${prefix}-select-all`).checked;
  document.querySelectorAll(`#${prefix}-table-body input[type=checkbox].row-select`).forEach(cb=>cb.checked=all);
}
function collectSelected(prefix){
  const ids = [];
  document.querySelectorAll(`#${prefix}-table-body input[type=checkbox].row-select:checked`).forEach(cb=>ids.push(cb.value));
  return ids;
}
function exportCsvRows(filename, rows){
  if (!rows.length) return alert('请选择要导出的行');
  const headers = Object.keys(rows[0]);
  const escape = s => {
    if (s == null) return '';
    const v = String(s).replace(/"/g,'""');
    return /[",\n]/.test(v) ? `"${v}"` : v;
  };
  const csv = [headers.join(',')].concat(rows.map(r=>headers.map(h=>escape(r[h])).join(','))).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}

function exportInboundSelected(){
  const ids = collectSelected('inbound');
  const tbody = document.getElementById('inbound-table-body');
  const rows = []; tbody.querySelectorAll('tr').forEach(tr=>{
    const cb = tr.querySelector('input.row-select');
    if (cb && cb.checked){
      const tds = tr.querySelectorAll('td');
      rows.push({ inbound_number: tds[1].innerText, supplier: tds[2].innerText, quantity: tds[3].innerText, created_at: tds[4].innerText, status: tds[5].innerText });
    }
  });
  exportCsvRows('inbound-selected.csv', rows);
}
function exportOutboundSelected(){
  const tbody = document.getElementById('outbound-table-body');
  const rows = []; tbody.querySelectorAll('tr').forEach(tr=>{
    const cb = tr.querySelector('input.row-select');
    if (cb && cb.checked){ const tds=tr.querySelectorAll('td'); rows.push({ outbound_number: tds[1].innerText, customer: tds[2].innerText, quantity: tds[3].innerText, created_at: tds[4].innerText, status: tds[5].innerText }); }
  });
  exportCsvRows('outbound-selected.csv', rows);
}
function exportInventorySelected(){
  const tbody = document.getElementById('inventory-table-body');
  const rows = []; tbody.querySelectorAll('tr').forEach(tr=>{
    const cb = tr.querySelector('input.row-select');
    if (cb && cb.checked){ const tds=tr.querySelectorAll('td'); rows.push({ sku: tds[1].innerText, name: tds[2].innerText, category: tds[3].innerText, current_stock: tds[4].innerText, safety_stock: tds[5].innerText, status: tds[6].innerText }); }
  });
  exportCsvRows('inventory-selected.csv', rows);
}
function exportOrdersSelected(){
  const tbody = document.getElementById('orders-table-body');
  const rows = []; tbody.querySelectorAll('tr').forEach(tr=>{
    const cb = tr.querySelector('input.row-select');
    if (cb && cb.checked){ const tds=tr.querySelectorAll('td'); rows.push({ order_number: tds[1].innerText, customer_name: tds[2].innerText, service_type: tds[3].innerText, total_weight: tds[4].innerText, total_amount: tds[5].innerText, status: tds[7]?.innerText || '' }); }
  });
  exportCsvRows('orders-selected.csv', rows);
}

// 修改各渲染函数，加入checkbox列
// 入库渲染处：
// tbody.innerHTML = rows.map(r => `<tr> <td><input type="checkbox" class="row-select" value="${r.inbound_number||''}"></td> ...`).join('')
// 出库/库存/订单同理
// 为避免重复，这里直接覆写渲染体

// 覆写渲染（入库）
function renderInboundRows(d){
  const tbody = document.getElementById('inbound-table-body');
  tbody.innerHTML = (d.rows||[]).map(r=>`
    <tr>
      <td><input type="checkbox" class="row-select" value="${r.inbound_number||''}"></td>
      <td>${r.inbound_number||''}</td>
      <td>${r.supplier||''}</td>
      <td>${r.quantity||''}</td>
      <td>${r.created_at||''}</td>
      <td><span class="status-badge ${r.status||''}">${r.status||''}</span></td>
      <td><button class="btn btn-small" onclick="viewInbound('${r.inbound_number||''}')">查看</button></td>
    </tr>`).join('');
  buildPagination('inbound-pagination', d.page, d.pageSize, d.total, 'filterInbound');
}
// 覆写渲染（出库）
function renderOutboundRows(d){
  const tbody = document.getElementById('outbound-table-body');
  tbody.innerHTML = (d.rows||[]).map(r=>`
    <tr>
      <td><input type="checkbox" class="row-select" value="${r.outbound_number||''}"></td>
      <td>${r.outbound_number||''}</td>
      <td>${r.customer||''}</td>
      <td>${r.quantity||''}</td>
      <td>${r.created_at||''}</td>
      <td><span class="status-badge ${r.status||''}">${r.status||''}</span></td>
      <td><button class="btn btn-small" onclick="viewOutbound('${r.outbound_number||''}')">查看</button></td>
    </tr>`).join('');
  buildPagination('outbound-pagination', d.page, d.pageSize, d.total, 'filterOutbound');
}
// 覆写渲染（库存）
function renderInventoryRows(d){
  const tbody = document.getElementById('inventory-table-body');
  tbody.innerHTML = (d.rows||[]).map(r=>`
    <tr>
      <td><input type="checkbox" class="row-select" value="${r.sku||''}"></td>
      <td>${r.sku||''}</td>
      <td>${r.name||''}</td>
      <td>${r.category||''}</td>
      <td>${r.current_stock||0}</td>
      <td>${r.safety_stock||0}</td>
      <td><span class="status-badge ${r.stock_status||''}">${r.stock_status||''}</span></td>
      <td><button class="btn btn-small" onclick="viewInventory('${r.sku||''}')">查看</button></td>
    </tr>`).join('');
  buildPagination('inventory-pagination', d.page, d.pageSize, d.total, 'filterInventory');
}
// 覆写渲染（订单）
function renderOrdersRows(d){
  const tbody = document.getElementById('orders-table-body');
  tbody.innerHTML = (d.rows||[]).map(r=>`
    <tr>
      <td><input type="checkbox" class="row-select" value="${r.order_number||''}"></td>
      <td>${r.order_number||''}</td>
      <td>${r.customer_name||''}</td>
      <td>${r.service_type||''}</td>
      <td>${r.total_weight||0}</td>
      <td>¥${r.total_amount||0}</td>
      <td><span class="status-badge ${r.status||''}">${r.status||''}</span></td>
      <td><button class="btn btn-small" onclick="viewOrder('${r.order_number||''}')">查看</button></td>
    </tr>`).join('');
  buildPagination('orders-pagination', d.page, d.pageSize, d.total, 'filterOrders');
} 