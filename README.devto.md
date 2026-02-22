# Node.js Token Bucket Rate Limiter

This is a compact, production-minded implementation of a Token Bucket rate limiter for Express. It demonstrates a per-IP token-bucket, request logging, metrics, and a Redis-backed approach for correctness under concurrency and horizontal scaling.

TL;DR

- Capacity: 10 tokens per IP
- Refill: 1 token / second
- Each request consumes 1 token
- State persisted in Redis; recommended atomic updates via Redis Lua scripting

Why this project

Implementing a simple in-memory limiter is straightforward, but it fails when multiple Node processes or concurrent requests are involved. Persisting per-IP state in Redis and performing atomic updates prevents race conditions and makes the limiter safe for production-like environments. This repo keeps the implementation small and easy to follow.

Features

- Token Bucket algorithm (burst + steady-rate control)
- Per-IP state persisted in Redis
- Designed for atomic, server-side updates in Redis (Lua/EVAL recommended)
- Request logging via `pino`
- Minimal metrics endpoint for quick observability

How it works

1. Request arrives at `/api/data`.
2. Middleware looks up per-IP token state in Redis.
3. Refill and consume logic runs atomically in Redis (recommended via Lua script).
4. If a token is available the middleware calls `next()`; otherwise it returns HTTP 429.

Correctness note — why Redis

If you do a `GET` → modify → `SET` from Node, two concurrent requests can both read the same state and both consume the same token, allowing more requests than intended. By moving the read-modify-write to Redis (a single `EVAL`/Lua call) the operation becomes atomic and Redis guarantees no interleaving between concurrent requests.

Installation

```bash
npm install
```

Run (local)

Make sure Redis is running locally on `redis://localhost:6379` then:

```bash
node server.js
```

Endpoints

- `GET /api/data` — protected endpoint
- `GET /metrics` — in-memory metrics (total/allowed/blocked)

Key files

- `rateLimiterMiddleware.js` — middleware, currently reads/writes Redis; recommended atomic update is described below
- `tokenBucket.js` — token bucket model used when state is reconstructed in JS
- `redisClient.js` — Redis connection helper
- `metrics.js` — simple in-memory counters

Examples / code snippets

Token bucket model (`tokenBucket.js`):

```js
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.refillRate = refillRate; // tokens per second
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const toAdd = elapsed * this.refillRate;
    if (toAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + toAdd);
      this.lastRefill = now;
    }
  }

  consume() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

module.exports = TokenBucket;
```

Simplified Redis client (`redisClient.js`):

```js
const { createClient } = require("redis");
const client = createClient({ url: "redis://localhost:6379" });
client.on("error", (err) => console.error("Redis Error:", err));
async function connectRedis() {
  if (!client.isOpen) await client.connect();
}
module.exports = { client, connectRedis };
```

Atomic Lua script (pseudocode) to run inside Redis:

```lua
-- ARGV: capacity, refillRate, now, ttl
local v = redis.call('GET', KEYS[1])
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local tokens = capacity
local lastRefill = now
if v then
  local obj = cjson.decode(v)
  tokens = tonumber(obj.tokens) or capacity
  lastRefill = tonumber(obj.lastRefill) or now
end
local elapsed = (now - lastRefill) / 1000
local add = elapsed * refillRate
if add > 0 then tokens = math.min(capacity, tokens + add); lastRefill = now end
if tokens >= 1 then
  tokens = tokens - 1
  redis.call('SET', KEYS[1], cjson.encode({tokens=tokens,lastRefill=lastRefill}))
  redis.call('EXPIRE', KEYS[1], ttl)
  return {1, tokens}
else
  redis.call('SET', KEYS[1], cjson.encode({tokens=tokens,lastRefill=lastRefill}))
  redis.call('EXPIRE', KEYS[1], ttl)
  return {0, tokens}
end
```

How to call the script from Node (node-redis v4):

```js
const lua = `...`; // load the Lua script string
const res = await client.eval(lua, {
  keys: [key],
  arguments: [CAPACITY, REFILL_RATE, Date.now(), ttlSec],
});
// res[1] => allowed (1|0), res[2] => remaining tokens
```

Example server usage (`server.js`):

```js
const express = require("express");
const rateLimiter = require("./rateLimiterMiddleware");
const { connectRedis } = require("./redisClient");
const app = express();
await connectRedis();
app.get("/api/data", rateLimiter, (req, res) =>
  res.json({ message: "Here is your data" }),
);
app.listen(3000);
```

Source & repo

Full source for this project is available on GitHub: https://github.com/Manas200426/TokenRateLimiter

Atomic Redis script (recommended)

Use a small Lua script so refill + consume is executed inside Redis atomically. Pseudocode Lua flow:

```lua
local v = redis.call('GET', KEYS[1])
local tokens, lastRefill = capacity, now
if v then
  local obj = cjson.decode(v)
  tokens = tonumber(obj.tokens) or capacity
  lastRefill = tonumber(obj.lastRefill) or now
end
local elapsed = (now - lastRefill) / 1000
local add = elapsed * refillRate
if add > 0 then tokens = math.min(capacity, tokens + add); lastRefill = now end
if tokens >= 1 then
  tokens = tokens - 1
  redis.call('SET', KEYS[1], cjson.encode({tokens=tokens, lastRefill=lastRefill}))
  redis.call('EXPIRE', KEYS[1], ttl)
  return {1, tokens}
else
  redis.call('SET', KEYS[1], cjson.encode({tokens=tokens, lastRefill=lastRefill}))
  redis.call('EXPIRE', KEYS[1], ttl)
  return {0, tokens}
end
```

Call it from Node using `client.eval(luaScript, { keys: [key], arguments: [capacity, refillRate, Date.now(), ttl] })`.

Operational tips

- Set a sensible TTL on per-IP keys to auto-expire idle entries (e.g. a couple of refill periods).
- Store `tokens` as a number and `lastRefill` as epoch ms.
- Decide fail-open vs fail-closed for Redis errors; this project currently logs errors and lets requests through.

Credits & license

Small demo project for learning . Use as you like.
