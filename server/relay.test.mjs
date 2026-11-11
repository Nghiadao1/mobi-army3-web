import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createRelay } from './relay.mjs';

test('relay preserves every byte across fragmented WebSocket and TCP messages', async () => {
  const tcp = net.createServer(socket => socket.on('data', data => {
    socket.write(data.subarray(0, 3)); socket.write(data.subarray(3));
  }));
  tcp.listen(0, '127.0.0.1'); await once(tcp, 'listening');
  const relay = createRelay({ port: 0, targetPort: tcp.address().port });
  await once(relay, 'listening');
  const client = new WebSocket(`ws://127.0.0.1:${relay.address().port}`);
  const expected = Buffer.from(Array.from({length: 4096}, (_, index) => index % 256));
  let received = Buffer.alloc(0);
  const completed = new Promise((resolve, reject) => {
    client.on('error', reject);
    client.on('message', data => {
      received = Buffer.concat([received, data]);
      if (received.length === expected.length) resolve();
    });
  });
  try {
    await once(client, 'open');
    client.send(expected.subarray(0, 13)); client.send(expected.subarray(13, 513)); client.send(expected.subarray(513));
    await completed;
    assert.deepEqual(received, expected);
  } finally {
    client.terminate();
    for (const socket of relay.clients) socket.terminate();
    await new Promise(resolve => relay.close(resolve));
    await new Promise(resolve => tcp.close(resolve));
  }
});
