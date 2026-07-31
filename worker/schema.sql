PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  batch_date TEXT NOT NULL,
  fulfilment TEXT NOT NULL,
  pickup_code TEXT,
  address TEXT,
  dropoff_lat TEXT,
  dropoff_lng TEXT,
  notes TEXT,
  subtotal_sen INTEGER NOT NULL,
  delivery_fee_sen INTEGER NOT NULL DEFAULT 0,
  delivery_actual_fee_sen INTEGER,
  total_sen INTEGER NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  order_status TEXT NOT NULL DEFAULT 'new',
  billplz_bill_id TEXT UNIQUE,
  billplz_url TEXT,
  payment_payload TEXT,
  lalamove_quotation_id TEXT,
  lalamove_order_id TEXT UNIQUE,
  lalamove_share_link TEXT,
  lalamove_driver_id TEXT,
  delivery_status TEXT,
  delivery_payload TEXT,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_sen INTEGER NOT NULL CHECK (unit_price_sen >= 0),
  line_total_sen INTEGER NOT NULL CHECK (line_total_sen >= 0),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS delivery_quotes (
  token TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL,
  pickup_code TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  pickup_lat TEXT NOT NULL,
  pickup_lng TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat TEXT NOT NULL,
  dropoff_lng TEXT NOT NULL,
  amount_sen INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR',
  expires_at TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_batch_date ON orders(batch_date);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_quotes_created_at ON delivery_quotes(created_at DESC);
