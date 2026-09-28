// 모든 시뮬의 <이름>/js/tests.js를 node로 한 번에 돌린다.
//
//   node scripts/run-all-tests.mjs          직접 실행 — 결과만 출력
//   node scripts/run-all-tests.mjs --hook   Claude Code PreToolUse 훅 — stdin의 JSON을 읽어
//                                           circuit에 대한 git commit일 때만 검사하고,
//                                           실패가 있으면 종료코드 2로 커밋을 막는다.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function isCircuitCommit(input) {
  const cmd = input?.tool_input?.command ?? '';
  if (!/\bgit\b[^|;&]*\bcommit\b/.test(cmd)) return false;
  const cwd = (input?.cwd ?? '').replace(/\\/g, '/').toLowerCase();
  return cwd.includes('/circuit') || /circuit/i.test(cmd);
}

async function runAll() {
  const results = [];
  // '.'은 루트의 회로 시뮬(circuit/js/tests.js)
  for (const name of ['.', ...readdirSync(ROOT).sort()]) {
    const file = join(ROOT, name, 'js', 'tests.js');
    if (!existsSync(file)) continue;
    try {
      const m = await import(pathToFileURL(file).href);
      const r = await m.runAll();
      const fails = r.filter(x => !x.ok);
      results.push({ name: name === '.' ? '(회로)' : name, pass: r.length - fails.length, fails });
    } catch (e) {
      results.push({ name: name === '.' ? '(회로)' : name, pass: 0, fails: [{ label: '불러오기 실패', error: String(e?.message ?? e) }] });
    }
  }
  return results;
}

const hookMode = process.argv.includes('--hook');
if (hookMode) {
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, '') || '{}'); } catch { /* 입력이 없으면 검사 안 함 */ }
  if (!isCircuitCommit(input)) process.exit(0);
}

const results = await runAll();
const failed = results.filter(r => r.fails.length);
const lines = results.map(r => `${r.fails.length ? 'FAIL' : 'ok  '} ${r.name}: PASS ${r.pass} / FAIL ${r.fails.length}`);
for (const r of failed) {
  for (const f of r.fails.slice(0, 5)) lines.push(`  - [${r.name}] ${f.label ?? f.name ?? ''} ${f.error ?? ''}`.trimEnd());
}

if (failed.length) {
  // 훅 모드에서 종료코드 2 + stderr는 Claude에게 전달되고 도구 호출이 막힌다.
  console.error('circuit 테스트 실패 — 커밋을 막았습니다.\n' + lines.join('\n'));
  process.exit(2);
}
if (!hookMode) console.log(lines.join('\n'));
process.exit(0);
