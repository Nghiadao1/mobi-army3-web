import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

/** The TCP target is operator-controlled; browsers cannot choose arbitrary hosts. */
export function createRelay({ host='127.0.0.1', port=8081, targetHost='127.0.0.1', targetPort=8122, origins=[] } = {}) {
  const server = new WebSocketServer({ host, port, maxPayload: 1024 * 1024 });
  server.on('connection', (websocket, request) => {
    if (origins.length && !origins.includes(request.headers.origin)) { websocket.close(1008, 'Origin not allowed'); return; }
    const socket = net.createConnection({ host: targetHost, port: targetPort });
    const queued = [];
    let connected = false;
    socket.on('connect', () => { connected = true; for (const bytes of queued) socket.write(bytes); queued.length = 0; });
    websocket.on('message', (bytes, binary) => {
      if (!binary) { websocket.close(1003, 'Binary protocol required'); return; }
      if (connected) socket.write(bytes); else queued.push(bytes);
    });
    socket.on('data', bytes => { if (websocket.readyState === WebSocket.OPEN) websocket.send(bytes, { binary: true }); });
    socket.on('error', () => websocket.close(1011, 'Army 2 server unavailable'));
    socket.on('close', () => websocket.close(1000, 'Army 2 server closed'));
    websocket.on('close', () => socket.destroy());
    websocket.on('error', () => socket.destroy());
  });
  return server;
}

// Convert the entry path to a file URL so this works with Windows backslashes
// as well as POSIX paths.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createRelay({
    host: process.env.RELAY_HOST || '127.0.0.1', port: Number(process.env.RELAY_PORT || 8081),
    targetHost: process.env.ARMY2_TCP_HOST || '127.0.0.1', targetPort: Number(process.env.ARMY2_TCP_PORT || 8122),
    origins: (process.env.ARMY2_ORIGINS || '').split(',').filter(Boolean),
  });
  server.on('listening', () => console.log(`Army 2 binary relay ready on port ${server.address().port}`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {
    for (const client of server.clients) client.terminate();
    server.close(() => process.exit(0));
  });
}
