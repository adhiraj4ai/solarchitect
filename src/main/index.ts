import { app, BrowserWindow, session } from 'electron';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { AddressInfo } from 'node:net';
import { registerIpcHandlers } from './ipcHandlers';

const isDev = !!process.env['ELECTRON_RENDERER_URL'];

// Production stays strict (bundled assets only, plus tldraw's data:/blob: icons).
// Dev must allow Vite's HMR: its inline preamble script, eval, and the
// localhost websocket — without this the renderer never mounts (blank window).
const CSP = isDev
  ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* ws://localhost:*"
  : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' data: blob:; font-src 'self' data:";

function applyCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] },
    });
  });
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

// Serve the packaged renderer from a loopback-only http server rather than file://.
// Chromium only decodes SVGs (via img.decode()/createImageBitmap, which tldraw uses
// to preload its icon sprite) over http(s) — never file:// or custom schemes — so
// serving over 127.0.0.1 is the only scheme that renders tldraw without console
// errors. Binding to loopback keeps the app fully local and offline.
function startRendererServer(): Promise<string> {
  const rendererRoot = join(__dirname, '../renderer');
  const server: Server = createServer(async (req, res) => {
    try {
      const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      const relPath = normalize(rawPath === '/' ? '/index.html' : rawPath).replace(/^(\.\.[/\\])+/, '');
      const filePath = join(rendererRoot, relPath);
      const data = await readFile(filePath);
      res.setHeader('content-type', MIME_TYPES[extname(filePath)] ?? 'application/octet-stream');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function createWindow(rendererUrl: string): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
    },
  });
  win.loadURL(rendererUrl);
}

app.whenReady().then(async () => {
  applyCsp();
  registerIpcHandlers();
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'] ?? (await startRendererServer());
  createWindow(rendererUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(rendererUrl);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
