import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { orderRoutes } from './routes';
import { websocketRoutes } from './websocket';
import { initializeDatabase } from './database';
import './worker'; // Import worker to start it

const fastify = Fastify({ logger: true });

// Register plugins
fastify.register(fastifyCors, { origin: '*' });
fastify.register(fastifyWebsocket);

// Register routes
fastify.register(orderRoutes);
fastify.register(websocketRoutes);

// Health check route
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    // Initialize database
    await initializeDatabase();

    const port = 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`✅ Server running on http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
