class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;          // max tokens
    this.refillRate = refillRate;      // tokens per second
    this.tokens = capacity;            // start full
    this.lastRefill = Date.now();      // timestamp in ms
  }

  refill() {
    const now = Date.now();

    const elapsedTime = (now - this.lastRefill) / 1000; // convert ms → sec

    const tokensToAdd = elapsedTime * this.refillRate;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(
        this.capacity,
        this.tokens + tokensToAdd
      );

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