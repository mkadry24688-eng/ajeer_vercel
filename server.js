const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Buffer } = require('buffer');

// Load environment variables if not already populated
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const [key, ...values] = line.split('=');
            if (key && values.length) {
                const k = key.trim();
                if (!process.env[k]) {
                    process.env[k] = values.join('=').trim().replace(/^["']|["']$/g, '');
                }
            }
        });
    }
} catch {
    // Ignore error loading .env
}

const PUBLIC_FILES = new Set(require('./public-files.json'));
const ROOT = fs.realpathSync(__dirname);

let db = null;
try {
    db = require(path.join(__dirname, 'db.js'));
} catch (e) {
    console.error('Failed to load db module:', e);
}

const PORT = Number(process.env.PORT || 3010);
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.SUPABASE_ANON_KEY || 'ajeer-portal-secret-key-3010';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://muqhdaktjljnptruanox.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_n-xcjOpXTq7nmKZAdHjE5g_4jnKHRev';

const ROUTE_MAPS = {
    '/': '/index.html',
    '/login': '/login.html',
    '/ajeer': '/ajeer/ajeer-dashboard.html',
    '/health': '/health/health-dashboard.html',
    '/health/health-verify': '/health/health-verify.html',
    '/health/health-certificate': '/health/health-certificate.html'
};

const PROTECTED_FILES = new Set([
    'index.html',
    'ajeer/ajeer-dashboard.html',
    'ajeer/form.html',
    'ajeer/contract.html',
    'ajeer/scanner.html',
    'health/health-dashboard.html'
]);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject'
};

function parseCookies(req) {
    const list = {};
    const cookieHeader = req.headers && req.headers.cookie;
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.split('=');
        const trimmedName = name?.trim();
        if (!trimmedName) return;
        list[trimmedName] = decodeURIComponent(rest.join('=').trim());
    });
    return list;
}

function signSession(payload) {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const hmac = crypto.createHmac('sha256', AUTH_SECRET);
    hmac.update(data);
    const signature = hmac.digest('base64url');
    return `${data}.${signature}`;
}

function verifySession(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const hmac = crypto.createHmac('sha256', AUTH_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest('base64url');
    if (signature.length !== expectedSignature.length) return null;
    try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return null;
        }
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function readBody(req, limit = 50 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > limit) {
                reject(new Error('Body too large'));
                return;
            }
            body += chunk.toString();
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

async function authenticateUser(username, password) {
    if (!username || !password) return null;
    if (db) {
        try {
            return await db.authenticateUser(username, password);
        } catch (e) {
            console.error('Auth error with db:', e);
        }
    }
    return null;
}

const server = http.createServer(async (req, res) => {

    res.setHeader('X-Content-Type-Options', 'nosniff');
    let urlObj;
    let pathname;
    try {
        urlObj = new URL(req.url, 'http://localhost');
        pathname = decodeURIComponent(urlObj.pathname);
        if (pathname.includes('\\') || pathname.includes('\0') ||
            pathname.split('/').some(part => part === '.' || part === '..')) throw new Error('Invalid path');
    } catch {
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }

    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Handle logout endpoint
    if (pathname === '/logout' || pathname === '/api/auth/logout') {
        res.writeHead(302, {
            'Set-Cookie': 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
            'Location': '/login',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end();
        return;
    }

    // Handle session establishment endpoint
    if (req.method === 'POST' && pathname === '/api/auth/session') {
        try {
            const rawBody = await readBody(req);
            const parsed = JSON.parse(rawBody || '{}');
            const user = parsed.user;
            if (!user || !user.username) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: 'Invalid payload' }));
                return;
            }
            const sessionToken = signSession({
                id: user.id || 'client-session',
                username: user.username,
                full_name: user.full_name || user.username,
                email: user.email || '',
                exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
            });
            const cookie = `auth_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Set-Cookie': cookie
            });
            res.end(JSON.stringify({ success: true }));
        } catch {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: 'Bad request' }));
        }
        return;
    }

    // Handle login endpoint (JSON API or HTML form POST)
    if (req.method === 'POST' && (pathname === '/login' || pathname === '/api/auth/login' || pathname === '/api/login')) {
        try {
            const rawBody = await readBody(req);
            let username = '';
            let password = '';
            const contentType = req.headers['content-type'] || '';
            const isJson = contentType.includes('application/json');

            if (isJson) {
                const parsed = JSON.parse(rawBody || '{}');
                username = (parsed.username || '').trim();
                password = parsed.password || '';
            } else {
                const params = new URLSearchParams(rawBody);
                username = (params.get('username') || '').trim();
                password = params.get('password') || '';
            }

            const user = await authenticateUser(username, password);
            if (!user) {
                if (isJson) {
                    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' }));
                } else {
                    res.writeHead(302, { 'Location': '/login?error=1' });
                    res.end();
                }
                return;
            }

            const sessionToken = signSession({
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
            });
            const cookie = `auth_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;

            if (isJson) {
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Set-Cookie': cookie
                });
                res.end(JSON.stringify({ success: true, user }));
            } else {
                res.writeHead(302, {
                    'Location': '/index.html',
                    'Set-Cookie': cookie
                });
                res.end();
            }
        } catch (err) {
            console.error('Login handler error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: 'حدث خطأ في الخادم' }));
        }
        return;
    }

    // Handle check session endpoint
    if (req.method === 'GET' && pathname === '/api/auth/me') {
        const cookies = parseCookies(req);
        const session = verifySession(cookies.auth_token);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ authenticated: !!session, user: session || null }));
        return;
    }

    // Contracts & MongoDB API endpoints
    if (pathname === '/api/contracts' || pathname.startsWith('/api/contracts/')) {
        if (!db) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Database module unavailable' }));
            return;
        }

        // Check if contract number exists
        if (req.method === 'GET' && pathname.startsWith('/api/contracts/check-number/')) {
            const num = decodeURIComponent(pathname.replace('/api/contracts/check-number/', ''));
            try {
                const exists = await db.checkContractNumberExists(num);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ exists }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Check if contract ID exists
        if (req.method === 'GET' && pathname.startsWith('/api/contracts/check-id/')) {
            const id = decodeURIComponent(pathname.replace('/api/contracts/check-id/', ''));
            try {
                const exists = await db.checkContractIdExists(id);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ exists }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Get next unique contract number
        if (req.method === 'GET' && pathname === '/api/contracts/next-number') {
            try {
                const number = await db.getNextContractNumber();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ number }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Bulk insert / import contracts
        if (req.method === 'POST' && pathname === '/api/contracts/bulk') {
            try {
                const rawBody = await readBody(req, 50 * 1024 * 1024);
                const parsed = JSON.parse(rawBody || '[]');
                const records = Array.isArray(parsed) ? parsed : (parsed.data || []);
                const result = await db.bulkInsertContracts(records);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // List all contracts
        if (req.method === 'GET' && pathname === '/api/contracts') {
            try {
                const list = await db.listContracts();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(list));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Get single contract by id or number
        if (req.method === 'GET' && pathname.startsWith('/api/contracts/')) {
            const id = decodeURIComponent(pathname.replace('/api/contracts/', ''));
            try {
                const contract = await db.getContract(id);
                if (!contract) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Contract not found' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(contract));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Create new contract
        if (req.method === 'POST' && pathname === '/api/contracts') {
            try {
                const rawBody = await readBody(req);
                const contractData = JSON.parse(rawBody || '{}');
                const customId = contractData.id || contractData._id;
                if (customId) {
                    const exists = await db.checkContractIdExists(customId);
                    if (exists) {
                        res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: 'معرف العقد (_id) موجود مسبقاً، يرجى اختيار معرف آخر' }));
                        return;
                    }
                }
                const saved = await db.saveContract(contractData);
                res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(saved));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Update contract (PUT /api/contracts/:id or POST /api/contracts/:id)
        if ((req.method === 'PUT' || req.method === 'POST') && pathname.startsWith('/api/contracts/')) {
            const id = decodeURIComponent(pathname.replace('/api/contracts/', ''));
            try {
                const rawBody = await readBody(req);
                const contractData = JSON.parse(rawBody || '{}');
                contractData.id = id;
                const saved = await db.saveContract(contractData);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(saved));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Delete contract (DELETE /api/contracts/:id)
        if (req.method === 'DELETE' && pathname.startsWith('/api/contracts/')) {
            const id = decodeURIComponent(pathname.replace('/api/contracts/', ''));
            try {
                const deleted = await db.deleteContract(id);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: deleted }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }
    }

    // Database status endpoint
    if (req.method === 'GET' && pathname === '/api/db/status') {
        try {
            const list = db ? await db.listContracts() : [];
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                status: 'connected',
                database: 'mongodb',
                contractsCount: list.length
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ status: 'error', error: err.message }));
        }
        return;
    }

    // Force migrate endpoint (e.g. if manual sync requested)
    if (req.method === 'POST' && pathname === '/api/db/migrate') {
        try {
            if (!db) throw new Error('DB module unavailable');
            const result = await db.migrateFromSupabaseIfNeeded();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (ROUTE_MAPS[pathname]) {
        pathname = ROUTE_MAPS[pathname];
    }

    let relativePath = pathname.slice(1);
    if (!path.extname(relativePath)) {
        if (PUBLIC_FILES.has(relativePath + '.html')) relativePath += '.html';
        else if (PUBLIC_FILES.has(relativePath + '/index.html')) relativePath += '/index.html';
    }

    // Authentication middleware
    const cookies = parseCookies(req);
    const session = verifySession(cookies.auth_token);

    // If already authenticated and accessing login, redirect to index
    if (session && (relativePath === 'login.html' || pathname === '/login.html')) {
        res.writeHead(302, {
            'Location': '/index.html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end();
        return;
    }

    // If protected file and not authenticated, redirect to /login immediately
    if (PROTECTED_FILES.has(relativePath)) {
        if (!session) {
            const acceptHeader = req.headers.accept || '';
            if (acceptHeader.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
            } else {
                res.writeHead(302, {
                    'Location': '/login',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                });
                res.end();
            }
            return;
        }
    }

    if (!PUBLIC_FILES.has(relativePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }
    const filePath = path.join(ROOT, relativePath);
    // Reject symlinks, including links to private files inside the project.
    try {
        if (fs.realpathSync(filePath) !== filePath) throw new Error('Symlink');
    } catch {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    // Special server-side rendering for login.html to support error alerts without JS
    if (relativePath === 'login.html') {
        fs.readFile(filePath, 'utf8', (err, htmlContent) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Internal Server Error');
                return;
            }
            const hasError = urlObj && urlObj.searchParams.has('error');
            const errorHtml = hasError ?
                '<div class="alert alert-danger py-2 mb-3 text-center" style="border-radius: 10px; font-size: 0.9rem;"><i class="bi bi-exclamation-triangle-fill me-1"></i> اسم المستخدم أو كلمة المرور غير صحيحة</div>' :
                '';
            const renderedHtml = htmlContent.replace('<!-- ERROR_ALERT -->', errorHtml);
            const contentBuffer = Buffer.from(renderedHtml, 'utf8');
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': contentBuffer.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(contentBuffer);
        });
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            console.log(`File not found: ${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found - File does not exist');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        const stream = fs.createReadStream(filePath);
        stream.on('error', (streamErr) => {
            console.error('Error reading stream: ', streamErr);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Internal Server Error');
            }
        });
        stream.pipe(res);
    });
});

if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
    if (db) {
        db.connectDB().then(() => {
            return db.migrateFromSupabaseIfNeeded();
        }).catch(err => {
            console.error('[Startup] MongoDB initialization error:', err.message);
        });
    }
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
} else if (typeof module === 'undefined') {
    server.listen(PORT, '0.0.0.0', () => {});
}

if (typeof module !== 'undefined') {
    module.exports = {
        server,
        signSession,
        verifySession,
        parseCookies,
        PROTECTED_FILES
    };
}
