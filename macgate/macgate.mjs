#!/usr/bin/env node
// MacGate v0.1 (MVP) — a SheepGate-style bridge agent for macOS.
// Single file, Node.js standard library only. No dependencies.
//
// Usage:
//   node macgate.mjs --root /path/to/project [--port 46148]
//
// Protocol (compatible with the SheepGate client flow Muse already uses):
//   GET  /health                         -> { ok, project, machine, version, mode }
//   POST /pair   { code }                -> { session_token, project, machine }
//        (code is a one-time pair code printed at startup; it dies after use)
//   POST /call   header X-Session-Token: <token>
//        body { method, path, body }
//        GET  /list?path=src
//        GET  /read?path=README.md
//        GET  /git/status
//        POST /write { path, content }
//        POST /edit  { path, old, new }        (first occurrence)
//        POST /run   { argv: ["git", "status"] } (allowlisted programs, no shell)
//
// Safety:
//   - Listens on 127.0.0.1 only. Expose it with cloudflared, never directly.
//   - Every file path is sandboxed to the project root (no "..", no symlink escape).
//   - /write keeps a backup of the previous file under <root>/.bridge_backups/.
//   - Session token is stored (hashed) in <root>/.macgate/state.json, mode 0600.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const VERSION = '0.1.0';

// ---------- args ----------
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const ROOT = fs.realpathSync(path.resolve(argValue('--root', process.cwd())));
const PORT = Number(argValue('--port', '46148'));
const MODE = argValue('--mode', 'full');

const STATE_DIR = path.join(ROOT, '.macgate');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const BACKUP_DIR = path.join(ROOT, '.bridge_backups');
fs.mkdirSync(STATE_DIR, { recursive: true });

// ---------- state / pairing ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
let state;
if (fs.existsSync(STATE_FILE)) {
  state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} else {
  state = { pairCode: crypto.randomBytes(4).toString('hex').toUpperCase(), tokenHash: null };
  saveState();
}
function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}
if (!state.pairCode && !state.tokenHash) {
  state.pairCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  saveState();
}

function tokenOk(req) {
  const t = req.headers['x-session-token'];
  if (!t || !state.tokenHash) return false;
  const a = Buffer.from(sha256(String(t)));
  const b = Buffer.from(state.tokenHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- helpers ----------
function send(res, code, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 16 * 1024 * 1024) reject(new Error('body too large'));
      else chunks.push(c);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      try { resolve(text ? JSON.parse(text) : {}); } catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}
// Resolve a user-supplied relative path inside ROOT, refusing escapes.
function safeResolve(rel) {
  if (typeof rel !== 'string' || rel.includes('\0')) throw new Error('bad path');
  const abs = path.resolve(ROOT, '.' + path.sep + rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) throw new Error('path escapes project root');
  // Symlink check on the deepest existing ancestor.
  let probe = abs;
  while (!fs.existsSync(probe) && probe !== ROOT) probe = path.dirname(probe);
  const real = fs.realpathSync(probe);
  if (real !== ROOT && !real.startsWith(ROOT + path.sep)) throw new Error('path escapes project root (symlink)');
  return abs;
}

const RUN_ALLOWLIST = new Set(['git', 'node', 'npm', 'npx', 'python3', 'ls', 'cat', 'pwd', 'which']);
function runArgv(argv, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    if (!Array.isArray(argv) || argv.length === 0) return resolve({ code: 400, stdout: '', stderr: 'argv must be a non-empty list' });
    const prog = path.basename(String(argv[0]));
    if (!RUN_ALLOWLIST.has(prog)) return resolve({ code: 403, stdout: '', stderr: `program not allowlisted: ${prog}` });
    const child = spawn(prog, argv.slice(1).map(String), { cwd: ROOT, shell: false, env: process.env });
    let stdout = '', stderr = '', killed = false;
    const cap = (s) => (s.length > 1_000_000 ? s.slice(0, 1_000_000) + '\n[truncated]' : s);
    child.stdout.on('data', (d) => { stdout = cap(stdout + d.toString('utf8')); });
    child.stderr.on('data', (d) => { stderr = cap(stderr + d.toString('utf8')); });
    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: 127, stdout, stderr: stderr + String(e) }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: killed ? 124 : code, stdout, stderr }); });
  });
}

async function handleCall(req, res) {
  if (!tokenOk(req)) return send(res, 401, { error: 'bad or missing session token' });
  let payload;
  try { payload = await readBody(req); } catch (e) { return send(res, 400, { error: String(e.message || e) }); }
  const method = String(payload.method || 'GET').toUpperCase();
  const rawPath = String(payload.path || '/');
  const body = payload.body || {};
  const qIndex = rawPath.indexOf('?');
  const pathname = qIndex >= 0 ? rawPath.slice(0, qIndex) : rawPath;
  const query = new URLSearchParams(qIndex >= 0 ? rawPath.slice(qIndex + 1) : '');

  try {
    if (method === 'GET' && pathname === '/health') {
      return send(res, 200, { ok: true, project: path.basename(ROOT), root: ROOT, machine: os.hostname(), version: VERSION, mode: MODE });
    }
    if (method === 'GET' && pathname === '/list') {
      const rel = query.get('path') || '.';
      const abs = safeResolve(rel);
      const entries = fs.readdirSync(abs, { withFileTypes: true })
        .filter((e) => e.name !== '.macgate')
        .map((e) => {
          const item = { name: e.name, type: e.isDirectory() ? 'dir' : 'file' };
          if (e.isFile()) { try { item.size = fs.statSync(path.join(abs, e.name)).size; } catch {} }
          return item;
        })
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
      return send(res, 200, { path: rel, entries });
    }
    if (method === 'GET' && pathname === '/read') {
      const rel = query.get('path');
      if (!rel) return send(res, 400, { error: 'missing ?path=' });
      const abs = safeResolve(rel);
      const st = fs.statSync(abs);
      if (st.size > 4 * 1024 * 1024) return send(res, 413, { error: 'file too large to read (4MB cap)' });
      return send(res, 200, { path: rel, content: fs.readFileSync(abs, 'utf8') });
    }
    if (method === 'GET' && pathname === '/git/status') {
      const r = await runArgv(['git', 'status', '--porcelain=v1', '-b']);
      return send(res, 200, { code: r.code, stdout: r.stdout, stderr: r.stderr });
    }
    if (method === 'POST' && pathname === '/write') {
      const rel = body.path; const content = body.content;
      if (!rel || typeof content !== 'string') return send(res, 400, { error: 'need {path, content}' });
      const abs = safeResolve(rel);
      if (fs.existsSync(abs)) {
        const bak = path.join(BACKUP_DIR, rel + '.' + new Date().toISOString().replace(/[:.]/g, '-') + '.bak');
        fs.mkdirSync(path.dirname(bak), { recursive: true });
        fs.copyFileSync(abs, bak);
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf8');
      return send(res, 200, { ok: true, path: rel, bytes: Buffer.byteLength(content) });
    }
    if (method === 'POST' && pathname === '/edit') {
      const rel = body.path; const oldText = body.old; const newText = body.new;
      if (!rel || typeof oldText !== 'string' || typeof newText !== 'string') return send(res, 400, { error: 'need {path, old, new}' });
      const abs = safeResolve(rel);
      const text = fs.readFileSync(abs, 'utf8');
      const idx = text.indexOf(oldText);
      if (idx < 0) return send(res, 404, { error: 'old text not found' });
      const bak = path.join(BACKUP_DIR, rel + '.' + new Date().toISOString().replace(/[:.]/g, '-') + '.bak');
      fs.mkdirSync(path.dirname(bak), { recursive: true });
      fs.copyFileSync(abs, bak);
      fs.writeFileSync(abs, text.slice(0, idx) + newText + text.slice(idx + oldText.length), 'utf8');
      return send(res, 200, { ok: true, path: rel });
    }
    if (method === 'POST' && pathname === '/run') {
      const r = await runArgv(body.argv, body.timeout_ms);
      return send(res, 200, r);
    }
    return send(res, 404, { error: `unknown endpoint: ${method} ${pathname}` });
  } catch (e) {
    return send(res, 400, { error: String(e.message || e) });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, project: path.basename(ROOT), machine: os.hostname(), version: VERSION, mode: MODE, paired: Boolean(state.tokenHash) });
  }
  if (req.method === 'POST' && url.pathname === '/pair') {
    let payload;
    try { payload = await readBody(req); } catch (e) { return send(res, 400, { error: String(e.message || e) }); }
    if (!state.pairCode || String(payload.code || '').toUpperCase() !== state.pairCode) {
      return send(res, 403, { error: 'invalid or already-used pair code' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    state.tokenHash = sha256(token);
    state.pairCode = null; // one-time use
    saveState();
    return send(res, 200, { session_token: token, project: path.basename(ROOT), root: ROOT, machine: os.hostname(), version: VERSION, mode: MODE });
  }
  if (req.method === 'POST' && url.pathname === '/call') return handleCall(req, res);
  return send(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MacGate ${VERSION} listening on http://127.0.0.1:${PORT}`);
  console.log(`Project root: ${ROOT}`);
  console.log(`Machine: ${os.hostname()}  Mode: ${MODE}`);
  if (state.pairCode) {
    console.log('');
    console.log('==================================================');
    console.log(`  PAIR CODE (one-time): ${state.pairCode}`);
    console.log('  Give this code to Muse to pair. It dies after use.');
    console.log('==================================================');
  } else {
    console.log('Already paired. To re-pair, delete .macgate/state.json in the project and restart.');
  }
});
