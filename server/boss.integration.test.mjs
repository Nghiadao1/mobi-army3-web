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

function readUTFAt(buf, off) {
  const len = buf.readUInt16BE(off);
  return [buf.toString('utf8', off + 2, off + 2 + len), off + 2 + len];
}

function parseBoss89(data) {
  const bosses = [];
  let off = 1;
  const count = data.readInt8(0);
  for (let i = 0; i < count; i += 1) {
    off += 4; // userID
    const [, next] = readUTFAt(data, off);
    off = next;
    const hp = data.readInt32BE(off); off += 4;
    const glass = data.readInt8(off); off += 1;
    const x = data.readInt16BE(off); const y = data.readInt16BE(off + 2); off += 4;
    bosses.push({ hp, glass, x, y });
  }
  return bosses;
}

// Joins the boss board that owns `mapID` as its owner, selects the map and
// starts the war. Returns the boss list from the cmd 89 message plus a flag
// telling whether the war already ended (cmd 50) within the watch window.
async function startBossWar(mapID) {
  for (let roomID = 0; roomID <= 16; roomID += 1) {
    for (let boardID = 0; boardID <= 4; boardID += 1) {
      const client = new Army2ProtocolClient(url);
      try {
        await client.ready();
        const myId = await enterGuest(client, 'BossTest');
        const roomWaitPromise = client.wait(8, 4000).catch(() => null);
        const changeMapPromise = client.wait(75, 4000).catch(() => null);
        client.send(8, Buffer.concat([Buffer.from([roomID, boardID]), writeUTF('')]));
        const roomWait = await roomWaitPromise;
        const changeMap = await changeMapPromise;
        if (!roomWait || !changeMap) { client.close(); continue; }
        const ownerId = roomWait.readInt32BE(0);
        const firstMap = changeMap.readInt8(0);
        const boardFits = firstMap === mapID
          || (firstMap === mapID - 1 && (mapID === 31 || mapID === 39));
        if (!boardFits || ownerId !== myId) { client.close(); continue; }

        let bosses = null;
        let ended = false;
        client.on('packet', (packet) => {
          if (packet.command === 89 && !bosses) {
            try { bosses = parseBoss89(packet.data); } catch { bosses = null; }
          }
          if (packet.command === 50) ended = true;
        });
        if (firstMap !== mapID) {
          client.send(75, Buffer.from([mapID]));
          await sleep(400);
        }
        client.send(20);
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline && !bosses && !ended) await sleep(200);
        // Give a wrongly-instant war a chance to end itself before judging.
        await sleep(2500);
        client.close();
        return { bosses, ended };
      } catch {
        client.close();
      }
    }
  }
  return { bosses: null, ended: false };
}

const cases = [
  { mapID: 36, glass: 17, label: 'balloon (khi cau)' },
  { mapID: 37, glass: 22, label: 'poison spider (nhen doc)' },
  { mapID: 38, glass: 25, label: 'ghost 1 (ma)' },
  { mapID: 39, glass: 26, label: 'ghost 2 (ma)' },
  { mapID: 32, glass: 13, label: 'robot spider (control)' },
];

for (const { mapID, glass, label } of cases) {
  test(`boss map ${mapID} ${label} spawns its boss and does not end instantly`, { skip: !url }, async () => {
    const { bosses, ended } = await startBossWar(mapID);
    assert.ok(bosses && bosses.length > 0, `map ${mapID} spawned no boss`);
    assert.ok(bosses.every((boss) => boss.glass === glass && boss.hp > 0),
      `map ${mapID} bosses have wrong glass/hp: ${JSON.stringify(bosses)}`);
    assert.equal(ended, false, `map ${mapID} war ended instantly`);
  });
}
