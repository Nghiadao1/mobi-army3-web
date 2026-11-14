
import { randomBytes } from 'node:crypto';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';
const URL = process.env.ARMY2_INTEGRATION_URL || 'ws://127.0.0.1:8081';
const IDENTITY = randomBytes(16).toString('hex');
const PROOF = randomBytes(32).toString('hex');
const NAME = 'Equip ' + randomBytes(4).toString('hex');
let failures = 0;
function check(label, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + label + (detail ? ' | ' + detail : ''));
  if (!cond) failures++;
}
function readUTF(buf, offset) {
  const len = buf.readUInt16BE(offset);
  return { value: buf.subarray(offset + 2, offset + 2 + len).toString('utf8'), next: offset + 2 + len };
}
async function enterGuest() {
  const client = new Army2ProtocolClient(URL);
  await client.ready();
  const entered = client.wait(3);
  client.send(-90, Buffer.concat([writeUTF(NAME), writeUTF(IDENTITY), writeUTF(PROOF), writeUTF('2.4.1')]));
  const info = await entered;
  return { client, info };
}
// Parse cmd 3 loadInfoAll: returns equipID arrays per glass.
function parseInfoAll(buf) {
  let off = 12; // id, xu, luong
  off += 1; // selectGlass
  off += 2; // short -1
  off += 1; // byte 0
  const glasses = [];
  for (let g = 0; g < 10; g++) {
    const hasData = buf[off++] !== 0;
    if (hasData) { off += 10; } // data: 5 shorts
    const ids = [];
    for (let i = 0; i < 5; i++) { ids.push(buf.readInt16BE(off)); off += 2; }
    glasses.push(ids);
  }
  return glasses;
}

const s = await enterGuest();
const worn = {}; // type -> {dbKey, equipId}
try {
  const money = s.client.wait(105);
  s.client.send(77, Buffer.concat([writeUTF('giftcode'), writeUTF('FULLCAP'), writeUTF('')]));
  await money;

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
    off += 2;
    entries.push({ idx: i, glassID, type, id, xu });
  }
  const picks = [];
  for (let t = 0; t < 5; t++) {
    const e = entries.find((x) => x.type === t && x.xu > 0) || entries.find((x) => x.type === t);
    if (e) picks.push(e);
  }
  console.log('picks:', JSON.stringify(picks.map((p) => ({ type: p.type, id: p.id, xu: p.xu }))));
  check('shop offers several types', picks.length >= 3, 'types=' + picks.length);

  for (const p of picks) {
    const addW = s.client.wait(104);
    const payload = Buffer.alloc(4);
    payload[0] = 0;
    payload.writeInt16BE(p.idx, 1);
    payload[3] = 0;
    s.client.send(104, payload);
    const addMsg = await addW;
    worn[p.type] = { dbKey: addMsg.readInt32BE(1) & 0xffff, equipId: p.id };
  }
  const keys = [-1, -1, -1, -1, -1];
  for (const [t, w] of Object.entries(worn)) keys[t] = w.dbKey;
  const setW = s.client.wait(102);
  const setPayload = Buffer.alloc(20);
  keys.forEach((k, i) => setPayload.writeInt32BE(k, i * 4));
  s.client.send(102, setPayload);
  await setW;

  // cmd 90 type 6 -> cmd 101 in-use array
  const ruongW = s.client.wait(101);
  const infoW = s.client.wait(99);
  s.client.send(90, Buffer.from([6, 0]));
  const ruong = await ruongW;
  await infoW;
  let roff = 0;
  const count = ruong[roff++];
  for (let i = 0; i < count; i++) {
    roff += 4 + 1 + 1 + 2;
    const nm = readUTF(ruong, roff); roff = nm.next;
    const n = ruong[roff++];
    roff += n + 4;
  }
  const inUse = [];
  for (let i = 0; i < 5; i++) { inUse.push(ruong.readInt32BE(roff) & 0xffff); roff += 4; }
  console.log('inUse:', JSON.stringify(inUse), 'worn:', JSON.stringify(worn));
  for (const [t, w] of Object.entries(worn)) {
    check('inUse slot type ' + t, inUse[t] === w.dbKey);
  }

  // Training battle: cmd 20 must carry the worn equip ids.
  const mapW = s.client.wait(-6);
  s.client.send(-6);
  await mapW;
  const startW = s.client.wait(20);
  s.client.send(83, Buffer.from([0]));
  const start = await startW;
  const battleEquips = [];
  for (let i = 0; i < 5; i++) battleEquips.push(start.readInt16BE(i * 2));
  console.log('battle equip shorts:', JSON.stringify(battleEquips));
  for (const [t, w] of Object.entries(worn)) {
    check('battle equip type ' + t, battleEquips[t] === w.equipId, 'want ' + w.equipId);
  }
  const leaveW = s.client.wait(83);
  s.client.send(83, Buffer.from([1]));
  await leaveW;
} finally {
  s.client.close();
}

// Reconnect: cmd 3 loadInfoAll for glass 0 must list worn equip ids.
const s2 = await enterGuest();
try {
  const glasses = parseInfoAll(s2.info);
  console.log('cmd3 glass0 equipIDs:', JSON.stringify(glasses[0]));
  for (const [t, w] of Object.entries(worn)) {
    check('reconnect equipID type ' + t, glasses[0][t] === w.equipId, 'want ' + w.equipId);
  }
} finally {
  s2.client.close();
}
console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
