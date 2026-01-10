import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { orderRoutes } from '../routes';
import { db, initializeDatabase } from '../database';

describe('End-to-End Order Flow', () => {
  const fastify = Fastify();
  let createdOrderId: string;

  beforeAll(async () => {
    await initializeDatabase();
    await fastify.register(fastifyCors);
    await fastify.register(orderRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should create order via API', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 20,
        slippage: 0.05
      }
    });

    expect(response.statusCode).toBe(202);
    const data = JSON.parse(response.body);
    expect(data.orderId).toBeDefined();
    expect(data.status).toBe('accepted');
    expect(data.message).toBe('Order has been queued for processing');
    expect(data.websocketUrl).toBe(`/ws/${data.orderId}`);
    
    createdOrderId = data.orderId;
  });

  it('should retrieve order from API', async () => {
    // Wait a bit for order to be saved
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/orders/${createdOrderId}`
    });

    expect(response.statusCode).toBe(200);
    const order = JSON.parse(response.body);
    expect(order.id).toBe(createdOrderId);
    expect(order.token_in).toBe('SOL');
    expect(order.token_out).toBe('USDC');
    expect(order.amount).toBe('20');
  });

  it('should list all orders', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders'
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    
    // ✅ FIXED: Response is now { total, orders, timestamp }
    expect(data.total).toBeDefined();
    expect(typeof data.total).toBe('number');
    expect(data.orders).toBeDefined();
    expect(Array.isArray(data.orders)).toBe(true);
    expect(data.orders.length).toBeGreaterThan(0);
    expect(data.orders.length).toBe(data.total);
    expect(data.timestamp).toBeDefined();
    
    // Verify the created order is in the list
    const foundOrder = data.orders.find((o: any) => o.id === createdOrderId);
    expect(foundOrder).toBeDefined();
    expect(foundOrder.token_in).toBe('SOL');
  });
});
