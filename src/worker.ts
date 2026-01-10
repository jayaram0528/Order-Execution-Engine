import { Queue, Worker } from 'bullmq';
import { broadcastUpdate } from './websocket';
import { MockDexRouter, generateMockTxHash } from './dex-router';
import { db } from './database';

// Connection config (not Redis instance)
const connection = {
  host: 'localhost',
  port: 6379
};

// ✅ FIXED: Removed timeout from queue (it belongs in worker)
export const orderQueue = new Queue('orders', { 
  connection,
  defaultJobOptions: {
    attempts: 3,              // ✅ Retry up to 3 times if job fails
    backoff: {
      type: 'exponential',    // ✅ Wait longer between each retry (2s, 4s, 8s)
      delay: 2000             // ✅ Initial delay: 2 seconds
    },
    removeOnComplete: {
      age: 3600,              // ✅ Keep completed jobs for 1 hour (3600 seconds)
      count: 100              // ✅ Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 86400              // ✅ Keep failed jobs for 24 hours (86400 seconds)
    }
  }
});

const dexRouter = new MockDexRouter();

export const orderWorker = new Worker(
  'orders',
  async (job) => {
    const order = job.data;
    const attemptNumber = job.attemptsMade + 1;

    try {
      console.log(`\n⏳ Processing order: ${order.id} (Attempt ${attemptNumber}/${job.opts.attempts || 3})`);

      // Step 1: Pending
      broadcastUpdate(order.id, {
        status: 'pending',
        message: 'Order received and queued',
        attempt: attemptNumber
      });

      await sleep(500);

      // Step 2: Routing
      broadcastUpdate(order.id, {
        status: 'routing',
        message: 'Comparing DEX prices...'
      });

      const raydiumQuote = await dexRouter.getRaydiumQuote(order.amount);
      const meteoraQuote = await dexRouter.getMeteorQuote(order.amount);

      console.log(`  Raydium: ${raydiumQuote.price.toFixed(2)} USDC (fee: ${(raydiumQuote.fee * 100).toFixed(2)}%)`);
      console.log(`  Meteora: ${meteoraQuote.price.toFixed(2)} USDC (fee: ${(meteoraQuote.fee * 100).toFixed(2)}%)`);

      const selectedDex = meteoraQuote.price > raydiumQuote.price ? 'meteora' : 'raydium';
      const selectedQuote = selectedDex === 'meteora' ? meteoraQuote : raydiumQuote;

      console.log(`  ✅ Selected: ${selectedDex.toUpperCase()}`);

      // Step 3: Building
      broadcastUpdate(order.id, {
        status: 'building',
        message: `Creating swap transaction on ${selectedDex}`,
        selectedDex
      });

      await sleep(1000);

      // Step 4: Submitted
      const txHash = generateMockTxHash();

      broadcastUpdate(order.id, {
        status: 'submitted',
        message: 'Transaction submitted to blockchain',
        txHash,
        selectedDex
      });

      // Step 5: Confirmation delay
      await sleep(2000 + Math.random() * 1000);

      const executedPrice = selectedQuote.price;

      // Step 6: Confirmed
      broadcastUpdate(order.id, {
        status: 'confirmed',
        message: 'Swap executed successfully',
        txHash,
        executedPrice,
        selectedDex
      });

      // Save to database
      await db.orders.update(order.id, {
        status: 'confirmed',
        txHash,
        executedPrice,
        selectedDex
      });

      console.log(`✅ Order ${order.id} completed!\n`);

      return {
        orderId: order.id,
        txHash,
        executedPrice,
        selectedDex,
        attempt: attemptNumber
      };
    } catch (error: any) {
      console.error(`❌ Order ${order.id} failed (Attempt ${attemptNumber}):`, error.message);

      // ✅ IMPROVED: Determine if this is the final attempt
      const isFinalAttempt = attemptNumber >= (job.opts.attempts || 3);

      if (isFinalAttempt) {
        // Final failure - save to database as failed
        broadcastUpdate(order.id, {
          status: 'failed',
          message: `Order failed after ${attemptNumber} attempts: ${error.message}`,
          error: error.message,
          attempts: attemptNumber
        });

        await db.orders.update(order.id, {
          status: 'failed',
          error: error.message
        });

        console.error(`🚨 Order ${order.id} exhausted all retry attempts!`);
      } else {
        // Will retry
        broadcastUpdate(order.id, {
          status: 'retrying',
          message: `Attempt ${attemptNumber} failed, retrying...`,
          error: error.message,
          nextRetryIn: calculateBackoffDelay(attemptNumber)
        });

        console.warn(`🔄 Order ${order.id} will retry (Attempt ${attemptNumber + 1}/${job.opts.attempts || 3})`);
      }

      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  },
  {
    connection,
    concurrency: 10,
    lockDuration: 30000       // ✅ FIXED: Moved timeout here (lock duration = 30 seconds)
  }
);

// ✅ NEW: Enhanced event listeners with better logging
orderWorker.on('completed', (job) => {
  console.log(`🎉 Job ${job.id} completed successfully`);
});

orderWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`💥 Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`);
    
    // Check if max attempts reached
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      console.error(`🚨 Job ${job.id} exhausted all retry attempts. Marked as permanently failed.`);
    }
  } else {
    console.error(`💥 Job failed: ${err.message}`);
  }
});

// ✅ NEW: Additional event listeners for better monitoring
orderWorker.on('error', (err) => {
  console.error('⚠️ Worker error:', err.message);
});

orderWorker.on('stalled', (jobId) => {
  console.warn(`⏸️ Job ${jobId} stalled (timeout or worker crash). Will retry automatically.`);
});

orderWorker.on('active', (job) => {
  console.log(`▶️ Job ${job.id} is now active (processing)`);
});

orderWorker.on('progress', (job, progress) => {
  console.log(`📊 Job ${job.id} progress: ${progress}%`);
});

// ✅ NEW: Helper function to calculate backoff delay
function calculateBackoffDelay(attemptNumber: number): string {
  const baseDelay = 2000; // 2 seconds
  const delayMs = baseDelay * Math.pow(2, attemptNumber - 1);
  return `${(delayMs / 1000).toFixed(1)}s`;
}

// ✅ NEW: Graceful shutdown handler
async function gracefulShutdown() {
  console.log('\n🛑 Shutting down worker gracefully...');
  
  await orderWorker.close();
  await orderQueue.close();
  
  console.log('✅ Worker and queue closed successfully');
  process.exit(0);
}

// Listen for shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
