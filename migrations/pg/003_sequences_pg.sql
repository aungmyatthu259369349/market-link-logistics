-- 003_sequences_pg.sql
-- 目标：为入库/出库/订单/跟踪号生成并发安全的单号，格式：PREFIXYYYYMMDD-XXXX
-- PREFIX: IN / OUT / ORD / ML

-- 计数表：按 前缀+日期 维护当天序号
CREATE TABLE IF NOT EXISTS doc_counters (
  prefix TEXT NOT NULL,
  ymd DATE NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY(prefix, ymd)
);

-- 通用函数：生成单号
CREATE OR REPLACE FUNCTION gen_doc_no(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_ymd DATE := CURRENT_DATE;
  v_seq INTEGER;
BEGIN
  INSERT INTO doc_counters(prefix, ymd, seq)
  VALUES (p_prefix, v_ymd, 1)
  ON CONFLICT (prefix, ymd)
  DO UPDATE SET seq = doc_counters.seq + 1
  RETURNING seq INTO v_seq;

  RETURN p_prefix || to_char(v_ymd, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- 触发器：在插入时自动填充单号（若未提供）

-- 入库单号 IN
CREATE OR REPLACE FUNCTION trg_set_inbound_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.inbound_number IS NULL OR NEW.inbound_number = '' THEN
    NEW.inbound_number := gen_doc_no('IN');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS before_insert_inbound_number ON inbound_records;
CREATE TRIGGER before_insert_inbound_number
BEFORE INSERT ON inbound_records
FOR EACH ROW EXECUTE FUNCTION trg_set_inbound_number();

-- 出库单号 OUT
CREATE OR REPLACE FUNCTION trg_set_outbound_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.outbound_number IS NULL OR NEW.outbound_number = '' THEN
    NEW.outbound_number := gen_doc_no('OUT');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS before_insert_outbound_number ON outbound_records;
CREATE TRIGGER before_insert_outbound_number
BEFORE INSERT ON outbound_records
FOR EACH ROW EXECUTE FUNCTION trg_set_outbound_number();

-- 订单号 ORD
CREATE OR REPLACE FUNCTION trg_set_order_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := gen_doc_no('ORD');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS before_insert_order_number ON orders;
CREATE TRIGGER before_insert_order_number
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION trg_set_order_number();

-- 跟踪号 ML
CREATE OR REPLACE FUNCTION trg_set_tracking_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tracking_number IS NULL OR NEW.tracking_number = '' THEN
    NEW.tracking_number := gen_doc_no('ML');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS before_insert_tracking_number ON tracking;
CREATE TRIGGER before_insert_tracking_number
BEFORE INSERT ON tracking
FOR EACH ROW EXECUTE FUNCTION trg_set_tracking_number();


