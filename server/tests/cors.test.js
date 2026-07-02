import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { app } from '../src/app.js';

const allowedOrigin = 'http://localhost:5173';
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

const preflight = (path, method) => fetch(`${baseUrl}${path}`, {
  method: 'OPTIONS',
  headers: {
    Origin: allowedOrigin,
    'Access-Control-Request-Method': method,
    'Access-Control-Request-Headers': 'content-type,authorization'
  }
});

test('auth endpoints accept valid CORS preflight requests', async () => {
  const endpoints = [
    ['/api/auth/login', 'POST'],
    ['/api/auth/register', 'POST'],
    ['/api/auth/forgot-password', 'POST'],
    ['/api/auth/profile', 'GET']
  ];

  for (const [path, method] of endpoints) {
    const response = await preflight(path, method);
    assert.equal(response.status, 204, `${method} ${path}`);
    assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
    assert.match(response.headers.get('access-control-allow-methods'), /GET/);
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
    assert.match(response.headers.get('access-control-allow-methods'), /PATCH/);
    assert.match(response.headers.get('access-control-allow-headers'), /Content-Type/i);
    assert.match(response.headers.get('access-control-allow-headers'), /Authorization/i);
  }
});

test('successful responses include the requesting allowed origin', async () => {
  const response = await fetch(`${baseUrl}/`, { headers: { Origin: allowedOrigin } });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.match(response.headers.get('vary'), /(?:^|,\s*)Origin(?:,|$)/);
});

test('authentication errors retain CORS headers', async () => {
  const response = await fetch(`${baseUrl}/api/auth/profile`, {
    headers: { Origin: allowedOrigin }
  });

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
});

test('unlisted origins are rejected without granting CORS access', async () => {
  const response = await fetch(`${baseUrl}/`, {
    headers: { Origin: 'https://untrusted.example' }
  });

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(await response.json(), {
    success: false,
    message: 'Origin is not allowed'
  });
});
