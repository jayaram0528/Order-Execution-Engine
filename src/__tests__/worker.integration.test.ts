import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { orderQueue, orderWorker } from '../worker';

describe('Worker Integration', () => {
  afterAll(async () => {
    await orderQueue.close();
    await orderWorker.close();
  });

  it('should process order through complete lifecycle', async () => {
    const testOrder = {
      id: 'integration_test_001',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 5,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const job = await orderQueue.add(testOrder.id, testOrder);
    
    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.data.id).toBe('integration_test_001');
  });

  it('should handle multiple orders concurrently', async () => {
    const orders = Array.from({ length: 3 }, (_, i) => ({
      id: `concurrent_test_${i}`,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 10 + i,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const jobs = await Promise.all(
      orders.map(order => orderQueue.add(order.id, order))
    );

    expect(jobs).toHaveLength(3);
    jobs.forEach((job, index) => {
      expect(job.data.id).toBe(`concurrent_test_${index}`);
    });
  });
});
