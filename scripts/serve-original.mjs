import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(process.env.ARMY2_WEB_ROOT || 'web-client/build/dist/js/webapp');
const port = Number(process.env.PORT || 5180);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.json':'application/json', '.wasm':'application/wasm' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    let file = path;
    const info = await stat(file);
    if (info.isDirectory()) file = resolve(file, 'index.html');
    const size = (await stat(file)).size;
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': size, 'Cache-Control':'no-cache' });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Army 2 original client: http://127.0.0.1:${port}/`));
