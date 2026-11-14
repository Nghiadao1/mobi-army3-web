import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';

// Spec v3 Phase C: cadence specials in the training arena. After N
// normal shots the NEXT shot becomes the hero's special (per the
// official character site). Companion shots (lightning, back-blast,
// clone) arrive as a second Message 22 before the turn returns.
const url = process.env.ARMY2_INTEGRATION_URL;

function parseShootReply(data) {
  let p = 1;
  const isPow = data.readInt8(p); p += 1;
  p += 1; // shooter index
  const bulletId = data.readInt8(p); p += 1;
  p += 4 + 2; // gun position + angle
  if (bulletId === 17 || bulletId === 19) p += 1;
  if (bulletId === 14 || bulletId === 40) p += 2;
  if (bulletId === 44 || bulletId === 45 || bulletId === 47) p += 1;
  p += 1; // nshoot
  const nBull = data.readInt8(p); p += 1;
  // Only the first bullet's frame count is read (the Phase A harness
  // does the same): the per-bullet frame blocks are followed by hit
  // arrays, so walking them all would need the full wire layout.
  const frames = nBull > 0 ? data.readUInt16BE(p) : 0;
  return { isPow, bulletId, nBull, frames };
}

test('cadence specials follow spec v3 phase C in the training arena', { skip: !url }, async () => {
  const client = new Army2ProtocolClient(url);
  await client.ready();
  try {
    const identity = randomBytes(16).toString('hex');
    const proof = randomBytes(32).toString('hex');
    const entered = client.wait(3);
    client.send(-90, Buffer.concat([
      writeUTF('Cadence ' + randomBytes(3).toString('hex')),
      writeUTF(identity), writeUTF(proof), writeUTF('2.4.1'),
    ]));
    await entered;
    const mapPromise = client.wait(-6);
    client.send(-6);
    await mapPromise;
    const startPromise = client.wait(20);
    client.send(83, Buffer.from([0]));
    const start = await startPromise;
    const sx = start.readInt16BE(14);
    const sy = start.readInt16BE(16);

    async function fireMulti(bulletId, att, force = 15) {
      const replies = [];
      const collector = (m) => {
        if (m.command === 22) replies.push(parseShootReply(m.data));
      };
      client.on('packet', collector);
      const turnPromise = client.wait(24, 30000);
      const body = Buffer.alloc(12);
      body.writeInt8(bulletId, 0);
      body.writeInt16BE(sx, 1);
      body.writeInt16BE(sy, 3);
      body.writeInt16BE(45, 5);
      body.writeInt8(force, 7);
      body.writeInt8(1, 8);
      body.writeInt16BE(att, 9);
      body.writeInt8(0, 11);
      client.send(84, body);
      await turnPromise;
      await new Promise((r) => setTimeout(r, 200));
      client.off('packet', collector);
      return replies;
    }
    const types = (rs) => rs.map((r) => r.bulletId);

    // Thor: shots 1-2 plain hammer, shot 3 calls 3 lightning bolts.
    assert.deepEqual(types(await fireMulti(64, 400)), [64]);
    assert.deepEqual(types(await fireMulti(64, 400)), [64]);
    let r = await fireMulti(64, 400);
    assert.deepEqual(types(r), [64, 84]);
    assert.equal(r[1].nBull, 3);

    // Thor Stormbreaker: same cadence around the axe landing point.
    assert.deepEqual(types(await fireMulti(65, 400)), [65]);
    assert.deepEqual(types(await fireMulti(65, 400)), [65]);
    r = await fireMulti(65, 400);
    assert.deepEqual(types(r), [65, 84]);
    assert.equal(r[1].nBull, 3);

    // Iron Man Mark 50: shot 3 becomes the 150% energy beam.
    assert.deepEqual(types(await fireMulti(62, 350)), [61]);
    assert.deepEqual(types(await fireMulti(62, 350)), [61]);
    assert.deepEqual(types(await fireMulti(62, 350)), [77]);

    // Red Hulk: shot 3 claps both ways (forward + backward shockwave).
    assert.deepEqual(types(await fireMulti(63, 450)), [63]);
    assert.deepEqual(types(await fireMulti(63, 450)), [63]);
    assert.deepEqual(types(await fireMulti(63, 450)), [63, 63]);

    // Hawkeye: after 3 normal arrows, shot 4 is the lock-on volley.
    assert.deepEqual(types(await fireMulti(71, 508)), [71]);
    assert.deepEqual(types(await fireMulti(71, 508)), [71]);
    assert.deepEqual(types(await fireMulti(71, 508)), [71]);
    r = await fireMulti(71, 508);
    assert.deepEqual(types(r), [72]);
    assert.equal(r[0].nBull, 4);

    // Hawkeye Tech: shot 3 calls the air support marker.
    assert.deepEqual(types(await fireMulti(73, 510)), [73]);
    assert.deepEqual(types(await fireMulti(73, 510)), [73]);
    assert.deepEqual(types(await fireMulti(73, 510)), [80]);

    // Ultron: from shot 2 on, a clone fires a second beam alongside.
    assert.deepEqual(types(await fireMulti(74, 300)), [77]);
    assert.deepEqual(types(await fireMulti(74, 300)), [77, 77]);

    // Ultron Prime: same clone behavior.
    assert.deepEqual(types(await fireMulti(75, 350)), [77]);
    assert.deepEqual(types(await fireMulti(75, 350)), [77, 77]);

    // Doctor Strange: discs keep alternating blue/yellow (the magic
    // shield itself is state-only while the dummy cannot shoot back).
    assert.deepEqual(types(await fireMulti(67, 400)), [67]);
    assert.deepEqual(types(await fireMulti(67, 400)), [83]);
    assert.deepEqual(types(await fireMulti(67, 400)), [67]);

    const leavePromise = client.wait(83);
    client.send(83, Buffer.from([1]));
    await leavePromise;
  } finally {
    client.close();
  }
});
