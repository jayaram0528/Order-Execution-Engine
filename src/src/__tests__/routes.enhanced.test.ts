import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { orderRoutes } from '../routes';
import { initializeDatabase } from '../database';

describe('Enhanced Routes Features', () => {
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

  // ✅ Test Health Check
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/health'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('order-execution-engine');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeGreaterThan(0);
      expect(data.version).toBe('1.0.0');
    });
  });

  // ✅ Test 404 Handler
  describe('404 Not Found Handler', () => {
    it('should return 404 for unknown route', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/unknown-route'
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('ROUTE_NOT_FOUND');
      expect(data.message).toContain('GET /api/unknown-route does not exist');
      expect(data.code).toBe('ERR_404');
      expect(data.availableRoutes).toBeDefined();
      expect(Array.isArray(data.availableRoutes)).toBe(true);
    });

    it('should return 404 for POST to unknown route', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/fake-endpoint',
        payload: {}
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('ROUTE_NOT_FOUND');
      expect(data.message).toContain('POST /api/fake-endpoint');
    });
  });

  // ✅ Test Enhanced Validation
  describe('Enhanced Input Validation', () => {
    it('should reject invalid token format', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'invalid-token',
          tokenOut: 'USDC',
          amount: 10
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_TOKEN_IN');
      expect(data.code).toBe('ERR_008');
    });

    it('should reject same token swap', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'SOL',
          amount: 10
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('SAME_TOKEN_SWAP');
      expect(data.code).toBe('ERR_010');
    });

    it('should reject invalid slippage type', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: 10,
          slippage: 'invalid'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_SLIPPAGE_TYPE');
      expect(data.code).toBe('ERR_006');
    });

    it('should reject slippage out of range', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: 10,
          slippage: 1.5
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_SLIPPAGE_RANGE');
      expect(data.code).toBe('ERR_007');
    });

    it('should reject non-number amount', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: 'ten'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_AMOUNT_TYPE');
      expect(data.code).toBe('ERR_004');
    });

    it('should reject missing amount', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'USDC'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('MISSING_AMOUNT');
      expect(data.code).toBe('ERR_003');
    });
  });

  // ✅ Test Enhanced Response Format
  describe('Enhanced Response Format', () => {
    it('should return enhanced order creation response', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: 15
        }
      });

      expect(response.statusCode).toBe(202);
      const data = JSON.parse(response.body);
      expect(data.orderId).toBeDefined();
      expect(data.status).toBe('accepted');
      expect(data.message).toBe('Order has been queued for processing');
      expect(data.websocketUrl).toBe(`/ws/${data.orderId}`);
      expect(data.estimatedProcessingTime).toBe('3-5 seconds');
    });

    it('should return order list with metadata', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.total).toBeDefined();
      expect(data.orders).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(typeof data.total).toBe('number');
      expect(Array.isArray(data.orders)).toBe(true);
    });
  });

  // ✅ Test Enhanced Error Details
  describe('Error Details', () => {
    it('should include helpful error details', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: -10
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
      expect(data.message).toBeDefined();
      expect(data.code).toBeDefined();
      expect(data.field).toBeDefined();
      expect(data.receivedValue).toBe(-10);
    });

    it('should return enhanced error for invalid orderId', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders/   '  // Empty orderId (whitespace)
      });

      // ✅ FIXED: Empty orderId triggers validation (400), not 404
      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_ORDER_ID');
      expect(data.code).toBe('ERR_011');
      expect(data.field).toBe('orderId');
    });
  });
});
