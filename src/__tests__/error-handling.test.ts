import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { orderRoutes } from '../routes';

describe('Error Handling', () => {
  const fastify = Fastify();

  beforeAll(async () => {
    await fastify.register(fastifyCors);
    await fastify.register(orderRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should handle missing tokenIn', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenOut: 'USDC',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('MISSING_TOKEN_IN');
    expect(body.code).toBe('ERR_001');
    expect(body.field).toBe('tokenIn');
  });

  it('should handle missing tokenOut', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('MISSING_TOKEN_OUT');
    expect(body.code).toBe('ERR_002');
    expect(body.field).toBe('tokenOut');
  });

  it('should handle negative amount', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: -5
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_AMOUNT');
    expect(body.code).toBe('ERR_005');
    expect(body.field).toBe('amount');
  });

  it('should handle zero amount', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 0
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_AMOUNT');
    expect(body.code).toBe('ERR_005');
    expect(body.field).toBe('amount');
  });

  it('should return 404 for non-existent order', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders/does_not_exist_999'
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    
    // ✅ FIXED: Check new structured error format
    expect(body.error).toBe('ORDER_NOT_FOUND');
    expect(body.message).toContain('does not exist');
    expect(body.code).toBe('ERR_404');
    expect(body.orderId).toBe('does_not_exist_999');
  });
});
