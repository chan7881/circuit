// model.js 검증. test.html에서 모듈로 로드되어 화면·콘솔에 PASS/FAIL을 출력한다.

import {
  CONDUCTOR,
  INSULATOR,
  CHARGE_PAIRS,
  FAR_GAP,
  TRACK,
  CAN_W,
  CONTACT_AMOUNT,
  SCOPE_PLATE_LEFT,
  createModel,
  setRodCharge,
  setRodTipX,
  setMaterial,
  setPreCharge,
  setMode,
  canLeft,
  canRight,
  gap,
  proximity,
  shiftedElectrons,
  nearSideCharge,
  farSideCharge,
  totalCharge,
  forceOnObject,
  stepCan,
  resetCan,
  foilSpread,
  foilTrend,
  electronDrift,
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

/** 막대를 캔 왼쪽 면에서 정확히 `g`만큼 떨어진 곳에 둔다 */
function placeRod(m, g) {
  setRodTipX(m, canLeft(m) - g)
  return m
}

/** n초 동안 물리를 돌린다(60fps 기준) */
function run(m, seconds) {
  const dt = 1 / 60
  for (let i = 0; i < Math.round(seconds / dt); i++) stepCan(m, dt)
  return m
}

// 1) 멀리 있으면 아무 일도 없다
;(function farAway() {
  const m = createModel()
  placeRod(m, FAR_GAP + 50)
  eq(proximity(m), 0, '아주 멀면 근접도 0')
  eq(shiftedElectrons(m), 0, '멀면 전자가 이동하지 않는다')
  eq(forceOnObject(m), NONE, '멀면 힘도 없다')
})()

// 2) 가까이 갈수록 더 많이 몰린다
;(function nearerMoreShift() {
  const m = createModel()
  placeRod(m, FAR_GAP * 0.75)
  const few = shiftedElectrons(m)
  placeRod(m, FAR_GAP * 0.1)
  const many = shiftedElectrons(m)
  assert(many > few, `가까울수록 더 많은 전자가 몰린다 (${few} → ${many})`)
  assert(many <= CHARGE_PAIRS, '전자 이동 수가 가진 것보다 많아지지 않는다')
})()

// 3) 유도만으로는 물체 전체 전하가 0이다 — 이 시뮬레이터의 핵심 사실
;(function inductionConservesCharge() {
  const m = createModel()
  placeRod(m, 10)
  eq(totalCharge(m), 0, '유도만으로는 물체 전체 전하가 0(전하가 새로 생기지 않는다)')
  eq(nearSideCharge(m) + farSideCharge(m), 0, '가까운 쪽과 먼 쪽 전하의 합은 0')
})()

// 4) 막대가 (+)든 (−)든 가까운 쪽은 항상 반대 전하 → 항상 끌린다
;(function alwaysOppositeAndAttract() {
  for (const rod of [1, -1]) {
    const m = createModel()
    setRodCharge(m, rod)
    placeRod(m, 20)
    assert(Math.sign(nearSideCharge(m)) === -rod, `막대가 ${rod > 0 ? '(+)' : '(−)'}일 때 가까운 쪽은 반대 전하`)
    eq(forceOnObject(m), ATTRACT, `막대가 ${rod > 0 ? '(+)' : '(−)'}여도 중성 도체는 끌린다`)
  }
})()

// 5) 전자가 움직이는 방향 — (−)막대는 밀어내고 (+)막대는 끌어온다
;(function driftDirection() {
  const m = createModel()
  setRodCharge(m, -1)
  eq(electronDrift(m), 1, '(−)막대면 전자가 먼 쪽으로 밀려난다')
  setRodCharge(m, 1)
  eq(electronDrift(m), -1, '(+)막대면 전자가 가까운 쪽으로 끌려온다')
})()

// 6) 부도체에서는 유도가 일어나지 않는다
;(function insulatorNoInduction() {
  const m = createModel()
  setMaterial(m, INSULATOR)
  placeRod(m, 5)
  eq(shiftedElectrons(m), 0, '부도체는 자유 전자가 없어 전하가 몰리지 않는다')
  eq(forceOnObject(m), NONE, '부도체에는 힘을 표시하지 않는다')
})()

// 7) 캔이 실제로 굴러온다 — 끌리면 막대 쪽으로 가까워져야 한다
;(function canRollsToward() {
  const m = createModel()
  setMaterial(m, CONDUCTOR)
  placeRod(m, 90)
  const before = gap(m)
  run(m, 1)
  assert(gap(m) < before, `중성 금속 캔은 대전체 쪽으로 굴러온다 (틈 ${before.toFixed(1)} → ${gap(m).toFixed(1)})`)
})()

// 8) 닿으면 접촉 대전 — 막대와 **같은** 전기를 띠고, 그 뒤로는 밀려난다
;(function contactChargingThenRepel() {
  const m = createModel()
  setRodCharge(m, -1)
  placeRod(m, 40)
  run(m, 4) // 끌려와서 닿을 때까지
  eq(Math.sign(m.contactCharge), -1, '(−)막대에 닿으면 캔도 (−)로 대전된다(같은 전기)')
  eq(Math.abs(m.contactCharge), CONTACT_AMOUNT, '옮겨온 전하량이 정해진 값만큼이다')
  assert(totalCharge(m) !== 0, '접촉 후에는 물체 전체 전하가 더 이상 0이 아니다')
  eq(forceOnObject(m), REPEL, '접촉해 같은 전기를 띠면 그때부터는 밀려난다')

  const afterTouch = gap(m)
  run(m, 1)
  assert(gap(m) > afterTouch, `밀려나서 멀어진다 (${afterTouch.toFixed(1)} → ${gap(m).toFixed(1)})`)
})()

// 9) 부도체는 닿아도 대전되지 않는다
;(function insulatorNoContactCharge() {
  const m = createModel()
  setMaterial(m, INSULATOR)
  setRodTipX(m, canLeft(m) + 5) // 억지로 겹치게
  run(m, 0.5)
  eq(m.contactCharge, 0, '부도체는 닿아도 전하가 옮겨오지 않는다')
})()

// 10) 캔은 실험대 밖으로 나가지 않는다 (양쪽 벽)
;(function walls() {
  // 오른쪽: 접촉 대전 후 계속 밀어붙인다
  const m = createModel()
  setRodCharge(m, -1)
  placeRod(m, 30)
  run(m, 12)
  assert(canRight(m) <= TRACK.right + 0.001, `오른쪽 벽을 넘지 않는다 (오른끝=${canRight(m).toFixed(1)}, 벽=${TRACK.right})`)

  // 왼쪽: 막대를 왼쪽 끝에 두고 끌어당긴다
  const m2 = createModel()
  setRodTipX(m2, 0)
  run(m2, 12)
  assert(canLeft(m2) >= TRACK.left - 0.001, `왼쪽 벽을 넘지 않는다 (왼끝=${canLeft(m2).toFixed(1)}, 벽=${TRACK.left})`)
})()

// 11) 캔이 막대를 뚫고 지나가지 않는다
;(function noTunneling() {
  const m = createModel()
  placeRod(m, 60)
  run(m, 10)
  assert(gap(m) >= -0.001, `캔이 막대 안으로 파고들지 않는다 (틈=${gap(m).toFixed(2)})`)
})()

// 12) 물리가 폭발하지 않는다
;(function stability() {
  for (const rod of [1, -1]) {
    for (const mat of [CONDUCTOR, INSULATOR]) {
      const m = createModel()
      setRodCharge(m, rod)
      setMaterial(m, mat)
      placeRod(m, 1)
      run(m, 15)
      assert(Number.isFinite(m.can.x) && Number.isFinite(m.can.v), `막대 ${rod}, ${mat} 조합에서 값이 발산하지 않는다`)
    }
  }
})()

// 13) 초기화하면 처음 상태로 돌아온다
;(function reset() {
  const m = createModel()
  placeRod(m, 20)
  run(m, 5)
  resetCan(m)
  eq(m.contactCharge, 0, '초기화하면 대전 상태가 사라진다')
  eq(m.can.v, 0, '초기화하면 캔이 멈춘다')
  eq(totalCharge(m), 0, '초기화하면 다시 중성')
})()

// ── 검전기 ────────────────────────────────────────────────────────────

// 14) 검전기 모드는 고정된 금속판 기준으로 거리를 잰다
;(function scopeGeometry() {
  const m = createModel()
  setMode(m, 'scope')
  setRodTipX(m, SCOPE_PLATE_LEFT - 100)
  eq(gap(m), 100, '검전기 모드의 틈은 금속판 기준이다')
  // 금속판을 뚫고 들어갈 수는 없다
  setRodTipX(m, SCOPE_PLATE_LEFT + 50)
  assert(gap(m) > 0, '막대가 금속판 안으로 들어가지 않는다')
})()

// 15) 중성 검전기 — 가까이 하면 금속박이 벌어진다
;(function neutralScopeOpens() {
  const m = createModel()
  setMode(m, 'scope')
  eq(foilTrend(m), 'flat', '멀리 있으면 금속박이 닫혀 있다')
  eq(foilSpread(m), 0, '벌어짐 0')
  setRodTipX(m, SCOPE_PLATE_LEFT - 10)
  eq(foilTrend(m), 'open', '가까이 하면 금속박이 벌어진다')
  assert(foilSpread(m) > 0.5, '가까이 할수록 많이 벌어진다')
})()

// 16) 이미 대전된 검전기 — 같은 극성이면 더 벌어지고 반대면 오므라든다 (JavaLab 검전기의 핵심)
;(function chargedScopeDiscriminates() {
  const same = createModel()
  setMode(same, 'scope')
  setPreCharge(same, -3)
  setRodCharge(same, -1)
  const baseline = foilSpread(same)
  setRodTipX(same, SCOPE_PLATE_LEFT - 10)
  assert(foilSpread(same) > baseline, `같은 극성을 가까이 하면 더 벌어진다 (${baseline.toFixed(2)} → ${foilSpread(same).toFixed(2)})`)
  eq(foilTrend(same), 'wider', '판정: 더 벌어짐')

  const opposite = createModel()
  setMode(opposite, 'scope')
  setPreCharge(opposite, -3)
  setRodCharge(opposite, 1)
  const base2 = foilSpread(opposite)
  setRodTipX(opposite, SCOPE_PLATE_LEFT - 10)
  assert(foilSpread(opposite) < base2, `반대 극성을 가까이 하면 오므라든다 (${base2.toFixed(2)} → ${foilSpread(opposite).toFixed(2)})`)
  eq(foilTrend(opposite), 'narrower', '판정: 오므라듦')
})()

// 17) 벌어짐 값은 항상 0~1 범위 안에 있다(그리기가 각도로 바로 쓴다)
;(function spreadRange() {
  for (const pre of [0, -3, 3, -6]) {
    for (const rod of [1, -1]) {
      const m = createModel()
      setMode(m, 'scope')
      setPreCharge(m, pre)
      setRodCharge(m, rod)
      setRodTipX(m, SCOPE_PLATE_LEFT - 1)
      const s = foilSpread(m)
      assert(s >= 0 && s <= 1, `벌어짐이 0~1 안에 있다 (미리대전 ${pre}, 막대 ${rod} → ${s.toFixed(2)})`)
    }
  }
})()

// 18) 모드를 바꾸면 앞 모드의 결과가 섞이지 않는다
;(function modeSwitchResets() {
  const m = createModel()
  setRodCharge(m, -1)
  placeRod(m, 30)
  run(m, 5)
  assert(m.contactCharge !== 0, '(사전 조건) 접촉으로 대전된 상태')
  setMode(m, 'scope')
  eq(m.contactCharge, 0, '모드를 바꾸면 대전 상태가 초기화된다')
  eq(m.material, CONDUCTOR, '검전기 모드는 항상 도체다')
  setMode(m, 'can')
  eq(m.preCharge, 0, '캔 모드로 돌아오면 검전기 사전 대전은 사라진다')
})()

// 19) 캔 크기·실험대 정의가 온전한지
;(function geometrySane() {
  assert(TRACK.right - TRACK.left > CAN_W * 2, '실험대가 캔이 굴러다닐 만큼 넓다')
  const m = createModel()
  eq(canRight(m) - canLeft(m), CAN_W, '캔의 폭이 정의와 일치한다')
})()

export function runAll() {
  return results
}
