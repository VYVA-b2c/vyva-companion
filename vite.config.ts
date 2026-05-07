import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readFileSync } from "node:fs";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version?: string };

const appVersion = process.env.VITE_APP_VERSION || packageJson.version || "0.0.0";

function forwardApiRequest(req: IncomingMessage, res: ServerResponse) {
  const target = `http://127.0.0.1:3001${req.url ?? ""}`;
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (!value || key.toLowerCase() === "host") return;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  });

  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  req.on("end", async () => {
    try {
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });
      res.statusCode = upstream.status;
      upstream.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "API proxy failed", detail: err instanceof Error ? err.message : String(err) }));
    }
  });
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    {
      name: "vyva-api-forwarder",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/api/")) {
            forwardApiRequest(req, res);
            return;
          }
          next();
        });
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
});
