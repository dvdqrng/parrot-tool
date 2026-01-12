const path = require('path');

// In production, Next.js standalone creates a nested directory structure
// We need to find and run the generated server.js
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
    // In development, use the regular Next.js dev server
    const { createServer } = require('http');
    const { parse } = require('url');
    const next = require('next');

    const app = next({ dev: true });
    const handle = app.getRequestHandler();
    const port = parseInt(process.env.PORT || '3000', 10);

    app.prepare().then(() => {
        createServer(async (req, res) => {
            try {
                const parsedUrl = parse(req.url, true);
                await handle(req, res, parsedUrl);
            } catch (err) {
                console.error('Error occurred handling', req.url, err);
                res.statusCode = 500;
                res.end('internal server error');
            }
        }).listen(port, (err) => {
            if (err) throw err;
            console.log(`> Ready on http://localhost:${port}`);
        });
    });
} else {
    // In production, run the Next.js standalone server
    // The standalone output structure varies based on where the build runs:
    // - CI builds: .next/standalone/server.js (flat)
    // - Local builds: .next/standalone/Projects/beeper-kanban/server.js (nested)
    // We try both paths to support both scenarios

    const possiblePaths = [
        // CI build path (flat structure)
        path.join(__dirname, '.next', 'standalone', 'server.js'),
        // Local build path (nested structure with project name)
        path.join(__dirname, '.next', 'standalone', 'Projects', 'beeper-kanban', 'server.js'),
    ];

    let standaloneServerPath = null;
    for (const p of possiblePaths) {
        try {
            require.resolve(p);
            standaloneServerPath = p;
            break;
        } catch {
            // Path doesn't exist, try next
        }
    }

    if (!standaloneServerPath) {
        console.error('Failed to find standalone server. Tried paths:', possiblePaths);
        process.exit(1);
    }

    try {
        console.log('Starting Next.js standalone server from:', standaloneServerPath);

        // Patch process.chdir to avoid ENOTDIR error when running inside asar
        const originalChdir = process.chdir;
        process.chdir = function (dir) {
            console.log(`[Shim] Preventing chdir to: ${dir}`);
        };

        // Patch process.cwd to return the standalone directory
        const originalCwd = process.cwd;
        const projectDir = path.dirname(standaloneServerPath);
        process.cwd = function () {
            return projectDir;
        };

        try {
            require(standaloneServerPath);
        } finally {
            process.chdir = originalChdir;
            process.cwd = originalCwd;
        }
    } catch (err) {
        console.error('Failed to start standalone server:', err);
        console.error('Server path:', standaloneServerPath);
        process.exit(1);
    }
}
