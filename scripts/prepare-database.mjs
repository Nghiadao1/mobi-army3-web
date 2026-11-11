import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const schema = await readFile(new URL('../upstream/MobiArmy2-Server/army.sql', import.meta.url), 'utf8');
// Preserve all gameplay tables but do not deploy upstream's saved user accounts.
const clean = schema
  .replace(/INSERT INTO `user(?:_[a-z]*)?`[\s\S]*?;(?=\s|$)/g, '')
  // The upstream dump referenced equip.id alone even though equipment IDs are
  // only unique within a character (equip's primary key is id + glassID).
  // MySQL 8.4 correctly rejects those incomplete foreign keys.
  .replace('ADD KEY `equipId` (`equipId`);', 'ADD KEY `equip_glass` (`equipId`,`glassID`);')
  .replace('ADD KEY `equipID` (`equipID`);', 'ADD KEY `equip_glass` (`equipID`,`glassID`);')
  .replace('ADD KEY `mission_id` (`mission_id`);', 'ADD KEY `mission_level` (`mission_id`,`level`);')
  .replace('FOREIGN KEY (`equipId`) REFERENCES `equip` (`id`)',
    'FOREIGN KEY (`equipId`,`glassID`) REFERENCES `equip` (`id`,`glassID`)')
  .replace('FOREIGN KEY (`equipID`) REFERENCES `equip` (`id`)',
    'FOREIGN KEY (`equipID`,`glassID`) REFERENCES `equip` (`id`,`glassID`)')
  .replace('FOREIGN KEY (`mission_id`) REFERENCES `mission` (`id`)',
    'FOREIGN KEY (`mission_id`,`level`) REFERENCES `mission` (`id`,`level`)');
const output = resolve('server/build/schema.sql');
const database = process.env.ARMY2_DATABASE || 'army';
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Invalid database name');
await mkdir(resolve('server/build'), {recursive:true});
await writeFile(output, `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4;\nUSE ${database};\n${clean}`);
console.log(output);
