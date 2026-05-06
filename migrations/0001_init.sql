CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY DEFAULT 1,
  display_name TEXT NOT NULL DEFAULT 'Me',
  date_of_birth TEXT,
  monthly_salary REAL DEFAULT 0,
  monthly_expenses REAL DEFAULT 0,
  base_currency TEXT NOT NULL DEFAULT 'SGD',
  rebalance_targets TEXT DEFAULT '{}',
  password_hash TEXT NOT NULL DEFAULT '',
  jwt_secret TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cpf_data (
  id INTEGER PRIMARY KEY DEFAULT 1,
  oa_balance REAL DEFAULT 0,
  sa_balance REAL DEFAULT 0,
  ma_balance REAL DEFAULT 0,
  ra_balance REAL DEFAULT 0,
  monthly_salary REAL DEFAULT 0,
  auto_update_enabled INTEGER DEFAULT 0,
  auto_update_last_applied TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS srs_data (
  id INTEGER PRIMARY KEY DEFAULT 1,
  balance REAL DEFAULT 0,
  annual_contribution REAL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cash_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'buffer',
  balance REAL DEFAULT 0,
  interest_rate REAL DEFAULT 0,
  currency TEXT DEFAULT 'SGD',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'stock',
  category TEXT DEFAULT 'growth',
  geography TEXT,
  geography_inferred INTEGER DEFAULT 1,
  units REAL DEFAULT 0,
  avg_cost REAL DEFAULT 0,
  current_price REAL DEFAULT 0,
  currency TEXT DEFAULT 'SGD',
  exchange TEXT,
  platform TEXT,
  is_srs INTEGER DEFAULT 0,
  include_in_allocation INTEGER DEFAULT 1,
  closed_at TEXT,
  notes TEXT,
  price_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS holding_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  holding_id INTEGER NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  txn_type TEXT NOT NULL DEFAULT 'buy',
  units REAL NOT NULL,
  price REAL NOT NULL,
  fees REAL DEFAULT 0,
  currency TEXT DEFAULT 'SGD',
  platform TEXT,
  txn_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  loan_type TEXT NOT NULL DEFAULT 'personal',
  original_amount REAL NOT NULL,
  outstanding REAL NOT NULL,
  interest_rate REAL NOT NULL,
  monthly_payment REAL NOT NULL,
  tenure_months INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  currency TEXT DEFAULT 'SGD',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  property_type TEXT DEFAULT 'hdb',
  purchase_price REAL NOT NULL,
  current_value REAL NOT NULL,
  estimated_as_of TEXT,
  purchase_date TEXT,
  linked_loan_id INTEGER REFERENCES loans(id) ON DELETE SET NULL,
  rental_income REAL DEFAULT 0,
  include_in_net_worth INTEGER DEFAULT 1,
  include_in_allocation INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ilps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  insurer TEXT,
  sub_fund_name TEXT,
  total_premiums_paid REAL DEFAULT 0,
  surrender_value REAL DEFAULT 0,
  surrender_value_as_of TEXT,
  annual_premium REAL DEFAULT 0,
  start_date TEXT,
  include_in_net_worth INTEGER DEFAULT 1,
  include_in_allocation INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS dividends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  holding_id INTEGER REFERENCES holdings(id) ON DELETE SET NULL,
  ticker TEXT,
  name TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'SGD',
  ex_date TEXT NOT NULL,
  payment_date TEXT,
  confidence_tier TEXT DEFAULT 'received',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL UNIQUE,
  net_worth REAL NOT NULL DEFAULT 0,
  cash REAL NOT NULL DEFAULT 0,
  investments REAL NOT NULL DEFAULT 0,
  cpf REAL NOT NULL DEFAULT 0,
  srs REAL NOT NULL DEFAULT 0,
  properties REAL NOT NULL DEFAULT 0,
  loans REAL NOT NULL DEFAULT 0,
  breakdown TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS fx_rates_cache (
  currency TEXT PRIMARY KEY,
  rate_to_sgd REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS price_cache (
  ticker TEXT PRIMARY KEY,
  price REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO fx_rates_cache (currency, rate_to_sgd) VALUES
  ('SGD', 1.0), ('USD', 1.35), ('HKD', 0.173), ('GBP', 1.71),
  ('EUR', 1.47), ('JPY', 0.009), ('AUD', 0.87), ('CNY', 0.187),
  ('MYR', 0.303), ('CAD', 1.0);
INSERT OR IGNORE INTO profiles (id) VALUES (1);
INSERT OR IGNORE INTO cpf_data (id) VALUES (1);
INSERT OR IGNORE INTO srs_data (id) VALUES (1);
