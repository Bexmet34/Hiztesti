import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

async function startServer() {
  // 1. Disable compression for test endpoints as requested
  // We apply it selectively or just don't use it for /api/test/*
  
  // CORS configuration for preflight caching
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Range");
    res.header("Access-Control-Max-Age", "86400"); // 24 hours cache for CORS preflight
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Ping endpoint (HEAD request supported)
  app.head("/api/ping", (req, res) => {
    res.status(200).end();
  });
  app.get("/api/ping", (req, res) => {
    res.status(200).send("pong");
  });

  // Download endpoint - provides raw data without compression
  app.get("/api/download", (req, res) => {
    const size = parseInt(req.query.size as string) || 10 * 1024 * 1024; // Default 10MB
    res.header("Content-Type", "application/octet-stream");
    res.header("Content-Length", size.toString());
    res.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");
    
    // Send dummy data in a non-blocking way with backpressure handling
    const buffer = Buffer.alloc(64 * 1024, 'x'); // 64KB chunks
    let sent = 0;
    
    const sendChunk = () => {
      while (sent < size) {
        const toSend = Math.min(buffer.length, size - sent);
        const canContinue = res.write(buffer.subarray(0, toSend));
        sent += toSend;
        
        if (!canContinue) {
          // Wait for 'drain' event to continue
          res.once('drain', sendChunk);
          return;
        }
      }
      res.end();
    };
    
    sendChunk();
  });

  // Upload endpoint
  app.post("/api/upload", (req, res) => {
    req.on("data", () => {
      // Just consume the data
    });
    req.on("end", () => {
      res.status(200).json({ success: true });
    });
  });

  // Proxy endpoint for network info to bypass client-side CORS/Adblockers
  app.get("/api/network-info", async (req, res) => {
    const providers = [
      'https://ipapi.co/json/',
      'https://ipwho.is/',
      'https://api.ipify.org?format=json'
    ];

    for (const url of providers) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const data = await response.json();
          return res.json(data);
        }
      } catch (error) {
        console.error(`Backend failed to fetch from ${url}:`, error);
      }
    }
    res.status(500).json({ error: "All providers failed" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
