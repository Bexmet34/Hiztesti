// Web Worker for high-precision speed testing
// Multi-threading: 4-8 parallel fetch requests
// Memory Management: Don't keep downloaded data in RAM (use streams)

self.onmessage = async (e) => {
  console.log('Worker received message:', e.data);
  const { type, url, threads = 4, duration = 10000, size = 10 * 1024 * 1024 } = e.data;

  if (type === 'download') {
    await runDownloadTest(url, threads, duration, size);
  } else if (type === 'upload') {
    await runUploadTest(url, threads, duration);
  }
};

async function runDownloadTest(url: string, threads: number, duration: number, size: number) {
  const startTime = performance.now();
  let totalBytes = 0;
  let lastReportedBytes = 0;
  let lastReportTime = performance.now();
  let activeThreads = threads;
  const controller = new AbortController();

  // Safety timeout to ensure the test stops even if fetch hangs
  const safetyTimeout = setTimeout(() => {
    controller.abort();
  }, duration + 2000);

  console.log(`Starting download test: ${url}, threads: ${threads}`);

  const threadFn = async (id: number) => {
    try {
      while (performance.now() - startTime < duration && !controller.signal.aborted) {
        try {
          const cacheBuster = `?nocache=${Date.now()}-${Math.random()}&size=${size}`;
          const response = await fetch(url + cacheBuster, { 
            signal: controller.signal,
            // Keep-alive to avoid overhead, but ensure it doesn't hang
            priority: 'high'
          });
          
          if (!response.body) {
            console.warn(`Thread ${id}: No response body`);
            continue;
          }

          const reader = response.body.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
                if (value) {
                  totalBytes += value.length;
                  
                  const now = performance.now();
                  // Report progress more frequently (every 32KB or 100ms)
                  if (totalBytes - lastReportedBytes > 32 * 1024 || now - lastReportTime > 100) {
                     self.postMessage({ type: 'progress', bytes: totalBytes, timestamp: now });
                     lastReportedBytes = totalBytes;
                     lastReportTime = now;
                  }
                }
              
              if (performance.now() - startTime >= duration) {
                controller.abort();
                break;
              }
            }
          } finally {
            reader.releaseLock();
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') break;
          console.error(`Thread ${id} download error:`, err);
          // Small delay before retrying on error to avoid tight loops
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } finally {
      activeThreads--;
      if (activeThreads === 0) {
        clearTimeout(safetyTimeout);
        console.log(`Download test complete. Total bytes: ${totalBytes}`);
        self.postMessage({ type: 'complete', totalBytes, duration: performance.now() - startTime });
      }
    }
  };

  for (let i = 0; i < threads; i++) {
    threadFn(i);
  }
}

async function runUploadTest(url: string, threads: number, duration: number) {
  const startTime = performance.now();
  let totalBytes = 0;
  let lastReportedBytes = 0;
  let lastReportTime = performance.now();
  let activeThreads = threads;
  const controller = new AbortController();

  // Safety timeout to ensure the test stops
  const safetyTimeout = setTimeout(() => {
    controller.abort();
  }, duration + 2000);

  console.log(`Starting upload test: ${url}, threads: ${threads}`);

  // Pre-generate a large buffer to slice from
  const maxChunkSize = 10 * 1024 * 1024; // 10MB
  const randomBuffer = new Uint8Array(maxChunkSize);
  crypto.getRandomValues(randomBuffer);

  const threadFn = async (id: number) => {
    // Start with a small chunk size (256KB) to quickly ramp up
    let currentChunkSize = 256 * 1024; 

    try {
      while (performance.now() - startTime < duration && !controller.signal.aborted) {
        try {
          const chunk = new Uint8Array(randomBuffer.buffer, 0, currentChunkSize);
          const cacheBuster = `?nocache=${Date.now()}-${Math.random()}`;
          
          const reqStart = performance.now();
          const response = await fetch(url + cacheBuster, {
            method: 'POST',
            body: chunk,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/octet-stream'
            }
          });

          if (response.ok) {
            const reqTime = performance.now() - reqStart;
            totalBytes += currentChunkSize;
            
            const now = performance.now();
            if (totalBytes - lastReportedBytes > 0 || now - lastReportTime > 100) {
              self.postMessage({ type: 'progress', bytes: totalBytes, timestamp: now });
              lastReportedBytes = totalBytes;
              lastReportTime = now;
            }

            // Dynamic chunk sizing: Target ~200ms per request for smooth updates without too much overhead
            if (reqTime < 100 && currentChunkSize < maxChunkSize) {
              currentChunkSize = Math.min(currentChunkSize * 2, maxChunkSize);
            } else if (reqTime > 400 && currentChunkSize > 64 * 1024) {
              currentChunkSize = Math.max(currentChunkSize / 2, 64 * 1024);
            }
          } else {
            await new Promise(r => setTimeout(r, 100));
          }

          if (performance.now() - startTime >= duration) {
            controller.abort();
            break;
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') break;
          await new Promise(r => setTimeout(r, 100));
        }
      }
    } finally {
      activeThreads--;
      if (activeThreads === 0) {
        clearTimeout(safetyTimeout);
        console.log(`Upload test complete. Total bytes: ${totalBytes}`);
        self.postMessage({ type: 'complete', totalBytes, duration: performance.now() - startTime });
      }
    }
  };

  for (let i = 0; i < threads; i++) {
    threadFn(i);
  }
}
