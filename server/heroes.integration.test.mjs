import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';

// Hero weapons per SPEC V3 (2026-11-14): shooting follows the user's
// description, specials follow mobiarmy3.me/nhan-vat. Phase A covers
// the core shots only. The defining rule: POW is an explicit flag the
// client appends to command 84 (after the hero attack short) - force
// no longer implies POW, and a POW shot can be charged at ANY force.
// Cadence specials arrive in Phase C, flight/Hulk leap in Phase B.
const url = process.env.ARMY2_INTEGRATION_URL ?? 'ws://127.0.0.1:8081';

async function startPractice(client, name) {
  const identity = randomBytes(16).toString('hex');
  const proof = randomBytes(32).toString('hex');
  const entered = client.wait(3);
  client.send(-90, Buffer.concat([
    writeUTF(name), writeUTF(identity), writeUTF(proof), writeUTF('2.4.1'),
  ]));
  await entered;
  const mapPromise = client.wait(-6);
  client.send(-6);
  await mapPromise;
  const startPromise = client.wait(20);
  client.send(83, Buffer.from([0]));
  const start = await startPromise;
  return { sx: start.readInt16BE(14), sy: start.readInt16BE(16) };
}

async function fire(client, sx, sy, bulletType, heroAtt, force = 20, powFlag = 0, angle = 45) {
  const replyPromise = client.wait(22);
  const turnPromise = client.wait(24, 25000);
  const body = Buffer.alloc(12);
  let o = 0;
  body.writeInt8(bulletType, o); o += 1;
  body.writeInt16BE(sx, o); o += 2;
  body.writeInt16BE(sy, o); o += 2;
  body.writeInt16BE(angle, o); o += 2;
  body.writeInt8(force, o); o += 1;
  body.writeInt8(1, o); o += 1;
  body.writeInt16BE(heroAtt, o); o += 2;
  body.writeInt8(powFlag, o); o += 1;
  client.send(84, body);
  const reply = await replyPromise;
  let p = 1;
  const isPow = reply.readInt8(p); p += 1;
  p += 1; // shooter index
  const bulletId = reply.readInt8(p); p += 1;
  p += 4 + 2; // gun position + angle
  if (bulletId === 17 || bulletId === 19) p += 1;
  if (bulletId === 14 || bulletId === 40) p += 2;
  if (bulletId === 44 || bulletId === 45 || bulletId === 47) p += 1;
  p += 1; // nshoot
  const nBullet = reply.readInt8(p); p += 1;
  const frames = reply.readInt16BE(p);
  const turn = await turnPromise;
  assert.equal(turn.readInt8(0), 0, 'turn returns to the shooter');
  return { isPow, bulletId, nBullet, frames };
}

test('hero core shots follow spec v3 phase A in the training arena', async () => {
  const client = new Army2ProtocolClient(url);
  await client.ready();
  try {
    const { sx, sy } = await startPractice(client, 'Hero ' + randomBytes(3).toString('hex'));

    // Captain: shield throw. Max force alone is NOT pow anymore...
    let r = await fire(client, sx, sy, 60, 250, 30, 0);
    assert.equal(r.bulletId, 60);
    assert.equal(r.isPow, 0);
    // ...but the POW flag at LOW force is the giant shield (81).
    r = await fire(client, sx, sy, 60, 250, 5, 1);
    assert.equal(r.bulletId, 81);
    assert.equal(r.isPow, 1);
    // Plain throw again.
    r = await fire(client, sx, sy, 60, 250, 20, 0);
    assert.equal(r.bulletId, 60);

    // Iron Man: 2 plasma bolts; POW = 2 rockets (82) at any force.
    r = await fire(client, sx, sy, 61, 350, 15, 0);
    assert.equal(r.bulletId, 61);
    assert.equal(r.nBullet, 2);
    r = await fire(client, sx, sy, 61, 350, 12, 1);
    assert.equal(r.bulletId, 82);
    assert.equal(r.nBullet, 2);

    // Mark 50 shares the Iron Man core in Phase A (beam is Phase C).
    r = await fire(client, sx, sy, 62, 350, 15, 0);
    assert.equal(r.bulletId, 61);
    assert.equal(r.nBullet, 2);
    r = await fire(client, sx, sy, 62, 350, 12, 1);
    assert.equal(r.bulletId, 82);

    // Red Hulk: one punch shockwave.
    r = await fire(client, sx, sy, 63, 450, 15, 0);
    assert.equal(r.bulletId, 63);
    assert.equal(r.nBullet, 1);

    // Thor: one hammer; POW does not triple it in Phase A.
    r = await fire(client, sx, sy, 64, 400, 15, 0);
    assert.equal(r.bulletId, 64);
    assert.equal(r.nBullet, 1);
    r = await fire(client, sx, sy, 64, 400, 15, 1);
    assert.equal(r.bulletId, 64);
    assert.equal(r.nBullet, 1);
    // Stormbreaker: one axe.
    r = await fire(client, sx, sy, 65, 400, 15, 0);
    assert.equal(r.bulletId, 65);


    // Loki: one scepter bolt (no combo anymore).
    r = await fire(client, sx, sy, 66, 400, 15, 0);
    assert.equal(r.bulletId, 66);
    assert.equal(r.nBullet, 1);

    // Doctor Strange: discs alternate blue (67), yellow (83), blue.
    assert.equal((await fire(client, sx, sy, 67, 400, 15, 0)).bulletId, 67);
    assert.equal((await fire(client, sx, sy, 67, 400, 15, 0)).bulletId, 83);
    assert.equal((await fire(client, sx, sy, 67, 400, 15, 0)).bulletId, 67);

    // Winter Soldier: one terrain-piercing AK round (stock 25).
    r = await fire(client, sx, sy, 69, 350, 20, 0);
    assert.equal(r.bulletId, 25);
    assert.equal(r.nBullet, 1);
    // Winter: same piercing round (mark applies on hit, Phase C aura).
    r = await fire(client, sx, sy, 70, 350, 20, 0);
    assert.equal(r.bulletId, 25);
    assert.equal(r.nBullet, 1);
    r = await fire(client, sx, sy, 70, 350, 20, 1);
    assert.equal(r.bulletId, 25);
    assert.equal(r.nBullet, 1);

    // Hawkeye: three single arrows, then the Phase C lock-on
    // volley on the 4th shot (4 homing arrows at 50% each).
    for (let i = 0; i < 3; i++) {
      r = await fire(client, sx, sy, 71, 508, 15, 0);
      assert.equal(r.bulletId, 71);
      assert.equal(r.nBullet, 1);
    }
    r = await fire(client, sx, sy, 71, 508, 15, 0);
    assert.equal(r.bulletId, 72);
    assert.equal(r.nBullet, 4);
    // Hawkeye Tech: single tech arrow (airstrike cadence is
    // covered by heroes-cadence.integration.test.mjs).
    r = await fire(client, sx, sy, 73, 510, 15, 0);
    assert.equal(r.bulletId, 73);
    assert.equal(r.nBullet, 1);

    // Ultron / Ultron Prime: one plasma beam (77).
    r = await fire(client, sx, sy, 74, 300, 15, 0);
    assert.equal(r.bulletId, 77);
    assert.equal(r.nBullet, 1);
    r = await fire(client, sx, sy, 75, 350, 15, 0);
    assert.equal(r.bulletId, 77);
    assert.equal(r.nBullet, 1);

    // Hulk (Phase B): the leap bullet IS Hulk. A normal leap replies
    // with the leap trajectory...
    r = await fire(client, sx, sy, 68, 450, 15, 0);
    assert.equal(r.bulletId, 68);
    // ...and a max-force leap from the spawn flies off the island:
    // Hulk dies (the water case) and the server reports shooter HP 0
    // via command 51 before handing the turn back.
    const hpEvents = [];
    const collector = (m) => {
      if (m.command === 51) {
        hpEvents.push({ who: m.data.readInt8(0), hp: m.data.readUInt16BE(1) });
      }
    };
    client.on('packet', collector);
    r = await fire(client, sx, sy, 68, 450, 30, 0);
    assert.equal(r.bulletId, 68);
    await new Promise((res) => setTimeout(res, 400));
    client.off('packet', collector);
    assert.ok(
      hpEvents.some((e) => e.who === 0 && e.hp === 0),
      'shooter death reported via command 51, got ' + JSON.stringify(hpEvents),
    );

    const leavePromise = client.wait(83);
    client.send(83, Buffer.from([1]));
    await leavePromise;
  } finally {
    client.close();
  }
});
