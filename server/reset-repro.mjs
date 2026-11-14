
import { randomBytes } from 'node:crypto';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';

const URL = process.env.ARMY2_INTEGRATION_URL || 'ws://127.0.0.1:8081';
let failures = 0;
function check(label, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + label + (detail ? ' | ' + detail : ''));
  if (!cond) failures++;
}
function readUTF(buf, offset) {
  const len = buf.readUInt16BE(offset);
  return { value: buf.subarray(offset + 2, offset + 2 + len).toString('utf8'), next: offset + 2 + len };
}
const IDENTITY = randomBytes(16).toString('hex');
const PROOF = randomBytes(32).toString('hex');
async function enterGuest(name) {
  const identity = IDENTITY;
  const proof = PROOF;
  const client = new Army2ProtocolClient(URL);
  await client.ready();
  const entered = client.wait(3);
  client.send(-90, Buffer.concat([writeUTF(name), writeUTF(identity), writeUTF(proof), writeUTF('2.4.1')]));
  const info = await entered;
  return { client, id: info.readInt32BE(0) };
}
function parseInfo(buf) {
  return {
    level: buf[0],
    point: buf.readInt16BE(2),
    ability: [0, 1, 2, 3, 4].map((i) => buf.readInt16BE(4 + i * 2)),
    exp: buf.readInt32BE(14),
  };
}
async function getInfo(client) {
  const w = client.wait(99);
  client.send(99, Buffer.alloc(0));
  return parseInfo(await w);
}
function parseRuong(buf) {
  let off = 0;
  const count = buf[off++];
  const equips = [];
  for (let i = 0; i < count; i++) {
    const dbKey = buf.readInt32BE(off) & 0xffff; off += 4;
    const glassID = buf[off++];
    const type = buf[off++];
    const id = buf.readInt16BE(off); off += 2;
    const nm = readUTF(buf, off); off = nm.next;
    const n = buf[off++];
    off += n;
    const date = buf[off++];
    const slot = buf[off++];
    const vip = buf[off++];
    const level2 = buf[off++];
    equips.push({ dbKey, glassID, type, id });
  }
  const inUse = [];
  for (let i = 0; i < 5; i++) { inUse.push(buf.readInt32BE(off) & 0xffff); off += 4; }
  return { equips, inUse };
}
async function getRuong(client) {
  const wInfo = client.wait(99);
  const wRuong = client.wait(101);
  client.send(90, Buffer.from([6, 0]));
  const info = parseInfo(await wInfo);
  const ruong = parseRuong(await wRuong);
  return { info, ruong };
}

const name = 'Reset ' + randomBytes(4).toString('hex');
console.log('guest:', name);
let s = await enterGuest(name);
try {
  const money = s.client.wait(105);
  s.client.send(77, Buffer.concat([writeUTF('giftcode'), writeUTF('FULLCAP'), writeUTF('')]));
  await money;
  const base = await getInfo(s.client);
  console.log('baseline:', JSON.stringify(base));
  check('baseline FULLCAP state', base.point === 759 && base.ability.join(',') === '0,0,10,10,10');

  // Allocate +10 HP.
  const push = s.client.wait(99);
  const alloc = Buffer.alloc(10);
  alloc.writeInt16BE(10, 0);
  s.client.send(98, alloc);
  const after = parseInfo(await push);
  console.log('after alloc:', JSON.stringify(after));
  check('alloc push 99', after.point === 749 && after.ability[0] === 10);

  // Re-enter profile area (cmd 90 type 6) within the same session.
  const r1 = await getRuong(s.client);
  console.log('requery info:', JSON.stringify(r1.info));
  check('points survive profile re-entry (same session)', r1.info.point === 749 && r1.info.ability[0] === 10);

  // Buy an equip from the generated shop, then wear it.
  const shopW = s.client.wait(103);
  s.client.send(103, Buffer.alloc(0));
  const shop = await shopW;
  const nShop = shop.readInt16BE(0);
  let off = 2;
  const entries = [];
  for (let i = 0; i < nShop; i++) {
    const glassID = shop[off++];
    const type = shop[off++];
    const id = shop.readInt16BE(off); off += 2;
    const nm = readUTF(shop, off); off = nm.next;
    const xu = shop.readInt32BE(off); off += 4;
    const luong = shop.readInt32BE(off); off += 4;
    off += 2; // date, level
    entries.push({ glassID, type, id, xu });
  }
  const buyIdx = entries.findIndex((e) => e.xu > 0);
  console.log('shop entries:', nShop, 'buyIdx:', buyIdx, JSON.stringify(entries[buyIdx]));
  const addW = s.client.wait(104);
  const buyPayload = Buffer.alloc(4);
  buyPayload[0] = 0;
  buyPayload.writeInt16BE(buyIdx, 1);
  buyPayload[3] = 0;
  s.client.send(104, buyPayload);
  const addMsg = await addW;
  const dbKey = addMsg.readInt32BE(1) & 0xffff;
  const eType = entries[buyIdx].type;
  console.log('bought dbKey:', dbKey, 'type:', eType);

  const keys = [-1, -1, -1, -1, -1];
  keys[eType] = dbKey;
  const setW = s.client.wait(102);
  const setPayload = Buffer.alloc(20);
  keys.forEach((k, i) => setPayload.writeInt32BE(k, i * 4));
  s.client.send(102, setPayload);
  await setW;

  const r2 = await getRuong(s.client);
  console.log('ruong inUse after wear:', JSON.stringify(r2.ruong.inUse), 'equips:', JSON.stringify(r2.ruong.equips));
  check('equip stays worn after profile re-entry (same session)', r2.ruong.inUse[eType] === dbKey);
} finally {
  s.client.close();
}

// Reconnect with the same guest name: state must resume.
s = await enterGuest(name);
try {
  check('resume same user id', s.id > 0, 'id=' + s.id);
  const r3 = await getRuong(s.client);
  console.log('after reconnect info:', JSON.stringify(r3.info), 'inUse:', JSON.stringify(r3.ruong.inUse));
  check('points survive reconnect', r3.info.point === 749 && r3.info.ability[0] === 10);
  check('equip survives reconnect', r3.ruong.equips.length >= 1 && r3.ruong.inUse.some((k) => k > 0 && k !== 65535));
} finally {
  s.client.close();
}
console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
