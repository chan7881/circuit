// model.js 검증. test.html에서 모듈로 로드되어 화면과 콘솔에 PASS/FAIL을 출력한다.

import {
  PAIRS,
  BASE_ELECTRONS,
  MAX_TRANSFER,
  RUB_DISTANCE_PER_ELECTRON,
  createModel,
  rubByDistance,
  rubFraction,
  reset,
  setPair,
  electronCount,
  protonCount,
  netCharge,
  totalElectrons,
  forceBetween,
  objectParticle,
  createHockeyModel,
  resetHockey,
  setHockeyCharge,
  movePaddle,
  stepHockey,
  hockeyForceKind,
  MAX_SPEED,
  FIELD,
  PUCK_R,
  PADDLE_R,
  ATTRACT,
  REPEL,
  NONE,
} from './model.js'

const results = []
function assert(cond, label) {
  results.push({ ok: !!cond, label })
}
function eq(actual, expected, label) {
  results.push({ ok: actual === expected, label: `${label} (실제=${actual}, 기대=${expected})` })
}

/** 전자 n개가 옮겨갈 만큼 문지른다 */
function rubElectrons(m, n) {
  return rubByDistance(m, RUB_DISTANCE_PER_ELECTRON * n)
}

// 1) 처음에는 두 물체 모두 중성이다
;(function neutralAtStart() {
  const m = createModel('straw')
  eq(netCharge(m, 'a'), 0, '처음 빨대는 중성')
  eq(netCharge(m, 'b'), 0, '처음 털가죽은 중성')
  eq(electronCount(m, 'a'), BASE_ELECTRONS, '처음 전자 수 = 양성자 수(a)')
})()

// 2) 전하량 보존 — 몇 번을 문질러도 전자 총합은 그대로
;(function conservation() {
  const m = createModel('straw')
  const before = totalElectrons(m)
  rubElectrons(m, MAX_TRANSFER + 3)
  eq(totalElectrons(m), before, '문질러도 두 물체의 전자 수 합은 일정(전하량 보존)')
  eq(netCharge(m, 'a') + netCharge(m, 'b'), 0, '두 물체의 알짜 전하 합은 항상 0')
})()

// 3) 원자핵(양성자)은 절대 움직이지 않는다
;(function protonsNeverMove() {
  const m = createModel('straw')
  const before = protonCount()
  rubElectrons(m, 4)
  eq(protonCount(), before, '문질러도 양성자 수는 그대로(전자만 이동)')
})()

// 4) 교과서와 같은 결과 — 빨대·털가죽에서는 빨대가 (−), 털가죽이 (+)
;(function strawPairSigns() {
  const m = createModel('straw')
  rubElectrons(m, 3)
  assert(netCharge(m, 'a') < 0, '빨대는 전자를 얻어 (−)전기를 띤다')
  assert(netCharge(m, 'b') > 0, '털가죽은 전자를 잃어 (+)전기를 띤다')
  eq(electronCount(m, 'a'), BASE_ELECTRONS + 3, '빨대의 전자 수가 3 늘었다')
  eq(electronCount(m, 'b'), BASE_ELECTRONS - 3, '털가죽의 전자 수가 3 줄었다')
})()

// 5) 쌍을 바꾸면 부호가 반대가 된다 — "빨대는 항상 (−)"라는 오개념 방지
;(function glassPairSigns() {
  const m = createModel('glass')
  rubElectrons(m, 3)
  assert(netCharge(m, 'a') > 0, '유리막대는 전자를 잃어 (+)전기를 띤다')
  assert(netCharge(m, 'b') < 0, '비단은 전자를 얻어 (−)전기를 띤다')
})()

// 6) 최대치를 넘겨 문질러도 안전하고, 초기화하면 중성으로 돌아온다
;(function clampAndReset() {
  const m = createModel('straw')
  rubElectrons(m, 999)
  eq(m.transferred, MAX_TRANSFER, '최대 이동 개수를 넘지 않는다')
  assert(electronCount(m, 'b') >= 0, '전자 수가 음수가 되지 않는다')
  reset(m)
  eq(netCharge(m, 'a'), 0, '초기화하면 다시 중성')
  eq(m.rubProgress, 0, '초기화하면 쌓인 문지른 거리도 사라진다')
})()

// 7) 쌍을 바꾸면 문지른 상태가 초기화된다(섞이지 않게)
;(function switchPairResets() {
  const m = createModel('straw')
  rubElectrons(m, 4)
  setPair(m, 'glass')
  eq(m.transferred, 0, '쌍을 바꾸면 처음부터 다시 문질러야 한다')
  eq(m.pairId, 'glass', '쌍이 바뀌었다')
})()

// 8) 문지른 만큼만 옮겨간다 — 조금 문지르면 조금, 많이 문지르면 많이
//    (예전에는 조금만 움직여도 최대치까지 차버려 이 관계가 안 보였다, 2026-08-06 피드백)
;(function gradualTransfer() {
  const m = createModel('straw')
  eq(rubByDistance(m, RUB_DISTANCE_PER_ELECTRON * 0.9), 0, '한 칸을 못 채우면 전자는 안 옮겨간다')
  eq(m.transferred, 0, '아직 중성 그대로')
  assert(rubFraction(m) > 0.85 && rubFraction(m) < 1, '진행도는 거의 다 찬 상태로 남아 있다')

  eq(rubByDistance(m, RUB_DISTANCE_PER_ELECTRON * 0.2), 1, '남은 거리를 마저 채우면 전자 하나가 옮겨간다')
  eq(m.transferred, 1, '누적된 거리가 이어져 계산된다')

  const m2 = createModel('straw')
  eq(rubByDistance(m2, RUB_DISTANCE_PER_ELECTRON * 3), 3, '세 칸만큼 문지르면 전자 3개가 한 번에 옮겨간다')
})()

// 9) 최대치에서는 거리가 쌓이지 않는다 — 초기화 직후 전자가 우르르 옮겨가면 안 된다
;(function noOverflowAtMax() {
  const m = createModel('straw')
  rubElectrons(m, MAX_TRANSFER)
  rubByDistance(m, RUB_DISTANCE_PER_ELECTRON * 5) // 최대치 상태에서 한참 더 문지름
  eq(m.rubProgress, 0, '최대치에서는 문지른 거리가 쌓이지 않는다')
  reset(m)
  eq(rubByDistance(m, 1), 0, '초기화 직후 아주 조금 움직여도 전자는 안 옮겨간다')
})()

// 10) 움직이지 않으면 아무 일도 없다
;(function noRubNoTransfer() {
  const m = createModel('straw')
  eq(rubByDistance(m, 0), 0, '움직이지 않으면 옮겨가지 않는다')
  eq(rubByDistance(m, -50), 0, '음수 거리는 무시한다')
  eq(m.transferred, 0, '중성 그대로')
})()

// 11) 전기력 판정 — 이번 소단원의 결론
;(function forceRules() {
  eq(forceBetween(1, 1), REPEL, '(+)와 (+)는 밀어낸다')
  eq(forceBetween(-1, -1), REPEL, '(−)와 (−)는 밀어낸다')
  eq(forceBetween(1, -1), ATTRACT, '(+)와 (−)는 끌어당긴다')
  eq(forceBetween(-1, 1), ATTRACT, '(−)와 (+)는 끌어당긴다')
  eq(forceBetween(0, 1), NONE, '한쪽이 중성이면 이 화면에서는 힘을 표시하지 않는다')
  eq(forceBetween(3, 1), REPEL, '크기가 달라도 같은 부호면 밀어낸다')
})()

// 12) 물체 쌍 정의가 온전한지
;(function pairsWellFormed() {
  assert(PAIRS.length >= 2, '물체 쌍이 2가지 이상이다')
  const ok = PAIRS.every((p) => (p.donor === 'a' || p.donor === 'b') && p.a?.name && p.b?.name && p.a?.shape && p.b?.shape)
  assert(ok, '모든 쌍에 donor·이름·그림 모양이 정의되어 있다')
  const donors = new Set(PAIRS.map((p) => p.donor))
  assert(donors.size === 2, '전자를 주는 쪽이 서로 다른 쌍이 함께 있다(결과가 상대적임을 보이기 위해)')
})()

// ── 에어하키 ──────────────────────────────────────────────────────────

/** n초 동안 물리를 돌린다(60fps 기준) */
function run(h, seconds) {
  const dt = 1 / 60
  for (let i = 0; i < Math.round(seconds / dt); i++) stepHockey(h, dt)
  return h
}

// 13) 같은 전기끼리는 밀어낸다 — 퍽이 채에서 멀어져야 한다
;(function hockeyRepel() {
  const h = createHockeyModel()
  setHockeyCharge(h, 'paddle', -1)
  setHockeyCharge(h, 'puck', -1)
  eq(hockeyForceKind(h), REPEL, '(−)채와 (−)퍽은 밀어냄')
  const before = Math.hypot(h.puck.x - h.paddle.x, h.puck.y - h.paddle.y)
  run(h, 0.5)
  const after = Math.hypot(h.puck.x - h.paddle.x, h.puck.y - h.paddle.y)
  assert(after > before, `같은 전기끼리는 퍽이 채에서 멀어진다 (${before.toFixed(1)} → ${after.toFixed(1)})`)
})()

// 14) 다른 전기끼리는 끌어당긴다
;(function hockeyAttract() {
  const h = createHockeyModel()
  setHockeyCharge(h, 'paddle', 1)
  setHockeyCharge(h, 'puck', -1)
  eq(hockeyForceKind(h), ATTRACT, '(+)채와 (−)퍽은 끌어당김')
  const before = Math.hypot(h.puck.x - h.paddle.x, h.puck.y - h.paddle.y)
  run(h, 0.5)
  const after = Math.hypot(h.puck.x - h.paddle.x, h.puck.y - h.paddle.y)
  assert(after < before, `다른 전기끼리는 퍽이 채 쪽으로 끌려온다 (${before.toFixed(1)} → ${after.toFixed(1)})`)
})()

// 15) 사방이 막혀 있다 — 퍽은 어떤 경우에도 경기장을 벗어나지 않는다
;(function hockeyWalls() {
  const h = createHockeyModel()
  setHockeyCharge(h, 'paddle', -1)
  setHockeyCharge(h, 'puck', -1)
  // 채를 구석에 붙여 퍽을 계속 밀어붙인다
  movePaddle(h, 0, 0, 0.016)
  run(h, 6)
  const inside =
    h.puck.x >= FIELD.x + PUCK_R - 0.001 &&
    h.puck.x <= FIELD.x + FIELD.w - PUCK_R + 0.001 &&
    h.puck.y >= FIELD.y + PUCK_R - 0.001 &&
    h.puck.y <= FIELD.y + FIELD.h - PUCK_R + 0.001
  assert(inside, `퍽이 벽 안에 머문다 (x=${h.puck.x.toFixed(1)}, y=${h.puck.y.toFixed(1)})`)
})()

// 16) 채도 경기장을 벗어나지 않는다
;(function paddleWalls() {
  const h = createHockeyModel()
  movePaddle(h, -500, -500, 0.016)
  eq(h.paddle.x, FIELD.x + PADDLE_R, '채는 왼쪽 벽을 넘지 않는다')
  eq(h.paddle.y, FIELD.y + PADDLE_R, '채는 위쪽 벽을 넘지 않는다')
  movePaddle(h, 9999, 9999, 0.016)
  eq(h.paddle.x, FIELD.x + FIELD.w - PADDLE_R, '채는 오른쪽 벽을 넘지 않는다')
  eq(h.paddle.y, FIELD.y + FIELD.h - PADDLE_R, '채는 아래쪽 벽을 넘지 않는다')
})()

// 17) 끌어당기는 조합에서도 퍽이 채를 통과하지 못한다(물리 충돌)
;(function noTunneling() {
  const h = createHockeyModel()
  setHockeyCharge(h, 'paddle', 1)
  setHockeyCharge(h, 'puck', -1)
  run(h, 10) // 계속 끌어당겨 붙게 둔다
  const d = Math.hypot(h.puck.x - h.paddle.x, h.puck.y - h.paddle.y)
  assert(d >= PUCK_R + PADDLE_R - 0.5, `끌려와도 채 안으로 파고들지 않는다 (거리=${d.toFixed(1)}, 최소=${PUCK_R + PADDLE_R})`)
})()

// 18) 물리가 폭발하지 않는다 — 어떤 조합으로 오래 돌려도 값이 유한하다
;(function stability() {
  for (const [pc, kc] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const h = createHockeyModel()
    setHockeyCharge(h, 'paddle', pc)
    setHockeyCharge(h, 'puck', kc)
    // 채를 퍽 위에 겹쳐 두는 최악의 경우
    movePaddle(h, h.puck.x, h.puck.y, 0.016)
    run(h, 8)
    assert(Number.isFinite(h.puck.x) && Number.isFinite(h.puck.y), `전하 (${pc},${kc}) 조합에서 좌표가 발산하지 않는다`)
  }
})()

// 18-2) 어떤 경우에도 퍽의 속력이 상한을 넘은 채로 프레임이 끝나지 않는다.
//       채 충돌은 채의 속도를 퍽에 얹으므로, 손가락을 휙 그었을 때 여기서 터지기 쉽다.
;(function speedNeverExceedsCap() {
  const h = createHockeyModel()
  setHockeyCharge(h, 'paddle', -1)
  setHockeyCharge(h, 'puck', -1)
  let worst = 0
  for (let i = 0; i < 400; i++) {
    // 매 프레임 채를 퍽 위로 순간이동시켜 채 속도를 최대로 키운다(최악의 경우)
    movePaddle(h, h.puck.x, h.puck.y, 1 / 60)
    stepHockey(h, 1 / 60)
    worst = Math.max(worst, Math.hypot(h.puck.vx, h.puck.vy))
  }
  assert(worst <= MAX_SPEED + 0.001, `퍽의 속력이 상한을 넘지 않는다 (최고=${worst.toFixed(1)}, 상한=${MAX_SPEED})`)
})()

// 19) 초기화하면 처음 배치로 돌아온다
;(function hockeyReset() {
  const h = createHockeyModel()
  run(h, 2)
  resetHockey(h)
  eq(h.puck.vx, 0, '초기화하면 퍽이 멈춘다')
  eq(h.puck.x, FIELD.w * 0.7, '퍽이 처음 자리로 돌아온다')
})()

// 20) 한글 조사 — 안내 문구가 "빨대을"처럼 어색해지지 않아야 한다
;(function josa() {
  eq(objectParticle('빨대'), '를', '받침 없는 말 뒤에는 "를"')
  eq(objectParticle('유리막대'), '를', '유리막대 → "를"')
  eq(objectParticle('털가죽'), '을', '받침 있는 말 뒤에는 "을"')
  eq(objectParticle('비단'), '을', '비단 → "을"')
})()

export function runAll() {
  return results
}
