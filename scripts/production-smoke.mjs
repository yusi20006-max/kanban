const base = (process.env.BASE_URL || "http://127.0.0.1:8081").replace(/\/$/, "");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, attempts = 60, delayMs = 500) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw lastError;
}

async function expect(path, predicate, label) {
  let lastResponse;
  let lastBody = "";
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const response = await fetchWithRetry(base + path);
    const body = await response.text();
    lastResponse = response;
    lastBody = body;
    if (predicate(response, body)) {
      console.log(label + " PASS");
      return;
    }
    if (response.status !== 503 || attempt === 60) break;
    await sleep(500);
  }
  throw new Error(label + " failed: " + lastResponse.status + " " + lastBody.slice(0, 300));
}

await expect("/health/live", (r) => r.ok, "liveness");
await expect("/health/ready", (r) => r.ok, "readiness");
await expect("/__grok/manifest.webmanifest", (r, body) => r.ok && body.includes("name"), "PWA manifest");
await expect("/sw.js", (r, body) => r.ok && body.includes("cache"), "service worker asset");
