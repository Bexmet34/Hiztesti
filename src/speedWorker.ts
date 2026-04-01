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
                
                // Report progress every 256KB or so to keep UI smooth
                if (totalBytes - lastReportedBytes > 256 * 1024) {
                   self.postMessage({ type: 'progress', bytes: totalBytes, timestamp: performance.now() });
                   lastReportedBytes = totalBytes;
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
  let activeThreads = threads;
  const controller = new AbortController();

  // Safety timeout to ensure the test stops even if fetch hangs
  const safetyTimeout = setTimeout(() => {
    controller.abort();
  }, duration + 2000);

  console.log(`Starting upload test: ${url}, threads: ${threads}`);

  // Create a large dummy buffer for upload
  const chunkSize = 1024 * 1024; // 1MB
  const chunk = new Uint8Array(chunkSize);
  crypto.getRandomValues(chunk);

  const threadFn = async (id: number) => {
    try {
      while (performance.now() - startTime < duration && !controller.signal.aborted) {
        try {
          const cacheBuster = `?nocache=${Date.now()}-${Math.random()}`;
          const response = await fetch(url + cacheBuster, {
            method: 'POST',
            body: chunk,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/octet-stream'
            }
          });

          if (response.ok) {
            totalBytes += chunkSize;
            self.postMessage({ type: 'progress', bytes: totalBytes, timestamp: performance.now() });
          } else {
            console.warn(`Thread ${id} upload failed: ${response.status}`);
            // Small delay on error
            await new Promise(r => setTimeout(r, 500));
          }

          if (performance.now() - startTime >= duration) {
            controller.abort();
            break;
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') break;
          console.error(`Thread ${id} upload error:`, err);
          // Small delay on error
          await new Promise(r => setTimeout(r, 500));
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
