import { describe, it, expect } from 'vitest';
import { MockDexRouter, generateMockTxHash } from '../dex-router';

describe('DEX Router', () => {
  const router = new MockDexRouter();

  it('should return a quote from Raydium', async () => {
    const quote = await router.getRaydiumQuote(10);
    
    expect(quote).toBeDefined();
    expect(quote.dex).toBe('raydium');
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.fee).toBe(0.003);
    expect(quote.timestamp).toBeDefined();
  });

  it('should return a quote from Meteora', async () => {
    const quote = await router.getMeteorQuote(10);
    
    expect(quote).toBeDefined();
    expect(quote.dex).toBe('meteora');
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.fee).toBe(0.002);
    expect(quote.timestamp).toBeDefined();
  });

  it('should return different prices for Raydium and Meteora', async () => {
    const raydiumQuote = await router.getRaydiumQuote(10);
    const meteoraQuote = await router.getMeteorQuote(10);
    
    // Prices should be different due to variance
    expect(raydiumQuote.price).not.toBe(meteoraQuote.price);
  });

  it('should generate valid transaction hash', () => {
    const txHash = generateMockTxHash();
    
    expect(txHash).toBeDefined();
    expect(txHash.length).toBe(88);
    expect(typeof txHash).toBe('string');
  });

  it('should generate unique transaction hashes', () => {
    const hash1 = generateMockTxHash();
    const hash2 = generateMockTxHash();
    
    expect(hash1).not.toBe(hash2);
  });
});
