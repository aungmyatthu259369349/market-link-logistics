const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const config = require('./config');
const db = require('./db-adapter');

const app = express();

// 安全中间件
app.use(helmet());
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

// 压缩
app.use(compression());

// CORS 白名单
const whitelist = (process.env.ORIGIN_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || whitelist.length === 0 || whitelist.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  }
}));

// 解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态资源（带缓存）
app.use(express.static('./', { maxAge: '7d', etag: true }));

// 健康检查 & 版本
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
app.get('/api/version', (req, res) => {
  res.json({ version: process.env.RENDER_GIT_COMMIT || 'dev', driver: db.isPg ? 'pg' : 'sqlite' });
});

// 认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '需要认证令牌' });
  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '无效的令牌' });
    req.user = user; next();
  });
};
const requireAdmin = (req, res, next) => { if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' }); next(); };

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === config.ADMIN.USERNAME && password === config.ADMIN.PASSWORD) {
    const adminUser = { id: 0, username, email: config.ADMIN.EMAIL, role: 'admin' };
    const token = jwt.sign({ id: 0, username, role: 'admin' }, config.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token, user: adminUser });
  }
  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    const valid = await bcrypt.compare(password, user.password).catch(() => false);
    if (!valid) return res.status(401).json({ error: '用户名或密码错误' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, config.JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role, company_name: user.company_name, contact_name: user.contact_name } });
  });
});

// 注册
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, company_name, contact_name, phone } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (username, email, password, company_name, contact_name, phone) VALUES (?, ?, ?, ?, ?, ?)';
    db.insert(sql, [username, email, hashed, company_name, contact_name, phone], (err) => {
      if (err) {
        if (/UNIQUE|duplicate/i.test(String(err.message))) return res.status(400).json({ error: '用户名或邮箱已存在' });
        return res.status(500).json({ error: '注册失败' });
      }
      res.json({ success: true });
    });
  } catch {
    res.status(500).json({ error: '注册失败' });
  }
});

// 跟踪
app.get('/api/tracking/:trackingNumber', (req, res) => {
  const { trackingNumber } = req.params;
  const sql = `SELECT t.*, tu.status, tu.location, tu.update_time, tu.notes
               FROM tracking t LEFT JOIN tracking_updates tu ON t.id = tu.tracking_id
               WHERE t.tracking_number = ? ORDER BY tu.update_time DESC LIMIT 1`;
  db.get(sql, [trackingNumber], (err, result) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (!result) return res.status(404).json({ error: '未找到该跟踪号' });
    db.all(`SELECT status, location, update_time, notes FROM tracking_updates WHERE tracking_id = (SELECT id FROM tracking WHERE tracking_number = ?) ORDER BY update_time DESC`, [trackingNumber], (e2, updates) => {
      if (e2) updates = [];
      res.json({ tracking_number: result.tracking_number, status: result.current_status, location: result.current_location, estimated_delivery: result.estimated_delivery, updates: updates || [] });
    });
  });
});

// 价格
app.post('/api/calculate-price', (req, res) => {
  const { origin, destination, weight, serviceType } = req.body;
  if (!origin || !destination || !weight || !serviceType) return res.status(400).json({ error: '请填写所有必填信息' });
  let base = weight * 2, multi = serviceType === 'express' ? 1.5 : serviceType === 'premium' ? 2 : 1;
  const total = base * multi;
  const eta = serviceType === 'express' ? '1-2天' : serviceType === 'premium' ? '24小时内' : '3-5天';
  res.json({ origin, destination, weight, serviceType, totalPrice: total.toFixed(2), estimatedTime: eta });
});

// 管理员统计
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  const stats = {};
  db.get('SELECT SUM(current_stock) as total_inventory FROM inventory', [], (e, r) => {
    stats.totalInventory = r ? r.total_inventory || 0 : 0;
    db.get(`SELECT COUNT(*) as today_inbound FROM inbound_records WHERE DATE(created_at) = DATE('now')`, [], (e2, r2) => {
      stats.todayInbound = r2 ? r2.today_inbound || 0 : 0;
      db.get(`SELECT COUNT(*) as today_outbound FROM outbound_records WHERE DATE(created_at) = DATE('now')`, [], (e3, r3) => {
        stats.todayOutbound = r3 ? r3.today_outbound || 0 : 0;
        db.get(`SELECT COUNT(*) as in_transit FROM orders WHERE status IN ('processing', 'shipped')`, [], (e4, r4) => {
          stats.inTransit = r4 ? r4.in_transit || 0 : 0;
          res.json(stats);
        });
      });
    });
  });
});

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '10', 10)));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function sendCsv(res, filename, rows) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => escape(r[h])).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(csv);
}

function sanitizeSort(input, whitelist, defaultSort){
  if(!input) return defaultSort;
  const [field, dir] = input.split(/\s+/);
  if (!whitelist.includes(field)) return defaultSort;
  const d = (dir||'DESC').toUpperCase()==='ASC' ? 'ASC' : 'DESC';
  return `${field} ${d}`;
}

function buildInPlaceholders(arr){ return arr.map(()=>'?').join(','); }

// 入库列表：分页/搜索/导出
app.get('/api/admin/inbound', authenticateToken, requireAdmin, (req, res) => {
  const { search = '', status = '', startDate = '', endDate = '', export: exp, sort, scope = '' } = req.query;
  const { page, pageSize, offset } = parsePagination(req);
  const where = []; const params = [];
  if (search) { where.push('(ir.inbound_number LIKE ? OR p.name LIKE ? OR p.sku LIKE ? OR ir.supplier LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (status) { where.push('ir.status = ?'); params.push(status); }
  if (startDate) { where.push('ir.created_at >= ?'); params.push(startDate); }
  if (endDate) { where.push('ir.created_at <= ?'); params.push(endDate); }
  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const orderBy = sanitizeSort(sort, ['inbound_number','supplier','quantity','created_at','status'], 'created_at DESC');
  const baseSql = `SELECT ir.inbound_number, ir.supplier, ir.quantity, ir.created_at, ir.status, p.name as product_name, p.sku
                   FROM inbound_records ir LEFT JOIN products p ON ir.product_id = p.id ${whereSql} ORDER BY ${orderBy}`;
  const pagedSql = `${baseSql} LIMIT ? OFFSET ?`;
  const runSql = (exp === 'csv' && scope === 'page') ? pagedSql : baseSql;
  const runParams = (exp === 'csv' && scope === 'page') ? params.concat([pageSize, offset]) : params;
  db.all(runSql, runParams, (err, rows) => {
    if (err) return res.status(500).json({ error: '获取入库记录失败' });
    if (exp === 'csv') return sendCsv(res, 'inbound.csv', rows);
    db.get(`SELECT COUNT(1) as cnt FROM inbound_records ir LEFT JOIN products p ON ir.product_id = p.id ${whereSql}`, params, (e2, r2) => {
      const total = r2 ? r2.cnt || 0 : 0;
      res.json({ page, pageSize, total, rows });
    });
  });
});

// 批量操作：入库
app.post('/api/admin/inbound/batch-status', authenticateToken, requireAdmin, (req, res) => {
  const { ids = [], status } = req.body || {};
  if (!ids.length || !status) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`UPDATE inbound_records SET status = ? WHERE inbound_number IN (${placeholders})`, [status, ...ids], (err)=>{
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ success: true });
  });
});
app.post('/api/admin/inbound/batch-delete', authenticateToken, requireAdmin, (req, res) => {
  const { ids = [] } = req.body || {};
  if (!ids.length) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`DELETE FROM inbound_records WHERE inbound_number IN (${placeholders})`, ids, (err)=>{
    if (err) return res.status(500).json({ error: '删除失败' });
    res.json({ success: true });
  });
});

// 出库列表
app.get('/api/admin/outbound', authenticateToken, requireAdmin, (req, res) => {
  const { search = '', status = '', startDate = '', endDate = '', export: exp, sort, scope = '' } = req.query;
  const { page, pageSize, offset } = parsePagination(req);
  const where = []; const params = [];
  if (search) { where.push('(ob.outbound_number LIKE ? OR p.name LIKE ? OR ob.customer LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (status) { where.push('ob.status = ?'); params.push(status); }
  if (startDate) { where.push('ob.created_at >= ?'); params.push(startDate); }
  if (endDate) { where.push('ob.created_at <= ?'); params.push(endDate); }
  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const orderBy = sanitizeSort(sort, ['outbound_number','customer','quantity','created_at','status'], 'created_at DESC');
  const baseSql = `SELECT ob.outbound_number, ob.customer, ob.quantity, ob.created_at, ob.status, p.name as product_name, p.sku
                   FROM outbound_records ob LEFT JOIN products p ON ob.product_id = p.id ${whereSql} ORDER BY ${orderBy}`;
  const pagedSql = `${baseSql} LIMIT ? OFFSET ?`;
  const runSql = (exp === 'csv' && scope === 'page') ? pagedSql : baseSql;
  const runParams = (exp === 'csv' && scope === 'page') ? params.concat([pageSize, offset]) : params;
  db.all(runSql, runParams, (err, rows) => {
    if (err) return res.status(500).json({ error: '获取出库记录失败' });
    if (exp === 'csv') return sendCsv(res, 'outbound.csv', rows);
    db.get(`SELECT COUNT(1) as cnt FROM outbound_records ob LEFT JOIN products p ON ob.product_id = p.id ${whereSql}`, params, (e2, r2) => {
      const total = r2 ? r2.cnt || 0 : 0;
      res.json({ page, pageSize, total, rows });
    });
  });
});

// 批量操作：出库
app.post('/api/admin/outbound/batch-status', authenticateToken, requireAdmin, (req, res) => {
  const { ids = [], status } = req.body || {};
  if (!ids.length || !status) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`UPDATE outbound_records SET status = ? WHERE outbound_number IN (${placeholders})`, [status, ...ids], (err)=>{
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ success: true });
  });
});
app.post('/api/admin/outbound/batch-delete', authenticateToken, requireAdmin, (req, res) => {
  const { ids = [] } = req.body || {};
  if (!ids.length) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`DELETE FROM outbound_records WHERE outbound_number IN (${placeholders})`, ids, (err)=>{
    if (err) return res.status(500).json({ error: '删除失败' });
    res.json({ success: true });
  });
});

// 库存列表
app.get('/api/admin/inventory', authenticateToken, requireAdmin, (req, res) => {
  const { search = '', category = '', export: exp, sort, scope = '' } = req.query;
  const { page, pageSize, offset } = parsePagination(req);
  const where = []; const params = [];
  if (search) { where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (category) { where.push('p.category = ?'); params.push(category); }
  const orderBy = sanitizeSort(sort, ['p.sku','p.name','p.category','i.current_stock','p.safety_stock','stock_status','p.created_at'], 'p.created_at DESC');
  const baseSql = `SELECT p.sku, p.name, p.category, p.safety_stock, i.current_stock, i.available_stock, i.reserved_stock, i.last_updated,
                  CASE WHEN i.current_stock > p.safety_stock THEN 'in-stock' WHEN i.current_stock > 0 THEN 'low-stock' ELSE 'out-of-stock' END as stock_status
                  FROM products p LEFT JOIN inventory i ON p.id = i.product_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                  ORDER BY ${orderBy}`;
  const pagedSql = `${baseSql} LIMIT ? OFFSET ?`;
  const runSql = (exp === 'csv' && scope === 'page') ? pagedSql : baseSql;
  const runParams = (exp === 'csv' && scope === 'page') ? params.concat([pageSize, offset]) : params;
  db.all(runSql, runParams, (err, rows) => {
    if (err) return res.status(500).json({ error: '获取库存信息失败' });
    if (exp === 'csv') return sendCsv(res, 'inventory.csv', rows);
    db.get(`SELECT COUNT(1) as cnt FROM products p LEFT JOIN inventory i ON p.id = i.product_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`, params, (e2, r2) => {
      const total = r2 ? r2.cnt || 0 : 0;
      res.json({ page, pageSize, total, rows });
    });
  });
});

// 订单列表
app.get('/api/admin/orders', authenticateToken, requireAdmin, (req, res) => {
  const { search = '', status = '', startDate = '', endDate = '', export: exp, sort, scope = '' } = req.query;
  const { page, pageSize, offset } = parsePagination(req);
  const where = []; const params = [];
  if (search) { where.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.customer_address LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (status) { where.push('o.status = ?'); params.push(status); }
  if (startDate) { where.push('o.created_at >= ?'); params.push(startDate); }
  if (endDate) { where.push('o.created_at <= ?'); params.push(endDate); }
  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const orderBy = sanitizeSort(sort, ['order_number','customer_name','total_weight','total_amount','service_type','created_at','status'], 'created_at DESC');
  const baseSql = `SELECT o.order_number, o.customer_name, o.total_weight, o.total_amount, o.service_type, o.status, o.created_at
                   FROM orders o ${whereSql} ORDER BY ${orderBy}`;
  const pagedSql = `${baseSql} LIMIT ? OFFSET ?`;
  const runSql = (exp === 'csv' && scope === 'page') ? pagedSql : baseSql;
  const runParams = (exp === 'csv' && scope === 'page') ? params.concat([pageSize, offset]) : params;
  db.all(runSql, runParams, (err, rows) => {
    if (err) return res.status(500).json({ error: '获取订单失败' });
    if (exp === 'csv') return sendCsv(res, 'orders.csv', rows);
    db.get(`SELECT COUNT(1) as cnt FROM orders o ${whereSql}`, params, (e2, r2) => {
      const total = r2 ? r2.cnt || 0 : 0;
      res.json({ page, pageSize, total, rows });
    });
  });
});

// 批量操作：订单
app.post('/api/admin/orders/batch-status', authenticateToken, requireAdmin, (req, res) => {
  const { ids = [], status } = req.body || {};
  if (!ids.length || !status) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`UPDATE orders SET status = ? WHERE order_number IN (${placeholders})`, [status, ...ids], (err)=>{
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ success: true });
  });
});
app.post('/api/admin/orders/batch-delete', authenticateToken, requireAdmin, (req, res) => {
  const { ids = [] } = req.body || {};
  if (!ids.length) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`DELETE FROM orders WHERE order_number IN (${placeholders})`, ids, (err)=>{
    if (err) return res.status(500).json({ error: '删除失败' });
    res.json({ success: true });
  });
});

// 忘记密码/重置密码
app.post('/api/auth/forgot', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: '请输入邮箱' });
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!user) return res.json({ success: true });
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.run('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expiresAt], (e2) => {
      if (e2) return res.status(500).json({ error: '服务器错误' });
      return res.json({ success: true, token });
    });
  });
});
app.get('/api/auth/reset/:token', (req, res) => {
  const { token } = req.params;
  db.get('SELECT pr.user_id, pr.expires_at, u.email FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE pr.token = ?', [token], (err, row) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!row) return res.status(404).json({ error: '链接无效' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: '链接已过期' });
    res.json({ success: true, email: row.email });
  });
});
app.post('/api/auth/reset/:token', async (req, res) => {
  const { token } = req.params; const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: '密码至少6位' });
  db.get('SELECT user_id, expires_at FROM password_resets WHERE token = ?', [token], async (err, row) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!row) return res.status(404).json({ error: '链接无效' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: '链接已过期' });
    const hashed = await bcrypt.hash(password, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, row.user_id], (e2) => {
      if (e2) return res.status(500).json({ error: '服务器错误' });
      db.run('DELETE FROM password_resets WHERE token = ?', [token], () => res.json({ success: true }));
    });
  });
});

// 详情接口
app.get('/api/admin/inbound/:inboundNumber', authenticateToken, requireAdmin, (req, res) => {
  const id = req.params.inboundNumber;
  const sql = `SELECT ir.*, p.name as product_name, p.sku FROM inbound_records ir LEFT JOIN products p ON p.id = ir.product_id WHERE ir.inbound_number = ?`;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!row) return res.status(404).json({ error: '未找到记录' });
    res.json(row);
  });
});

app.get('/api/admin/outbound/:outboundNumber', authenticateToken, requireAdmin, (req, res) => {
  const id = req.params.outboundNumber;
  const sql = `SELECT ob.*, p.name as product_name, p.sku FROM outbound_records ob LEFT JOIN products p ON p.id = ob.product_id WHERE ob.outbound_number = ?`;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!row) return res.status(404).json({ error: '未找到记录' });
    res.json(row);
  });
});

app.get('/api/admin/orders/:orderNumber', authenticateToken, requireAdmin, (req, res) => {
  const id = req.params.orderNumber;
  const sql = `SELECT * FROM orders WHERE order_number = ?`;
  db.get(sql, [id], (err, order) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!order) return res.status(404).json({ error: '未找到订单' });
    db.all(`SELECT * FROM order_items WHERE order_id = ?`, [order.id], (e2, items) => {
      if (e2) items = [];
      res.json({ order, items: items || [] });
    });
  });
});

app.get('/api/admin/inventory/:sku', authenticateToken, requireAdmin, (req, res) => {
  const sku = req.params.sku;
  const sql = `SELECT p.*, i.current_stock, i.available_stock, i.reserved_stock, i.last_updated
               FROM products p LEFT JOIN inventory i ON p.id = i.product_id WHERE p.sku = ?`;
  db.get(sql, [sku], (err, row) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!row) return res.status(404).json({ error: '未找到商品' });
    res.json(row);
  });
});

// 静态页面
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/client', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));

const PORT = config.PORT;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`服务器运行在 http://localhost:${PORT} (driver=${db.isPg ? 'pg' : 'sqlite'})`);
}); 