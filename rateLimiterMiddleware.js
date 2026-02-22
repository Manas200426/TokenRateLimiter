const TokenBucket = require("./tokenBucket");
const { client } = require("./redisClient");
const logger = require("./logger");
const { recordAllowed, recordBlocked } = require("./metrics");

const CAPACITY = 10;
const REFILL_RATE = 1;

async function rateLimiter(req, res, next) {
  const ip = req.ip;
  const key = `rate_limit:${ip}`;
  const start = Date.now();

  try {
    const now = Date.now();

    let data = await client.get(key);

    let bucket;

    if (!data) {
      bucket = new TokenBucket(CAPACITY, REFILL_RATE);
    } else {
      const parsed = JSON.parse(data);

      bucket = new TokenBucket(CAPACITY, REFILL_RATE);
      bucket.tokens = parsed.tokens;
      bucket.lastRefill = parsed.lastRefill;
    }

    const allowed = bucket.consume();

    await client.set(
      key,
      JSON.stringify({
        tokens: bucket.tokens,
        lastRefill: bucket.lastRefill,
      })
    );

    const duration = Date.now() - start;

    if (allowed) {
      recordAllowed();

      logger.info({
        ip,
        endpoint: req.originalUrl,
        status: "allowed",
        durationMs: duration,
      });

      next();
    } else {
      recordBlocked();

      logger.warn({
        ip,
        endpoint: req.originalUrl,
        status: "blocked",
        durationMs: duration,
      });

      res.status(429).json({
        message: "Too Many Requests",
      });
    }
  } catch (err) {
    logger.error({ err }, "Rate limiter error");
    next();
  }
}

module.exports = rateLimiter;