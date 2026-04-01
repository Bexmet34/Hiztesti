// Web Worker for high-precision speed testing
// Multi-threading: 4-8 parallel fetch requests
// Memory Management: Don't keep downloaded data in RAM (use streams)

self.onmessage = async (e) => {
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
  let activeThreads = threads;
  const controller = new AbortController();

  const threadFn = async () => {
    while (performance.now() - startTime < duration && !controller.signal.aborted) {
      try {
        // Cache Busting: Add dynamic query string
        const cacheBuster = `?nocache=${Date.now()}-${Math.random()}&size=${size}`;
        const response = await fetch(url + cacheBuster, { signal: controller.signal });
        
        if (!response.body) continue;

        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            // Memory Management: Data is processed (counted) and then discarded by GC
            // We don't store the 'value' anywhere.
            
            // Report progress periodically
            if (totalBytes % (1024 * 1024) === 0) {
               self.postMessage({ type: 'progress', bytes: totalBytes, timestamp: performance.now() });
            }
          }
          
          if (performance.now() - startTime >= duration) {
            controller.abort();
            break;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') break;
        console.error('Download thread error:', err);
        break;
      }
    }
    activeThreads--;
    if (activeThreads === 0) {
      self.postMessage({ type: 'complete', totalBytes, duration: performance.now() - startTime });
    }
  };

  for (let i = 0; i < threads; i++) {
    threadFn();
  }
}

async function runUploadTest(url: string, threads: number, duration: number) {
  const startTime = performance.now();
  let totalBytes = 0;
  let activeThreads = threads;
  const controller = new AbortController();

  // Create a large dummy buffer for upload
  const chunkSize = 1024 * 1024; // 1MB
  const chunk = new Uint8Array(chunkSize);
  crypto.getRandomValues(chunk);

  const threadFn = async () => {
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
        }

        if (performance.now() - startTime >= duration) {
          controller.abort();
          break;
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') break;
        console.error('Upload thread error:', err);
        break;
      }
    }
    activeThreads--;
    if (activeThreads === 0) {
      self.postMessage({ type: 'complete', totalBytes, duration: performance.now() - startTime });
    }
  };

  for (let i = 0; i < threads; i++) {
    threadFn();
  }
}
