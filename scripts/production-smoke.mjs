const base = (process.env.BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");

async function expect(path, predicate, label) {
  const response = await fetch(base + path);
  const body = await response.text();
  if (!predicate(response, body)) throw new Error(label + " failed: " + response.status + " " + body.slice(0, 300));
  console.log(label + " PASS");
}

await expect("/health/live", (r) => r.ok, "liveness");
await expect("/health/ready", (r) => r.ok, "readiness");
await expect("/manifest.webmanifest", (r, body) => r.ok && body.includes("name"), "PWA manifest");
await expect("/sw.js", (r, body) => r.ok && body.includes("cache"), "service worker asset");
