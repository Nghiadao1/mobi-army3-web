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

async function startTraining(client) {
  const mapReplyPromise = client.wait(-6);
  client.send(-6);
  await mapReplyPromise;
  const startPromise = client.wait(20);
  client.send(83, Buffer.from([0]));
  const start = await startPromise;
  const offset = 10 + 1 + 1 + 2;
  return { sx: start.readInt16BE(offset), sy: start.readInt16BE(offset + 2) };
}

// Fire one training shot the way the hero-enabled client does: bullet
// type + hero attack appended after nshoot. Resolves with the parsed
// trajectory header once the turn comes back (command 24).
async function fire(client, sx, sy, bulletType, heroAtt, force = 20, angle = 45) {
  const replyPromise = client.wait(22);
  const turnPromise = client.wait(24);
  const body = Buffer.alloc(1 + 2 + 2 + 2 + 1 + 1 + 2);
  let o = 0;
  body.writeInt8(bulletType, o); o += 1;
  body.writeInt16BE(sx, o); o += 2;
  body.writeInt16BE(sy, o); o += 2;
  body.writeInt16BE(angle, o); o += 2;
  body.writeInt8(force, o); o += 1;
  body.writeInt8(1, o); o += 1;
  body.writeInt16BE(heroAtt, o); o += 2;
  client.send(84, body);
  const reply = await replyPromise;
  let p = 0;
  const typeShoot = reply.readInt8(p); p += 1;
  const isPow = reply.readInt8(p); p += 1;
  const whoFire = reply.readInt8(p); p += 1;
  const bulletId = reply.readInt8(p); p += 1;
  p += 4; // gun x/y
  p += 2; // angle
  if (bulletId === 17 || bulletId === 19) p += 1;
  if (bulletId === 14 || bulletId === 40) p += 2;
  if (bulletId === 44 || bulletId === 45 || bulletId === 47) p += 1;
  p += 1; // nshoot
  const nBullet = reply.readInt8(p); p += 1;
  const frames = reply.readInt16BE(p);
  const turn = await turnPromise;
  assert.equal(turn.readInt8(0), 0, 'turn returns to the shooter');
  return { typeShoot, isPow, whoFire, bulletId, nBullet, frames };
}

test('hero weapon skills resolve through the training arena', { skip: !url }, async () => {
  const client = new Army2ProtocolClient(url);
  await client.ready();
  await enterGuest(client, 'Hero');
  const { sx, sy } = await startTraining(client);

  // Captain America: shield throw, and the giant shield at full force.
  const shield = await fire(client, sx, sy, 60, 250, 20);
  assert.equal(shield.bulletId, 60, 'shield bullet type');
  assert.equal(shield.isPow, 0, 'normal shield is not pow');
  assert.ok(shield.frames > 10, `shield flight frames: ${shield.frames}`);
  const bigShield = await fire(client, sx, sy, 60, 250, 30);
  assert.equal(bigShield.isPow, 1, 'full-force shield is the giant POW shield');

  // Iron Man Mark 50: two normal shots, third is the energy beam.
  const m1 = await fire(client, sx, sy, 62, 350, 15);
  const m2 = await fire(client, sx, sy, 62, 350, 15);
  const m3 = await fire(client, sx, sy, 62, 350, 15);
  assert.deepEqual([m1.bulletId, m2.bulletId, m3.bulletId], [0, 0, 14], 'mark 50 cadence');

  // Winter Soldier: shots pierce terrain (stock type 25 on the wire).
  const ws = await fire(client, sx, sy, 69, 350, 20);
  assert.equal(ws.bulletId, 25, 'winter soldier pierces terrain');

  // Hawkeye: three arrows, fourth shot is the 4-arrow lock-on volley.
  await fire(client, sx, sy, 71, 508, 15);
  await fire(client, sx, sy, 71, 508, 15);
  await fire(client, sx, sy, 71, 508, 15);
  const volley = await fire(client, sx, sy, 71, 508, 15);
  assert.equal(volley.bulletId, 72, 'lock-on volley type');
  assert.equal(volley.nBullet, 4, 'four arrows');

  // Thor: third shot is powered (lightning carrier).
  await fire(client, sx, sy, 64, 400, 15);
  await fire(client, sx, sy, 64, 400, 15);
  const thor = await fire(client, sx, sy, 64, 400, 15);
  assert.equal(thor.bulletId, 64, 'thor keeps his bullet type');
  assert.equal(thor.isPow, 1, 'third thor shot is the lightning skill shot');

  // Hulk: leap attack bullet.
  const hulk = await fire(client, sx, sy, 68, 450, 18);
  assert.equal(hulk.bulletId, 68, 'hulk leap type');
  assert.equal(hulk.nBullet, 1, 'one leap');

  const leavePromise = client.wait(83);
  client.send(83, Buffer.from([1]));
  await leavePromise;
  client.close();
});
