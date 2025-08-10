#!/usr/bin/env node
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const isPg = !!process.env.DATABASE_URL;
const dbPath = process.env.DB_PATH || './database/logistics.db';
const backupsDir = process.env.BACKUPS_DIR || '/data/backups';
const file = process.argv[2];

if (!file){
  console.error('用法: node scripts/restore.js <备份文件路径>');
  process.exit(1);
}

function restorePg(){
  const env = { ...process.env };
  execFile('pg_restore', ['-c', '-d', process.env.DATABASE_URL, file], { env }, (err, stdout, stderr)=>{
    if (err){ console.error('pg_restore 失败:', err.message, stderr); process.exit(1); }
    console.log('PostgreSQL 恢复完成');
  });
}

function restoreSqlite(){
  if (!fs.existsSync(file)) { console.error('未找到备份文件:', file); process.exit(1); }
  // 覆盖恢复（谨慎使用）
  fs.copyFileSync(file, dbPath);
  console.log('SQLite 恢复完成');
}

if (isPg) restorePg(); else restoreSqlite();
