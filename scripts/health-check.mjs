const base = (process.env.BASE_URL || "http://localhost:8080").replace(/\/$/, "");
for (const path of ["/health/live", "/health/ready"]) {
  const response = await fetch(base + path);
  const body = await response.text();
  if (!response.ok) throw new Error(path + " returned " + response.status + ": " + body);
  console.log(path + " PASS " + response.status + " " + body);
}
