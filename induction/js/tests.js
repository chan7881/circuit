// model.js 검증. test.html에서 모듈로 로드되어 화면·콘솔에 PASS/FAIL을 출력한다.

import {
  CHARGE_PAIRS,
  ROD_FULL_CHARGES,
  FAR_GAP,
  TRACK,
  CAN_W,
  CONTACT_AMOUNT,
  SCOPE_PLATE_LEFT,
  createModel,
  ROD_PROTONS,
  rodElectrons,
  setRodCharge,
  setRodTipX,
  setPreCharge,
  rodStrength,
  setMode,
  canLeft,
  canRight,
  gap,
  proximity,
  shiftedElectrons,
  nearSideCharge,
  farSideCharge,
  objectCharge,
  forceOnObject,
  stepCan,
  stepScope,
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
  eq(objectCharge(m), 0, '유도만으로는 물체 전체 전하가 0(전하가 새로 생기지 않는다)')
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

// 6) **전하 보존** — 닿아서 옮겨갈 때 막대가 가진 전하도 그만큼 줄어든다.
//    전하는 새로 생기는 게 아니라 옮겨 다닐 뿐이다. 예전에는 막대 전하를 ±1 부호로만 들고
//    있어서 캔이 대전돼도 막대는 그대로였다 — 학생에게 "전하가 복사된다"고 가르치는 셈이었다.
;(function contactConservesCharge() {
  for (const rod of [1, -1]) {
    const m = createModel()
    setRodCharge(m, rod)
    const before = m.rodCharge + objectCharge(m)
    eq(Math.abs(m.rodCharge), ROD_FULL_CHARGES, `막대는 처음에 ${ROD_FULL_CHARGES}개를 가지고 있다`)

    placeRod(m, 40)
    run(m, 4) // 끌려와 닿을 때까지

    const after = m.rodCharge + objectCharge(m)
    eq(after, before, `막대 ${rod > 0 ? '(+)' : '(−)'}: 막대와 캔의 전하 합이 그대로다(전하 보존)`)
    assert(
      Math.abs(m.rodCharge) < ROD_FULL_CHARGES,
      `막대가 나눠준 만큼 줄어든다 (${ROD_FULL_CHARGES} → ${Math.abs(m.rodCharge)})`,
    )
    eq(Math.sign(m.rodCharge), rod, '막대의 전기 종류는 그대로다(약해질 뿐)')
    eq(Math.abs(m.rodCharge) + Math.abs(objectCharge(m)), ROD_FULL_CHARGES, '개수로 봐도 딱 맞는다')
  }
})()

// 6-1) **전자 개수로 세어도 보존된다** — 화면이 보여 주는 것과 같은 방식의 검증.
//      알짜 전하만 맞는 게 아니라, 양쪽에 그려지는 **전자 개수의 합**이 그대로여야
//      학생이 세어 보고 "전자가 옮겨갔을 뿐"이라고 확인할 수 있다.
;(function electronCountConserved() {
  for (const rod of [1, -1]) {
    const m = createModel()
    setRodCharge(m, rod)
    // 물체(캔)의 전자 수 = CHARGE_PAIRS − 알짜 전하
    const canElectrons = (mm) => CHARGE_PAIRS - mm.contactCharge
    const before = rodElectrons(m) + canElectrons(m)

    placeRod(m, 40)
    run(m, 4)

    eq(rodElectrons(m) + canElectrons(m), before, `막대 ${rod > 0 ? '(+)' : '(−)'}: 전자 개수의 합이 그대로다`)
    // 옮겨간 방향도 맞아야 한다: (−)막대는 전자를 내주고, (+)막대는 전자를 받아 온다
    if (rod < 0) {
      assert(rodElectrons(m) < before - canElectrons(m) + 1, '(−)막대는 전자를 내준다')
      assert(canElectrons(m) > CHARGE_PAIRS, '캔은 전자를 얻어 (−)를 띤다')
    } else {
      assert(canElectrons(m) < CHARGE_PAIRS, '캔은 전자를 잃어 (+)를 띤다')
      assert(rodElectrons(m) > ROD_PROTONS - ROD_FULL_CHARGES, '(+)막대는 전자를 받아 온다')
    }
  }
})()

// 6-2) 막대가 약해지면 유도도 약해진다 — 전하를 나눠준 결과가 다음 관찰에 이어진다
;(function weakerRodInducesLess() {
  const strong = createModel()
  placeRod(strong, 30)
  const before = shiftedElectrons(strong)

  const weak = createModel()
  weak.rodCharge = -CONTACT_AMOUNT // 이미 절반쯤 나눠준 막대
  placeRod(weak, 30)
  const after = shiftedElectrons(weak)

  assert(rodStrength(weak) < rodStrength(strong), '나눠준 막대는 세기가 약하다')
  assert(after < before, `약해진 막대는 전자를 덜 몰아낸다 (${before} → ${after})`)
})()

// 7) 캔이 실제로 굴러온다 — 끌리면 막대 쪽으로 가까워져야 한다
;(function canRollsToward() {
  const m = createModel()
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
  assert(objectCharge(m) !== 0, '접촉 후에는 물체 전체 전하가 더 이상 0이 아니다')
  eq(forceOnObject(m), REPEL, '접촉해 같은 전기를 띠면 그때부터는 밀려난다')

  const afterTouch = gap(m)
  run(m, 1)
  assert(gap(m) > afterTouch, `밀려나서 멀어진다 (${afterTouch.toFixed(1)} → ${gap(m).toFixed(1)})`)
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
    const m = createModel()
    setRodCharge(m, rod)
    placeRod(m, 1)
    run(m, 15)
    assert(Number.isFinite(m.can.x) && Number.isFinite(m.can.v), `막대 ${rod}에서 값이 발산하지 않는다`)
  }
})()

// 13) 초기화하면 처음 상태로 돌아온다 — **검전기까지 함께**
//     검전기는 한 번 대전되면 막대를 치워도 그대로 남으므로, 캔만 되돌리면 앞 실험 결과가
//     남아 다음 관찰을 망친다.
;(function reset() {
  const m = createModel()
  placeRod(m, 20)
  run(m, 5)
  resetCan(m)
  eq(m.contactCharge, 0, '초기화하면 대전 상태가 사라진다')
  eq(m.can.v, 0, '초기화하면 캔이 멈춘다')
  eq(objectCharge(m), 0, '초기화하면 다시 중성')

  // 검전기를 대전시켜 둔 뒤에도 초기화가 먹혀야 한다
  const s = createModel()
  setMode(s, 'scope')
  setRodTipX(s, SCOPE_PLATE_LEFT)
  stepScope(s)
  assert(s.preCharge !== 0, '(사전 조건) 검전기가 대전된 상태')
  resetCan(s)
  eq(s.preCharge, 0, '초기화하면 검전기 대전도 사라진다')
  eq(Math.abs(s.rodCharge), ROD_FULL_CHARGES, '초기화하면 막대도 가득 찬 상태로 돌아온다')
})()

// ── 검전기 ────────────────────────────────────────────────────────────

// 14) 검전기 모드는 고정된 금속판 기준으로 거리를 잰다
;(function scopeGeometry() {
  const m = createModel()
  setMode(m, 'scope')
  setRodTipX(m, SCOPE_PLATE_LEFT - 100)
  eq(gap(m), 100, '검전기 모드의 틈은 금속판 기준이다')
  // 금속판에 **닿게는** 할 수 있어야 한다(접촉 대전을 보여줘야 하므로). 다만 뚫고 들어가진 않는다.
  setRodTipX(m, SCOPE_PLATE_LEFT + 50)
  eq(gap(m), 0, '막대를 금속판에 닿는 데까지 가져갈 수 있다(더 밀어도 판을 뚫진 않는다)')
})()

// 14-2) 금속판에 닿으면 검전기가 접촉으로 대전되고, 막대를 치워도 벌어진 채 남는다
//       — 유도(치우면 닫힘)와 접촉 대전(치워도 벌어짐)을 가르는 결정적 장면이다
;(function scopeContactCharging() {
  const m = createModel()
  setMode(m, 'scope')
  setRodCharge(m, -1)

  setRodTipX(m, SCOPE_PLATE_LEFT - 100)
  eq(stepScope(m), false, '떨어져 있으면 접촉이 일어나지 않는다')
  eq(m.preCharge, 0, '아직 중성')

  setRodTipX(m, SCOPE_PLATE_LEFT)
  eq(stepScope(m), true, '닿는 순간 접촉 대전이 일어난다')
  eq(Math.sign(m.preCharge), -1, '(−)막대에 닿으면 검전기도 (−)로 대전된다(같은 전기)')
  eq(stepScope(m), false, '이미 대전된 뒤에는 다시 일어나지 않는다')

  // 막대를 멀리 치워도 금속박은 벌어진 채로 남는다
  setRodTipX(m, 44)
  eq(shiftedElectrons(m), 0, '막대를 치우면 유도는 사라진다')
  assert(foilSpread(m) > 0, `그래도 금속박은 벌어진 채 남는다 (벌어짐=${foilSpread(m).toFixed(2)})`)
})()

// 14-3) 검전기도 전하 보존이 지켜진다 — 검전기가 얻은 만큼 막대가 잃는다
;(function scopeConservesCharge() {
  for (const rod of [1, -1]) {
    const m = createModel()
    setMode(m, 'scope')
    setRodCharge(m, rod)
    const before = m.rodCharge + m.preCharge

    setRodTipX(m, SCOPE_PLATE_LEFT)
    eq(stepScope(m), true, `막대 ${rod > 0 ? '(+)' : '(−)'}: 닿으면 접촉 대전이 일어난다`)

    eq(m.rodCharge + m.preCharge, before, '막대와 검전기의 전하 합이 그대로다(전하 보존)')
    assert(
      Math.abs(m.rodCharge) < ROD_FULL_CHARGES,
      `막대가 나눠준 만큼 줄어든다 (${ROD_FULL_CHARGES} → ${Math.abs(m.rodCharge)})`,
    )
    eq(Math.sign(m.preCharge), rod, '검전기는 막대와 같은 전기를 띤다')
  }
})()

// 14-4) **같은 극성으로 다가가는 동안 금속박이 도로 오므라들지 않는다** (단조성 검증)
//
// 예전 검증은 "멀 때 닫힘 / 가까울 때 열림" 두 지점만 봤다. 그 사이에서 잠깐 줄어드는 것은
// 통과해 버려서, 닿는 순간 1.00 → 0.90으로 툭 줄던 것을 놓쳤다. 화면에서는 "가까이 갔더니
// 닫힌다"로 보이는데, 이건 정확히 반대되는 결론을 가르치는 셈이다.
;(function foilNeverClosesWhileApproaching() {
  for (const rod of [1, -1]) {
    const m = createModel()
    setMode(m, 'scope')
    setRodCharge(m, rod)

    let prev = -1
    let worst = null
    // 아주 멀리서 닿을 때까지 촘촘히 좁혀 간다(접촉이 일어나는 순간까지 포함)
    for (let gap = 260; gap >= 0; gap -= 4) {
      setRodTipX(m, SCOPE_PLATE_LEFT - gap)
      stepScope(m) // main.js가 매 프레임 부르는 것과 같게
      const s = foilSpread(m)
      if (s < prev - 1e-9 && worst === null) worst = `틈 ${gap}에서 ${prev.toFixed(3)} → ${s.toFixed(3)}`
      prev = s
    }
    assert(
      worst === null,
      `막대 ${rod > 0 ? '(+)' : '(−)'}: 다가가는 동안 금속박이 한 번도 줄어들지 않는다${worst ? ` (${worst})` : ''}`,
    )
    assert(prev > 0.9, `끝까지 가면 금속박이 크게 벌어져 있다 (${prev.toFixed(2)})`)
  }
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
  eq(Math.abs(m.rodCharge), ROD_FULL_CHARGES, '모드를 바꾸면 막대도 가득 찬 상태로 돌아온다')
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
