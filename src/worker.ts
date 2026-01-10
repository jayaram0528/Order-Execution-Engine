import { Queue, Worker, Job } from 'bullmq';
import { Order } from './types';
import { db } from './database';
import { config } from './config';

// ✅ Import WebSocket broadcast function
// Check your websocket.ts - use whichever name it exports
import { broadcastUpdate } from './websocket';  
// OR: import { broadcastOrderUpdate } from './websocket';

// ✅ For DEX Router - check your dex-router.ts file
// If it exports a class, use this:
import { MockDexRouter } from './dex-router';

// OR if it exports a function, use this instead:
// import { getDexRouter } from './dex-router';

// ✅ Create Redis connection configuration (plain object for BullMQ)
const connection = {
  host: config.redis.host,
  port: config.redis.port,
  ...(config.redis.password && { password: config.redis.password }),
  ...(config.redis.username && { username: config.redis.username }),
};

// ✅ Create queue with production-ready settings
export const orderQueue = new Queue('order-processing', {
  connection,
  defaultJobOptions: {
    attempts: config.queue.maxRetries,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 3600,
      count: 100
    },
    removeOnFail: {
      age: 86400
    }
  }
});

// ✅ Process order function
async function processOrder(job: Job<Order>) {
  const order = job.data;
  const attemptNumber = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts || 3;

  try {
    console.log(`\n⏳ Processing order: ${order.id} (Attempt ${attemptNumber}/${maxAttempts})`);

    // Step 1: Update to processing
    await db.orders.update(order.id, { status: 'processing' });
    
    // ✅ Use the correct broadcast function name
    broadcastUpdate(order.id, {
      status: 'processing',
      message: 'Order is being processed',
      timestamp: new Date().toISOString()
    });

    await sleep(500);

    // Step 2: Get DEX quotes
    console.log(`  Fetching DEX quotes...`);
    
    // ✅ OPTION A: If using MockDexRouter class
    const dexRouter = new MockDexRouter();
    const raydiumQuote = await dexRouter.getRaydiumQuote(order.amount);
    const meteoraQuote = await dexRouter.getMeteorQuote(order.amount);
    
    const selectedDex = meteoraQuote.price > raydiumQuote.price ? 'METEORA' : 'RAYDIUM';
    const bestPrice = meteoraQuote.price > raydiumQuote.price ? meteoraQuote.price : raydiumQuote.price;
    
    // ✅ OPTION B: If using getDexRouter() function (comment out Option A if using this)
    // const dexRouter = getDexRouter();
    // const result = await dexRouter.getBestPrice(order.tokenIn, order.tokenOut, order.amount);
    // const selectedDex = result.selectedDex;
    // const bestPrice = result.bestPrice;

    console.log(`  Raydium: ${raydiumQuote.price.toFixed(2)} USDC (fee: ${(raydiumQuote.fee * 100).toFixed(2)}%)`);
    console.log(`  Meteora: ${meteoraQuote.price.toFixed(2)} USDC (fee: ${(meteoraQuote.fee * 100).toFixed(2)}%)`);
    console.log(`  ✅ Selected: ${selectedDex}`);

    broadcastUpdate(order.id, {
      status: 'routing',
      message: `Routing to ${selectedDex}`,
      selectedDex,
      timestamp: new Date().toISOString()
    });

    // Step 3: Building transaction
    await sleep(1000);
    broadcastUpdate(order.id, {
      status: 'building',
      message: 'Building transaction',
      timestamp: new Date().toISOString()
    });

    // Step 4: Submit transaction
    await sleep(2000 + Math.random() * 1000);
    const txHash = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    broadcastUpdate(order.id, {
      status: 'submitted',
      message: 'Transaction submitted',
      txHash,
      timestamp: new Date().toISOString()
    });

    // Step 5: Confirmation
    await sleep(1000);

    // Step 6: Completed
    await db.orders.update(order.id, {
      status: 'completed',
      selectedDex,
      executedPrice: bestPrice,
      txHash
    });

    broadcastUpdate(order.id, {
      status: 'completed',
      message: 'Order executed successfully',
      selectedDex,
      executedPrice: bestPrice,
      txHash,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Order ${order.id} completed!\n`);

    return {
      orderId: order.id,
      status: 'completed',
      selectedDex,
      executedPrice: bestPrice,
      txHash
    };

  } catch (error: any) {
    console.error(`❌ Order ${order.id} failed (Attempt ${attemptNumber}):`, error.message);

    const isFinalAttempt = attemptNumber >= maxAttempts;

    if (isFinalAttempt) {
      await db.orders.update(order.id, {
        status: 'failed',
        error: error.message
      });

      broadcastUpdate(order.id, {
        status: 'failed',
        message: `Order failed after ${attemptNumber} attempts`,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      console.error(`🚨 Order ${order.id} exhausted all retry attempts!`);
    } else {
      const nextDelay = calculateBackoffDelay(attemptNumber);
      
      broadcastUpdate(order.id, {
        status: 'retrying',
        message: `Retrying in ${nextDelay}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      console.warn(`🔄 Order ${order.id} will retry (Attempt ${attemptNumber + 1}/${maxAttempts})`);
    }

    throw error;
  }
}

// ✅ Create worker
export const orderWorker = new Worker('order-processing', processOrder, {
  connection,
  concurrency: config.queue.concurrency,
  lockDuration: 30000
});

// Event listeners
orderWorker.on('completed', (job) => {
  console.log(`🎉 Job ${job.id} completed successfully`);
});

orderWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`💥 Job ${job.id} failed: ${err.message}`);
  }
});

orderWorker.on('error', (err) => {
  console.error('⚠️ Worker error:', err.message);
});

orderWorker.on('stalled', (jobId) => {
  console.warn(`⏸️ Job ${jobId} stalled`);
});

orderWorker.on('active', (job) => {
  console.log(`▶️ Job ${job.id} is now active (processing)`);
});

// Helper functions
function calculateBackoffDelay(attemptNumber: number): string {
  const baseDelay = 2000;
  const delayMs = baseDelay * Math.pow(2, attemptNumber - 1);
  return `${(delayMs / 1000).toFixed(1)}s`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('\n🛑 Shutting down worker...');
  await orderWorker.close();
  await orderQueue.close();
  console.log('✅ Worker closed');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
