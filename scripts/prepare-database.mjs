import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const schema = await readFile(new URL('../upstream/MobiArmy2-Server/army.sql', import.meta.url), 'utf8');
// Preserve all gameplay tables but do not deploy upstream's saved user accounts.
const clean = schema.replace(/INSERT INTO `user(?:_[a-z]*)?`[\s\S]*?;(?=\s|$)/g, '');
const output = resolve('server/build/schema.sql');
const database = process.env.ARMY2_DATABASE || 'army';
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Invalid database name');
await mkdir(resolve('server/build'), {recursive:true});
await writeFile(output, `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4;\nUSE ${database};\n${clean}`);
console.log(output);
