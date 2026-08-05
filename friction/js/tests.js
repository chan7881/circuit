// model.js 검증. test.html에서 모듈로 로드되어 화면과 콘솔에 PASS/FAIL을 출력한다.

import {
  PAIRS,
  BASE_ELECTRONS,
  MAX_TRANSFER,
  createModel,
  rub,
  reset,
  setPair,
  electronCount,
  protonCount,
  netCharge,
  totalElectrons,
  forceBetween,
  createForceModel,
  setForceCharge,
  forceKind,
  euroParticle,
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
  for (let i = 0; i < MAX_TRANSFER + 3; i++) rub(m, 1)
  eq(totalElectrons(m), before, '문질러도 두 물체의 전자 수 합은 일정(전하량 보존)')
  eq(netCharge(m, 'a') + netCharge(m, 'b'), 0, '두 물체의 알짜 전하 합은 항상 0')
})()

// 3) 원자핵(양성자)은 절대 움직이지 않는다
;(function protonsNeverMove() {
  const m = createModel('straw')
  const before = protonCount()
  rub(m, 4)
  eq(protonCount(), before, '문질러도 양성자 수는 그대로(전자만 이동)')
})()

// 4) 교과서와 같은 결과 — 빨대·털가죽에서는 빨대가 (−), 털가죽이 (+)
;(function strawPairSigns() {
  const m = createModel('straw')
  rub(m, 3)
  assert(netCharge(m, 'a') < 0, '빨대는 전자를 얻어 (−)전기를 띤다')
  assert(netCharge(m, 'b') > 0, '털가죽은 전자를 잃어 (+)전기를 띤다')
  eq(electronCount(m, 'a'), BASE_ELECTRONS + 3, '빨대의 전자 수가 3 늘었다')
  eq(electronCount(m, 'b'), BASE_ELECTRONS - 3, '털가죽의 전자 수가 3 줄었다')
})()

// 5) 쌍을 바꾸면 부호가 반대가 된다 — "빨대는 항상 (−)"라는 오개념 방지
;(function glassPairSigns() {
  const m = createModel('glass')
  rub(m, 3)
  assert(netCharge(m, 'a') > 0, '유리막대는 전자를 잃어 (+)전기를 띤다')
  assert(netCharge(m, 'b') < 0, '비단은 전자를 얻어 (−)전기를 띤다')
})()

// 6) 최대치를 넘겨 문질러도 안전하고, 초기화하면 중성으로 돌아온다
;(function clampAndReset() {
  const m = createModel('straw')
  rub(m, 999)
  eq(m.transferred, MAX_TRANSFER, '최대 이동 개수를 넘지 않는다')
  assert(electronCount(m, 'b') >= 0, '전자 수가 음수가 되지 않는다')
  reset(m)
  eq(netCharge(m, 'a'), 0, '초기화하면 다시 중성')
})()

// 7) 쌍을 바꾸면 문지른 상태가 초기화된다(섞이지 않게)
;(function switchPairResets() {
  const m = createModel('straw')
  rub(m, 4)
  setPair(m, 'glass')
  eq(m.transferred, 0, '쌍을 바꾸면 처음부터 다시 문질러야 한다')
  eq(m.pairId, 'glass', '쌍이 바뀌었다')
})()

// 8) 전기력 판정 — 이번 소단원의 결론
;(function forceRules() {
  eq(forceBetween(1, 1), REPEL, '(+)와 (+)는 밀어낸다')
  eq(forceBetween(-1, -1), REPEL, '(−)와 (−)는 밀어낸다')
  eq(forceBetween(1, -1), ATTRACT, '(+)와 (−)는 끌어당긴다')
  eq(forceBetween(-1, 1), ATTRACT, '(−)와 (+)는 끌어당긴다')
  eq(forceBetween(0, 1), NONE, '한쪽이 중성이면 이 화면에서는 힘을 표시하지 않는다')
  // 전하량의 크기가 달라도 판정은 부호로만 정해진다
  eq(forceBetween(3, 1), REPEL, '크기가 달라도 같은 부호면 밀어낸다')
})()

// 9) 힘 관찰 모드 상태
;(function forceModeState() {
  const f = createForceModel()
  eq(forceKind(f), REPEL, '기본값((−),(−))은 밀어냄')
  setForceCharge(f, 'right', 1)
  eq(forceKind(f), ATTRACT, '한쪽을 (+)로 바꾸면 끌어당김')
  setForceCharge(f, 'left', 0)
  eq(forceKind(f), NONE, '한쪽을 중성으로 두면 힘 없음')
})()

// 10) 물체 쌍 정의가 온전한지
;(function pairsWellFormed() {
  assert(PAIRS.length >= 2, '물체 쌍이 2가지 이상이다')
  const ok = PAIRS.every((p) => (p.donor === 'a' || p.donor === 'b') && p.a?.name && p.b?.name)
  assert(ok, '모든 쌍에 donor와 이름이 제대로 정의되어 있다')
  const donors = new Set(PAIRS.map((p) => p.donor))
  assert(donors.size === 2, '전자를 주는 쪽이 서로 다른 쌍이 함께 있다(결과가 상대적임을 보이기 위해)')
})()

// 11) 한글 조사 — 안내 문구가 "빨대으로"처럼 어색해지지 않아야 한다
;(function josa() {
  eq(euroParticle('빨대'), '로', '받침 없는 말 뒤에는 "로"')
  eq(euroParticle('털가죽'), '으로', '받침 있는 말 뒤에는 "으로"')
  eq(euroParticle('유리막대'), '로', '유리막대 → "로"')
  eq(euroParticle('비단'), '으로', '비단 → "으로"')
  eq(euroParticle('코일'), '로', 'ㄹ 받침 뒤에는 "로"')
})()

export function runAll() {
  return results
}
