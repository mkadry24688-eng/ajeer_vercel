const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');

test('static handler permits public pages, protects dashboard routes, and denies private paths', async () => {
  let handler;
  const context = {
    require(name) {
      if (name === 'http') return { createServer(fn) { handler = fn; return { listen() {} }; } };
      if (name === './public-files.json') return require('../public-files.json');
      return require(name);
    },
    __dirname: root,
    process: { env: { AUTH_SECRET: 'test-secret-key-123' } },
    URL,
    Buffer,
    console: { log() {}, error() {} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'server.js'), 'utf8'), context);

  const { Writable } = require('node:stream');
  async function request(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const response = new Writable({ write(chunk, encoding, done) { done(); } });
      response.headers = {};
      response.setHeader = (k, v) => { response.headers[k.toLowerCase()] = v; };
      response.writeHead = (status, hdrs) => {
        response.status = status;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            response.headers[k.toLowerCase()] = v;
          }
        }
      };
      response.on('finish', () => resolve({ status: response.status, headers: response.headers }));
      response.on('error', reject);
      handler({ url, method: 'GET', headers }, response);
    });
  }

  // Helper to generate a valid signed session token for testing
  function createTestToken(payload, secret = 'test-secret-key-123') {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    const signature = hmac.digest('base64url');
    return `${data}.${signature}`;
  }

  const validToken = createTestToken({
    id: 'test-id',
    username: 'admin',
    exp: Date.now() + 3600000
  });

  // 1. Unauthenticated requests to protected pages MUST redirect to /login (302)
  for (const url of ['/', '/ajeer', '/index.html', '/ajeer/ajeer-dashboard.html', '/ajeer/form.html']) {
    const res = await request(url);
    assert.equal(res.status, 302, `Expected 302 for unauthenticated ${url}`);
    assert.equal(res.headers.location, '/login', `Expected Location /login for ${url}`);
  }

  // 2. Public pages should permit unauthenticated access (200)
  for (const url of ['/login', '/login.html', '/ajeer/verify', '/shared/js/config.js', '/shared/css/style.css']) {
    const res = await request(url);
    assert.equal(res.status, 200, `Expected 200 for public ${url}`);
  }

  // 3. Authenticated requests to protected pages must succeed (200)
  for (const url of ['/', '/ajeer', '/index.html', '/ajeer/ajeer-dashboard.html']) {
    const res = await request(url, { cookie: `auth_token=${validToken}` });
    assert.equal(res.status, 200, `Expected 200 for authenticated ${url}`);
  }

  // 4. Forged or invalid token must be rejected with 302 to /login
  const forgedToken = validToken.slice(0, -5) + 'xxxxx';
  for (const url of ['/', '/ajeer']) {
    const res = await request(url, { cookie: `auth_token=${forgedToken}` });
    assert.equal(res.status, 302, `Expected 302 for forged token on ${url}`);
    assert.equal(res.headers.location, '/login');
  }

  // 5. Expired token must be rejected with 302 to /login
  const expiredToken = createTestToken({
    id: 'test-id',
    username: 'admin',
    exp: Date.now() - 10000
  });
  for (const url of ['/', '/ajeer']) {
    const res = await request(url, { cookie: `auth_token=${expiredToken}` });
    assert.equal(res.status, 302, `Expected 302 for expired token on ${url}`);
    assert.equal(res.headers.location, '/login');
  }

  // 6. If already authenticated and accessing /login, redirect to /index.html
  const loginRedirectRes = await request('/login', { cookie: `auth_token=${validToken}` });
  assert.equal(loginRedirectRes.status, 302);
  assert.equal(loginRedirectRes.headers.location, '/index.html');

  // 7. GET /logout must clear cookie and redirect to /login
  const logoutRes = await request('/logout', { cookie: `auth_token=${validToken}` });
  assert.equal(logoutRes.status, 302);
  assert.equal(logoutRes.headers.location, '/login');
  assert.ok(logoutRes.headers['set-cookie']?.includes('auth_token=;'));

  // 8. Deny access to private files
  for (const url of ['/.env', '/.git/config', '/server.js', '/generate-config.js', '/package.json', '/supabase_setup.sql', '/.env.bak_before_fix_2026-09-29', '/shared/js/contract.js.bak_2026-09-28-2021', '/shared/js/%63ontract.js.bak_2026-09-28-2021', '/tests/security.test.js', '/SECURITY_FIX_REPORT.md']) {
    const res = await request(url);
    assert.equal(res.status, 404, url);
  }

  // 9. Malformed and traversal paths return 400
  for (const url of ['/%ZZ', '/%00', '/shared/%2e%2e%2f.env', '/shared%5c..%5c.env']) {
    const res = await request(url);
    assert.equal(res.status, 400, url);
  }
});

for (const name of ['verify', 'verify-page', 'dashboard', 'contract', 'scanner']) {
  test(`${name}: hostile HTML is escaped`, () => {
    const context = { document: { addEventListener() {}, getElementById() { return null; } }, window: {}, URLSearchParams, console };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, `shared/js/${name}.js`), 'utf8'), context);
    const payload = '<img src=x onerror="alert(1)">&\'';
    assert.equal(context.escapeHtml(payload), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;');
    if (name.startsWith('verify')) {
      context.formatDate = value => value;
      const container = {};
      const contract = Object.fromEntries(['workerName', 'workerIdNumber', 'workerProfession', 'beneficiaryEntity', 'beneficiaryHrId', 'providerEntity', 'providerHrId', 'startDate', 'endDate'].map(key => [key, payload]));
      context.renderVerification(container, contract);
      assert.ok(!container.innerHTML.includes('<img'));
      assert.ok(container.innerHTML.includes('&lt;img'));
      context.renderError(container, payload);
      assert.ok(!container.innerHTML.includes('<img'));
    }
  });
}
