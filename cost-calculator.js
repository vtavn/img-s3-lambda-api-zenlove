#!/usr/bin/env node

/**
 * 🎯 AWS Cost Calculator for Image Transformation Service
 * Tính toán chi phí cho CloudFront + API Gateway + Lambda + S3
 */

// AWS Pricing (ap-southeast-1 region)
const PRICING = {
  // S3 Pricing
  s3: {
    storage: 0.023, // $0.023 per GB per month
    getRequests: 0.0004, // $0.0004 per 1,000 GET requests
    putRequests: 0.005, // $0.005 per 1,000 PUT requests
  },

  // CloudFront Pricing
  cloudfront: {
    dataTransfer: 0.085, // $0.085 per GB (first 10TB)
    requests: 0.0075, // $0.0075 per 10,000 requests
  },

  // Lambda Pricing
  lambda: {
    requests: 0.2, // $0.20 per 1M requests
    duration: 0.0000166667, // $0.0000166667 per GB-second
    memory: 1024, // MB
  },

  // API Gateway Pricing (HTTP API v2)
  apiGateway: {
    requests: 1.0, // $1.00 per 1M requests
    dataTransfer: 0.09, // $0.09 per GB
  },
};

/**
 * Tính toán chi phí S3
 */
function calculateS3Cost(storageGB, getRequests, putRequests) {
  const storageCost = storageGB * PRICING.s3.storage;
  const getCost = (getRequests / 1000) * PRICING.s3.getRequests;
  const putCost = (putRequests / 1000) * PRICING.s3.putRequests;

  return {
    storage: storageCost,
    getRequests: getCost,
    putRequests: putCost,
    total: storageCost + getCost + putCost,
  };
}

/**
 * Tính toán chi phí CloudFront
 */
function calculateCloudFrontCost(dataTransferGB, requests) {
  const transferCost = dataTransferGB * PRICING.cloudfront.dataTransfer;
  const requestCost = (requests / 10000) * PRICING.cloudfront.requests;

  return {
    dataTransfer: transferCost,
    requests: requestCost,
    total: transferCost + requestCost,
  };
}

/**
 * Tính toán chi phí Lambda
 */
function calculateLambdaCost(requests, avgDurationMs) {
  const requestCost = (requests / 1000000) * PRICING.lambda.requests;

  // Convert memory to GB and duration to seconds
  const memoryGB = PRICING.lambda.memory / 1024;
  const durationSeconds = avgDurationMs / 1000;
  const durationCost =
    requests * memoryGB * durationSeconds * PRICING.lambda.duration;

  return {
    requests: requestCost,
    duration: durationCost,
    total: requestCost + durationCost,
  };
}

/**
 * Tính toán chi phí API Gateway
 */
function calculateAPIGatewayCost(requests, dataTransferGB) {
  const requestCost = (requests / 1000000) * PRICING.apiGateway.requests;
  const transferCost = dataTransferGB * PRICING.apiGateway.dataTransfer;

  return {
    requests: requestCost,
    dataTransfer: transferCost,
    total: requestCost + transferCost,
  };
}

/**
 * Tính toán tổng chi phí
 */
function calculateTotalCost(scenario) {
  const {
    storageGB = 10,
    getRequests = 100000,
    putRequests = 1000,
    dataTransferGB = 50,
    requests = 100000,
    avgDurationMs = 500,
  } = scenario;

  const s3Cost = calculateS3Cost(storageGB, getRequests, putRequests);
  const cloudfrontCost = calculateCloudFrontCost(dataTransferGB, requests);
  const lambdaCost = calculateLambdaCost(requests, avgDurationMs);
  const apiGatewayCost = calculateAPIGatewayCost(requests, dataTransferGB);

  const total =
    s3Cost.total +
    cloudfrontCost.total +
    lambdaCost.total +
    apiGatewayCost.total;

  return {
    s3: s3Cost,
    cloudfront: cloudfrontCost,
    lambda: lambdaCost,
    apiGateway: apiGatewayCost,
    total: total,
  };
}

/**
 * In kết quả
 */
function printCostBreakdown(costs, scenario) {
  console.log("\n🎯 AWS Cost Calculator for Image Transformation Service");
  console.log("=".repeat(60));

  console.log("\n📊 Scenario:");
  console.log(`   Storage: ${scenario.storageGB} GB`);
  console.log(`   S3 GET Requests: ${scenario.getRequests.toLocaleString()}`);
  console.log(`   S3 PUT Requests: ${scenario.putRequests.toLocaleString()}`);
  console.log(`   Total Requests: ${scenario.requests.toLocaleString()}`);
  console.log(`   Data Transfer: ${scenario.dataTransferGB} GB`);
  console.log(`   Avg Lambda Duration: ${scenario.avgDurationMs}ms`);

  console.log("\n💰 Monthly Cost Breakdown:");
  console.log("─".repeat(40));

  console.log(`S3 Storage:           $${costs.s3.storage.toFixed(4)}`);
  console.log(`S3 GET Requests:      $${costs.s3.getRequests.toFixed(4)}`);
  console.log(`S3 PUT Requests:      $${costs.s3.putRequests.toFixed(4)}`);
  console.log(`S3 Total:             $${costs.s3.total.toFixed(4)}`);

  console.log(
    `\nCloudFront Transfer:   $${costs.cloudfront.dataTransfer.toFixed(4)}`
  );
  console.log(`CloudFront Requests:  $${costs.cloudfront.requests.toFixed(4)}`);
  console.log(`CloudFront Total:     $${costs.cloudfront.total.toFixed(4)}`);

  console.log(`\nLambda Requests:       $${costs.lambda.requests.toFixed(4)}`);
  console.log(`Lambda Duration:      $${costs.lambda.duration.toFixed(4)}`);
  console.log(`Lambda Total:         $${costs.lambda.total.toFixed(4)}`);

  console.log(
    `\nAPI Gateway Requests:  $${costs.apiGateway.requests.toFixed(4)}`
  );
  console.log(
    `API Gateway Transfer: $${costs.apiGateway.dataTransfer.toFixed(4)}`
  );
  console.log(`API Gateway Total:    $${costs.apiGateway.total.toFixed(4)}`);

  console.log("\n" + "=".repeat(40));
  console.log(`🎯 TOTAL MONTHLY COST: $${costs.total.toFixed(4)}`);
  console.log(`📅 Daily Average:      $${(costs.total / 30).toFixed(4)}`);
  console.log("=".repeat(40));
}

// Các scenario khác nhau
const scenarios = {
  small: {
    storageGB: 5,
    getRequests: 50000,
    putRequests: 500,
    dataTransferGB: 25,
    requests: 50000,
    avgDurationMs: 300,
  },

  medium: {
    storageGB: 20,
    getRequests: 200000,
    putRequests: 2000,
    dataTransferGB: 100,
    requests: 200000,
    avgDurationMs: 500,
  },

  large: {
    storageGB: 100,
    getRequests: 1000000,
    putRequests: 10000,
    dataTransferGB: 500,
    requests: 1000000,
    avgDurationMs: 800,
  },

  enterprise: {
    storageGB: 500,
    getRequests: 5000000,
    putRequests: 50000,
    dataTransferGB: 2500,
    requests: 5000000,
    avgDurationMs: 1000,
  },
};

// Chạy tính toán cho tất cả scenarios
console.log("🚀 AWS Cost Calculator for Image Transformation Service");
console.log("Region: ap-southeast-1 (Singapore)");

Object.entries(scenarios).forEach(([name, scenario]) => {
  const costs = calculateTotalCost(scenario);
  printCostBreakdown(costs, scenario);
  console.log("\n");
});

// Tính toán cho scenario tùy chỉnh
console.log("💡 Custom Scenario Calculator:");
console.log(
  "Bạn có thể chỉnh sửa giá trị trong file này để tính toán chi phí cho use case cụ thể của bạn."
);

// Export functions để sử dụng trong module khác
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calculateTotalCost,
    calculateS3Cost,
    calculateCloudFrontCost,
    calculateLambdaCost,
    calculateAPIGatewayCost,
    PRICING,
  };
}
