const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const config = require('../config');
const path = require('path');
const fs = require('fs');

// 确保数据库目录存在
const dbPath = path.resolve(config.DB_PATH);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const db = new sqlite3.Database(dbPath);

console.log('初始化数据库...');

// 创建表的SQL语句
const createTables = `
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        company_name TEXT,
        contact_name TEXT,
        phone TEXT,
        role TEXT DEFAULT 'client',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 商品表
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        unit TEXT DEFAULT 'piece',
        safety_stock INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 库存表
    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        current_stock INTEGER DEFAULT 0,
        reserved_stock INTEGER DEFAULT 0,
        available_stock INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id)
    );

    -- 订单表
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_address TEXT,
        service_type TEXT NOT NULL,
        total_weight REAL,
        total_amount REAL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );

    -- 订单项表
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL,
        total_price REAL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    );

    -- 入库记录表
    CREATE TABLE IF NOT EXISTS inbound_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inbound_number TEXT UNIQUE NOT NULL,
        supplier TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL,
        total_amount REAL,
        status TEXT DEFAULT 'pending',
        inbound_time DATETIME,
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
    );

    -- 出库记录表
    CREATE TABLE IF NOT EXISTS outbound_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outbound_number TEXT UNIQUE NOT NULL,
        order_id INTEGER,
        customer TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        destination TEXT,
        status TEXT DEFAULT 'pending',
        outbound_time DATETIME,
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
    );

    -- 物流跟踪表
    CREATE TABLE IF NOT EXISTS tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_number TEXT UNIQUE NOT NULL,
        order_id INTEGER,
        current_status TEXT NOT NULL,
        current_location TEXT,
        estimated_delivery DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id)
    );

    -- 跟踪更新记录表
    CREATE TABLE IF NOT EXISTS tracking_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        location TEXT,
        update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (tracking_id) REFERENCES tracking (id)
    );
`;

// 执行数据库初始化
db.serialize(() => {
    db.exec(createTables, async (err) => {
        if (err) {
            console.error('创建表时出错:', err);
            return;
        }
        console.log('数据库表创建成功');

        try {
            const hashedPassword = await bcrypt.hash(config.ADMIN.PASSWORD, 10);

            db.run(`INSERT OR IGNORE INTO users (username, email, password, company_name, contact_name, role) 
                    VALUES (?, ?, ?, ?, ?, ?)`, 
                   [config.ADMIN.USERNAME, config.ADMIN.EMAIL, hashedPassword, 
                    'Market Link Logistics', '系统管理员', 'admin']);

            const sampleProducts = [
                ['SKU001', 'iPhone 15 Pro', 'electronics', '苹果手机', 'piece', 50],
                ['SKU002', 'MacBook Air', 'electronics', '苹果笔记本', 'piece', 30],
                ['SKU003', '运动鞋', 'clothing', '运动休闲鞋', 'pair', 100],
                ['SKU004', '有机大米', 'food', '优质有机大米', 'kg', 200]
            ];

            for (const product of sampleProducts) {
                db.run(`INSERT OR IGNORE INTO products (sku, name, category, description, unit, safety_stock) 
                        VALUES (?, ?, ?, ?, ?, ?)`, product);
            }

            db.run(`INSERT OR IGNORE INTO inventory (product_id, current_stock, available_stock) 
                    SELECT id, 150, 150 FROM products WHERE sku = 'SKU001'`);
            db.run(`INSERT OR IGNORE INTO inventory (product_id, current_stock, available_stock) 
                    SELECT id, 25, 25 FROM products WHERE sku = 'SKU002'`);
            db.run(`INSERT OR IGNORE INTO inventory (product_id, current_stock, available_stock) 
                    SELECT id, 200, 200 FROM products WHERE sku = 'SKU003'`);
            db.run(`INSERT OR IGNORE INTO inventory (product_id, current_stock, available_stock) 
                    SELECT id, 500, 500 FROM products WHERE sku = 'SKU004'`);

            db.run(`INSERT OR IGNORE INTO tracking (tracking_number, current_status, current_location, estimated_delivery) 
                    VALUES ('ML123456789', '运输中', '北京市朝阳区配送中心', '2024-01-15')`);
            db.run(`INSERT OR IGNORE INTO tracking (tracking_number, current_status, current_location, estimated_delivery) 
                    VALUES ('ML987654321', '已送达', '收件人已签收', '2024-01-10')`);

            console.log('初始数据插入完成');
        } catch (error) {
            console.error('插入初始数据时出错:', error);
        }

        setTimeout(() => {
            db.close((err) => {
                if (err) {
                    console.error('关闭数据库时出错:', err);
                } else {
                    console.log('数据库初始化完成！');
                }
            });
        }, 200);
    });
}); 