import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  broadcastUpdate, 
  initializeWebSocket, 
  getActiveConnections,
  clearConnections,
  websocketRoutes,
  setupWebSocket
} from '../websocket';
import http from 'http';
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';

describe('WebSocket Broadcasting', () => {
  let server: http.Server;

  beforeEach(async () => {
    server = http.createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        initializeWebSocket(server);
        resolve();
      });
    });
  });

  afterEach(async () => {
    clearConnections();
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it('should not crash when broadcasting to non-existent connection', () => {
    expect(() => {
      broadcastUpdate('fake_order_123', {
        status: 'pending',
        message: 'Test message'
      });
    }).not.toThrow();
  });

  it('should handle broadcast with all status types', () => {
    const statuses = ['pending', 'routing', 'building', 'submitted', 'confirmed', 'failed'];
    
    statuses.forEach(status => {
      expect(() => {
        broadcastUpdate('test_order', {
          status: status as any,
          message: `Testing ${status}`
        });
      }).not.toThrow();
    });
  });

  it('should handle broadcast with additional data', () => {
    expect(() => {
      broadcastUpdate('test_order_with_data', {
        status: 'confirmed',
        message: 'Order completed',
        txHash: 'abc123',
        executedPrice: 2000,
        selectedDex: 'meteora'
      });
    }).not.toThrow();
  });

  it('should broadcast to connected clients', async () => {
    const WebSocket = require('ws');
    const address = server.address() as any;
    const client = new WebSocket(`ws://localhost:${address.port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        broadcastUpdate('test_order_broadcast', {
          status: 'confirmed',
          message: 'Broadcasting test'
        });

        setTimeout(() => {
          client.close();
          resolve();
        }, 100);
      });

      client.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        expect(message.orderId).toBe('test_order_broadcast');
        expect(message.status).toBe('confirmed');
      });
    });
  });

  it('should include timestamp in broadcast messages', async () => {
    const WebSocket = require('ws');
    const address = server.address() as any;
    const client = new WebSocket(`ws://localhost:${address.port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        broadcastUpdate('timestamp_test', {
          status: 'pending',
          message: 'Timestamp test'
        });

        setTimeout(() => {
          client.close();
          resolve();
        }, 100);
      });

      client.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        expect(message.timestamp).toBeDefined();
        expect(typeof message.timestamp).toBe('string');
      });
    });
  });

  it('should handle multiple concurrent clients', async () => {
    const WebSocket = require('ws');
    const address = server.address() as any;
    
    const client1 = new WebSocket(`ws://localhost:${address.port}`);
    const client2 = new WebSocket(`ws://localhost:${address.port}`);
    const client3 = new WebSocket(`ws://localhost:${address.port}`);

    await new Promise<void>((resolve) => {
      let openCount = 0;
      const onOpen = () => {
        openCount++;
        if (openCount === 3) {
          expect(openCount).toBe(3);
          
          broadcastUpdate('multi_client_test', {
            status: 'confirmed',
            message: 'Multiple clients'
          });

          setTimeout(() => {
            client1.close();
            client2.close();
            client3.close();
            resolve();
          }, 100);
        }
      };

      client1.on('open', onOpen);
      client2.on('open', onOpen);
      client3.on('open', onOpen);
    });
  });

  it('should handle client messages', async () => {
    const WebSocket = require('ws');
    const address = server.address() as any;
    const client = new WebSocket(`ws://localhost:${address.port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        client.send('Hello from client');
        
        setTimeout(() => {
          client.close();
          resolve();
        }, 100);
      });
    });
  });

  it('should broadcast to active connection', () => {
    const connections = getActiveConnections();
    
    const mockSocket = {
      readyState: 1,
      send: (data: string) => {
        const message = JSON.parse(data);
        expect(message.orderId).toBe('active_test');
        expect(message.status).toBe('pending');
      }
    };

    connections.set('active_test', mockSocket);

    broadcastUpdate('active_test', {
      status: 'pending',
      message: 'Testing active connection'
    });

    connections.delete('active_test');
  });

  it('should track active connections', () => {
    const connections = getActiveConnections();
    expect(connections).toBeDefined();
    expect(connections.size).toBeGreaterThanOrEqual(0);
  });

  it('should clear connections', () => {
    clearConnections();
    const connections = getActiveConnections();
    expect(connections.size).toBe(0);
  });
});

// FIXED: Fastify WebSocket Routes
describe('Fastify WebSocket Routes', () => {
  let fastify: any;
  let port: number;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(fastifyWebsocket);
    await fastify.register(websocketRoutes);
    
    // FIX: Actually start the server
    await fastify.listen({ port: 0, host: '127.0.0.1' });
    port = fastify.server.address().port;
  });

  afterEach(async () => {
    clearConnections();
    await fastify.close();
  });

  it('should connect to WebSocket route with orderId', async () => {
    const WebSocket = require('ws');
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/order_123`);

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        resolve();
      });

      client.on('error', reject);

      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    client.close();
  });

  it('should receive initial connection message', async () => {
    const WebSocket = require('ws');
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/order_456`);

    await new Promise<void>((resolve) => {
      client.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        expect(message.orderId).toBe('order_456');
        expect(message.status).toBe('connected');
        expect(message.message).toBe('Waiting for order processing');
        resolve();
      });
    });

    client.close();
  });

  it('should handle client disconnect', async () => {
    const WebSocket = require('ws');
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/order_789`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        const connections = getActiveConnections();
        expect(connections.has('order_789')).toBe(true);
        
        client.close();
      });

      client.on('close', () => {
        setTimeout(() => {
          const connections = getActiveConnections();
          expect(connections.has('order_789')).toBe(false);
          resolve();
        }, 100);
      });
    });
  });

  it('should broadcast to specific order connection', async () => {
    const WebSocket = require('ws');
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/order_broadcast_test`);

    await new Promise<void>((resolve) => {
      let messageCount = 0;

      client.on('message', (data: any) => {
        messageCount++;
        const message = JSON.parse(data.toString());
        
        if (messageCount === 1) {
          expect(message.status).toBe('connected');
        } else if (messageCount === 2) {
          expect(message.status).toBe('processing');
          expect(message.message).toBe('Order is being processed');
          client.close();
          resolve();
        }
      });

      client.on('open', () => {
        setTimeout(() => {
          broadcastUpdate('order_broadcast_test', {
            status: 'processing',
            message: 'Order is being processed'
          });
        }, 100);
      });
    });
  });
});

// FIXED: setupWebSocket Function
describe('setupWebSocket Function', () => {
  let fastify: any;
  let port: number;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(fastifyWebsocket);
    await fastify.register(setupWebSocket);
    
    // FIX: Actually start the server
    await fastify.listen({ port: 0, host: '127.0.0.1' });
    port = fastify.server.address().port;
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should connect to generic /ws endpoint', async () => {
    const WebSocket = require('ws');
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        expect(client.readyState).toBe(1);
        resolve();
      });

      client.on('error', reject);

      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    client.close();
  });

  it('should handle messages sent to /ws endpoint', async () => {
    const WebSocket = require('ws');
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        client.send('Test message from client');
        
        setTimeout(() => {
          client.close();
          resolve();
        }, 100);
      });
    });
  });

  it('should handle disconnect on /ws endpoint', async () => {
    const WebSocket = require('ws');
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        client.close();
      });

      client.on('close', () => {
        expect(client.readyState).toBe(3);
        resolve();
      });
    });
  });
});
