'use strict';

const express = require('express');
const seeder = require('./seed');
const performanceMetricEndpoints = require('./performanceMetrics');

// Constants
const PORT = 3000;
const HOST = '0.0.0.0';

async function start() {
  // Seed the database
  await seeder.seedDatabase();

  // App
  const app = express();
  app.use(express.json())

  // Health check
  app.get('/health', (req, res) => {
    res.send('Hello World');
  });

  // Write your endpoints here
  app.post('/performanceMetricsForUser', performanceMetricEndpoints.performanceMetricsForUser);

  app.post('/performanceMetricsForGroup', performanceMetricEndpoints.performanceMetricsForGroup);

  app.listen(PORT, HOST);
  console.log(`Server is running on http://${HOST}:${PORT}`);
}

start();
