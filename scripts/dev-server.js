const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8888);
const HOST = process.env.HOST || '127.0.0.1';

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const routeMap = new Map([
  ['/reset-password', '/pages/auth/reset-password.html']
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(body);
}

function safeFilePath(requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const normalized = path.posix.normalize(decoded).replace(/^\/+/, '');
  const absolute = path.resolve(ROOT, normalized);
  if (absolute !== ROOT && !absolute.startsWith(ROOT + path.sep)) return null;
  return absolute;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    let pathname = url.pathname;

    if (routeMap.has(pathname)) pathname = routeMap.get(pathname);
    if (pathname === '/') pathname = '/index.html';

    let filePath = safeFilePath(pathname);
    if (!filePath) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });

    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    } catch (_) {
      // handled below
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return send(res, 404, `404 - ${pathname}`, { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    return send(res, 200, data, { 'Content-Type': contentType });
  } catch (error) {
    console.error(error);
    return send(res, 500, 'Internal server error', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('CertiTrack local development server');
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://${HOST}:${PORT}`);
  console.log('Press Ctrl+C to stop.');
  console.log('');
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
