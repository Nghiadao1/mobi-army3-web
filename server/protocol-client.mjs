import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';

export function writeUTF(value) {
  const bytes=[];
  for (let i=0;i<value.length;i++) {
    const code=value.charCodeAt(i);
    if (code>0 && code<128) bytes.push(code);
    else if (code<2048) bytes.push(192 | code>>6, 128 | code&63);
    else bytes.push(224 | code>>12,128 | code>>6&63,128 | code&63);
  }
  if (bytes.length>65535) throw new Error('UTF string too long');
  const buffer=Buffer.alloc(bytes.length+2);buffer.writeUInt16BE(bytes.length);Buffer.from(bytes).copy(buffer,2);return buffer;
}

export class Army2ProtocolClient extends EventEmitter {
  buffer=Buffer.alloc(0); key=null; readIndex=0; writeIndex=0;
  constructor(url) {
    super();this.socket=new WebSocket(url);
    this.socket.on('message',bytes=>{this.buffer=Buffer.concat([this.buffer,bytes]);this.consume();});
    this.socket.on('open',()=>this.send(-27));
  }
  async ready() {if(this.key)return;await this.wait(-27);}
  wait(command,timeout=7000) {
    return new Promise((resolve,reject)=>{
      const handler=message=>{if(message.command!==command)return;clearTimeout(timer);this.off('packet',handler);resolve(message.data);};
      const timer=setTimeout(()=>{this.off('packet',handler);reject(new Error(`Army 2 command ${command} timed out`));},timeout);
      this.on('packet',handler);
    });
  }
  send(command,data=Buffer.alloc(0)) {
    const packet=Buffer.alloc(data.length+3);packet.writeInt8(command,0);packet.writeUInt16BE(data.length,1);data.copy(packet,3);
    if(this.key)for(let i=0;i<packet.length;i++){packet[i]^=this.key[this.writeIndex];this.writeIndex=(this.writeIndex+1)%this.key.length;}
    this.socket.send(packet);
  }
  consume() {
    while(this.buffer.length>=3) {
      let cursor=this.readIndex;
      const decode=value=>{if(!this.key)return value;const result=value^this.key[cursor];cursor=(cursor+1)%this.key.length;return result;};
      let command=decode(this.buffer[0]);if(command>127)command-=256;
      let header=3,size;
      if(command===90 || command===-120) {if(this.buffer.length<5)return;header=5;size=this.buffer.readUInt32BE(1);}
      else size=decode(this.buffer[1])*256+decode(this.buffer[2]);
      if(this.buffer.length<header+size)return;
      const data=Buffer.from(this.buffer.subarray(header,header+size));
      if(header===3 && this.key)for(let i=0;i<data.length;i++)data[i]=decode(data[i]);
      this.buffer=this.buffer.subarray(header+size);this.readIndex=cursor;
      if(command===-27) {this.key=Buffer.from(data.subarray(1,1+data[0]));for(let i=1;i<this.key.length;i++)this.key[i]^=this.key[i-1];this.readIndex=0;}
      this.emit('packet',{command,data});
    }
  }
  close() {this.socket.terminate();}
}
