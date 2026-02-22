const express = require("express");
const rateLimiter = require("./rateLimiterMiddleware");
const { connectRedis } = require("./redisClient");
const { getMetrics } = require("./metrics");
const app = express();
const PORT = 3000;

app.get("/api/data", rateLimiter, (req, res) => {
  res.json({ message: "Here is your data" });
});
app.get("/metrics", (req, res) => {
  res.json(getMetrics());
});
async function startServer() {
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();