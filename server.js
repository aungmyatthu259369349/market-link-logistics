const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const config = require('./config');
const db = require('./db-adapter');

const app = express();

// 安全中间件
app.use(helmet());
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);
app.use(compression());

// CORS（生产建议填写你的域名）
const whitelist = (process.env.ORIGIN_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => { if (!origin || whitelist.length === 0 || whitelist.includes(origin)) return cb(null, true); return cb(new Error('Not allowed by CORS')); },
  credentials: true
}));

// 解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// 在 Render/生产环境下使用 Postgres 存储会话
const usePgSession = !!process.env.DATABASE_URL;
app.set('trust proxy', 1);
app.use(session({
  name: 'mlsid',
  store: usePgSession ? new PgSession({
    conString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
    tableName: 'session',
    createTableIfMissing: true
  }) : undefined,
  secret: config.SESSION_SECRET || 'logistics_session_secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: (parseInt(process.env.SESSION_MAX_AGE_MINUTES || '30',10))*60*1000
  }
}));

// 登录用户活动时间
app.use((req,res,next)=>{ if (req.session && req.session.user) { req.session.lastSeen = Date.now(); } next(); });

// 会话信息/续期
app.get('/api/auth/session-info', (req, res) => {
  const maxAgeMs = (parseInt(process.env.SESSION_MAX_AGE_MINUTES || '30',10))*60*1000;
  const last = (req.session && req.session.lastSeen) ? req.session.lastSeen : Date.now();
  const remainingMs = Math.max(0, maxAgeMs - (Date.now() - last));
  res.json({ remainingMs, maxAgeMs });
});
app.post('/api/auth/renew', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: '未登录' });
  req.session.lastSeen = Date.now();
  res.json({ success: true });
});

// 静态
app.use(express.static('./', { maxAge: '7d', etag: true }));

// 健康与版本
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/version', (req, res) => res.json({ version: process.env.RENDER_GIT_COMMIT || 'dev', driver: db.isPg ? 'pg' : 'sqlite' }));

// 会话认证
function requireAuth(req, res, next){ if (req.session && req.session.user) return next(); return res.status(401).json({ error: '未登录' }); }
function requireAdmin(req, res, next){ if (req.session && req.session.user && req.session.user.role === 'admin') return next(); return res.status(403).json({ error: '需要管理员权限' }); }

// 登录（Cookie Session）
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    const valid = await bcrypt.compare(password, user.password).catch(()=>false);
    if (!valid) return res.status(401).json({ error: '用户名或密码错误' });
    req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role };
    res.json({ success: true, user: req.session.user });
  });
});
app.post('/api/auth/logout', (req, res) => { req.session.destroy(()=>res.json({ success: true })); });

// 注册
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, company_name, contact_name, phone } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    db.insert('INSERT INTO users (username, email, password, company_name, contact_name, phone) VALUES (?, ?, ?, ?, ?, ?)', [username, email, hashed, company_name, contact_name, phone], (err)=>{
      if (err){ if(/UNIQUE|duplicate/i.test(String(err.message))) return res.status(400).json({ error: '用户名或邮箱已存在' }); return res.status(500).json({ error: '注册失败' }); }
      res.json({ success: true });
    });
  } catch { res.status(500).json({ error: '注册失败' }); }
});

// 邮件发送器（重置密码使用）
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.sendgrid.net',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: false,
  auth: { user: process.env.MAIL_USER || 'apikey', pass: process.env.MAIL_API_KEY || '' }
});
async function sendResetEmail(email, token){
  if (!process.env.MAIL_FROM) return;
  const url = `${process.env.PUBLIC_URL || ''}/reset.html?token=${encodeURIComponent(token)}`;
  await transporter.sendMail({ from: process.env.MAIL_FROM, to: email, subject: '重置密码', html: `<p>点击链接重置密码：<a href="${url}">${url}</a>（1小时内有效）</p>` });
}

// 忘记密码/重置密码（使用会话独立）
app.post('/api/auth/forgot', (req, res) => {
  const { email } = req.body || {}; if (!email) return res.status(400).json({ error: '请输入邮箱' });
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!user) return res.json({ success: true });
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.run('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expiresAt], async (e2) => {
      if (e2) return res.status(500).json({ error: '服务器错误' });
      try { await sendResetEmail(email, token); } catch {}
      return res.json({ success: true });
    });
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

// 后台接口（使用会话鉴权）
// 示例：统计
app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
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
app.get('/api/admin/inbound', requireAuth, requireAdmin, (req, res) => {
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

// 新建入库
app.post('/api/admin/inbound', requireAuth, requireAdmin, (req, res) => {
  const { supplier, inboundNumber, productName, category, quantity, inboundTime, notes } = req.body || {};
  if (!supplier || !productName || !category || !quantity) {
    return res.status(400).json({ error: '参数不完整' });
  }
  const createdBy = req.session.user?.id || null;
  // 1) 确认/创建商品
  db.get('SELECT id FROM products WHERE name = ?', [productName], (e1, p) => {
    if (e1) return res.status(500).json({ error: '服务器错误' });
    const ensureProduct = (cb) => {
      if (p && p.id) return cb(null, p.id);
      const sku = 'SKU' + Date.now();
      db.insert('INSERT INTO products (sku, name, category) VALUES (?, ?, ?)', [sku, productName, category], (e2, productId) => {
        if (e2) return cb(e2);
        cb(null, productId);
      });
    };
    ensureProduct((e3, productId) => {
      if (e3) return res.status(500).json({ error: '创建商品失败' });
      // 2) 写入入库记录（编号若未提供，PG 触发器会自动生成；SQLite 下需要提供，但本项目线上为 PG）
      const sql = `INSERT INTO inbound_records (inbound_number, supplier, product_id, quantity, status, inbound_time, notes, created_by)
                   VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)`;
      db.insert(sql, [inboundNumber || null, supplier, productId, parseInt(quantity,10)||0, inboundTime || new Date().toISOString(), notes || '', createdBy], (e4) => {
        if (e4) return res.status(500).json({ error: '创建入库失败' });
        return res.json({ success: true });
      });
    });
  });
});

// 批量操作：入库
app.post('/api/admin/inbound/batch-status', requireAuth, requireAdmin, (req, res) => {
  const { ids = [], status } = req.body || {};
  if (!ids.length || !status) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`UPDATE inbound_records SET status = ? WHERE inbound_number IN (${placeholders})`, [status, ...ids], (err)=>{
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ success: true });
  });
});
app.post('/api/admin/inbound/batch-delete', requireAuth, requireAdmin, (req, res) => {
  const { ids = [] } = req.body || {};
  if (!ids.length) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`DELETE FROM inbound_records WHERE inbound_number IN (${placeholders})`, ids, (err)=>{
    if (err) return res.status(500).json({ error: '删除失败' });
    res.json({ success: true });
  });
});

// 出库列表
app.get('/api/admin/outbound', requireAuth, requireAdmin, (req, res) => {
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
app.post('/api/admin/outbound/batch-status', requireAuth, requireAdmin, (req, res) => {
  const { ids = [], status } = req.body || {};
  if (!ids.length || !status) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`UPDATE outbound_records SET status = ? WHERE outbound_number IN (${placeholders})`, [status, ...ids], (err)=>{
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ success: true });
  });
});
app.post('/api/admin/outbound/batch-delete', requireAuth, requireAdmin, (req, res) => {
  const { ids = [] } = req.body || {};
  if (!ids.length) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`DELETE FROM outbound_records WHERE outbound_number IN (${placeholders})`, ids, (err)=>{
    if (err) return res.status(500).json({ error: '删除失败' });
    res.json({ success: true });
  });
});

// 库存列表
app.get('/api/admin/inventory', requireAuth, requireAdmin, (req, res) => {
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
app.get('/api/admin/orders', requireAuth, requireAdmin, (req, res) => {
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
app.post('/api/admin/orders/batch-status', requireAuth, requireAdmin, (req, res) => {
  const { ids = [], status } = req.body || {};
  if (!ids.length || !status) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`UPDATE orders SET status = ? WHERE order_number IN (${placeholders})`, [status, ...ids], (err)=>{
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ success: true });
  });
});
app.post('/api/admin/orders/batch-delete', requireAuth, requireAdmin, (req, res) => {
  const { ids = [] } = req.body || {};
  if (!ids.length) return res.status(400).json({ error: '参数错误' });
  const placeholders = buildInPlaceholders(ids);
  db.run(`DELETE FROM orders WHERE order_number IN (${placeholders})`, ids, (err)=>{
    if (err) return res.status(500).json({ error: '删除失败' });
    res.json({ success: true });
  });
});

// 详情接口
app.get('/api/admin/inbound/:inboundNumber', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.inboundNumber;
  const sql = `SELECT ir.*, p.name as product_name, p.sku FROM inbound_records ir LEFT JOIN products p ON p.id = ir.product_id WHERE ir.inbound_number = ?`;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!row) return res.status(404).json({ error: '未找到记录' });
    res.json(row);
  });
});

app.get('/api/admin/outbound/:outboundNumber', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.outboundNumber;
  const sql = `SELECT ob.*, p.name as product_name, p.sku FROM outbound_records ob LEFT JOIN products p ON p.id = ob.product_id WHERE ob.outbound_number = ?`;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!row) return res.status(404).json({ error: '未找到记录' });
    res.json(row);
  });
});

app.get('/api/admin/orders/:orderNumber', requireAuth, requireAdmin, (req, res) => {
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

app.get('/api/admin/inventory/:sku', requireAuth, requireAdmin, (req, res) => {
  const sku = req.params.sku;
  const sql = `SELECT p.*, i.current_stock, i.available_stock, i.reserved_stock, i.last_updated
               FROM products p LEFT JOIN inventory i ON p.id = i.product_id WHERE p.sku = ?`;
  db.get(sql, [sku], (err, row) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    if (!row) return res.status(404).json({ error: '未找到商品' });
    res.json(row);
  });
});

// 自检接口：DB与邮件配置
app.get('/api/self-check', async (req, res) => {
  const out = { ok: true, driver: db.isPg ? 'pg' : 'sqlite', mailConfigured: !!(process.env.MAIL_FROM && process.env.MAIL_API_KEY) };
  await new Promise(resolve => {
    db.get('SELECT 1 as up', [], (e, r) => { out.db = e ? { ok:false, error: String(e) } : { ok:true }; resolve(); });
  });
  res.json(out);
});

// 静态页面
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/client', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));

const PORT = config.PORT; const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => { console.log(`服务器运行在 http://localhost:${PORT} (driver=${db.isPg ? 'pg' : 'sqlite'})`); }); 