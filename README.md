#  Order Execution Engine

A **high‑performance decentralized exchange (DEX) order execution and routing engine** designed to demonstrate how real‑world trading systems work under the hood — fast, reliable, and observable in real time.

This project emphasizes **clean architecture**, **production‑ready backend patterns**, and **excellent developer experience**, while keeping the system easy to read, reason about, and extend.

![Tests](https://img.shields.io/badge/tests-96%20passed-success)
![Coverage](https://img.shields.io/badge/coverage-91.79%25-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)

---

##  What This Project Does (At a Glance)

* Accepts trade requests (e.g., **SOL → USDC**)
* Compares prices across multiple DEXs (Raydium & Meteora)
* Automatically selects the **best execution price**
* Executes orders asynchronously using a queue‑based worker model
* Streams **real‑time order status updates** to clients via WebSockets

All of this is implemented as a **type‑safe, well‑tested, and scalable backend system** suitable for real production environments.

---

##  Key Features

### Smart DEX Routing

Automatically compares prices from **Raydium** and **Meteora** and routes each order to the DEX offering the best execution price.

### Real‑Time Order Updates

Clients receive **live order status updates** (pending → executing → completed) using WebSockets, enabling reactive UIs and monitoring tools.

### Queue‑Based Order Processing

Uses **BullMQ + Redis** to safely process concurrent orders, handle retries, and decouple API requests from execution logic.

### Reliable Error Handling

Built‑in **automatic retries with exponential backoff**:

* 2 seconds → 4 seconds → 8 seconds

This ensures resilience against temporary failures and external service instability.

### Type‑Safe by Design

Written entirely in **TypeScript**, reducing runtime errors and improving long‑term maintainability.

### Production‑Grade Testing

* **96 tests passing**
* **91.79% overall coverage**

This is not a toy project — it follows real production quality standards.

---

## Order Type Choice: Market Orders

### Why Market Orders?

For this implementation, I intentionally started with **Market Orders**.

**Rationale:**

1. **Focus on Core Architecture**
   Market orders execute immediately, making them ideal for demonstrating the complete execution pipeline — routing, queuing, execution, persistence, and WebSocket updates — without additional complexity.

2. **Predictable & Testable Behavior**
   Immediate execution results in deterministic outcomes, simpler test cases, and fewer edge conditions compared to conditional orders.

3. **Production‑Realistic**
   Market orders are the most common order type and form the foundation of most trading systems.

---

## Extending to Other Order Types

The system is **designed for extensibility**. Only the *trigger mechanism* changes — the core execution pipeline remains untouched.

### Limit Orders

* Add a background worker that periodically polls DEX prices (every N seconds)
* When the target price is reached, trigger the existing `processOrder()` flow

No changes are required to:

* Queue system
* DEX router
* WebSocket updates
* Retry logic

### Sniper Orders (Token Launch Trades)

* Subscribe to Raydium/Meteora pool‑creation events via WebSockets
* On token launch detection:

  * Immediately enqueue the order with **high priority**
  * Apply higher slippage tolerance to account for launch volatility

### Shared Across All Order Types

* DEX routing logic
* BullMQ queue
* WebSocket infrastructure
* Retry & error handling
* Database layer

---

## High‑Level Architecture

```
Client Request
      ↓
Fastify API
      ↓
BullMQ Queue (Redis)
      ↓
Worker Process
      ↓
DEX Router (Raydium vs Meteora)
      ↓
Order Execution
      ↓
Database Update
      ↓
WebSocket → Live Client Updates
```

Each component has a **single responsibility**, making the system easy to scale, test, and reason about.

---

## Design Decisions

This project was built with **real-world production systems** in mind — not just to "make it work." Every architectural choice was intentional and grounded in how modern trading platforms are designed.

* **Why Fastify over Express?**
  Fastify offers significantly higher throughput and lower latency compared to Express, with first-class TypeScript support and built-in schema validation. When processing large volumes of orders, performance and safety matter.

* **Why BullMQ instead of simple in-memory queues?**
  BullMQ provides production-grade capabilities out of the box: retries, backoff strategies, job prioritization, persistence, and observability — all backed by Redis. These are essential features for any serious trading or financial system.

* **Why separate the Worker from the API?**
  Decoupling request handling from execution allows independent horizontal scaling. API servers can scale for traffic, while workers scale for throughput. This pattern is standard in high-frequency and event-driven systems.

* **Why PostgreSQL for history and Redis for active orders?**
  Active orders require ultra-low latency access — Redis excels here. Historical order data benefits from relational queries, indexing, and ACID guarantees — PostgreSQL is the right tool for the job. This hybrid storage model is common in fintech systems.

* **Why WebSockets over polling?**
  Trading systems demand near real-time feedback. WebSockets provide persistent, low-latency communication without the overhead of repeated HTTP polling, enabling a smoother and more responsive trading experience.

* **Why Market Orders first?**
  Market orders form the foundation of any exchange or trading engine. By implementing them first, the core execution pipeline is validated before introducing additional complexity such as limit or sniper orders.

These decisions reflect patterns used in real-world platforms like Binance and Coinbase. The goal was to demonstrate not only **how** to build a trading engine, but **why** it should be built this way.

---

## Tech Stack

* **Runtime:** Node.js 20+ with TypeScript
* **API Framework:** Fastify (high‑performance HTTP server)
* **Queue System:** BullMQ + Redis
* **Database:** PostgreSQL (production) / In‑memory (development)
* **WebSockets:** @fastify/websocket
* **Testing:** Vitest + V8 Coverage
* **Deployment:** Railway (PostgreSQL + Redis + App)

---

## Getting Started

### Prerequisites

* Node.js 20+
* Redis (required for queue processing)
* PostgreSQL (optional — required only for production mode)

### Installation

```bash
# Clone the repository
git clone https://github.com/jayaram0528/Order-Execution-Engine.git
cd Order-Execution-Engine

# Install dependencies
npm install
```

### Start Redis

Choose one option:

```bash
# Docker
docker run -d -p 6379:6379 redis:alpine
```

```bash
# WSL
sudo service redis-server start
```

(Windows users can download Redis directly from the official site.)

### Run the Application

```bash
# Development mode (hot reload)
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Start production server
npm start
```

Server runs at:

```
http://localhost:3000
```

---

## API Reference

###  Create an Order

**POST** `/api/orders/execute`

```json
{
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amount": 10,
  "slippage": 0.01
}
```

**Response (202 – Accepted):**

```json
{
  "orderId": "order_1768048336478_y769la",
  "status": "pending",
  "message": "Order created and queued successfully"
}
```

---

###  Get Order Status

**GET** `/api/orders/:orderId`

```json
{
  "id": "order_123",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amount": 10,
  "status": "completed",
  "selectedDex": "RAYDIUM",
  "executedPrice": 2024.50
}
```

---

###  List All Orders

**GET** `/api/orders`

---

## WebSocket Streaming

Subscribe to real‑time updates for a specific order:

```js
const ws = new WebSocket('ws://localhost:3000/ws/order_123');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(update);
};
```

---

## Postman Collection

A ready‑to‑use **Postman collection** is included in this repository for easy API testing and validation.

### What’s Included

The `postman_collection.json` file contains pre‑configured requests:

* Health Check — verify the API is running
* Create Market Order — submit a new order
* Get Order by ID — retrieve order details
* List All Orders — fetch order history
* Invalid Order Test — validate error handling

### How to Use

#### Option 1: Postman UI

1. Open Postman (Desktop or Web)
2. Click **Import**
3. Select `postman_collection.json`
4. Set environment variable `baseUrl`:

   * Local: `http://localhost:3000`
   * Production: `https://order-execution-engine-production-c76b.up.railway.app`
5. Send requests and observe responses

#### Option 2: Newman (CLI)

```bash
# Install Newman
npm install -g newman

# Run against local API
newman run postman_collection.json --env-var "baseUrl=http://localhost:3000"

# Run against production
newman run postman_collection.json --env-var "baseUrl=https://order-execution-engine-production-c76b.up.railway.app"
```

---

## Test Coverage Summary

| File          | % Stmts | % Branch | % Funcs | % Lines |
| ------------- | ------- | -------- | ------- | ------- |
| All files     | 91.79   | 76.92    | 95.45   | 91.66   |
| database.ts   | 100     | 100      | 100     | 100 ✅   |
| dex-router.ts | 100     | 100      | 100     | 100 ✅   |
| routes.ts     | 92.3    | 80.76    | 100     | 92.3 ✅  |
| websocket.ts  | 100     | 87.5     | 100     | 100 ✅   |
| worker.ts     | 83.07   | 61.11    | 81.81   | 82.81 ✅ |

**14 test suites | 96 tests passed**

---

## End‑to‑End Flow

1. Client submits an order
2. API validates and queues the request
3. Worker processes the job
4. DEX router compares prices
5. Best execution path is selected
6. Order is executed
7. Live updates stream via WebSocket
8. Order is persisted as `completed`

---

## Project Structure

```
order-execution-engine/
├── src/
│   ├── server.ts         # Server entry point
│   ├── types.ts          # Shared TypeScript types
│   ├── config.ts         # Environment configuration
│   ├── database.ts       # PostgreSQL database layer
│   ├── dex-router.ts     # DEX price comparison logic
│   ├── routes.ts         # REST API endpoints
│   ├── websocket.ts      # WebSocket server
│   └── worker.ts         # Background job processor
├── src/tests/            # 14 test suites (96 tests)
├── postman_collection.json
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Live Deployment

**Production URL:**
[https://order-execution-engine-production-c76b.up.railway.app](https://order-execution-engine-production-c76b.up.railway.app)

### Try It Live

```bash
# Health Check
curl https://order-execution-engine-production-c76b.up.railway.app/health

# Create an Order
curl -X POST https://order-execution-engine-production-c76b.up.railway.app/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amount": 10,
    "slippage": 0.01
  }'
```

WebSocket:

```js
const ws = new WebSocket(
  'wss://order-execution-engine-production-c76b.up.railway.app/ws/ORDER_ID'
);

ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

---

## Infrastructure

The application is deployed on **Railway** with:

* ✅ PostgreSQL for persistent order history
* ✅ Redis for queue management
* ✅ Auto‑deploy on pushes to the `main` branch

---

## Future Improvements

* Connect to real Solana DEX APIs (Raydium / Meteora SDKs)
* Add JWT‑based authentication
* Implement rate limiting and request throttling
* Add Prometheus metrics & observability dashboards
* Horizontal scaling with multiple workers
* WebSocket clustering for multi‑server deployments

---

## License

MIT License — free to use for learning, experimentation, and portfolio projects.

---

## Author

**Jayaram**
GitHub: **@jayaram0528**

> If you’re reviewing this as a recruiter or engineer: this project is meant to demonstrate **system design, backend engineering, and real‑world reliability patterns** — not just code that “works.”
