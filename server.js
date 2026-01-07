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
    // The standalone output is in .next/standalone with the full project path
    // When packaged in asar, we can require it directly without fs.existsSync
    const standaloneServerPath = path.join(__dirname, '.next', 'standalone', 'Projects', 'parrot', 'server.js');

    try {
        console.log('Starting Next.js standalone server...');

        // Patch process.chdir to avoid ENOTDIR error when running inside asar
        // Next.js standalone server tries to chdir to the .next directory which works on filesystem
        // but fails when inside an asar archive.
        const originalChdir = process.chdir;
        process.chdir = function (dir) {
            console.log(`[Shim] Preventing chdir to: ${dir}`);
            // Do nothing, effectively staying in the app root (or wherever we are)
        };

        // Also patch process.cwd to return the directory where standalone server thinks it is
        // This ensures relative paths (like ./.next) resolve correctly
        const originalCwd = process.cwd;
        const projectDir = path.dirname(standaloneServerPath);
        process.cwd = function () {
            return projectDir;
        };

        try {
            require(standaloneServerPath);
        } finally {
            // Restore original chdir/cwd just in case (though we likely crash if we exit)
            process.chdir = originalChdir;
            process.cwd = originalCwd;
        }
    } catch (err) {
        console.error('Failed to start standalone server:', err);
        console.error('Server path:', standaloneServerPath);
        process.exit(1);
    }
}
