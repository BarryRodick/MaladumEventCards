import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MIME_TYPES = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.webmanifest', 'application/manifest+json; charset=utf-8'],
    ['.woff2', 'font/woff2']
]);

function readArgument(name, fallback) {
    const inline = process.argv.find(argument => argument.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = process.argv.indexOf(name);
    return index === -1 ? fallback : process.argv[index + 1];
}

function resolveRequestPath(requestUrl, { root, host, port }) {
    const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(root, relativePath);
    const relativeToRoot = path.relative(root, filePath);

    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
        return null;
    }

    return filePath;
}

export function createStaticServer({
    root: requestedRoot = process.cwd(),
    host = '127.0.0.1',
    port = 4173
} = {}) {
    const root = path.resolve(requestedRoot);
    const numericPort = Number(port);
    if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
        throw new Error(`Invalid port: ${port}`);
    }

    return createServer(async (request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' });
            response.end('Method not allowed');
            return;
        }

        let filePath;
        try {
            filePath = resolveRequestPath(request.url || '/', { root, host, port: numericPort });
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

        try {
            const fileStat = await stat(filePath);
            if (!fileStat.isFile()) throw new Error('Not a file');

            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Length': fileStat.size,
                'Content-Type': MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
                'X-Content-Type-Options': 'nosniff'
            });

            if (request.method === 'HEAD') {
                response.end();
                return;
            }

            createReadStream(filePath).pipe(response);
        } catch {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not found');
        }
    });
}

const isCommandLine = process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCommandLine) {
    const root = path.resolve(readArgument('--root', process.cwd()));
    const host = readArgument('--host', '127.0.0.1');
    const port = Number(readArgument('--port', '4173'));
    const server = createStaticServer({ root, host, port });

    server.listen(port, host, () => {
        console.log(`Static test server listening at http://${host}:${port}`);
    });

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => process.exit(0));
    }
}
