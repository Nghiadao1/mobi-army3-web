#!/usr/bin/env node
/**
 * GIAI DOAN 1 (rebuild Army 2): pipeline dua asset GOC Mobi Army 2 vao game.
 *
 * Nguon: thu muc army2-sources (vantu03 client LibGDX + server) dat canh repo:
 *   ../army2-sources  (hoac truyen duong dan qua argv[2])
 * Dich: public/assets cua repo nay.
 *
 * Nguyen tac an toan (da kiem chung bang kich thuoc/frame truoc khi ghi):
 *  - Chi thay file co CUNG ten + CUNG ti le khung hinh (ban Army 2 = ban 1x,
 *    ban dang dung = x3 chay o div 1.5) -> cap nhat manifest div 1.5 -> 0.5
 *    de kich thuoc hien thi tren man hinh KHONG doi, chi doi nguon goc.
 *  - Item strip: ban x2 cua Army 2 (32x1312, 41 o) thay ban Army 3 (50x2048);
 *    CSS .item-icon-strip da scale theo background-size nen khong can doi CSS.
 *    Mot so item phai doi stripIndex sang o dung cua Army 2 (xem bang duoi).
 *  - Asset chua co cho dung trong engine (sheet hero, sprite boss, bg pieces,
 *    GUI, nhac) duoc chep vao thu muc army2/ de san sang cho Giai doan 2/3.
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

/* ============ PHAN 1: thay truc tiep (cung ten, cung ti le frame) ============ */
// effects: no (no) f5, locxoay (xoay) f3 - ban 1x 32px/o
copy(join(RES, 'effect/no.png'), join(PUB, 'effects/no.png'), '[div 1.5->0.5]');
copy(join(RES, 'effect/locxoay.png'), join(PUB, 'effects/locxoay.png'), '[div 1.5->0.5]');
// dan/ho tro: axit f16, bongbong f2, crate box/box2/boxEmpty f1
copy(join(RES, 'item/axit.png'), join(PUB, 'bullets/axit.png'), '[div 1.5->0.5]');
copy(join(RES, 'item/bongbong.png'), join(PUB, 'bullets/bongbong.png'), '[div 1.5->0.5]');
copy(join(RES, 'item/box.png'), join(PUB, 'bullets/box.png'), '[div 1.5->0.5]');
copy(join(RES, 'item/box2.png'), join(PUB, 'bullets/box2.png'), '[div 1.5->0.5]');
copy(join(RES, 'item/boxEmpty.png'), join(PUB, 'bullets/boxEmpty.png'), '[div 1.5->0.5]');
// item strip: ban x2 Army 2 (32x1312 = 41 o 32px) thay ban Army 3 (50x2048)
copy(join(RES, 'x2/gui/item.png'), join(PUB, 'ui/item.png'), '[strip 41 o, da remap stripIndex]');
// logo goc Army 2 (82x65) thay logo Army 3 (232x173)
copy(join(RES, 'gui/logoGame.png'), join(PUB, 'ui/logoGame.png'), '[logo goc]');

/* ============ PHAN 2: asset san sang cho Giai doan 2/3 (staging) ============ */
// Sheet 10 hero classic (GĐ2: renderer)
for (let i = 0; i <= 9; i++) {
  copy(join(RES, `BigImage/bigImage${i}.png`), join(PUB, `heroes/army2/big${i}.png`));
}
// Boss: Nguoi Tuyet (client) + cac manh boss server (GĐ3: port Boss.java)
for (const f of ['arm.png','body.png','body1.png','body2.png','body3.png','body_injured.png','body_injured2.png','body_injured3.png','bullet_carot.png','fly.png','fullBody.png','leg.png','snow_bull.png','snowman_fire_bum.png']) {
  copy(join(RES, `Boss/SnowMan/${f}`), join(PUB, `bosses/army2/snowman/${f}`));
}
for (const f of ['UFO.png','UFOFire.png','apache.png','arm.png','back_fan.png','body.png','body_injured.png','bomb.png','bossbig.png','bossrobot.png','bosssmall.png','bug_body.png','bug_gun.png','bug_leg.png','bullet.png','conKhiP.png','cowg.png','cuteGirl.png','diamond.png','eye.png','fan1.png','fan2.png','fire.png','front_fan.png','ga.png','greenP.png','gun.png','gunbig.png','injured.png','khicau.png','leg.png','ma.png','ma2.png','magenta.png','mainGun.png','robot.png','rocketer.png','spider.png','tazz.png','yellowP.png']) {
  copy(join(SRES, `player/${f}`), join(PUB, `bosses/army2/parts/${f}`));
}
// Nen theo kieu Army 2: cac manh canh quan lam lop xa (GĐ2: bg renderer)
for (const f of ['back1.png','back2.png','back3.png','back4.png','back5.png','back6.png','back7.png','back8.png','back11.png','back12.png','back14.png','back15.png','back16.png','back17.png','bang.png','bg-cloud.png','bg_cloud1.png','canhdong.png','halongkaka.png','map_spider_layout.png','rock_down.png','rock_up.png','rungRam.png','trungThu_1.png','trungThu_2.png']) {
  copy(join(RES, `map/bgItem/${f}`), join(PUB, `backgrounds/army2/${f}`));
}
// GUI goc (x2 - ban net nhat con dung layout goc) + newGUI (GĐ2/4: UI pass)
copy(join(RES, 'x2/gui'), join(PUB, 'ui/army2/x2gui'), '[ca thu muc]');
copy(join(RES, 'newGUI'), join(PUB, 'ui/army2/newGUI'), '[ca thu muc]');
copy(join(RES, 'gui'), join(PUB, 'ui/army2/gui'), '[ca thu muc]');
// Am thanh Army 2: nhac nen 24s loop + 3 tieng (staging - chua doi BGM mac dinh)
copy(join(RES, 'music/0.mp3'), join(PUB, 'audio/army2/music0.mp3'));
for (const f of ['0.wav','1.wav','2.wav']) copy(join(RES, `sound/${f}`), join(PUB, `audio/army2/sound${f}`));

/* ============ PHAN 3: cap nhat manifest div cho cac strip da thay ============ */
const manifestPath = join(PUB, 'assets-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const divTargets = [
  ['effects', 'explosion'], ['effects', 'tornado'],
  ['bullets', 'acid'], ['bullets', 'tornado'],
  ['bullets', 'crate'],
];
for (const [group, key] of divTargets) {
  if (manifest[group]?.[key]) {
    manifest[group][key].div = 0.5;
    log.push(`MANIFEST ${group}.${key}.div = 0.5`);
  }
}
// bongbong/box2/boxEmpty khong nam trong manifest (chi la file phu) -> khong can div.
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(log.join('\n'));
console.log(`\nTong: ${log.filter((l) => l.startsWith('OK')).length} file/thu muc da chep, ${log.filter((l) => l.startsWith('BO QUA')).length} bo qua.`);
