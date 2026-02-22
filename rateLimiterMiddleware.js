const TokenBucket = require("./tokenBucket");
const { client } = require("./redisClient");

const CAPACITY = 10;
const REFILL_RATE = 1;

async function rateLimiter(req, res, next) {
  const ip = req.ip;
  const key = `rate_limit:${ip}`;

  try {
    const now = Date.now();

    let data = await client.get(key);

    let bucket;

    if (!data) {
      // First time user → create bucket
      bucket = new TokenBucket(CAPACITY, REFILL_RATE);
    } else {
      const parsed = JSON.parse(data);

      bucket = new TokenBucket(CAPACITY, REFILL_RATE);
      bucket.tokens = parsed.tokens;
      bucket.lastRefill = parsed.lastRefill;
    }

    const allowed = bucket.consume();

    // Save updated bucket to Redis
    await client.set(
      key,
      JSON.stringify({
        tokens: bucket.tokens,
        lastRefill: bucket.lastRefill,
      })
    );

    if (allowed) {
      console.log(`Allowed request from ${ip}`);
      next();
    } else {
      console.log(` Blocked request from ${ip}`);
      res.status(429).json({
        message: "Too Many Requests",
      });
    }
  } catch (err) {
    console.error("Rate limiter error:", err);
    next(); // fail open
  }
}

module.exports = rateLimiter;