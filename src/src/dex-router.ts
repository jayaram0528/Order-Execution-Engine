export interface Quote {
  dex: 'raydium' | 'meteora';
  price: number;
  fee: number;
  timestamp: string;
}

export class MockDexRouter {
  private basePrice = 200; // 1 SOL = 200 USDC

  async getRaydiumQuote(amount: number): Promise<Quote> {
    await this.sleep(200); // Simulate network delay
    
    const variance = 0.98 + Math.random() * 0.04; // ±2%
    const price = this.basePrice * variance * amount;

    return {
      dex: 'raydium',
      price,
      fee: 0.003, // 0.3%
      timestamp: new Date().toISOString()
    };
  }

  async getMeteorQuote(amount: number): Promise<Quote> {
    await this.sleep(200);
    
    const variance = 0.97 + Math.random() * 0.05; // ±2.5%
    const price = this.basePrice * variance * amount;

    return {
      dex: 'meteora',
      price,
      fee: 0.002, // 0.2%
      timestamp: new Date().toISOString()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function generateMockTxHash(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 88; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return hash;
}
