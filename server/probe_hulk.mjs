import { randomBytes } from 'node:crypto';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';

const url = 'ws://127.0.0.1:8081';
const client = new Army2ProtocolClient(url);
await client.ready();
const hpEvents = [];
client.on('packet', (m) => {
  if (m.command === 51) {
    hpEvents.push({ who: m.data.readInt8(0), hp: m.data.readUInt16BE(1) });
  }
});
async function start(name) {
  const identity = randomBytes(16).toString('hex');
  const proof = randomBytes(32).toString('hex');
  const entered = client.wait(3);
  client.send(-90, Buffer.concat([writeUTF(name), writeUTF(identity), writeUTF(proof), writeUTF('2.4.1')]));
  await entered;
  const mp = client.wait(-6);
  client.send(-6);
  const mapMsg = await mp;
  const sp = client.wait(20);
  client.send(83, Buffer.from([0]));
  const start = await sp;
  return { mapId: mapMsg.readInt8(0), sx: start.readInt16BE(14), sy: start.readInt16BE(16), dx: start.readInt16BE(20), dy: start.readInt16BE(22) };
}
async function leave() {
  const lp = client.wait(83, 5000).catch(() => null);
  client.send(83, Buffer.from([1]));
  await lp;
}
async function fireHulk(sx, sy, angle, force) {
  hpEvents.length = 0;
  const rp = client.wait(22, 15000);
  const tp = client.wait(24, 25000);
  const body = Buffer.alloc(12);
  body.writeInt8(68, 0);
  body.writeInt16BE(sx, 1);
  body.writeInt16BE(sy, 3);
  body.writeInt16BE(angle, 5);
  body.writeInt8(force, 7);
  body.writeInt8(1, 8);
  body.writeInt16BE(450, 9);
  body.writeInt8(0, 11);
  client.send(84, body);
  const reply = await rp;
  await tp;
  await new Promise(r => setTimeout(r, 300));
  return { frames: reply.readInt16BE(reply.length - 2), hp: [...hpEvents] };
}
const info = await start('Probe ' + randomBytes(3).toString('hex'));
console.log('map:', JSON.stringify(info));
const shots = [[45, 30], [80, 30], [10, 30], [45, 12], [90, 20], [135, 30], [170, 30], [60, 25]];
for (const [a, f] of shots) {
  try {
    const r = await fireHulk(info.sx, info.sy, a, f);
    console.log('angle', a, 'force', f, '-> hp events:', JSON.stringify(r.hp));
  } catch (e) {
    console.log('angle', a, 'force', f, '-> ERROR', e.message);
  }
  await leave();
  await start('Probe ' + randomBytes(3).toString('hex'));
}
await leave();
client.close();
console.log('probe done');
