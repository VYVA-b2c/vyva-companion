// vite.config.ts
import { defineConfig } from "file:///home/runner/workspace/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/workspace/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "/home/runner/workspace";
function forwardApiRequest(req, res) {
  const target = `http://127.0.0.1:3001${req.url ?? ""}`;
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (!value || key.toLowerCase() === "host") return;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  });
  const chunks = [];
  req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  req.on("end", async () => {
    try {
      const body = chunks.length ? Buffer.concat(chunks) : void 0;
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? void 0 : body
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
var vite_config_default = defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true,
    hmr: {
      overlay: false
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false
      }
    }
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
      }
    },
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core"
    ]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci93b3Jrc3BhY2Uvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgdHlwZSB7IEluY29taW5nTWVzc2FnZSwgU2VydmVyUmVzcG9uc2UgfSBmcm9tIFwiaHR0cFwiO1xuXG5mdW5jdGlvbiBmb3J3YXJkQXBpUmVxdWVzdChyZXE6IEluY29taW5nTWVzc2FnZSwgcmVzOiBTZXJ2ZXJSZXNwb25zZSkge1xuICBjb25zdCB0YXJnZXQgPSBgaHR0cDovLzEyNy4wLjAuMTozMDAxJHtyZXEudXJsID8/IFwiXCJ9YDtcbiAgY29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gIE9iamVjdC5lbnRyaWVzKHJlcS5oZWFkZXJzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICBpZiAoIXZhbHVlIHx8IGtleS50b0xvd2VyQ2FzZSgpID09PSBcImhvc3RcIikgcmV0dXJuO1xuICAgIGhlYWRlcnMuc2V0KGtleSwgQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZS5qb2luKFwiLCBcIikgOiB2YWx1ZSk7XG4gIH0pO1xuXG4gIGNvbnN0IGNodW5rczogQnVmZmVyW10gPSBbXTtcbiAgcmVxLm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IGNodW5rcy5wdXNoKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykgPyBjaHVuayA6IEJ1ZmZlci5mcm9tKGNodW5rKSkpO1xuICByZXEub24oXCJlbmRcIiwgYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBib2R5ID0gY2h1bmtzLmxlbmd0aCA/IEJ1ZmZlci5jb25jYXQoY2h1bmtzKSA6IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IHVwc3RyZWFtID0gYXdhaXQgZmV0Y2godGFyZ2V0LCB7XG4gICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgYm9keTogcmVxLm1ldGhvZCA9PT0gXCJHRVRcIiB8fCByZXEubWV0aG9kID09PSBcIkhFQURcIiA/IHVuZGVmaW5lZCA6IGJvZHksXG4gICAgICB9KTtcbiAgICAgIHJlcy5zdGF0dXNDb2RlID0gdXBzdHJlYW0uc3RhdHVzO1xuICAgICAgdXBzdHJlYW0uaGVhZGVycy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiByZXMuc2V0SGVhZGVyKGtleSwgdmFsdWUpKTtcbiAgICAgIHJlcy5lbmQoQnVmZmVyLmZyb20oYXdhaXQgdXBzdHJlYW0uYXJyYXlCdWZmZXIoKSkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDI7XG4gICAgICByZXMuc2V0SGVhZGVyKFwiY29udGVudC10eXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJBUEkgcHJveHkgZmFpbGVkXCIsIGRldGFpbDogZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpIH0pKTtcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjAuMC4wLjBcIixcbiAgICBwb3J0OiA1MDAwLFxuICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxuICAgIH0sXG4gICAgcHJveHk6IHtcbiAgICAgIFwiL2FwaVwiOiB7XG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vMTI3LjAuMC4xOjMwMDFcIixcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAge1xuICAgICAgbmFtZTogXCJ2eXZhLWFwaS1mb3J3YXJkZXJcIixcbiAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgICBpZiAocmVxLnVybD8uc3RhcnRzV2l0aChcIi9hcGkvXCIpKSB7XG4gICAgICAgICAgICBmb3J3YXJkQXBpUmVxdWVzdChyZXEsIHJlcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0sXG4gICAgcmVhY3QoKSxcbiAgXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICAgIGRlZHVwZTogW1xuICAgICAgXCJyZWFjdFwiLFxuICAgICAgXCJyZWFjdC1kb21cIixcbiAgICAgIFwicmVhY3QvanN4LXJ1bnRpbWVcIixcbiAgICAgIFwicmVhY3QvanN4LWRldi1ydW50aW1lXCIsXG4gICAgICBcIkB0YW5zdGFjay9yZWFjdC1xdWVyeVwiLFxuICAgICAgXCJAdGFuc3RhY2svcXVlcnktY29yZVwiLFxuICAgIF0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFB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
