import { describe, it, expect } from 'vitest';
import type { Order, OrderStatus } from '../types';

describe('Type Definitions', () => {
  it('should validate OrderStatus types', () => {
    const validStatuses: OrderStatus[] = [
      'pending',
      'routing',
      'building',
      'submitted',
      'confirmed',
      'failed'
    ];

    validStatuses.forEach(status => {
      expect(status).toBeDefined();
      expect(typeof status).toBe('string');
    });
  });

  it('should create valid Order object', () => {
    const order: Order = {
      id: 'order_123',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 10,
      slippage: 0.05,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(order.id).toBe('order_123');
    expect(order.amount).toBe(10);
    expect(order.status).toBe('pending');
  });
});
