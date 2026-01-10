import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { orderRoutes } from '../routes';

describe('API Routes', () => {
  const fastify = Fastify();

  beforeAll(async () => {
    await fastify.register(fastifyCors, { origin: '*' });
    await fastify.register(orderRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should create a new order', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 10,
        slippage: 0.05
      }
    });

    expect(response.statusCode).toBe(202);
    const data = JSON.parse(response.body);
    expect(data.orderId).toBeDefined();
    expect(data.orderId).toContain('order_');
  });

  it('should reject order with invalid amount', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 0,
        slippage: 0.05
      }
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.body);
    expect(data.error).toBeDefined();
  });

  it('should reject order with missing fields', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(400);
  });
});
