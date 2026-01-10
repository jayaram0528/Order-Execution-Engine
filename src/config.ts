interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  username?: string;
}

export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  
  // Redis configuration
  redis: (() => {
    // Railway provides REDIS_URL in format: redis://user:pass@host:port
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL);
      return {
        host: url.hostname,
        port: parseInt(url.port, 10),
        password: url.password || undefined,
        username: url.username || undefined,
      } as RedisConfig;
    }
    // Fallback for local development
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    } as RedisConfig;
  })(),
  
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
};
