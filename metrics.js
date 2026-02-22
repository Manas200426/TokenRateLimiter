const metrics = {
  totalRequests: 0,
  allowedRequests: 0,
  blockedRequests: 0,
};

function recordAllowed() {
  metrics.totalRequests++;
  metrics.allowedRequests++;
}

function recordBlocked() {
  metrics.totalRequests++;
  metrics.blockedRequests++;
}

function getMetrics() {
  return metrics;
}

module.exports = {
  recordAllowed,
  recordBlocked,
  getMetrics,
};