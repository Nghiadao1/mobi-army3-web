import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';

const url = process.env.ARMY2_INTEGRATION_URL;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function enterGuest(client, label) {
  const identity = randomBytes(16).toString('hex');
  const proof = randomBytes(32).toString('hex');
  const name = `${label} ${identity.slice(0, 6)}`;
  const entered = client.wait(3);
  client.send(-90, Buffer.concat([
    writeUTF(name), writeUTF(identity), writeUTF(proof), writeUTF('2.4.1'),
  ]));
  const info = await entered;
  return info.readInt32BE(0);
}

// Finds a normal (non-boss) board where `client` becomes the owner.
// Boards in `skip` ("roomID:boardID") are not tried again.
async function claimBoard(client, myId, skip = new Set()) {
  for (let roomID = 0; roomID <= 16; roomID += 1) {
    for (let boardID = 0; boardID <= 4; boardID += 1) {
      if (skip.has(`${roomID}:${boardID}`)) continue;
      const joined = client.wait(8, 2500).catch(() => null);
      const mapP = client.wait(75, 2500).catch(() => null);
      client.send(8, Buffer.concat([Buffer.from([roomID, boardID]), writeUTF('')]));
      const rw = await joined;
      const mp = await mapP;
      if (!rw || !mp) continue;
      const owner = rw.readInt32BE(0);
      const firstMap = mp.readInt8(0);
      if (owner === myId && firstMap <= 26) {
        return { roomID, boardID };
      }
      client.send(15, Buffer.alloc(0)); // leave, try the next board
      await sleep(250);
    }
  }
  return null;
}

function parseLayout(data) {
  let off = 1 + 1 + 2; // zero byte, turn seconds, team point (no team byte in 1v1)
  const slots = [];
  for (let i = 0; i < 100; i += 1) {
    const x = data.readInt16BE(off);
    if (x === -1) {
      off += 2;
      slots.push(null);
      continue;
    }
    const y = data.readInt16BE(off + 2);
    const hp = data.readInt16BE(off + 4);
    off += 6;
    slots.push({ x, y, hp });
  }
  return slots;
}

function parseShoot(data) {
  let p = 0;
  const typeshoot = data.readInt8(p); p += 1;
  const isPow = data.readInt8(p); p += 1;
  const idx = data.readInt8(p); p += 1;
  const bulletId = data.readInt8(p); p += 1;
  p += 4 + 2; // gunX, gunY, ang
  if (bulletId === 17 || bulletId === 19) p += 1;
  if (bulletId === 14 || bulletId === 40) p += 2;
  if (bulletId === 44 || bulletId === 45 || bulletId === 47) p += 1;
  p += 1; // nshoot
  const nBull = data.readInt8(p); p += 1;
  return { typeshoot, isPow, idx, bulletId, nBull };
}

// A two-guest battle on one board. `heroA` is the heroes.json index A
// picks with command -91 before joining (-1 = no hero).
async function startBattle(heroA, label) {
  const a = new Army2ProtocolClient(url);
  await a.ready();
  const aId = await enterGuest(a, `${label}A`);
  if (heroA >= 0) a.send(-91, Buffer.from([heroA]));

  const b = new Army2ProtocolClient(url);
  await b.ready();
  const bId = await enterGuest(b, `${label}B`);
  assert.ok(bId !== aId);

  // Boards can hold ghost seats from earlier disconnected battles,
  // which silently block the start; retry on the next board then.
  const tried = new Set();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const board = await claimBoard(a, aId, tried);
    assert.ok(board, 'no free normal board found');
    tried.add(`${board.roomID}:${board.boardID}`);
    const state = {
      a, b, layout: null, heroes92: null, lastTurn: -1, turnSeq: 0, shoots: [],
      setXY: [], hp51: [],
    };
    // Broadcasts reach every player: listen on ONE client only, or
    // every packet would be recorded twice.
    const onPk = (pk) => {
      if (pk.command === 20 && !state.layout) {
        try { state.layout = parseLayout(pk.data); } catch { /* keep waiting */ }
      }
      if (pk.command === -92) state.heroes92 = pk.data;
      if (pk.command === 24) {
        state.lastTurn = pk.data.readInt8(0);
        state.turnSeq += 1;
      }
      if (pk.command === 22) state.shoots.push(parseShoot(pk.data));
      if (pk.command === 53) {
        state.setXY.push({
          idx: pk.data.readInt8(0), x: pk.data.readInt16BE(1), y: pk.data.readInt16BE(3),
        });
      }
      if (pk.command === 51) {
        state.hp51.push({ idx: pk.data.readInt8(0), hp: pk.data.readInt16BE(1) });
      }
    };
    a.on('packet', onPk);
    const bJoined = b.wait(8, 5000).catch(() => null);
    b.send(8, Buffer.concat([Buffer.from([board.roomID, board.boardID]), writeUTF('')]));
    const joinedOk = await bJoined;
    if (joinedOk) {
      await sleep(400);
      b.send(16, Buffer.alloc(0)); // ready
      await sleep(400);
      a.send(20, Buffer.alloc(0)); // owner starts
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline && (!state.layout || !state.heroes92)) {
        await sleep(200);
      }
    }
    if (state.layout) return state; // listener stays attached for the battle
    // Start refused (ghost seats): detach, leave, try another board.
    a.removeListener('packet', onPk);
    b.send(15, Buffer.alloc(0));
    a.send(15, Buffer.alloc(0));
    await sleep(400);
  }
  assert.fail('battle layout (cmd 20) never arrived on any board');
  return null;
}

// Graceful exit: leave the board before closing so the seats free up.
function leaveBattle(state) {
  try { state.b.send(15, Buffer.alloc(0)); } catch { /* already closed */ }
  try { state.a.send(15, Buffer.alloc(0)); } catch { /* already closed */ }
  state.a.close();
  state.b.close();
}

function fire(client, pos, force = 15) {
  const body = Buffer.alloc(9);
  body.writeInt8(0, 0); // bulletId: ignored by the battle server
  body.writeInt16BE(pos.x, 1);
  body.writeInt16BE(pos.y, 3);
  body.writeInt16BE(45, 5);
  body.writeInt8(force, 7);
  body.writeInt8(1, 8);
  client.send(22, body);
}

// Drives the battle turn by turn (whoever holds the turn fires) until
// `stop(counts)` returns true. The first turn is not guaranteed to be
// slot 0, so the driver never waits for a specific player. Returns
// false when no new turn arrives before the deadline.
async function driveTurns(state, { stop, onShot, forceFor = () => 15, deadlineMs = 180000 }) {
  const counts = [0, 0];
  let actedSeq = 0;
  const start = Date.now();
  while (!stop(counts)) {
    if (Date.now() - start > deadlineMs) return false;
    if (state.turnSeq <= actedSeq || (state.lastTurn !== 0 && state.lastTurn !== 1)) {
      await sleep(120);
      continue;
    }
    const idx = state.lastTurn;
    actedSeq = state.turnSeq;
    const client = idx === 0 ? state.a : state.b;
    fire(client, state.layout[idx], forceFor(idx));
    const shot = await waitShoot(state, idx, counts[idx]);
    if (!shot) return false;
    counts[idx] += 1;
    if (onShot) onShot(idx, shot);
  }
  return true;
}

// Waits until a shot from `idx` beyond the ones already seen arrives.
async function waitShoot(state, idx, seenBefore, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const mine = state.shoots.filter((s) => s.idx === idx);
    if (mine.length > seenBefore) return mine[mine.length - 1];
    await sleep(120);
  }
  return null;
}

test('hero in a real battle: identity, stats, core shot and cadence (Iron Man)', { skip: !url }, async () => {
  const st = await startBattle(0, 'HeroPvp'); // A = ironman (LoCheo3 index 0)
  try {
    // -92 table: exactly one entry, slot 0 -> hero 0, no morph.
    assert.ok(st.heroes92, 'cmd -92 hero table never arrived');
    assert.equal(st.heroes92.readInt8(0), 1);
    assert.equal(st.heroes92.readInt8(1), 0);
    assert.equal(st.heroes92.readInt8(2), 0);
    assert.equal(st.heroes92.readInt8(3), -1);
    // Hero stats are applied server-side: A has 1000 * (100+100)% HP = 2000.
    assert.equal(st.layout[0].hp, 2000, `hero hp ${st.layout[0].hp}`);
    assert.equal(st.layout[1].hp, 1000, `stock hp ${st.layout[1].hp}`);

    // Drive turns until A has fired 3 times: 61, 61, then the cadence
    // energy beam 77. B always fires its stock bullet.
    const aTypes = [];
    const driven = await driveTurns(st, {
      stop: () => aTypes.length >= 3,
      onShot: (idx, shot) => {
        if (idx === 0) {
          aTypes.push(shot.bulletId);
          if (aTypes.length === 1) assert.equal(shot.nBull, 2, 'plasma fires 2 bullets');
        } else {
          assert.ok(shot.bulletId < 60, `B must fire a stock bullet, got ${shot.bulletId}`);
        }
      },
    });
    assert.ok(driven, 'battle stalled before A fired 3 times');
    assert.deepEqual(aTypes, [61, 61, 77], `Iron Man cadence sequence ${aTypes}`);
  } finally {
    leaveBattle(st);
  }
});

test('hero in a real battle: Hulk leap resolves (relocate or death)', { skip: !url }, async () => {
  const st = await startBattle(1, 'HulkPvp'); // A = hulk (LoCheo3 index 1)
  try {
    assert.equal(st.layout[0].hp, 3000, `hulk hp ${st.layout[0].hp}`); // 1000 * (100+200)% = 3000
    const spawn = st.layout[0];
    const xyBefore = st.setXY.length;
    const hpBefore = st.hp51.length;
    // Hulk fires a max-force leap at 45 degrees (like the training
    // death probe); B fires stock shots just to pass its turns.
    let leapShot = null;
    const driven = await driveTurns(st, {
      stop: () => leapShot !== null,
      forceFor: (idx) => (idx === 0 ? 30 : 15),
      onShot: (idx, shot) => {
        if (idx === 0) leapShot = shot;
      },
    });
    assert.ok(driven && leapShot, 'Hulk never got to fire');
    assert.equal(leapShot.bulletId, 68, `Hulk must fire the leap bullet, got ${leapShot.bulletId}`);
    // Resolution: a setXY relocating Hulk, or an HP report of 0.
    const start = Date.now();
    let resolved = false;
    while (Date.now() - start < 12000 && !resolved) {
      const moved = st.setXY.slice(xyBefore).some((m) => m.idx === 0 && (m.x !== spawn.x || m.y !== spawn.y));
      const died = st.hp51.slice(hpBefore).some((h) => h.idx === 0 && h.hp === 0);
      resolved = moved || died;
      if (!resolved) await sleep(150);
    }
    assert.ok(resolved, 'Hulk leap never resolved (no relocate, no death)');
  } finally {
    leaveBattle(st);
  }
});
