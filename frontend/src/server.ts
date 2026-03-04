import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

function parseCspDirective(envName: string, fallback: string): string {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : fallback;
}

function buildContentSecurityPolicy() {
  const directives = [
    `default-src ${parseCspDirective('OP_CSP_DEFAULT_SRC', "'self'")}`,
    `base-uri ${parseCspDirective('OP_CSP_BASE_URI', "'self'")}`,
    `frame-ancestors ${parseCspDirective('OP_CSP_FRAME_ANCESTORS', "'none'")}`,
    `object-src ${parseCspDirective('OP_CSP_OBJECT_SRC', "'none'")}`,
    `script-src ${parseCspDirective('OP_CSP_SCRIPT_SRC', "'self'")}`,
    `style-src ${parseCspDirective('OP_CSP_STYLE_SRC', "'self' 'unsafe-inline'")}`,
    `img-src ${parseCspDirective('OP_CSP_IMG_SRC', "'self' data: blob: https:")}`,
    `font-src ${parseCspDirective('OP_CSP_FONT_SRC', "'self' data:")}`,
    `frame-src ${parseCspDirective('OP_CSP_FRAME_SRC', "'none'")}`,
    `connect-src ${parseCspDirective('OP_CSP_CONNECT_SRC', "'self' https: wss:")}`,
    `form-action ${parseCspDirective('OP_CSP_FORM_ACTION', "'self'")}`,
    `upgrade-insecure-requests`,
  ];
  return directives.join('; ');
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', buildContentSecurityPolicy());
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
