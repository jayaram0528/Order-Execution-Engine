import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { orderRoutes } from '../routes';
import { initializeDatabase } from '../database';

describe('Routes Edge Cases', () => {
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

  it('should handle whitespace-only orderId', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders/     '  // Multiple spaces
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('INVALID_ORDER_ID');
    expect(data.code).toBe('ERR_011');
  });

  it('should handle tab characters in orderId', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders/\t\t'  // Tabs
    });

    expect(response.statusCode).toBe(400);
  });

  it('should trigger global error handler with validation error', async () => {
    // Send completely invalid JSON-like payload
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: 'not-json-at-all',
      headers: {
        'content-type': 'application/json'
      }
    });

    // Should trigger error handler
    expect([400, 500]).toContain(response.statusCode);
  });

  it('should handle missing content-type header', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 10
      }
      // No explicit content-type (Fastify handles this)
    });

    // Should still work or return proper error
    expect([202, 400]).toContain(response.statusCode);
  });

  it('should handle very large amounts', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 999999999999999
      }
    });

    // Should succeed (no max amount check) or handle gracefully
    expect(response.statusCode).toBe(202);
  });

  it('should handle decimal amounts', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 0.00001
      }
    });

    expect(response.statusCode).toBe(202);
    const data = JSON.parse(response.body);
    expect(data.orderId).toBeDefined();
  });

  it('should handle maximum valid slippage', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 10,
        slippage: 1.0  // 100% slippage (max valid)
      }
    });

    expect(response.statusCode).toBe(202);
  });

  it('should handle minimum valid slippage', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 10,
        slippage: 0  // 0% slippage (min valid)
      }
    });

    expect(response.statusCode).toBe(202);
  });

  it('should handle numeric token names', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: '123',
        tokenOut: 'USDC',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(202);
  });

  it('should handle mixed alphanumeric tokens', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL123',
        tokenOut: 'USDC99',
        amount: 10
      }
    });

    expect(response.statusCode).toBe(202);
  });
});
