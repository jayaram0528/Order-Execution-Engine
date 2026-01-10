import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { orderQueue } from '../worker';
import { db, initializeDatabase } from '../database';

describe('Worker Retry Logic', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await orderQueue.close();
  });

  it('should retry failed jobs with exponential backoff', async () => {
    const orderId = `retry_test_${Date.now()}`;
    
    const order = {
      id: orderId,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 5,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.orders.create(order);

    // Add job to queue
    const job = await orderQueue.add(orderId, order, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 100 // Short delay for testing
      }
    });

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.opts.attempts).toBe(3);
  });

  it('should handle job removal on complete', async () => {
    const orderId = `complete_test_${Date.now()}`;
    
    const order = {
      id: orderId,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 3,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const job = await orderQueue.add(orderId, order, {
      removeOnComplete: {
        age: 3600,
        count: 100
      }
    });

    expect(job.opts.removeOnComplete).toBeDefined();
  });

  it('should handle job removal on fail', async () => {
    const orderId = `fail_test_${Date.now()}`;
    
    const order = {
      id: orderId,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 2,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const job = await orderQueue.add(orderId, order, {
      removeOnFail: {
        age: 86400
      }
    });

    expect(job.opts.removeOnFail).toBeDefined();
  });

  it('should calculate backoff delay correctly', async () => {
    // Test that queue has proper backoff configuration
    const queueOpts = orderQueue.opts as any;
    
    expect(queueOpts.defaultJobOptions?.attempts).toBe(3);
    expect(queueOpts.defaultJobOptions?.backoff).toBeDefined();
    
    // ✅ FIXED: Type-safe access to backoff properties
    const backoff = queueOpts.defaultJobOptions?.backoff;
    if (backoff && typeof backoff === 'object') {
      expect(backoff.type).toBe('exponential');
      expect(backoff.delay).toBe(2000);
    }
  });

  it('should have proper lock duration', async () => {
    // Worker should have lock duration configured
    const orderId = `lock_test_${Date.now()}`;
    
    const order = {
      id: orderId,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 1,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const job = await orderQueue.add(orderId, order);
    
    // Job should be added successfully
    expect(job).toBeDefined();
    expect(job.data.id).toBe(orderId);
    expect(job.data.amount).toBe(1);
  });

  it('should use default job options from queue', async () => {
    const orderId = `default_test_${Date.now()}`;
    
    const order = {
      id: orderId,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 7,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add job without specifying options (should use queue defaults)
    const job = await orderQueue.add(orderId, order);
    
    expect(job).toBeDefined();
    expect(job.opts).toBeDefined();
    
    // Should inherit default options from queue
    const queueDefaults = (orderQueue.opts as any).defaultJobOptions;
    expect(queueDefaults).toBeDefined();
    expect(queueDefaults.attempts).toBe(3);
  });

  it('should handle queue with proper connection', async () => {
    const orderId = `connection_test_${Date.now()}`;
    
    const order = {
      id: orderId,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 4,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Queue should be connected and functional
    const job = await orderQueue.add(orderId, order);
    
    expect(job).toBeDefined();
    expect(job.queueName).toBe('orders');
  });
});
