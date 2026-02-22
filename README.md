#  Node.js Token Bucket Rate Limiter

This project implements a custom Token Bucket Rate Limiter middleware in Node.js using Express.

The service simulates handling API requests from thousands of users while protecting the server from abuse caused by excessive requests.

The rate limiter is implemented from scratch without using external libraries to demonstrate backend engineering and system design concepts.

---

#  Features

 Token Bucket Algorithm implementation  
 Per-IP rate limiting  
 Express middleware integration  
 Request logging (Allowed / Blocked)  
 Production problem simulation  
 Scalable architecture explanation using Redis  

---

#  Token Bucket Algorithm

Each user (IP address) has a bucket with:

- Capacity = 10 tokens
- Refill Rate = 1 token per second
- Each request consumes 1 token

If tokens are available → request allowed  
If bucket empty → HTTP 429 Too Many Requests  

Tokens refill over time automatically based on elapsed time.

This approach allows burst traffic while maintaining long-term rate limits.

---

#  How to Run

Install dependencies:

```bash
npm install