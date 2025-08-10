const path = require('path');
const config = require('./config');

const isPg = !!process.env.DATABASE_URL;

if (isPg) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false } });

  const toPgParams = (sql, params = []) => {
    let idx = 0;
    const mapped = sql.replace(/\?/g, () => `$${++idx}`);
    return { text: mapped, values: params };
  };

  module.exports = {
    isPg: true,
    get(sql, params = [], cb) {
      pool.query(toPgParams(sql, params)).then(r => cb(null, r.rows[0])).catch(e => cb(e));
    },
    all(sql, params = [], cb) {
      pool.query(toPgParams(sql, params)).then(r => cb(null, r.rows)).catch(e => cb(e));
    },
    run(sql, params = [], cb) {
      pool.query(toPgParams(sql, params)).then(() => cb && cb(null)).catch(e => cb && cb(e));
    },
    insert(sql, params = [], cb) {
      // 需要返回id，若SQL未带RETURNING，尝试追加
      let text = sql.trim();
      if (!/returning\s+id/i.test(text)) {
        text += ' RETURNING id';
      }
      pool.query(toPgParams(text, params)).then(r => cb && cb(null, r.rows[0]?.id)).catch(e => cb && cb(e));
    }
  };
} else {
  const sqlite3 = require('sqlite3').verbose();
  const fs = require('fs');
  const dbPath = path.resolve(config.DB_PATH);
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const db = new sqlite3.Database(dbPath);

  module.exports = {
    isPg: false,
    get(sql, params = [], cb) { db.get(sql, params, cb); },
    all(sql, params = [], cb) { db.all(sql, params, cb); },
    run(sql, params = [], cb) { db.run(sql, params, cb); },
    insert(sql, params = [], cb) {
      db.run(sql, params, function(err){
        if (err) return cb && cb(err);
        cb && cb(null, this.lastID);
      });
    }
  };
}
