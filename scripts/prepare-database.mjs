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
const giftcodeTables = `
CREATE TABLE IF NOT EXISTS giftcode (
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  xu INT NOT NULL DEFAULT 0,
  luong INT NOT NULL DEFAULT 0,
  exp INT NOT NULL DEFAULT 0,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  expires_at DATETIME NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS giftcode_redeem (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(64) NULL,
  redeemed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY giftcode_user (code, user_id),
  KEY giftcode_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
await writeFile(output, `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4;\nUSE ${database};\n${clean}\n${giftcodeTables}`);
console.log(output);
