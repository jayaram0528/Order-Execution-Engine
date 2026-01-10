# 🚀 Order Execution Engine

A high-performance decentralized exchange (DEX) order routing system with real-time WebSocket updates and intelligent price comparison.

![Tests](https://img.shields.io/badge/tests-96%20passed-success)
![Coverage](https://img.shields.io/badge/coverage-91.79%25-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)

## ✨ Features

- **Smart DEX Routing** - Automatically compares Raydium and Meteora to get the best execution price
- **Real-time Updates** - WebSocket streaming for live order status notifications
- **Queue Management** - Concurrent order processing using BullMQ + Redis
- **Robust Error Handling** - Automatic retries with exponential backoff (2s → 4s → 8s)
- **Type-Safe** - Built with TypeScript for reliability
- **91.79% Test Coverage** - Production-ready quality with 96 passing tests

## 🏗️ Architecture

Client Request → Fastify API → BullMQ Queue → Worker
↓ ↓ ↓
Validation Redis Store DEX Router
↓ ↓
Database ← Order Complete ← Best Price
↓
WebSocket → Real-time Updates → Client


## 📋 Tech Stack

- **Runtime:** Node.js 20+ with TypeScript
- **Web Framework:** Fastify (high performance)
- **Queue:** BullMQ + Redis (job processing)
- **WebSocket:** @fastify/websocket (real-time)
- **Testing:** Vitest + V8 coverage
- **Database:** In-memory (can be replaced with PostgreSQL/MongoDB)

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Redis (for queue system)

### Installation

```bash
# Clone repository
git clone https://github.com/jayaram0528/Order-Execution-Engine.git
cd Order-Execution-Engine

# Install dependencies
npm install

# Start Redis (choose one):
# Option 1: Docker
docker run -d -p 6379:6379 redis:alpine

# Option 2: Windows (download from https://redis.io/download)
# Option 3: WSL
sudo service redis-server start

Run the Application:
# Development mode (with hot reload)
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Start production server
npm start

Server starts at: http://localhost:3000

📡 API Documentation
Create Order
POST /api/orders/execute
Content-Type: application/json

{
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amount": 10,
  "slippage": 0.01
}


Response (202 Accepted):
{
  "orderId": "order_1768048336478_y769la",
  "status": "pending",
  "message": "Order created and queued successfully"
}

Get Order Status:
GET /api/orders/:orderId

Response (200 OK):
{
  "id": "order_123",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amount": 10,
  "status": "completed",
  "selectedDex": "RAYDIUM",
  "executedPrice": 2024.50
}

List All Orders:
GET /api/orders


🔌 WebSocket Streaming
const ws = new WebSocket('ws://localhost:3000/ws/order_123');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(update);
};

🧪 Test Coverage

File           | % Stmts | % Branch | % Funcs | % Lines
---------------|---------|----------|---------|--------
All files      |   91.79 |    76.92 |   95.45 |   91.66
database.ts    |     100 |      100 |     100 |     100 ✅
dex-router.ts  |     100 |      100 |     100 |     100 ✅
routes.ts      |    92.3 |    80.76 |     100 |    92.3 ✅
websocket.ts   |     100 |     87.5 |     100 |     100 ✅
worker.ts      |   83.07 |    61.11 |   81.81 |   82.81 ✅

Test suites: 14 passed | Tests: 96 passed


🎯 How It Works
Client submits order via POST /api/orders/execute

API validates input and adds order to BullMQ queue

Worker picks up job from queue

DEX Router compares Raydium vs Meteora prices

Worker executes order with best price

Updates broadcast via WebSocket

Order saved to database as "completed"


📁 Project Structure

order-execution-engine/
├── src/
│   ├── index.ts          # Server entry point
│   ├── types.ts          # TypeScript types
│   ├── database.ts       # In-memory database
│   ├── dex-router.ts     # DEX price comparison
│   ├── routes.ts         # API endpoints
│   ├── websocket.ts      # WebSocket server
│   └── worker.ts         # Background job processor
├── src/__tests__/        # 14 test suites
├── package.json
├── tsconfig.json
└── vitest.config.ts


🔮 Future Enhancements
 Connect to real Solana DEXs (Raydium/Meteora APIs)

 Add PostgreSQL for persistent storage

 Implement JWT authentication

 Deploy to production (Railway/AWS)

 Add Prometheus metrics

 📄 License
MIT License - feel free to use this for learning or portfolio purposes.


👨‍💻 Author
Jayaram

GitHub: @jayaram0528