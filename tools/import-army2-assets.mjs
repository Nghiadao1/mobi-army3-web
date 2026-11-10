#!/usr/bin/env node
/**
 * Pipeline dua asset GOC Mobi Army 2 vao game (Giai doan 1 + 2 cua rebuild).
 *
 * Nguon: thu muc army2-sources (vantu03 client LibGDX + server) dat canh repo:
 *   ../army2-sources  (hoac truyen duong dan qua argv[2])
 * Dich: public/assets cua repo nay.
 *
 * GD1: thay cac strip cung ten/cung ti le frame (div 1.5 -> 0.5), item strip x2,
 *      logo goc; staging heroes/bosses/backgrounds/ui/audio cho GD2/GD3.
 * GD2: giai ma 5 FilePack cua client (bg/gui/item/effect/Hole - XOR khoa
 *      "NguyenVanMinh", index XOR chay lien tuc tren toan bo vung du lieu)
 *      -> staging public/assets/packs/* + thay:
 *        - holes/* bang ban goc trong Hole pack (cung kich thuoc, 0 doi gameplay)
 *        - effects/bullets co hinh hoc frame da kiem chung (ti le 3x, div 0.5)
 *        - backgrounds/army2/pack/* cho renderer nen kieu Army 2
 *
 * Chay: node tools/import-army2-assets.mjs [duong-dan-army2-sources]
 * Idempotent: chay lai nhieu lan cung ra cung ket qua.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = resolve(process.argv[2] ?? join(repoRoot, '..', 'army2-sources'));
const RES = join(srcRoot, 'client/android/assets/res');
const SRES = join(srcRoot, 'server/res');
const PUB = join(repoRoot, 'public/assets');

if (!existsSync(RES)) {
  console.error(`Khong thay army2-sources tai: ${srcRoot}`);
  process.exit(1);
}

const log = [];
function copy(from, to, note) {
  if (!existsSync(from)) {
    log.push(`BO QUA (thieu nguon): ${to} <- ${from}`);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  log.push(`OK  ${to.replace(PUB, 'assets')}  <-  ${from.replace(srcRoot, 'army2')}  ${note ?? ''}`);
}
function writeBuf(to, buf, note) {
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, buf);
  log.push(`OK  ${to.replace(PUB, 'assets')}  <-  FilePack  ${note ?? ''}`);
}

/* ================= FilePack (client Army 2) ================= */
const PACK_CODE = Buffer.from('NguyenVanMinh', 'utf8');
function unpackPack(buf) {
  const n = buf[0];
  let off = 1;
  const entries = [];
  for (let i = 0; i < n; i++) {
    const lname = buf[off++];
    const nameBytes = Buffer.from(buf.subarray(off, off + lname));
    for (let j = 0; j < nameBytes.length; j++) nameBytes[j] ^= PACK_CODE[j % 13];
    off += lname;
    const flen = buf.readUInt16BE(off);
    off += 2;
    entries.push({ name: nameBytes.toString('utf8'), flen });
  }
  const total = entries.reduce((s, e) => s + e.flen, 0);
  const data = Buffer.from(buf.subarray(off, off + total));
  for (let j = 0; j < data.length; j++) data[j] ^= PACK_CODE[j % 13];
  const out = {};
  let pos = 0;
  for (const e of entries) {
    out[e.name] = data.subarray(pos, pos + e.flen);
    pos += e.flen;
  }
  return out;
}
const packs = {};
for (const [key, rel] of [['bg', 'map/bg'], ['gui', 'gui/gui'], ['item', 'item/item'], ['effect', 'effect/effect'], ['hole', 'effect/Hole']]) {
  packs[key] = unpackPack(readFileSync(join(RES, rel)));
  // staging: luu tru nguyen ven cac pack goc cho cac giai doan sau
  for (const [name, buf] of Object.entries(packs[key])) {
    writeBuf(join(PUB, `packs/${key}/${name}`), buf, `[pack ${key}]`);
  }
}

/* ============ GD1: thay truc tiep (cung ten, cung ti le frame) ============ */
copy(join(RES, 'effect/no.png'), join(PUB, 'effects/no.png'), '[div 1.5->0.5]');
copy(join(RES, 'effect/locxoay.png'), join(PUB, 'effects/locxoay.png'), '[tam - GD2 thay bang ban pack]');
copy(join(RES, 'item/axit.png'), join(PUB, 'bullets/axit.png'), '[div 1.5->0.5]');
copy(join(RES, 'item/bongbong.png'), join(PUB, 'bullets/bongbong.png'), '[div 1.5->0.5]');
copy(join(RES, 'item/box.png'), join(PUB, 'bullets/box.png'), '[div 1.5->0.5]');
copy(join(RES, 'item/box2.png'), join(PUB, 'bullets/box2.png'), '[div 1.5->0.5]');
copy(join(RES, 'item/boxEmpty.png'), join(PUB, 'bullets/boxEmpty.png'), '[div 1.5->0.5]');
copy(join(RES, 'x2/gui/item.png'), join(PUB, 'ui/item.png'), '[strip 41 o, da remap stripIndex]');
copy(join(RES, 'gui/logoGame.png'), join(PUB, 'ui/logoGame.png'), '[logo goc]');

/* ============ GD1: staging cho GD2/GD3 ============ */
for (let i = 0; i <= 9; i++) {
  copy(join(RES, `BigImage/bigImage${i}.png`), join(PUB, `heroes/army2/big${i}.png`));
}
for (const f of ['arm.png','body.png','body1.png','body2.png','body3.png','body_injured.png','body_injured2.png','body_injured3.png','bullet_carot.png','fly.png','fullBody.png','leg.png','snow_bull.png','snowman_fire_bum.png']) {
  copy(join(RES, `Boss/SnowMan/${f}`), join(PUB, `bosses/army2/snowman/${f}`));
}
for (const f of ['UFO.png','UFOFire.png','apache.png','arm.png','back_fan.png','body.png','body_injured.png','bomb.png','bossbig.png','bossrobot.png','bosssmall.png','bug_body.png','bug_gun.png','bug_leg.png','bullet.png','conKhiP.png','cowg.png','cuteGirl.png','diamond.png','eye.png','fan1.png','fan2.png','fire.png','front_fan.png','ga.png','greenP.png','gun.png','gunbig.png','injured.png','khicau.png','leg.png','ma.png','ma2.png','magenta.png','mainGun.png','robot.png','rocketer.png','spider.png','tazz.png','yellowP.png']) {
  copy(join(SRES, `player/${f}`), join(PUB, `bosses/army2/parts/${f}`));
}
for (const f of ['back1.png','back2.png','back3.png','back4.png','back5.png','back6.png','back7.png','back8.png','back11.png','back12.png','back14.png','back15.png','back16.png','back17.png','bang.png','bg-cloud.png','bg_cloud1.png','canhdong.png','halongkaka.png','map_spider_layout.png','rock_down.png','rock_up.png','rungRam.png','trungThu_1.png','trungThu_2.png']) {
  copy(join(RES, `map/bgItem/${f}`), join(PUB, `backgrounds/army2/${f}`));
}
copy(join(RES, 'x2/gui'), join(PUB, 'ui/army2/x2gui'), '[ca thu muc]');
copy(join(RES, 'newGUI'), join(PUB, 'ui/army2/newGUI'), '[ca thu muc]');
copy(join(RES, 'gui'), join(PUB, 'ui/army2/gui'), '[ca thu muc]');
copy(join(RES, 'music/0.mp3'), join(PUB, 'audio/army2/music0.mp3'));
for (const f of ['0.wav','1.wav','2.wav']) copy(join(RES, `sound/${f}`), join(PUB, `audio/army2/sound${f}`));

/* ============ GD2: thay bang ban goc trong FilePack ============ */
// Nen: toan bo bg pack -> backgrounds/army2/pack (renderer nen Army 2 dung)
for (const [name, buf] of Object.entries(packs.bg)) {
  writeBuf(join(PUB, `backgrounds/army2/pack/${name}`), buf, '[bg pack]');
}
// Ho dan: 12 file goc, CUNG kich thuoc voi ban dang dung -> 0 thay doi gameplay
for (const [name, buf] of Object.entries(packs.hole)) {
  writeBuf(join(PUB, `holes/${name}`), buf, '[hole goc]');
}
writeBuf(join(PUB, 'bullets/hrangcua.png'), packs.hole['hrangcua.png'], '[hole goc]');
// Effects: hinh hoc frame da kiem chung (chieu cao chia het cho frames, ti le 3x)
for (const f of ['ex3.png','freeze.png','khoi.png','khoidoc.png','lua.png','tangHinhEffect.png','teleport_eff.png','waterBum.png','locxoay.png','longga.png','bomnguyentu.png']) {
  writeBuf(join(PUB, `effects/${f}`), packs.effect[f], '[effect pack, div ->0.5/0.56]');
}
// Dan: tu item pack
for (const f of ['grenade.png','rocket2.png','laser.png','13Missile.png','bomb.png','trungvang.png','thienthach.png','daodat.png','specialbullet.png','web.png']) {
  writeBuf(join(PUB, `bullets/${f}`), packs.item[f], '[item pack, div ->0.5]');
}
writeBuf(join(PUB, 'bullets/gatruilong.png'), packs.effect['gatruilong.png'], '[effect pack, div ->0.5]');
writeBuf(join(PUB, 'effects/gatruilong.png'), packs.effect['gatruilong.png'], '[effect pack]');

/* ============ Cap nhat manifest div ============ */
const manifestPath = join(PUB, 'assets-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const divTargets = {
  effects: { explosion: 0.5, tornado: 0.5, bigExplosion: 0.5, freeze: 0.5, smoke: 0.5, poison: 0.5, fire: 0.5, stealth: 0.5, teleport: 0.5, splash: 0.5, longga: 0.5, nuke: 0.56 },
  bullets: { acid: 0.5, tornado: 0.5, crate: 0.5, cannon: 0.5, ak: 0.5, lightning: 0.5, lightning_storm: 0.5, rocket: 0.5, bomb: 0.5, egg: 0.5, meteor: 0.5, digger: 0.5, special: 0.5, web: 0.5, gatruilong: 0.5 },
};
for (const [group, keys] of Object.entries(divTargets)) {
  for (const [key, div] of Object.entries(keys)) {
    if (manifest[group]?.[key]) {
      manifest[group][key].div = div;
      log.push(`MANIFEST ${group}.${key}.div = ${div}`);
    }
  }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(log.join('\n'));
console.log(`\nTong: ${log.filter((l) => l.startsWith('OK')).length} file/thu muc da chep, ${log.filter((l) => l.startsWith('BO QUA')).length} bo qua.`);
