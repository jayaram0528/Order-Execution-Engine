export type OrderStatus = 'pending' | 'routing' | 'building' | 'submitted' | 'confirmed' | 'failed';

export interface Order {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  slippage: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderRequest {
  tokenIn: string;
  tokenOut: string;
  amount: number;
  slippage: number;
}

export interface OrderResponse {
  orderId: string;
}
