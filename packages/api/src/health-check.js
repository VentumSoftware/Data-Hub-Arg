// Simple health check for Docker
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/api',
  timeout: 2000,
};

const request = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  if (res.statusCode === 200 || res.statusCode === 404) {
    process.exit(0); // Success - service is running
  } else {
    process.exit(1); // Failure
  }
});

request.on('error', (err) => {
  console.log('Health check failed:', err.message);
  process.exit(1);
});

request.end();