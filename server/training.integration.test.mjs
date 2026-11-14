import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';

const url = process.env.ARMY2_INTEGRATION_URL;

async function enterGuest(client, label) {
  const identity = randomBytes(16).toString('hex');
  const proof = randomBytes(32).toString('hex');
  const name = `${label} ${identity.slice(0, 6)}`;
  const entered = client.wait(3);
  client.send(-90, Buffer.concat([
    writeUTF(name), writeUTF(identity), writeUTF(proof), writeUTF('2.4.1'),
  ]));
  const info = await entered;
  return { id: info.readInt32BE(0), name };
}

test('training map request, practice start layout and leave acknowledgement', { skip: !url }, async () => {
  const client = new Army2ProtocolClient(url);
  await client.ready();
  await enterGuest(client, 'Training');

  const mapReplyPromise = client.wait(-6);
  client.send(-6);
  const mapReply = await mapReplyPromise;
  const mapId = mapReply.readInt8(0);
  assert.ok(mapId >= 0, `training map id ${mapId}`);

  const startPromise = client.wait(20);
  client.send(83, Buffer.from([0]));
  const start = await startPromise;
  let offset = 0;
  for (let i = 0; i < 5; i += 1) {
    start.readInt16BE(offset); // equip shorts of the current gun
    offset += 2;
  }
  assert.equal(start.readInt8(offset), mapId, 'start message names the same map');
  offset += 1;
  const turnSeconds = start.readInt8(offset);
  offset += 1;
  assert.ok(turnSeconds > 0, 'turn seconds present');
  offset += 2; // team bits (unused by the client in training)
  const slots = [];
  for (let s = 0; s < 8; s += 1) {
    const x = start.readInt16BE(offset);
    offset += 2;
    if (x === -1) {
      slots.push(null);
    } else {
      const y = start.readInt16BE(offset);
      const hp = start.readInt16BE(offset + 2);
      offset += 4;
      slots.push({ x, y, hp });
    }
  }
  assert.ok(slots[0] && slots[0].hp > 0, 'player spawn with hp');
  assert.ok(slots[1] && slots[1].hp > 0, 'target spawn with hp');
  assert.ok(slots.slice(2).every((slot) => slot === null), 'slots 2-7 stay empty');

  const leavePromise = client.wait(83);
  client.send(83, Buffer.from([1]));
  await leavePromise;
  client.close();
});
