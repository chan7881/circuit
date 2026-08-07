// model.js 검증. test.html에서 모듈로 로드되어 화면·콘솔에 PASS/FAIL을 출력한다.

import {
  MAX_CURRENT,
  EARTH_FIELD,
  EARTH_MAGNITUDE,
  createModel,
  setMode,
  setOn,
  setDirection,
  setCurrent,
  currentLevel,
  coilFieldAt,
  wireFieldAt,
  localFieldAt,
  needleFieldAt,
  needleAngle,
  localOverEarthRatio,
  compassPositions,
  COIL_COMPASS_POSITIONS,
  WIRE_COMPASS_POSITIONS,
} from './model.js'

const results = []
function assert(cond, label) {
  results.push({ ok: !!cond, label })
}
function eq(actual, expected, label) {
  results.push({ ok: actual === expected, label: `${label} (실제=${actual}, 기대=${expected})` })
}
function close(actual, expected, label, tol = 1e-6) {
  results.push({ ok: Math.abs(actual - expected) <= tol, label: `${label} (실제=${actual}, 기대=${expected})` })
}
function vecClose(a, b, label, tol = 1e-6) {
  assert(Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol, `${label} (실제=(${a.x.toFixed(3)},${a.y.toFixed(3)}), 기대=(${b.x.toFixed(3)},${b.y.toFixed(3)}))`)
}

// 1) 스위치를 끄면 전류 세기와 무관하게 자기장이 없다
;(function switchOff() {
  const m = createModel()
  setCurrent(m, MAX_CURRENT)
  setOn(m, false)
  eq(currentLevel(m), 0, '꺼져 있으면 전류 세기가 0')
  vecClose(coilFieldAt(m, { x: 100, y: 0 }), { x: 0, y: 0 }, '꺼져 있으면 코일도 자기장이 없다')
  vecClose(wireFieldAt(m, { x: 100, y: 0 }), { x: 0, y: 0 }, '꺼져 있으면 도선도 자기장이 없다')
})()

// 2) 전류가 셀수록 자기장도 세진다
;(function strongerCurrentStrongerField() {
  const m = createModel()
  setMode(m, 'coil')
  let prev = -1
  for (let c = 0; c <= MAX_CURRENT; c++) {
    setCurrent(m, c)
    const mag = Math.hypot(...Object.values(coilFieldAt(m, { x: 120, y: 0 })))
    assert(mag >= prev, `전류 ${c}단계에서 코일 자기장 세기가 줄지 않는다 (${prev.toFixed(4)} → ${mag.toFixed(4)})`)
    prev = mag
  }
})()

// 3) 전류 방향을 뒤집으면 자기장도 정확히 반대가 된다
;(function directionFlipsField() {
  const m = createModel()
  setCurrent(m, 3)
  for (const mode of ['coil', 'wire']) {
    setMode(m, mode)
    const p = { x: 90, y: 40 }
    setDirection(m, 1)
    const plus = localFieldAt(m, p)
    setDirection(m, -1)
    const minus = localFieldAt(m, p)
    vecClose({ x: plus.x + minus.x, y: plus.y + minus.y }, { x: 0, y: 0 }, `${mode}: 방향을 뒤집으면 자기장이 정확히 반대가 된다`)
  }
})()

// 4) 코일 축 위(양 끝 바깥)에서는 자기장이 축 방향을 향한다 — 자석의 극에서 field가 축과 나란한 것과 같다
;(function coilAxisFieldAlongAxis() {
  const m = createModel()
  setMode(m, 'coil')
  setDirection(m, 1)
  setCurrent(m, MAX_CURRENT)
  const f = coilFieldAt(m, { x: 150, y: 0 })
  assert(Math.abs(f.y) < 1e-9, '축 위(y=0)에서는 y성분이 0이다')
  assert(f.x !== 0, '축 위에서 자기장이 실제로 존재한다')
})()

// 5) 직선 도선 — 자기장은 도선까지의 거리에 반비례하고, 방향은 도선을 감싼다(접선 방향)
;(function wireFieldIsTangentialAndFallsOff() {
  const m = createModel()
  setMode(m, 'wire')
  setDirection(m, 1)
  setCurrent(m, MAX_CURRENT)

  const near = { x: 60, y: 0 }
  const far = { x: 240, y: 0 }
  const fNear = wireFieldAt(m, near)
  const fFar = wireFieldAt(m, far)
  const magNear = Math.hypot(fNear.x, fNear.y)
  const magFar = Math.hypot(fFar.x, fFar.y)
  assert(magNear > magFar, `가까울수록 세다 (거리60=${magNear.toFixed(3)}, 거리240=${magFar.toFixed(3)})`)
  close(magNear / magFar, 240 / 60, '세기는 거리에 정확히 반비례한다(1/r)', 1e-3)

  // 반지름 방향(x축 위의 점이면 반지름은 x방향)과 자기장은 수직이어야 한다(접선 방향)
  const dot = (near.x / 60) * fNear.x + (near.y / 60) * fNear.y
  close(dot, 0, '자기장은 도선에서 뻗어나가는 방향과 수직이다(접선 방향)', 1e-6)
})()

// 5-1) **직선 도선의 회전 방향이 오른손 법칙과 맞는가** (손잡이 검증)
//
// 예전 검증은 "자기장이 반지름 방향과 수직인가"까지만 봤다. 수직이기만 하면 시계 방향이든
// 반시계 방향이든 통과해 버려서, 나침반이 실제와 180° 반대를 가리키는 걸 놓쳤다.
// 여기서는 방향까지 못 박는다: B ∝ Î × r̂.
//
// 화면에서 direction=+1이면 전류는 위(장면 +y)로 흐르게 그려지고, 모델 좌표 {x,y}는 장면의
// {x,z}에 대응한다. 따라서 Î=(0,1,0), r̂=(p.x,0,p.y)/|p| 로 두고 외적을 구하면
//   Î × r̂ = (p.y, 0, −p.x)/|p|  →  모델 좌표에서 (p.y, −p.x)/|p|
;(function wireFieldFollowsRightHandRule() {
  const m = createModel()
  setMode(m, 'wire')
  setCurrent(m, MAX_CURRENT)

  for (const dir of [1, -1]) {
    setDirection(m, dir)
    for (const p of WIRE_COMPASS_POSITIONS) {
      const len = Math.hypot(p.x, p.y)
      // 전류 방향이 반대면 자기장도 반대로 돈다
      const ex = (dir * p.y) / len
      const ey = (dir * -p.x) / len
      const f = wireFieldAt(m, p)
      const flen = Math.hypot(f.x, f.y)
      const dot = (f.x / flen) * ex + (f.y / flen) * ey
      close(dot, 1, `전류방향 ${dir}, 위치 (${p.x.toFixed(0)},${p.y.toFixed(0)}): 자기장이 오른손 법칙 방향과 일치`, 1e-9)
    }
  }
})()

// 5-2) 코일도 같은 검증 — 그려진 전류 순환과 자기장 방향이 오른손 법칙으로 맞아야 한다.
//
// render.js는 direction=+1일 때 고리 앞쪽 위(45°)에서 전류가 (0,−1,+1) 방향으로 흐르도록
// 그린다. 그 순환(+y에서 +z 쪽으로 도는 것)의 자기 모멘트는 오른손 법칙으로 +x이므로,
// 코일 속과 축 위에서 자기장도 +x를 향해야 한다.
;(function coilFieldFollowsRightHandRule() {
  const m = createModel()
  setMode(m, 'coil')
  setCurrent(m, MAX_CURRENT)

  setDirection(m, 1)
  assert(coilFieldAt(m, { x: 0, y: 0 }).x > 0, '전류방향 +1: 코일 속 자기장이 +x(자기 모멘트 쪽)를 향한다')
  assert(coilFieldAt(m, { x: 150, y: 0 }).x > 0, '전류방향 +1: 코일 축 바깥에서도 +x를 향한다')

  setDirection(m, -1)
  assert(coilFieldAt(m, { x: 0, y: 0 }).x < 0, '전류방향 −1: 코일 속 자기장이 반대(−x)를 향한다')
  assert(coilFieldAt(m, { x: 150, y: 0 }).x < 0, '전류방향 −1: 코일 축 바깥에서도 −x를 향한다')
})()

// 6) **이 시뮬레이터의 핵심** — 나침반은 지구 자기장과 코일(도선) 자기장의 합을 가리킨다.
;(function needleIsVectorSum() {
  const m = createModel()
  setMode(m, 'coil')
  setDirection(m, 1)
  setCurrent(m, 2)
  const p = { x: 90, y: 60 }
  const local = coilFieldAt(m, p)
  const expected = { x: EARTH_FIELD.x * EARTH_MAGNITUDE + local.x, y: EARTH_FIELD.y * EARTH_MAGNITUDE + local.y }
  vecClose(needleFieldAt(m, p), expected, '나침반이 느끼는 자기장 = 지구 자기장 + 코일 자기장')
  close(needleAngle(m, p), Math.atan2(expected.y, expected.x), '바늘 각도는 그 합벡터의 방향이다')
})()

// 7) 전류가 아주 약하면(또는 꺼지면) 나침반은 전부 지구 자기장 방향을 가리킨다
;(function weakCurrentPointsToEarth() {
  const m = createModel()
  setOn(m, false)
  const earthAngle = Math.atan2(EARTH_FIELD.y, EARTH_FIELD.x)
  for (const mode of ['coil', 'wire']) {
    setMode(m, mode)
    for (const p of compassPositions(m)) {
      close(needleAngle(m, p), earthAngle, `${mode} 모드, 꺼져 있으면 위치 (${p.x},${p.y})의 바늘도 지구 자기장 방향`)
    }
  }
})()

// 8) 전류가 아주 세면 코일(도선)에 가까운 나침반일수록 지구 자기장의 영향이 작아진다
;(function strongCurrentDominatesNearby() {
  const m = createModel()
  setMode(m, 'coil')
  setCurrent(m, MAX_CURRENT)
  const near = { x: -85, y: -78 } // 코일 바로 옆
  const far = { x: 0, y: 500 } // 아주 멀리
  const ratioNear = localOverEarthRatio(m, near)
  const ratioFar = localOverEarthRatio(m, far)
  assert(ratioNear > 3, `코일 가까이서는 코일 자기장이 지구 자기장을 압도한다 (비율=${ratioNear.toFixed(2)})`)
  assert(ratioFar < 0.1, `아주 멀리서는 지구 자기장이 압도적이다 (비율=${ratioFar.toFixed(3)})`)
})()

// 9) 나침반 배치 — 모드마다 정의돼 있고, 원점(코일·도선 자체)과 안 겹친다
;(function compassPositionsWellFormed() {
  for (const [name, list] of [['coil', COIL_COMPASS_POSITIONS], ['wire', WIRE_COMPASS_POSITIONS]]) {
    assert(list.length === 8, `${name} 모드에 나침반이 8개 있다`)
    assert(
      list.every((p) => Math.hypot(p.x, p.y) > 20),
      `${name} 모드의 나침반이 중심에서 충분히 떨어져 있다`,
    )
  }
  const m = createModel()
  setMode(m, 'wire')
  eq(compassPositions(m), WIRE_COMPASS_POSITIONS, 'compassPositions가 모드에 맞는 배치를 돌려준다')
})()

// 10) 값 범위 제한
;(function clamping() {
  const m = createModel()
  setCurrent(m, 999)
  eq(m.current, MAX_CURRENT, '전류 세기는 최댓값을 넘지 않는다')
  setCurrent(m, -5)
  eq(m.current, 0, '전류 세기는 0 아래로 내려가지 않는다')
  setDirection(m, 0)
  eq(m.direction, 1, '방향은 0이 오면 +1로 취급한다')
  setMode(m, '이상한값')
  eq(m.mode, 'coil', '모르는 모드는 코일로 되돌아간다')
})()

// 11) 자기장 벡터는 항상 유한하다 — 코일·도선 바로 위에 나침반이 겹쳐도 발산하지 않는다
;(function neverDiverges() {
  const m = createModel()
  setCurrent(m, MAX_CURRENT)
  for (const mode of ['coil', 'wire']) {
    setMode(m, mode)
    for (const p of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]) {
      const f = localFieldAt(m, p)
      assert(Number.isFinite(f.x) && Number.isFinite(f.y), `${mode} 모드, 원점 근처(${p.x},${p.y})에서도 값이 유한하다`)
    }
  }
})()

export function runAll() {
  return results
}
