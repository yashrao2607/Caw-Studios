// progress/repro-race.js
// Minimal reproduction: concurrent redirects on a single short link
const http = require('http');

const SHORT_CODE = 'q4CBGI';
const CONCURRENCY = 10;
const BASE_URL = `http://localhost:3000/r/${SHORT_CODE}`;

async function makeRequest() {
  return new Promise((resolve) => {
    http.get(BASE_URL, (res) => {
      resolve(res.statusCode);
    }).on('error', (err) => resolve(500));
  });
}

async function main() {
  console.log(`Sending ${CONCURRENCY} concurrent requests to ${BASE_URL}...`);
  const requests = Array.from({ length: CONCURRENCY }, () => makeRequest());
  const results = await Promise.all(requests);

  const redirects = results.filter(c => c === 301 || c === 302);
  const errors = results.filter(c => c === 500);

  console.log(`Results: ${redirects.length} redirects (301/302), ${errors.length} errors (500)`);
  if (errors.length > 0) {
    console.log('BUG REPRODUCED: 500 unique constraint conflict under concurrent requests.');
  } else {
    console.log('PASS: All concurrent requests handled atomically with 0 errors.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
