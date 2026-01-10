import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'order_engine',
  user: 'postgres',
  password: 'postgres'
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Database initialized');
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [order.id, order.tokenIn, order.tokenOut, order.amount, 
         order.slippage, order.status, order.createdAt, order.updatedAt]
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
         updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [updates.status, updates.selectedDex, updates.txHash, 
         updates.executedPrice, orderId]
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
