/*
  运行 PostgreSQL 迁移脚本（按文件名顺序执行 *.sql）
  用法：DATABASE_URL=... node scripts/run-pg-migrations.js
  在启动前调用，幂等执行
*/
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('无 DATABASE_URL，跳过 PG 迁移');
  process.exit(0);
}

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations/pg');
const pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false } });

async function runSqlFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
}

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      await client.query('COMMIT');
      console.log('无 PG 迁移目录，跳过');
      return;
    }
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      const fp = path.join(MIGRATIONS_DIR, f);
      console.log('执行迁移：', f);
      await runSqlFile(client, fp);
    }
    await client.query('COMMIT');
    console.log('PG 迁移执行完成');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('PG 迁移失败：', e.message || e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();


