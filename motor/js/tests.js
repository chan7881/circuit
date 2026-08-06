// model.js 검증. test.html에서 모듈로 로드되어 화면·콘솔에 PASS/FAIL을 출력한다.

import {
  MAX_CURRENT,
  SWING_MAX_ANGLE,
  createModel,
  setMode,
  setOn,
  setDirection,
  setMagnetPolarity,
  setCurrent,
  currentLevel,
  forceSign,
  forceMagnitude,
  stepSwing,
  resetSwing,
  stepMotor,
  resetMotor,
  commutatorPhase,
  step,
} from './model.js'

const results = []
function assert(cond, label) {
  results.push({ ok: !!cond, label })
}
function eq(actual, expected, label) {
  results.push({ ok: actual === expected, label: `${label} (실제=${actual}, 기대=${expected})` })
}

function runFor(model, seconds, dt, stepFn) {
  for (let t = 0; t < seconds; t += dt) stepFn(model, dt)
}

// 1) 스위치가 꺼져 있거나 전류가 0이면 힘이 없다
;(function noForceWhenOff() {
  const m = createModel()
  setCurrent(m, MAX_CURRENT)
  setOn(m, false)
  eq(forceSign(m), 0, '꺼져 있으면 힘의 부호가 0')
  eq(forceMagnitude(m), 0, '꺼져 있으면 힘의 세기가 0')
  setOn(m, true)
  setCurrent(m, 0)
  eq(forceSign(m), 0, '전류가 0이면 힘의 부호도 0')
})()

// 2) 이 시뮬레이터의 핵심 규칙 — 전류만 반대면 반대, 자석만 반대면 반대, 둘 다 반대면 그대로
;(function forceSignRule() {
  const m = createModel()
  setCurrent(m, 2)
  setDirection(m, 1)
  setMagnetPolarity(m, 1)
  const base = forceSign(m)
  assert(base !== 0, '기본 상태에서 힘이 존재한다')

  setDirection(m, -1)
  setMagnetPolarity(m, 1)
  eq(forceSign(m), -base, '전류만 반대로 하면 힘의 방향이 반대가 된다')

  setDirection(m, 1)
  setMagnetPolarity(m, -1)
  eq(forceSign(m), -base, '자석 극만 반대로 하면 힘의 방향이 반대가 된다')

  setDirection(m, -1)
  setMagnetPolarity(m, -1)
  eq(forceSign(m), base, '전류와 자석을 둘 다 반대로 하면 힘의 방향은 원래와 같다')
})()

// 3) 전류가 셀수록 힘도 세진다
;(function strongerCurrentStrongerForce() {
  const m = createModel()
  let prev = -1
  for (let c = 0; c <= MAX_CURRENT; c++) {
    setCurrent(m, c)
    const mag = forceMagnitude(m)
    assert(mag >= prev, `전류 ${c}단계에서 힘의 세기가 줄지 않는다 (${prev} → ${mag})`)
    prev = mag
  }
})()

// 4) 그네 — 힘을 받으면 그 방향으로 흔들리다가 안정된 각도에 자리잡는다
;(function swingSettlesTowardForceDirection() {
  const m = createModel()
  setMode(m, 'swing')
  setDirection(m, 1)
  setMagnetPolarity(m, 1)
  setCurrent(m, MAX_CURRENT)
  runFor(m, 6, 1 / 60, stepSwing)
  assert(m.swingAngle > 0.05, `힘 방향으로 그네가 기운다 (각도=${m.swingAngle.toFixed(3)})`)
  assert(Math.abs(m.swingVelocity) < 0.05, `충분한 시간 후 그네가 안정된다 (각속도=${m.swingVelocity.toFixed(3)})`)
})()

// 5) 그네 — 방향을 반대로 하면 반대쪽으로 흔들린다
;(function swingReversesWithDirection() {
  const m = createModel()
  setMode(m, 'swing')
  setDirection(m, -1)
  setMagnetPolarity(m, 1)
  setCurrent(m, MAX_CURRENT)
  runFor(m, 6, 1 / 60, stepSwing)
  assert(m.swingAngle < -0.05, `전류 방향을 반대로 하면 그네도 반대쪽으로 기운다 (각도=${m.swingAngle.toFixed(3)})`)
})()

// 6) 그네 — 힘을 없애면(스위치 끔) 원래 자리로 돌아온다
;(function swingRelaxesWhenOff() {
  const m = createModel()
  setMode(m, 'swing')
  setCurrent(m, MAX_CURRENT)
  runFor(m, 6, 1 / 60, stepSwing)
  assert(Math.abs(m.swingAngle) > 0.05, '힘을 받는 동안 그네가 기울어 있다')
  setOn(m, false)
  runFor(m, 6, 1 / 60, stepSwing)
  assert(Math.abs(m.swingAngle) < 0.05, `스위치를 끄면 그네가 다시 제자리로 돌아온다 (각도=${m.swingAngle.toFixed(3)})`)
})()

// 7) 그네 — 각도가 한계를 넘지 않는다
;(function swingClamped() {
  const m = createModel()
  setMode(m, 'swing')
  setCurrent(m, MAX_CURRENT)
  runFor(m, 20, 1 / 60, stepSwing)
  assert(Math.abs(m.swingAngle) <= SWING_MAX_ANGLE + 1e-9, `그네 각도가 한계(${SWING_MAX_ANGLE})를 넘지 않는다 (실제=${m.swingAngle.toFixed(3)})`)
})()

// 8) 전동기 — 힘을 받으면 그 방향으로 계속 회전 속도가 붙는다(정류자 덕분에 방향이 유지됨)
;(function motorSpinsUpInForceDirection() {
  const m = createModel()
  setMode(m, 'motor')
  setDirection(m, 1)
  setMagnetPolarity(m, 1)
  setCurrent(m, MAX_CURRENT)
  runFor(m, 3, 1 / 60, stepMotor)
  assert(m.motorSpeed > 1, `전동기가 힘 방향으로 회전 속도가 붙는다 (각속도=${m.motorSpeed.toFixed(2)})`)
  // 여러 바퀴를 돌아도(=여러 정류자 전환을 거쳐도) 속도 부호가 바뀌지 않는다
  const speedAfterFirstRun = m.motorSpeed
  runFor(m, 3, 1 / 60, stepMotor)
  assert(m.motorSpeed > 0, `정류자가 전환된 뒤에도 회전 방향이 유지된다 (각속도=${m.motorSpeed.toFixed(2)})`)
  assert(m.motorSpeed >= speedAfterFirstRun - 1e-6, '시간이 더 지나면 목표 속도에 더 가까워진다')
})()

// 9) 전동기 — 방향을 반대로 하면 반대로 돈다
;(function motorReversesWithDirection() {
  const m = createModel()
  setMode(m, 'motor')
  setDirection(m, -1)
  setMagnetPolarity(m, 1)
  setCurrent(m, MAX_CURRENT)
  runFor(m, 3, 1 / 60, stepMotor)
  assert(m.motorSpeed < -1, `전류 방향을 반대로 하면 전동기도 반대로 돈다 (각속도=${m.motorSpeed.toFixed(2)})`)
})()

// 10) 전동기 — 자석과 전류를 둘 다 반대로 하면 회전 방향이 같다
;(function motorSameWhenBothFlip() {
  const base = createModel()
  setMode(base, 'motor')
  setCurrent(base, MAX_CURRENT)
  runFor(base, 3, 1 / 60, stepMotor)

  const both = createModel()
  setMode(both, 'motor')
  setDirection(both, -1)
  setMagnetPolarity(both, -1)
  setCurrent(both, MAX_CURRENT)
  runFor(both, 3, 1 / 60, stepMotor)

  assert(Math.sign(base.motorSpeed) === Math.sign(both.motorSpeed), '전류·자석을 둘 다 반대로 하면 회전 방향은 원래와 같다')
})()

// 11) 전동기 — 스위치를 끄면 서서히 멈춘다
;(function motorSlowsWhenOff() {
  const m = createModel()
  setMode(m, 'motor')
  setCurrent(m, MAX_CURRENT)
  runFor(m, 3, 1 / 60, stepMotor)
  assert(Math.abs(m.motorSpeed) > 1, '회전 중이다')
  setOn(m, false)
  runFor(m, 3, 1 / 60, stepMotor)
  assert(Math.abs(m.motorSpeed) < 0.1, `스위치를 끄면 전동기가 멈춘다 (각속도=${m.motorSpeed.toFixed(3)})`)
})()

// 12) 전동기 — 회전각은 항상 0~2π 범위로 정규화된다
;(function motorAngleNormalized() {
  const m = createModel()
  setMode(m, 'motor')
  setCurrent(m, MAX_CURRENT)
  for (let i = 0; i < 600; i++) {
    stepMotor(m, 1 / 30)
    assert(m.motorAngle >= 0 && m.motorAngle < Math.PI * 2, `회전각이 0~2π 범위 안에 있다(step ${i}, 실제=${m.motorAngle.toFixed(3)})`)
  }
})()

// 13) 정류자 위상 — 반 바퀴(π)마다 정확히 뒤집힌다
;(function commutatorFlipsEveryHalfTurn() {
  const m = createModel()
  eq(commutatorPhase(m), 1, '회전각 0에서는 위상 +1')
  m.motorAngle = Math.PI * 0.999
  eq(commutatorPhase(m), 1, 'π 직전까지는 위상 +1')
  m.motorAngle = Math.PI * 1.001
  eq(commutatorPhase(m), -1, 'π를 넘으면 위상 −1로 뒤집힌다')
  m.motorAngle = Math.PI * 1.999
  eq(commutatorPhase(m), -1, '2π 직전까지는 위상 −1')
})()

// 14) step()이 모드에 맞는 물리를 호출한다
;(function stepDispatchesByMode() {
  const swingM = createModel()
  setMode(swingM, 'swing')
  setCurrent(swingM, MAX_CURRENT)
  step(swingM, 1 / 60)
  assert(swingM.swingVelocity !== 0, 'swing 모드에서는 step()이 그네 물리를 진행시킨다')
  eq(swingM.motorAngle, 0, 'swing 모드에서는 전동기 각도가 그대로다')

  const motorM = createModel()
  setMode(motorM, 'motor')
  setCurrent(motorM, MAX_CURRENT)
  step(motorM, 1 / 60)
  assert(motorM.motorSpeed !== 0, 'motor 모드에서는 step()이 전동기 물리를 진행시킨다')
  eq(motorM.swingAngle, 0, 'motor 모드에서는 그네 각도가 그대로다')
})()

// 15) reset 함수
;(function resets() {
  const m = createModel()
  setCurrent(m, MAX_CURRENT)
  runFor(m, 3, 1 / 60, stepSwing)
  resetSwing(m)
  eq(m.swingAngle, 0, 'resetSwing 후 각도가 0')
  eq(m.swingVelocity, 0, 'resetSwing 후 각속도가 0')

  runFor(m, 3, 1 / 60, stepMotor)
  resetMotor(m)
  eq(m.motorAngle, 0, 'resetMotor 후 회전각이 0')
  eq(m.motorSpeed, 0, 'resetMotor 후 각속도가 0')
})()

// 16) 값 범위 제한
;(function clamping() {
  const m = createModel()
  setCurrent(m, 999)
  eq(m.current, MAX_CURRENT, '전류 세기는 최댓값을 넘지 않는다')
  setCurrent(m, -5)
  eq(m.current, 0, '전류 세기는 0 아래로 내려가지 않는다')
  setDirection(m, 0)
  eq(m.direction, 1, '전류 방향은 0이 오면 +1로 취급한다')
  setMagnetPolarity(m, 0)
  eq(m.magnetPolarity, 1, '자석 극은 0이 오면 +1로 취급한다')
  setMode(m, '이상한값')
  eq(m.mode, 'swing', '모르는 모드는 그네로 되돌아간다')
})()

// 17) currentLevel 범위
;(function currentLevelRange() {
  const m = createModel()
  for (let c = 0; c <= MAX_CURRENT; c++) {
    setCurrent(m, c)
    const level = currentLevel(m)
    assert(level >= 0 && level <= 1, `currentLevel은 0~1 범위 안이다(전류=${c}, level=${level})`)
  }
})()

export function runAll() {
  return results
}
