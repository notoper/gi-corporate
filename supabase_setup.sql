-- 在 Supabase Dashboard → SQL Editor 中运行此文件

-- 公司数据表
create table if not exists companies (
  id text primary key,
  company text, uen text, type text, status text,
  reg_date text, fye text, address text,
  client_name text, phone text, passport_no text,
  ep_no text, ep_expiry text, ep_status text,
  nd_name text, nd_expiry text, nd_status text,
  sec_name text, sec_expiry text, sec_status text,
  addr_expiry text, addr_status text,
  work text, ar2024 text, ar2025 text,
  ya2025 text, ya2026 text, ltr text,
  ops_fee text, bank text, source text,
  custom_todos text,
  created_at timestamptz default now()
);

-- 操作日志表
create table if not exists logs (
  id bigint primary key,
  action text, company text, field text,
  old_val text, new_val text, time_str text,
  created_at timestamptz default now()
);

-- 系统设置表（存密码等）
create table if not exists settings (
  key text primary key,
  value text
);

-- 关闭 RLS（内部工具，anon key 直接访问）
alter table companies disable row level security;
alter table logs disable row level security;
alter table settings disable row level security;
