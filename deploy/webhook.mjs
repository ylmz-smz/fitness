import { createHmac, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:http";

const secret = process.env.WEBHOOK_SECRET;

function signatureMatches(body, signature) {
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
  const received = Buffer.from(signature || "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

if (process.argv[2] === "--self-test") {
  process.env.WEBHOOK_SECRET || process.exit(1);
  const body = Buffer.from('{"ref":"refs/heads/main"}');
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  console.assert(signatureMatches(body, signature));
  console.assert(!signatureMatches(body, `${signature}0`));
  process.exit(0);
}

if (!secret) throw new Error("WEBHOOK_SECRET is required");

createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/hooks/fitness") {
    response.writeHead(404).end();
    return;
  }

  const chunks = [];
  let size = 0;
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size > 1024 * 1024) request.destroy();
    else chunks.push(chunk);
  });
  request.on("end", () => {
    const body = Buffer.concat(chunks);
    if (!signatureMatches(body, request.headers["x-hub-signature-256"])) {
      response.writeHead(401).end();
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      response.writeHead(400).end();
      return;
    }
    response.writeHead(202).end();
    if (request.headers["x-github-event"] === "push" && payload.ref === "refs/heads/main") {
      execFile("systemctl", ["start", "--no-block", "fitness-autodeploy.service"]);
    }
  });
}).listen(3200, "127.0.0.1");
