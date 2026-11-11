import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Army2ProtocolClient, writeUTF } from './protocol-client.mjs';

test('name-only guest entry creates and resumes one original Army 2 profile', {skip: !process.env.ARMY2_INTEGRATION_URL, timeout:30000}, async()=>{
  const identity=randomBytes(16).toString('hex'),token=randomBytes(32).toString('hex');
  const name=`Nghĩa ${identity.slice(0,8)}`;
  const data=(name,proof=token)=>Buffer.concat([writeUTF(name),writeUTF(identity),writeUTF(proof),writeUTF('2.4.1')]);
  let client=new Army2ProtocolClient(process.env.ARMY2_INTEGRATION_URL);
  try {
    await client.ready();
    let response=client.wait(45);client.send(-90,data(''));await response;
    response=client.wait(45);client.send(-90,data('Tên\nẩn'));await response;
    response=client.wait(3);client.send(-90,data(name));const first=await response;const id=first.readInt32BE();assert.ok(id>0);
    for (const type of [2,1,3,4,5]) {
      response=client.wait(90);client.send(90,Buffer.from([type,0]));
      const pack=await response;assert.equal(pack[0],type);assert.ok(pack.length>2,`Original asset pack ${type} must contain data`);
    }
    response=client.wait(6);client.send(6);assert.ok((await response).length>0,'Original room list remains functional');
    client.close();await delay(350);
    client=new Army2ProtocolClient(process.env.ARMY2_INTEGRATION_URL);await client.ready();
    response=client.wait(45);client.send(-90,data(name,randomBytes(32).toString('hex')));await response;
    response=client.wait(3);client.send(-90,data(name+' M'));assert.equal((await response).readInt32BE(),id,'Renaming with the same browser proof resumes the same profile');
    const second=new Army2ProtocolClient(process.env.ARMY2_INTEGRATION_URL);
    try {
      await second.ready();response=second.wait(45);
      second.send(-90,Buffer.concat([writeUTF(name+' M'),writeUTF(randomBytes(16).toString('hex')),writeUTF(randomBytes(32).toString('hex')),writeUTF('2.4.1')]));
      await response;
    } finally {second.close();}
  } finally {client.close();}
});
