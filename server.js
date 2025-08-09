const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const app = express();

// 中间件设置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./')); // 提供静态文件服务

// 确保数据库目录存在
const dbPath = path.resolve(config.DB_PATH);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// 数据库连接
const db = new sqlite3.Database(config.DB_PATH);

// JWT认证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '需要认证令牌' });
    }

    jwt.verify(token, config.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '无效的令牌' });
        }
        req.user = user;
        next();
    });
};

// 管理员权限检查
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

// ==================== 认证相关API ====================

// 用户登录
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    // 优先支持环境管理员直登，保证后台可用
    if (username === config.ADMIN.USERNAME && password === config.ADMIN.PASSWORD) {
        const adminUser = { id: 0, username, email: config.ADMIN.EMAIL, role: 'admin' };
        const token = jwt.sign({ id: 0, username, role: 'admin' }, config.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, user: adminUser });
    }

    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
        if (err) {
            console.error('登录查询数据库失败:', err);
            // 应急兜底：允许使用环境管理员账户直接登录
            if (username === config.ADMIN.USERNAME && password === config.ADMIN.PASSWORD) {
                const fallbackUser = { id: 0, username, email: config.ADMIN.EMAIL, role: 'admin' };
                const token = jwt.sign({ id: 0, username, role: 'admin' }, config.JWT_SECRET, { expiresIn: '24h' });
                return res.json({ success: true, token, user: fallbackUser });
            }
            return res.status(500).json({ error: '服务器错误' });
        }

        if (!user) {
            // 支持环境管理员应急登录
            if (username === config.ADMIN.USERNAME && password === config.ADMIN.PASSWORD) {
                const fallbackUser = { id: 0, username, email: config.ADMIN.EMAIL, role: 'admin' };
                const token = jwt.sign({ id: 0, username, role: 'admin' }, config.JWT_SECRET, { expiresIn: '24h' });
                return res.json({ success: true, token, user: fallbackUser });
            }
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const validPassword = await bcrypt.compare(password, user.password).catch(() => false);
        if (!validPassword) {
            // 支持环境管理员应急登录
            if (username === config.ADMIN.USERNAME && password === config.ADMIN.PASSWORD) {
                const fallbackUser = { id: user.id, username: user.username, email: user.email, role: user.role };
                const token = jwt.sign({ id: fallbackUser.id, username: fallbackUser.username, role: fallbackUser.role }, config.JWT_SECRET, { expiresIn: '24h' });
                return res.json({ success: true, token, user: fallbackUser });
            }
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            config.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                company_name: user.company_name,
                contact_name: user.contact_name
            }
        });
    });
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, company_name, contact_name, phone } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (username, email, password, company_name, contact_name, phone) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, company_name, contact_name, phone],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: '用户名或邮箱已存在' });
                    }
                    return res.status(500).json({ error: '注册失败' });
                }

                res.json({ success: true, message: '注册成功' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: '注册失败' });
    }
});

// ==================== 包裹跟踪API ====================

// 获取跟踪信息
app.get('/api/tracking/:trackingNumber', (req, res) => {
    const { trackingNumber } = req.params;

    db.get(`
        SELECT t.*, tu.status, tu.location, tu.update_time, tu.notes
        FROM tracking t
        LEFT JOIN tracking_updates tu ON t.id = tu.tracking_id
        WHERE t.tracking_number = ?
        ORDER BY tu.update_time DESC
        LIMIT 1
    `, [trackingNumber], (err, result) => {
        if (err) {
            return res.status(500).json({ error: '查询失败' });
        }

        if (!result) {
            return res.status(404).json({ error: '未找到该跟踪号' });
        }

        // 获取所有更新记录
        db.all(`
            SELECT status, location, update_time, notes
            FROM tracking_updates
            WHERE tracking_id = (SELECT id FROM tracking WHERE tracking_number = ?)
            ORDER BY update_time DESC
        `, [trackingNumber], (err, updates) => {
            if (err) {
                updates = [];
            }

            res.json({
                tracking_number: result.tracking_number,
                status: result.current_status,
                location: result.current_location,
                estimated_delivery: result.estimated_delivery,
                updates: updates || []
            });
        });
    });
});

// ==================== 价格计算API ====================

// 计算运费
app.post('/api/calculate-price', (req, res) => {
    const { origin, destination, weight, serviceType } = req.body;

    if (!origin || !destination || !weight || !serviceType) {
        return res.status(400).json({ error: '请填写所有必填信息' });
    }

    // 简单的价格计算逻辑
    let basePrice = weight * 2; // 基础价格：每公斤2元
    let serviceMultiplier = 1;
    let estimatedTime = '3-5天';

    switch (serviceType) {
        case 'express':
            serviceMultiplier = 1.5;
            estimatedTime = '1-2天';
            break;
        case 'premium':
            serviceMultiplier = 2;
            estimatedTime = '24小时内';
            break;
        default:
            serviceMultiplier = 1;
            estimatedTime = '3-5天';
    }

    const totalPrice = basePrice * serviceMultiplier;

    res.json({
        origin,
        destination,
        weight,
        serviceType,
        totalPrice: totalPrice.toFixed(2),
        estimatedTime
    });
});

// ==================== 管理员API ====================

// 获取统计数据
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    const stats = {};

    // 获取总库存
    db.get('SELECT SUM(current_stock) as total_inventory FROM inventory', (err, result) => {
        stats.totalInventory = result ? result.total_inventory || 0 : 0;

        // 获取今日入库
        db.get(`SELECT COUNT(*) as today_inbound FROM inbound_records 
                WHERE DATE(created_at) = DATE('now')`, (err, result) => {
            stats.todayInbound = result ? result.today_inbound || 0 : 0;

            // 获取今日出库
            db.get(`SELECT COUNT(*) as today_outbound FROM outbound_records 
                    WHERE DATE(created_at) = DATE('now')`, (err, result) => {
                stats.todayOutbound = result ? result.today_outbound || 0 : 0;

                // 获取运输中订单
                db.get(`SELECT COUNT(*) as in_transit FROM orders 
                        WHERE status IN ('processing', 'shipped')`, (err, result) => {
                    stats.inTransit = result ? result.in_transit || 0 : 0;

                    res.json(stats);
                });
            });
        });
    });
});

// 获取入库记录
app.get('/api/admin/inbound', authenticateToken, requireAdmin, (req, res) => {
    db.all(`
        SELECT ir.*, p.name as product_name, p.sku, u.username as created_by_name
        FROM inbound_records ir
        LEFT JOIN products p ON ir.product_id = p.id
        LEFT JOIN users u ON ir.created_by = u.id
        ORDER BY ir.created_at DESC
    `, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: '获取入库记录失败' });
        }
        res.json(rows);
    });
});

// 创建入库记录
app.post('/api/admin/inbound', authenticateToken, requireAdmin, (req, res) => {
    const { supplier, inboundNumber, productName, quantity, category, inboundTime, notes } = req.body;
    const createdBy = req.user.id;

    // 首先查找或创建商品
    db.get('SELECT id FROM products WHERE name = ?', [productName], (err, product) => {
        let productId;

        if (product) {
            productId = product.id;
            insertInboundRecord();
        } else {
            // 创建新商品
            const sku = 'SKU' + Date.now();
            db.run(
                'INSERT INTO products (sku, name, category) VALUES (?, ?, ?)',
                [sku, productName, category],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: '创建商品失败' });
                    }
                    productId = this.lastID;
                    insertInboundRecord();
                }
            );
        }

        function insertInboundRecord() {
            db.run(
                `INSERT INTO inbound_records (inbound_number, supplier, product_id, quantity, status, inbound_time, notes, created_by)
                 VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)`,
                [inboundNumber, supplier, productId, quantity, inboundTime, notes, createdBy],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: '创建入库记录失败' });
                    }

                    // 更新库存
                    db.run(
                        `INSERT OR REPLACE INTO inventory (product_id, current_stock, available_stock, last_updated)
                         VALUES (?, 
                                COALESCE((SELECT current_stock FROM inventory WHERE product_id = ?), 0) + ?,
                                COALESCE((SELECT available_stock FROM inventory WHERE product_id = ?), 0) + ?,
                                CURRENT_TIMESTAMP)`,
                        [productId, productId, quantity, productId, quantity],
                        (err) => {
                            if (err) {
                                console.error('更新库存失败:', err);
                            }
                        }
                    );

                    res.json({ success: true, message: '入库记录创建成功' });
                }
            );
        }
    });
});

// 获取库存信息
app.get('/api/admin/inventory', authenticateToken, requireAdmin, (req, res) => {
    db.all(`
        SELECT p.*, i.current_stock, i.available_stock, i.reserved_stock, i.last_updated,
               CASE 
                   WHEN i.current_stock > p.safety_stock THEN 'in-stock'
                   WHEN i.current_stock > 0 THEN 'low-stock'
                   ELSE 'out-of-stock'
               END as stock_status
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        ORDER BY p.created_at DESC
    `, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: '获取库存信息失败' });
        }
        res.json(rows);
    });
});

// ==================== 客户API ====================

// 获取客户订单
app.get('/api/client/orders', authenticateToken, (req, res) => {
    db.all(`
        SELECT o.*, COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `, [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: '获取订单失败' });
        }
        res.json(rows);
    });
});

// 创建新订单
app.post('/api/client/orders', authenticateToken, (req, res) => {
    const { receiverName, address, phone, productName, weight, serviceType, notes } = req.body;
    const userId = req.user.id;
    const orderNumber = 'ORD' + Date.now();

    // 计算价格
    let basePrice = weight * 2;
    let serviceMultiplier = serviceType === 'express' ? 1.5 : serviceType === 'premium' ? 2 : 1;
    const totalAmount = basePrice * serviceMultiplier;

    db.run(
        `INSERT INTO orders (order_number, user_id, customer_name, customer_phone, customer_address, 
                           service_type, total_weight, total_amount, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [orderNumber, userId, receiverName, phone, address, serviceType, weight, totalAmount, notes],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '创建订单失败' });
            }

            // 创建跟踪号
            const trackingNumber = 'ML' + Date.now();
            db.run(
                'INSERT INTO tracking (tracking_number, order_id, current_status, current_location) VALUES (?, ?, ?, ?)',
                [trackingNumber, this.lastID, '订单已创建', '仓库待处理'],
                (err) => {
                    if (err) {
                        console.error('创建跟踪记录失败:', err);
                    }
                }
            );

            res.json({ 
                success: true, 
                message: '订单创建成功',
                orderNumber,
                trackingNumber
            });
        }
    );
});

// ==================== 通用API ====================

// 获取用户信息
app.get('/api/user/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, username, email, company_name, contact_name, phone, role FROM users WHERE id = ?', 
           [req.user.id], (err, user) => {
        if (err) {
            return res.status(500).json({ error: '获取用户信息失败' });
        }
        res.json(user);
    });
});

// 联系表单提交
app.post('/api/contact', (req, res) => {
    const { name, email, phone, message } = req.body;
    
    // 这里可以添加邮件发送逻辑或存储到数据库
    console.log('收到联系表单:', { name, email, phone, message });
    
    res.json({ success: true, message: '感谢您的留言，我们将尽快回复您！' });
});

// ==================== 静态页面路由 ====================

// 主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 客户专区
app.get('/client', (req, res) => {
    res.sendFile(path.join(__dirname, 'client.html'));
});

// 后台管理
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// 后台登录
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ error: '页面未找到' });
});

// 启动服务器
const PORT = config.PORT;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`服务器运行在 http://localhost:${PORT} (局域网: http://<你的IP>:${PORT})`);
    console.log('API文档:');
    console.log('POST /api/auth/login - 用户登录');
    console.log('POST /api/auth/register - 用户注册');
    console.log('GET /api/tracking/:trackingNumber - 包裹跟踪');
    console.log('POST /api/calculate-price - 价格计算');
    console.log('GET /api/admin/stats - 管理员统计');
    console.log('GET /api/client/orders - 客户订单');
}); 