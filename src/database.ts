import { Pool } from 'pg';

// Use Railway's DATABASE_URL or fallback to local for development
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/order_engine',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        token_in VARCHAR(50) NOT NULL,
        token_out VARCHAR(50) NOT NULL,
        amount NUMERIC NOT NULL,
        slippage NUMERIC,
        status VARCHAR(50) NOT NULL,
        selected_dex VARCHAR(50),
        tx_hash VARCHAR(255),
        executed_price NUMERIC,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

export const db = {
  orders: {
    create: async (order: any) => {
      const result = await pool.query(
        `INSERT INTO orders 
        (id, token_in, token_out, amount, slippage, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *`,
        [order.id, order.tokenIn, order.tokenOut, order.amount, 
         order.slippage, order.status]
      );
      return result.rows[0];
    },

    update: async (orderId: string, updates: any) => {
      const result = await pool.query(
        `UPDATE orders SET 
         status = COALESCE($1, status),
         selected_dex = COALESCE($2, selected_dex),
         tx_hash = COALESCE($3, tx_hash),
         executed_price = COALESCE($4, executed_price),
         error = COALESCE($5, error),
         updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [updates.status, updates.selectedDex, updates.txHash, 
         updates.executedPrice, updates.error, orderId]
      );
      return result.rows[0];
    },

    getById: async (orderId: string) => {
      const result = await pool.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );
      return result.rows[0];
    },

    getAll: async () => {
      const result = await pool.query(
        'SELECT * FROM orders ORDER BY created_at DESC'
      );
      return result.rows;
    }
  }
};
