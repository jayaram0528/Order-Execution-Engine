import { FastifyInstance, FastifyError } from 'fastify';
import { OrderRequest, OrderResponse } from './types';
import { orderQueue } from './worker';
import { db } from './database';

export async function orderRoutes(fastify: FastifyInstance) {
  
  // POST /api/orders/execute
  fastify.post<{ Body: OrderRequest }>(
    '/api/orders/execute',
    async (request, reply) => {
      try {
        const { tokenIn, tokenOut, amount, slippage } = request.body;

        // ✅ IMPROVED: Detailed validation with specific error codes
        if (!tokenIn) {
          return reply.code(400).send({
            error: 'MISSING_TOKEN_IN',
            message: 'tokenIn field is required (e.g., "SOL", "USDC")',
            code: 'ERR_001',
            field: 'tokenIn',
            example: { tokenIn: 'SOL', tokenOut: 'USDC', amount: 10 }
          });
        }

        if (!tokenOut) {
          return reply.code(400).send({
            error: 'MISSING_TOKEN_OUT',
            message: 'tokenOut field is required (e.g., "SOL", "USDC")',
            code: 'ERR_002',
            field: 'tokenOut',
            example: { tokenIn: 'SOL', tokenOut: 'USDC', amount: 10 }
          });
        }

        if (amount === undefined || amount === null) {
          return reply.code(400).send({
            error: 'MISSING_AMOUNT',
            message: 'amount field is required and must be a positive number',
            code: 'ERR_003',
            field: 'amount',
            example: { tokenIn: 'SOL', tokenOut: 'USDC', amount: 10 }
          });
        }

        if (typeof amount !== 'number') {
          return reply.code(400).send({
            error: 'INVALID_AMOUNT_TYPE',
            message: 'amount must be a number',
            code: 'ERR_004',
            field: 'amount',
            receivedType: typeof amount,
            receivedValue: amount
          });
        }

        if (amount <= 0) {
          return reply.code(400).send({
            error: 'INVALID_AMOUNT',
            message: 'Amount must be greater than 0',
            code: 'ERR_005',
            field: 'amount',
            receivedValue: amount,
            minimumValue: 0.000001
          });
        }

        if (slippage !== undefined) {
          if (typeof slippage !== 'number') {
            return reply.code(400).send({
              error: 'INVALID_SLIPPAGE_TYPE',
              message: 'slippage must be a number',
              code: 'ERR_006',
              field: 'slippage',
              receivedType: typeof slippage
            });
          }

          if (slippage < 0 || slippage > 1) {
            return reply.code(400).send({
              error: 'INVALID_SLIPPAGE_RANGE',
              message: 'Slippage must be between 0 and 1 (e.g., 0.05 for 5%)',
              code: 'ERR_007',
              field: 'slippage',
              receivedValue: slippage,
              validRange: { min: 0, max: 1 },
              example: 0.05
            });
          }
        }

        // ✅ Validate token symbols (basic check)
        const validTokenPattern = /^[A-Z0-9]{2,10}$/;
        if (!validTokenPattern.test(tokenIn)) {
          return reply.code(400).send({
            error: 'INVALID_TOKEN_IN',
            message: 'tokenIn must be a valid token symbol (2-10 uppercase letters/numbers)',
            code: 'ERR_008',
            field: 'tokenIn',
            receivedValue: tokenIn,
            example: 'SOL'
          });
        }

        if (!validTokenPattern.test(tokenOut)) {
          return reply.code(400).send({
            error: 'INVALID_TOKEN_OUT',
            message: 'tokenOut must be a valid token symbol (2-10 uppercase letters/numbers)',
            code: 'ERR_009',
            field: 'tokenOut',
            receivedValue: tokenOut,
            example: 'USDC'
          });
        }

        // ✅ Check if tokens are the same
        if (tokenIn === tokenOut) {
          return reply.code(400).send({
            error: 'SAME_TOKEN_SWAP',
            message: 'tokenIn and tokenOut cannot be the same',
            code: 'ERR_010',
            receivedValues: { tokenIn, tokenOut }
          });
        }

        // Generate orderId
        const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Create order object
        const order = {
          id: orderId,
          tokenIn,
          tokenOut,
          amount,
          slippage: slippage || 0.05,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Save to database
        await db.orders.create(order);

        // Add to BullMQ queue
        await orderQueue.add(orderId, order);

        console.log(`✅ Order ${orderId} created and queued`);

        // ✅ IMPROVED: Return more details
        reply.code(202).send({ 
          orderId,
          status: 'accepted',
          message: 'Order has been queued for processing',
          websocketUrl: `/ws/${orderId}`,
          estimatedProcessingTime: '3-5 seconds'
        } as OrderResponse);
      } catch (error: any) {
        console.error('❌ Error creating order:', error.message);
        
        // ✅ IMPROVED: Structured error response
        reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while processing your order',
          code: 'ERR_500',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // GET /api/orders/:orderId
  fastify.get<{ Params: { orderId: string } }>(
    '/api/orders/:orderId',
    async (request, reply) => {
      try {
        const { orderId } = request.params;

        // ✅ IMPROVED: Validate orderId format
        if (!orderId || orderId.trim() === '') {
          return reply.code(400).send({
            error: 'INVALID_ORDER_ID',
            message: 'orderId parameter is required',
            code: 'ERR_011',
            field: 'orderId'
          });
        }

        const order = await db.orders.getById(orderId);

        if (!order) {
          return reply.code(404).send({
            error: 'ORDER_NOT_FOUND',
            message: `Order with ID '${orderId}' does not exist`,
            code: 'ERR_404',
            orderId,
            suggestion: 'Check if the orderId is correct or use GET /api/orders to list all orders'
          });
        }

        reply.send(order);
      } catch (error: any) {
        console.error(`❌ Error fetching order ${request.params.orderId}:`, error.message);
        
        reply.code(500).send({
          error: 'DATABASE_ERROR',
          message: 'Failed to retrieve order from database',
          code: 'ERR_502',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // GET /api/orders (list all)
  fastify.get('/api/orders', async (request, reply) => {
    try {
      const orders = await db.orders.getAll();
      
      // ✅ IMPROVED: Return count and metadata
      reply.send({
        total: orders.length,
        orders,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error fetching orders:', error.message);
      
      reply.code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve orders from database',
        code: 'ERR_503',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  });

  // ✅ NEW: Health check endpoint
  fastify.get('/api/health', async () => {
    return {
      status: 'healthy',
      service: 'order-execution-engine',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    };
  });

  // ✅ NEW: 404 handler for unknown API routes
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'ROUTE_NOT_FOUND',
      message: `Route ${request.method} ${request.url} does not exist`,
      code: 'ERR_404',
      availableRoutes: [
        'POST /api/orders/execute - Create a new swap order',
        'GET /api/orders/:orderId - Get order details',
        'GET /api/orders - List all orders',
        'GET /api/health - Health check',
        'GET /ws/:orderId - WebSocket connection for real-time updates'
      ],
      timestamp: new Date().toISOString()
    });
  });

  // ✅ NEW: Global error handler (FULLY FIXED)
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    console.error('🚨 Unhandled API Error:', error);
    
    // Get status code, fallback to 500
    const statusCode = error.statusCode || 500;
    
    // Build error response
    const errorResponse: any = {
      error: error.name || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred',
      code: `ERR_${statusCode}`,
      timestamp: new Date().toISOString()
    };

    // Add validation details if present
    if ('validation' in error) {
      errorResponse.error = 'VALIDATION_ERROR';
      errorResponse.message = 'Request validation failed';
      errorResponse.details = error.validation;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      errorResponse.stack = error.stack;
    }
    
    reply.code(statusCode).send(errorResponse);
  });
}
