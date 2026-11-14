import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';

// Integration test for the giftcode feature (server commands 122 + 77).
// Requires a seeded single-use code in the `giftcode` table worth 7777 xu
// and 7 luong; pass its name via ARMY2_GIFTCODE_TEST.
const CODE = process.env.ARMY2_GIFTCODE_TEST;
const XU = 7777;
const LUONG = 7;

function readUTF(buf, offset) {
  const len = buf.readUInt16BE(offset);
  return { value: buf.subarray(offset + 2, offset + 2 + len).toString('utf8'), next: offset + 2 + len };
}

function redeemPayload(code) {
  return Buffer.concat([writeUTF('giftcode'), writeUTF(code), writeUTF('')]);
}

async function enterGuest(name) {
  const identity = randomBytes(16).toString('hex');
  const proof = randomBytes(32).toString('hex');
  const client = new Army2ProtocolClient(process.env.ARMY2_INTEGRATION_URL);
  await client.ready();
  const entered = client.wait(3);
  client.send(-90, Buffer.concat([writeUTF(name), writeUTF(identity), writeUTF(proof), writeUTF('2.4.1')]));
  const info = await entered;
  return { client, id: info.readInt32BE(0), xu: info.readInt32BE(4), luong: info.readInt32BE(8) };
}

test('giftcode: method list, redeem, reuse, unknown code, exhaustion', {
  skip: !process.env.ARMY2_INTEGRATION_URL || !CODE,
  timeout: 60000,
}, async () => {
  const a = await enterGuest(`Gift A ${randomBytes(4).toString('hex')}`);
  try {
    // Command 122: the top-up method list contains the giftcode entry.
    const listReply = a.client.wait(122);
    a.client.send(122, Buffer.from([0]));
    const list = await listReply;
    assert.equal(list[0], 0, 'action 0 = method list');
    const entries = [];
    let off = 1;
    while (off < list.length) {
      const id = readUTF(list, off); off = id.next;
      const info = readUTF(list, off); off = info.next;
      const sms = readUTF(list, off); off = sms.next;
      entries.push({ id: id.value, sms: sms.value });
    }
    const gift = entries.find((e) => e.id === 'giftcode');
    assert.ok(gift, 'giftcode entry present in method list');
    assert.equal(gift.sms, 'napthe:giftcode');

    // Command 77: redeem, sending the code in lowercase (server normalizes).
    const moneyReply = a.client.wait(105);
    const okReply = a.client.wait(45);
    a.client.send(77, redeemPayload(CODE.toLowerCase()));
    const money = await moneyReply;
    assert.equal(money.readInt32BE(0), a.xu + XU, 'xu credited');
    assert.equal(money.readInt32BE(4), a.luong + LUONG, 'luong credited');
    assert.match(readUTF(await okReply, 0).value, /thành công/);

    // Same user, same code: rejected as already redeemed.
    const againReply = a.client.wait(45);
    a.client.send(77, redeemPayload(CODE));
    assert.match(readUTF(await againReply, 0).value, /đã dùng mã giftcode này rồi/);

    // Unknown code: rejected as nonexistent.
    const bogusReply = a.client.wait(45);
    a.client.send(77, redeemPayload('KHONGCO123'));
    assert.match(readUTF(await bogusReply, 0).value, /không tồn tại/);
  } finally {
    a.client.close();
  }

  // A second guest finds the single use exhausted.
  const b = await enterGuest(`Gift B ${randomBytes(4).toString('hex')}`);
  try {
    const outReply = b.client.wait(45);
    b.client.send(77, redeemPayload(CODE));
    assert.match(readUTF(await outReply, 0).value, /đã được sử dụng hết/);
  } finally {
    b.client.close();
  }
});
