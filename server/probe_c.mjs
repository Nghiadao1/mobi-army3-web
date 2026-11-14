import { randomBytes } from 'node:crypto';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';

const client = new Army2ProtocolClient('ws://127.0.0.1:8081');
await client.ready();
client.on('packet', (m) => {
  if (m.command === 22) {
    console.log('CMD22 len', m.data.length, 'hex:', m.data.subarray(0, 14).toString('hex'), '| byte2:', m.data.readInt8(2));
  }
});
const identity = randomBytes(16).toString('hex');
const proof = randomBytes(32).toString('hex');
const entered = client.wait(3);
client.send(-90, Buffer.concat([writeUTF('ProbeC ' + randomBytes(3).toString('hex')), writeUTF(identity), writeUTF(proof), writeUTF('2.4.1')]));
await entered;
const mp = client.wait(-6);
client.send(-6);
await mp;
const sp = client.wait(20);
client.send(83, Buffer.from([0]));
const start = await sp;
const sx = start.readInt16BE(14);
const sy = start.readInt16BE(16);
console.log('spawn', sx, sy);
const tp = client.wait(24, 30000);
const body = Buffer.alloc(12);
body.writeInt8(64, 0);
body.writeInt16BE(sx, 1);
body.writeInt16BE(sy, 3);
body.writeInt16BE(45, 5);
body.writeInt8(15, 7);
body.writeInt8(1, 8);
body.writeInt16BE(400, 9);
body.writeInt8(0, 11);
client.send(84, body);
await tp;
console.log('turn returned');
const lp = client.wait(83, 5000).catch(() => null);
client.send(83, Buffer.from([1]));
await lp;
client.close();
