// model.js 검증. test.html에서 모듈로 로드되어 화면·콘솔에 PASS/FAIL을 출력한다.

import {
  CONDUCTOR,
  INSULATOR,
  CHARGE_PAIRS,
  createModel,
  setRodCharge,
  setProximity,
  setMaterial,
  setPreCharge,
  shiftedElectrons,
  nearSideCharge,
  farSideCharge,
  totalCharge,
  forceOnObject,
  foilSpread,
  foilTrend,
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

function near(rodCharge, material = CONDUCTOR) {
  const m = createModel()
  setMaterial(m, material)
  setRodCharge(m, rodCharge)
  setProximity(m, 1)
  return m
}

// 1) 멀리 있으면 아무 일도 없다
;(function farAway() {
  const m = createModel()
  setProximity(m, 0)
  eq(shiftedElectrons(m), 0, '막대가 멀면 전자가 몰리지 않는다')
  eq(nearSideCharge(m), 0, '막대가 멀면 가까운 쪽도 중성')
  eq(forceOnObject(m), NONE, '막대가 멀면 힘이 없다')
})()

// 2) (−)막대 — 전자가 밀려나 가까운 쪽이 (+)가 된다 (교과서 그림 VII-3)
;(function minusRod() {
  const m = near(-1)
  assert(shiftedElectrons(m) > 0, '(−)막대를 가까이 하면 전자가 이동한다')
  assert(nearSideCharge(m) > 0, '(−)막대: 가까운 쪽은 (+)전기')
  assert(farSideCharge(m) < 0, '(−)막대: 먼 쪽은 (−)전기')
})()

// 3) (+)막대 — 부호가 정확히 반대가 된다
;(function plusRod() {
  const m = near(1)
  assert(nearSideCharge(m) < 0, '(+)막대: 가까운 쪽은 (−)전기')
  assert(farSideCharge(m) > 0, '(+)막대: 먼 쪽은 (+)전기')
})()

// 4) 전하량 보존 — 유도만으로는 물체 전체 전하가 절대 변하지 않는다
;(function conservation() {
  for (const rod of [-1, 1]) {
    const m = near(rod)
    eq(totalCharge(m), 0, `(${rod > 0 ? '+' : '−'})막대: 물체 전체의 알짜 전하는 0`)
    eq(nearSideCharge(m) + farSideCharge(m), 0, `(${rod > 0 ? '+' : '−'})막대: 양 끝 전하의 합은 0`)
  }
})()

// 5) 막대 극성과 무관하게 **항상 끌린다** — 이 단원에서 가장 놓치기 쉬운 결론
;(function alwaysAttract() {
  eq(forceOnObject(near(-1)), ATTRACT, '(−)막대 → 중성 금속은 끌려온다')
  eq(forceOnObject(near(1)), ATTRACT, '(+)막대 → 중성 금속도 끌려온다')
})()

// 6) 도체에서만 유도가 일어난다 (JavaLab 도체·부도체 시뮬의 대비)
;(function conductorOnly() {
  const metal = near(-1, CONDUCTOR)
  const plastic = near(-1, INSULATOR)
  assert(shiftedElectrons(metal) > 0, '금속(도체)에서는 자유 전자가 이동한다')
  eq(shiftedElectrons(plastic), 0, '플라스틱(부도체)에서는 전자가 이동하지 않는다')
  eq(nearSideCharge(plastic), 0, '부도체는 양 끝에 전하가 몰리지 않는다')
  eq(forceOnObject(plastic), NONE, '부도체는 이 화면에서 힘을 표시하지 않는다')
})()

// 7) 가까울수록 더 많이 몰린다
;(function proximityMatters() {
  const m = createModel()
  setRodCharge(m, -1)
  setProximity(m, 0.5)
  const half = shiftedElectrons(m)
  setProximity(m, 1)
  const full = shiftedElectrons(m)
  assert(full > half, '가까이 갈수록 몰리는 전자가 많아진다')
  assert(full <= CHARGE_PAIRS, '몰리는 전자가 전체 개수를 넘지 않는다')
})()

// 8) 검전기 — 중성 상태에서는 막대 극성과 무관하게 벌어진다
;(function electroscopeNeutral() {
  for (const rod of [-1, 1]) {
    const m = near(rod)
    assert(foilSpread(m) > 0, `(${rod > 0 ? '+' : '−'})막대: 중성 검전기의 금속박이 벌어진다`)
    eq(foilTrend(m), 'open', `(${rod > 0 ? '+' : '−'})막대: 중성 검전기는 '벌어짐'`)
  }
})()

// 9) 검전기 극성 판별 — 같은 극성이면 더 벌어지고, 반대면 오므라든다
;(function electroscopePolarity() {
  const chargedMinus = () => {
    const m = createModel()
    setPreCharge(m, -3) // (−)로 대전시켜 둔 검전기
    setProximity(m, 1)
    return m
  }

  const same = chargedMinus()
  setRodCharge(same, -1)
  const opposite = chargedMinus()
  setRodCharge(opposite, 1)

  const baseline = Math.min(1, 3 / CHARGE_PAIRS)
  assert(foilSpread(same) > baseline, '(−)검전기에 (−)막대 → 더 벌어진다')
  assert(foilSpread(opposite) < baseline, '(−)검전기에 (+)막대 → 오므라든다')
  eq(foilTrend(same), 'wider', '같은 극성이면 판정은 "더 벌어짐"')
  eq(foilTrend(opposite), 'narrower', '반대 극성이면 판정은 "오므라듦"')
  assert(foilSpread(opposite) >= 0, '오므라들어도 음수가 되지 않는다')
})()

// 10) 대전된 검전기와 막대 사이의 힘은 알짜 전하끼리로 정해진다
;(function chargedObjectForce() {
  const m = createModel()
  setPreCharge(m, -3)
  setProximity(m, 1)
  setRodCharge(m, -1)
  eq(forceOnObject(m), REPEL, '(−)로 대전된 물체와 (−)막대는 밀어낸다')
  setRodCharge(m, 1)
  eq(forceOnObject(m), ATTRACT, '(−)로 대전된 물체와 (+)막대는 끌어당긴다')
})()

export function runAll() {
  return results
}
