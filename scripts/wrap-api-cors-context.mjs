#!/usr/bin/env node
/**
 * Wraps Vercel api handlers with withCorsContext so json() sees the request for CORS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, '../backend/api');

function httpImportPath(fromFile) {
  const rel = path.relative(path.dirname(fromFile), path.join(__dirname, '../backend/lib/http.js'));
  const posix = rel.split(path.sep).join('/');
  return posix.startsWith('.') ? posix : `./${posix}`;
}

function findMatchingBrace(s, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function ensureWithCorsImport(content, filePath) {
  const httpPath = httpImportPath(filePath);
  let next = content.replace(
    /(import\s*\{)([^}]*)(}\s*from\s*['"])([^'"]*\/lib\/http\.js)(['"])/g,
    (full, a, mids, midq, pathPart, q) => {
      if (mids.includes('withCorsContext')) return full;
      let m = mids.trim();
      if (m && !m.endsWith(',')) m += ', ';
      m += 'withCorsContext';
      return `${a} ${m} ${midq}${pathPart}${q}`;
    },
  );
  if (!next.includes('withCorsContext')) {
    next = `import { withCorsContext } from '${httpPath}';\n` + next;
  }
  return next;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('export default withCorsContext(handler)')) return false;

  const trimmed = content.trim();
  const reExport = /^export\s*\{\s*default\s*\}\s*from\s*['"]([^'"]+)['"]\s*;?\s*$/;
  if (reExport.test(trimmed)) {
    const target = trimmed.match(reExport)[1];
    const httpPath = httpImportPath(filePath);
    content = `import handler from '${target}';\nimport { withCorsContext } from '${httpPath}';\nexport default withCorsContext(handler);\n`;
    fs.writeFileSync(filePath, content);
    return true;
  }

  const sig = 'export default async function handler(req, res) {';
  const idx = content.indexOf(sig);
  if (idx === -1) return false;

  content = ensureWithCorsImport(content, filePath);

  const idx2 = content.indexOf(sig);
  if (idx2 === -1) throw new Error(`Lost handler signature after import edit in ${filePath}`);

  const openBrace = idx2 + sig.length - 1;
  const closeBrace = findMatchingBrace(content, openBrace);
  if (closeBrace === -1) throw new Error(`Unbalanced braces in ${filePath}`);

  const before = content.slice(0, idx2);
  const body = content.slice(openBrace + 1, closeBrace);
  const after = content.slice(closeBrace + 1);

  content = `${before}async function handler(req, res) {${body}}${after.trimEnd()}\nexport default withCorsContext(handler);\n`;
  fs.writeFileSync(filePath, content);
  return true;
}

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

let n = 0;
for (const f of walk(apiRoot)) {
  if (processFile(f)) {
    console.log('wrapped', path.relative(apiRoot, f));
    n++;
  }
}
console.log('done,', n, 'files');
