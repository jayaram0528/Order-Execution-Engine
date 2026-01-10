interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  username?: string;
}

// Parse Railway's REDIS_URL environment variable
function getRedisConfig(): RedisConfig {
  // Railway provides REDIS_URL in format: redis://default:password@host:port
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      return {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        username: url.username !== 'default' ? url.username : undefined,
      };
    } catch (error) {
      console.error('Failed to parse REDIS_URL:', error);
    }
  }
  
  // Fallback for local development
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  };
}

export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  
  // Redis configuration
  redis: getRedisConfig(),
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Queue settings
  queue: {
    concurrency: 10,
    maxRetries: 3,
  }
};

// Helper function to check if running in production
export const isProduction = () => config.nodeEnv === 'production';

// Log configuration on startup (without sensitive data)
export const logConfig = () => {
  console.log('🔧 Configuration:');
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`   Queue Concurrency: ${config.queue.concurrency}`);
  if (process.env.REDIS_URL) {
    console.log(`   ✅ Using Railway Redis (REDIS_URL detected)`);
  }
};
