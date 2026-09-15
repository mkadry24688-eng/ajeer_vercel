const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const ROUTE_MAPS = {
    '/': '/index.html',
    '/login': '/login.html',
    '/ajeer': '/ajeer/ajeer-dashboard.html',
    '/health': '/health/health-dashboard.html',
    '/health/health-verify': '/health/health-verify.html',
    '/health/health-certificate': '/health/health-certificate.html'
};

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

const server = http.createServer((req, res) => {

    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    let pathname = urlObj.pathname;

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

    if (ROUTE_MAPS[pathname]) {
        pathname = ROUTE_MAPS[pathname];
    }

    let filePath = path.join(__dirname, pathname);

    if (!path.extname(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
            filePath += '.html';
        } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
            filePath = path.join(filePath, 'index.html');
        }
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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
