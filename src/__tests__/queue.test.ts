import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Queue } from 'bullmq';

const connection = {
  host: 'localhost',
  port: 6379
};

describe('Queue System', () => {
  let testQueue: Queue;

  beforeAll(() => {
    testQueue = new Queue('test-orders', { connection });
  });

  afterAll(async () => {
    await testQueue.close();
  });

  it('should add job to queue', async () => {
    const job = await testQueue.add('test-order', {
      id: 'test_123',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 10
    });

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.data.id).toBe('test_123');
  });

  it('should retrieve job from queue', async () => {
    const job = await testQueue.add('test-order', {
      id: 'test_456',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 5
    });

    const retrievedJob = await testQueue.getJob(job.id!);
    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.data.id).toBe('test_456');
  });

  it('should handle multiple concurrent jobs', async () => {
    const jobs = await Promise.all([
      testQueue.add('test-order', { id: 'concurrent_1', amount: 1 }),
      testQueue.add('test-order', { id: 'concurrent_2', amount: 2 }),
      testQueue.add('test-order', { id: 'concurrent_3', amount: 3 })
    ]);

    expect(jobs).toHaveLength(3);
    jobs.forEach(job => {
      expect(job.id).toBeDefined();
    });
  });
});
