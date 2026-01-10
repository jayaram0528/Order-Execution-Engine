import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { orderRoutes } from '../routes';
import { initializeDatabase, db } from '../database';

describe('Routes Error Scenarios', () => {
  const fastify = Fastify();

  beforeAll(async () => {
    await initializeDatabase();
    await fastify.register(fastifyCors);
    await fastify.register(orderRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should handle database errors gracefully on order creation', async () => {
    // Mock database error
    const originalCreate = db.orders.create;
    db.orders.create = vi.fn().mockRejectedValue(new Error('Database connection failed'));

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(500);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('INTERNAL_SERVER_ERROR');
    expect(data.code).toBe('ERR_500');

    // Restore original function
    db.orders.create = originalCreate;
  });

  it('should handle database errors on order retrieval', async () => {
    // Mock database error
    const originalGetById = db.orders.getById;
    db.orders.getById = vi.fn().mockRejectedValue(new Error('Connection timeout'));

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders/test_order_123'
    });

    expect(response.statusCode).toBe(500);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('DATABASE_ERROR');
    expect(data.code).toBe('ERR_502');

    // Restore original function
    db.orders.getById = originalGetById;
  });

  it('should handle database errors on listing orders', async () => {
    // Mock database error
    const originalGetAll = db.orders.getAll;
    db.orders.getAll = vi.fn().mockRejectedValue(new Error('Query failed'));

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders'
    });

    expect(response.statusCode).toBe(500);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('DATABASE_ERROR');
    expect(data.code).toBe('ERR_503');

    // Restore original function
    db.orders.getAll = originalGetAll;
  });

  it('should include timestamp in 500 error responses', async () => {
    // ✅ FIXED: Test with database error (500) which has timestamp
    const originalCreate = db.orders.create;
    db.orders.create = vi.fn().mockRejectedValue(new Error('Test error'));

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(500);
    const data = JSON.parse(response.body);
    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).toString()).not.toBe('Invalid Date');
    
    // Restore
    db.orders.create = originalCreate;
  });

  it('should validate empty orderId in URL', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders/   '
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('INVALID_ORDER_ID');
    expect(data.code).toBe('ERR_011');
  });

  it('should handle special characters in token names', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL@#$',
        tokenOut: 'USDC',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('INVALID_TOKEN_IN');
  });

  it('should handle lowercase token names', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'sol',
        tokenOut: 'USDC',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('INVALID_TOKEN_IN');
  });

  it('should handle very long token names', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'VERYLONGTOKENNAME12345',
        tokenOut: 'USDC',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('INVALID_TOKEN_IN');
  });

  it('should handle single character token', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'S',
        tokenOut: 'USDC',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('INVALID_TOKEN_IN');
  });

  it('should handle undefined slippage (use default)', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 10
        // slippage is undefined (not included)
      }
    });

    // Should succeed with default slippage
    expect(response.statusCode).toBe(202);
    const data = JSON.parse(response.body);
    expect(data.orderId).toBeDefined();
    expect(data.status).toBe('accepted');
  });
});
