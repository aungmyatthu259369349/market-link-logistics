-- 002_indexes_pg.sql
-- 目标：为常用查询添加索引；确保唯一键；启用 pg_trgm 以支持模糊查询（若可用）

-- 可选扩展：如无权限会报错，运行器会忽略此错误
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  -- 忽略扩展创建失败
  NULL;
END $$;

-- 唯一键（通常在建表已添加；此处再次保障幂等）
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku ON products (sku);
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_order_number ON orders (order_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inbound_inbound_number ON inbound_records (inbound_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbound_outbound_number ON outbound_records (outbound_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_tracking_number ON tracking (tracking_number);

-- 外键列索引（提升 JOIN/过滤）
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory (product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_tracking_order_id ON tracking (order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_updates_tracking_id ON tracking_updates (tracking_id);
CREATE INDEX IF NOT EXISTS idx_inbound_product_id ON inbound_records (product_id);
CREATE INDEX IF NOT EXISTS idx_outbound_product_id ON outbound_records (product_id);
CREATE INDEX IF NOT EXISTS idx_outbound_order_id ON outbound_records (order_id);

-- 业务高频过滤/排序字段
CREATE INDEX IF NOT EXISTS idx_inbound_created_at ON inbound_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_status ON inbound_records (status);
CREATE INDEX IF NOT EXISTS idx_inbound_supplier ON inbound_records (supplier);
CREATE INDEX IF NOT EXISTS idx_outbound_created_at ON outbound_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_status ON outbound_records (status);
CREATE INDEX IF NOT EXISTS idx_outbound_customer ON outbound_records (customer);
CREATE INDEX IF NOT EXISTS idx_inventory_last_updated ON inventory (last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders (customer_name);

-- 模糊搜索（如使用 LIKE '%xxx%'）
-- 若 pg_trgm 可用，则创建 GIN 索引；否则忽略错误
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS gin_products_name_trgm ON products USING gin (name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS gin_products_sku_trgm ON products USING gin (sku gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS gin_orders_customer_name_trgm ON orders USING gin (customer_name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS gin_inbound_supplier_trgm ON inbound_records USING gin (supplier gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS gin_outbound_customer_trgm ON outbound_records USING gin (customer gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;


