import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { config as loadEnv } from 'dotenv';

// Load .env into process.env so the dev API middleware can read ANTHROPIC_API_KEY.
loadEnv();

// Dev-only middleware that proxies /api/<name> to netlify/functions/<name>.ts,
// so we don't need the Netlify CLI during local development.
function devNetlifyFunctions(): Plugin {
  return {
    name: 'dev-netlify-functions',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const originalUrl = (req as unknown as { originalUrl?: string }).originalUrl || req.url || '/';
        if (!originalUrl.startsWith('/api/')) {
          next();
          return;
        }
        const url = new URL(originalUrl, `http://${req.headers.host || 'localhost'}`);
        const segments = url.pathname.replace(/^\/api\//, '').split('/');
        const fnName = segments[0];
        if (!fnName || !/^[a-z0-9_-]+$/i.test(fnName)) {
          next();
          return;
        }
        try {
          const mod = await server.ssrLoadModule(`/netlify/functions/${fnName}.ts`);
          const handler = mod.default as (req: Request, ctx: unknown) => Promise<Response>;

          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const bodyText = Buffer.concat(chunks).toString('utf8');

          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers[k] = v;
            else if (Array.isArray(v)) headers[k] = v.join(',');
          }

          const webReq = new Request(url, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : bodyText,
          });

          const response = await handler(webReq, {});
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));

          if (response.body) {
            const reader = response.body.getReader();
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              res.write(Buffer.from(value));
            }
          }
          res.end();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(`Dev API error: ${msg}`);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devNetlifyFunctions()],
  server: {
    port: 5173,
  },
});
