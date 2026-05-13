const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});
pool.on("error", err => console.error("DB error:", err.message));

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        wallet        VARCHAR(42) UNIQUE NOT NULL,
        name          VARCHAR(100) NOT NULL,
        role          VARCHAR(20) NOT NULL,
        facility      VARCHAR(150),
        password_hash VARCHAR(200),
        created_at    TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chain_users (
        wallet      VARCHAR(42) PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        role        VARCHAR(20) NOT NULL,
        facility    VARCHAR(150),
        active      BOOLEAN DEFAULT true,
        created_by  VARCHAR(42),
        private_key TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chain_batches (
        batch_id           VARCHAR(50) PRIMARY KEY,
        medicine_name      VARCHAR(100) NOT NULL,
        manufacturer       VARCHAR(100),
        quantity           INTEGER NOT NULL,
        remaining_quantity INTEGER NOT NULL,
        expiry_date        BIGINT,
        status             VARCHAR(20) DEFAULT 'Registered',
        registered_by      VARCHAR(42),
        location           VARCHAR(150),
        notes              TEXT,
        created_at         TIMESTAMP DEFAULT NOW(),
        updated_at         TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chain_blocks (
        id            SERIAL PRIMARY KEY,
        hash          VARCHAR(64) UNIQUE NOT NULL,
        previous_hash VARCHAR(64) NOT NULL,
        timestamp     BIGINT NOT NULL,
        data          JSONB NOT NULL,
        batch_id      VARCHAR(50),
        created_at    TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_blocks_batch ON chain_blocks(batch_id);
      CREATE INDEX IF NOT EXISTS idx_blocks_ts    ON chain_blocks(timestamp DESC);

      CREATE TABLE IF NOT EXISTS offline_queue (
        id         SERIAL PRIMARY KEY,
        wallet     VARCHAR(42) NOT NULL,
        action     VARCHAR(50) NOT NULL,
        payload    JSONB NOT NULL,
        status     VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        synced_at  TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
