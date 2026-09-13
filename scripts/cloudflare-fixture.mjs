import { createServer } from "node:http";
const delivery = process.env.CLOUDFLARE_TEST_URL ?? "http://127.0.0.1:8789";
createServer((request, response) => {
  const id =
    new URL(request.url, "http://127.0.0.1:8790").searchParams.get("widget") ??
    "12345678-1234-4234-8234-123456789abc";
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    response.writeHead(400);
    response.end();
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cedar Workshop</title><style>body{margin:0;background:#fcfaf5;color:#2e2a25;font-family:Georgia,serif}main{max-width:960px;margin:48px auto;padding:0 20px}h1{font-size:32px;margin:0 0 16px}p{line-height:1.5}header{margin-bottom:32px}</style></head><body><main><header><h1>Cedar Workshop</h1><p>Made with care. Shared by our customers.</p></header><div data-gsp-widget="${id}"></div></main><script async src="${delivery}/embed/loader.js"></script></body></html>`,
  );
}).listen(8790, "127.0.0.1", () =>
  console.log("Separate-origin fixture listening on 8790"),
);
