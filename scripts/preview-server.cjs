const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.argv[2] || 56005);
const defaultPath = 'src/renderer/index.html';
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid preview port: ${port}`);
}

function resolveRequestedFile(requestUrl) {
  const pathname = new URL(requestUrl, 'http://127.0.0.1').pathname;
  const requestedPath = decodeURIComponent(pathname).replace(/^\/+/, '') || defaultPath;
  const filePath = path.resolve(root, requestedPath);
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let filePath;
  try {
    filePath = resolveRequestedFile(request.url);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`desktop pet preview: http://127.0.0.1:${port}/${defaultPath}`);
});
