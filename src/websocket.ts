import { FastifyInstance } from 'fastify';
import { WebSocketServer } from 'ws';

const activeConnections = new Map<string, any>();
export let wss: WebSocketServer;

// Main WebSocket routes for Fastify
export async function websocketRoutes(fastify: FastifyInstance) {
  
  fastify.get('/ws/:orderId', { websocket: true }, (socket, request) => {
    const orderId = (request.params as any).orderId;

    console.log(`📡 WebSocket connected for order ${orderId}`);
    activeConnections.set(orderId, socket);

    // Send initial message
    socket.send(JSON.stringify({
      orderId,
      status: 'connected',
      message: 'Waiting for order processing',
      timestamp: new Date().toISOString()
    }));

    // Handle disconnect
    socket.on('close', () => {
      activeConnections.delete(orderId);
      console.log(`🔌 WebSocket disconnected for order ${orderId}`);
    });
  });
}

// Function to broadcast updates (main functionality)
export function broadcastUpdate(orderId: string, data: any) {
  const socket = activeConnections.get(orderId);
  
  if (socket && socket.readyState === 1) { // 1 = OPEN
    socket.send(JSON.stringify({
      orderId,
      timestamp: new Date().toISOString(),
      ...data
    }));
    console.log(`📨 Sent update: ${orderId} → ${data.status}`);
  } else if (wss) {
    // Fallback to broadcast to all clients if specific connection not found
    const message = JSON.stringify({
      orderId,
      timestamp: new Date().toISOString(),
      ...data
    });

    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    });
  }
}

// Export this function for Fastify plugin (used in tests)
export function setupWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    console.log('🔌 Client connected via WebSocket');

    socket.on('message', (message) => {
      console.log('📩 Received:', message.toString());
    });

    socket.on('close', () => {
      console.log('👋 Client disconnected');
    });
  });
}

// Export this function for standalone server (used in tests)
export function initializeWebSocket(server: any) {
  wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');
    
    ws.on('message', (message) => {
      console.log('📩 Received message:', message.toString());
    });

    ws.on('close', () => {
      console.log('👋 Client disconnected');
    });
  });
}

// Export active connections for testing
export function getActiveConnections() {
  return activeConnections;
}

// Clear connections (useful for tests)
export function clearConnections() {
  activeConnections.clear();
}
