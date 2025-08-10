# MARKET LINK LOGISTICS - 物流管理系统

（…前略…）

## 备份与恢复（演练）

- 备份目录：默认 `/data/backups`（Render 磁盘）
- 保留天数：`BACKUP_RETENTION_DAYS`（默认 7 天）

### 备份
```bash
npm run backup
```
- PostgreSQL：使用 `pg_dump -Fc` 生成 `.dump`
- SQLite：直接复制 `.db` 文件

### 恢复（谨慎，仅演练环境）
```bash
# 指定备份文件路径
npm run restore -- /data/backups/pg-20250101-120000.dump
```
- PostgreSQL：调用 `pg_restore -c -d $DATABASE_URL`
- SQLite：覆盖恢复数据库文件

### Render 定时任务（建议）
- 使用 Render Cron 服务或外部调度（GitHub Actions/CronJob）每日调用备份端点/脚本
- 示例：每天 02:00 执行 `npm run backup`

### 验证与演练
- 定期恢复到“演练环境”（单独 Postgres 实例）
- 执行应用启动与功能点验证，记录耗时与检查清单 