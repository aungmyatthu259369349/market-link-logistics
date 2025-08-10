#!/usr/bin/env node
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const isPg = !!process.env.DATABASE_URL;
const dbPath = process.env.DB_PATH || './database/logistics.db';
const backupsDir = process.env.BACKUPS_DIR || '/data/backups';
const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);

function ensureDir(dir){ if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function ts(){ const d=new Date(); const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }

async function cleanup(){
  try{
    const files = fs.readdirSync(backupsDir).map(f=>({ f, t: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }));
    const cutoff = Date.now() - retentionDays*24*60*60*1000;
    files.filter(x=>x.t<cutoff).forEach(x=>{ try{ fs.unlinkSync(path.join(backupsDir, x.f)); }catch{} });
  }catch{}
}

function backupPg(){
  const outfile = path.join(backupsDir, `pg-${ts()}.dump`);
  const env = { ...process.env };
  const args = ['-Fc', process.env.DATABASE_URL, '-f', outfile];
  execFile('pg_dump', args, { env }, (err, stdout, stderr)=>{
    if (err){ console.error('pg_dump 失败:', err.message, stderr); process.exit(1); }
    console.log('PostgreSQL 备份完成:', outfile);
    cleanup();
  });
}

function backupSqlite(){
  if (!fs.existsSync(dbPath)) { console.error('未找到SQLite数据库文件:', dbPath); process.exit(1); }
  const outfile = path.join(backupsDir, `sqlite-${ts()}.db`);
  fs.copyFileSync(dbPath, outfile);
  console.log('SQLite 备份完成:', outfile);
  cleanup();
}

function main(){
  ensureDir(backupsDir);
  if (isPg) backupPg(); else backupSqlite();
}

main();
