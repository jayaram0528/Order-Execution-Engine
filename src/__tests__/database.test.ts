import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db, initializeDatabase } from '../database';

describe('Database Operations', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    try {
      await db.orders.update('test_db_001', { status: 'pending' });
    } catch (error) {
      // Order doesn't exist yet, that's fine
    }
  });

  it('should create an order in database', async () => {
    // Use unique ID for each test run
    const timestamp = Date.now();
    const order = {
      id: `test_db_${timestamp}`,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 15,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.orders.create(order);
    
    expect(result).toBeDefined();
    expect(result.id).toBe(`test_db_${timestamp}`);
    expect(result.token_in).toBe('SOL');
    expect(result.amount).toBe('15');
  });

  it('should retrieve order by ID', async () => {
    // First create an order
    const timestamp = Date.now();
    const orderId = `test_retrieve_${timestamp}`;
    
    await db.orders.create({
      id: orderId,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 10,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Then retrieve it
    const order = await db.orders.getById(orderId);
    
    expect(order).toBeDefined();
    expect(order.id).toBe(orderId);
    expect(order.token_in).toBe('SOL');
  });

  it('should update order status', async () => {
    // First create an order
    const timestamp = Date.now();
    const orderId = `test_update_${timestamp}`;
    
    await db.orders.create({
      id: orderId,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 10,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Then update it
    const updated = await db.orders.update(orderId, {
      status: 'confirmed',
      txHash: 'test_tx_hash_123',
      executedPrice: 2000,
      selectedDex: 'meteora'
    });

    expect(updated).toBeDefined();
    expect(updated.status).toBe('confirmed');
    expect(updated.tx_hash).toBe('test_tx_hash_123');
    expect(updated.selected_dex).toBe('meteora');
  });

  it('should retrieve all orders', async () => {
    const orders = await db.orders.getAll();
    
    expect(orders).toBeDefined();
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
  });

  it('should return undefined for non-existent order', async () => {
    const order = await db.orders.getById('non_existent_999');
    
    expect(order).toBeUndefined();
  });
});
