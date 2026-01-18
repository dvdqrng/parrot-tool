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
    // With asar disabled, files are directly in the app directory
    // The structure varies between CI (flat) and local (nested) builds

    const possiblePaths = [
        // Local build path (nested structure based on project directory)
        path.join(__dirname, '.next', 'standalone', 'Projects', 'beeper-kanban', 'server.js'),
        // CI build path (flat structure - when built from repo root)
        path.join(__dirname, '.next', 'standalone', 'server.js'),
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
        console.log('[Server] Starting Next.js standalone server from:', standaloneServerPath);

        // Patch process.chdir to avoid ENOTDIR error when running inside asar
        const originalChdir = process.chdir;
        process.chdir = function (dir) {
            console.log(`[Server] Preventing chdir to: ${dir}`);
        };

        // Patch process.cwd to return the standalone directory
        const originalCwd = process.cwd;
        const projectDir = path.dirname(standaloneServerPath);
        console.log('[Server] Setting cwd to:', projectDir);
        process.cwd = function () {
            return projectDir;
        };

        // Don't restore the patches - keep them for the lifetime of the server
        // The server needs these patches to function correctly
        console.log('[Server] Loading standalone server module...');
        require(standaloneServerPath);
        console.log('[Server] Standalone server module loaded');

        // Restore patches when process exits
        process.on('exit', () => {
            process.chdir = originalChdir;
            process.cwd = originalCwd;
        });
    } catch (err) {
        console.error('[Server] Failed to start standalone server:', err);
        console.error('[Server] Server path:', standaloneServerPath);
        process.exit(1);
    }
}
