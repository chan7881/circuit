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
  isCommutatorBreak,
  COMMUTATOR_BREAK_HALF_ANGLE,
  reducedMotorAngle,
  motorTorque,
  MOTOR_MAX_SPEED,
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

// 8) 전동기 — 힘을 받으면 그 방향으로 회전 속도가 붙고, 여러 바퀴를 돌아도 방향이 유지된다
;(function motorSpinsUpInForceDirection() {
  const m = createModel()
  setMode(m, 'motor')
  setDirection(m, 1)
  setMagnetPolarity(m, 1)
  setCurrent(m, MAX_CURRENT)

  // 죽은점(돌림힘 0)을 여러 번 지나는 동안 한 번도 역회전하지 않아야 한다 — 정류자가
  // 반 바퀴마다 결선을 뒤집어 주기 때문에 돌림힘 부호가 계속 같은 쪽으로 유지된다.
  let minSpeed = Infinity
  let turns = 0
  let prevAngle = m.motorAngle
  for (let t = 0; t < 8; t += 1 / 60) {
    stepMotor(m, 1 / 60)
    if (t > 1) minSpeed = Math.min(minSpeed, m.motorSpeed)
    if (m.motorAngle < prevAngle) turns++ // 0을 지나 한 바퀴 돌 때마다
    prevAngle = m.motorAngle
  }
  assert(m.motorSpeed > 1, `전동기가 힘 방향으로 회전 속도가 붙는다 (각속도=${m.motorSpeed.toFixed(2)})`)
  assert(minSpeed > 0, `죽은점을 지나는 동안에도 역회전하지 않는다 (최저 각속도=${minSpeed.toFixed(2)})`)
  assert(turns >= 3, `여러 바퀴를 실제로 돈다 (바퀴 수=${turns})`)
})()

// 8-1) 전동기 — 돌림힘은 코일 면이 자기장과 나란할 때 최대, 수직일 때 0이다
;(function torqueVariesWithAngle() {
  const m = createModel()
  setMode(m, 'motor')
  setCurrent(m, MAX_CURRENT)

  m.motorAngle = 0
  const atZero = Math.abs(motorTorque(m))
  m.motorAngle = Math.PI / 2
  const atQuarter = Math.abs(motorTorque(m))
  m.motorAngle = Math.PI
  const atHalf = Math.abs(motorTorque(m))

  assert(Math.abs(atZero - 1) < 1e-9, `코일 면이 나란할 때 돌림힘이 최대 (실제=${atZero.toFixed(4)})`)
  assert(atQuarter < 1e-9, `코일 면이 수직일 때(죽은점) 돌림힘이 0 (실제=${atQuarter.toFixed(4)})`)
  assert(Math.abs(atHalf - 1) < 1e-9, `반 바퀴 뒤에는 다시 최대 — 정류자 덕분에 주기가 π다 (실제=${atHalf.toFixed(4)})`)

  // 돌림힘 부호는 한 바퀴 내내 같은 쪽이어야 한다(정류자가 하는 일)
  for (let i = 0; i < 40; i++) {
    m.motorAngle = (i / 40) * Math.PI * 2
    assert(motorTorque(m) >= -1e-9, `회전각 ${(m.motorAngle).toFixed(2)}에서 돌림힘 부호가 뒤집히지 않는다`)
  }
})()

// 8-2) reducedMotorAngle은 항상 −π/2 ~ π/2 범위다
;(function reducedAngleRange() {
  const m = createModel()
  for (let i = 0; i < 60; i++) {
    m.motorAngle = (i / 60) * Math.PI * 2
    const a = reducedMotorAngle(m)
    assert(a > -Math.PI / 2 - 1e-9 && a <= Math.PI / 2 + 1e-9, `줄인 회전각이 범위 안이다(실제=${a.toFixed(3)})`)
  }
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
  runFor(m, 6, 1 / 60, stepMotor)
  assert(Math.abs(m.motorSpeed) < 0.1, `스위치를 끄면 전동기가 멈춘다 (각속도=${m.motorSpeed.toFixed(3)})`)
})()

// 11-1) 전동기 — 각속도가 상한을 넘지 않는다
;(function motorSpeedCapped() {
  const m = createModel()
  setMode(m, 'motor')
  setCurrent(m, MAX_CURRENT)
  let peak = 0
  for (let t = 0; t < 20; t += 1 / 60) {
    stepMotor(m, 1 / 60)
    peak = Math.max(peak, Math.abs(m.motorSpeed))
  }
  assert(peak <= MOTOR_MAX_SPEED + 1e-9, `각속도가 상한(${MOTOR_MAX_SPEED})을 넘지 않는다 (최대=${peak.toFixed(2)})`)
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

// 13) 정류자 위상 — **죽은점(π/2·3π/2)** 에서 뒤집힌다(돌림힘이 최대인 0·π가 아니다)
;(function commutatorFlipsAtDeadPoints() {
  const m = createModel()
  m.motorAngle = 0
  eq(commutatorPhase(m), 1, '회전각 0(돌림힘 최대)에서는 위상 +1')
  m.motorAngle = Math.PI / 2 - 0.001
  eq(commutatorPhase(m), 1, 'π/2 직전까지는 위상 +1')
  m.motorAngle = Math.PI / 2 + 0.001
  eq(commutatorPhase(m), -1, 'π/2(죽은점)를 넘으면 위상이 뒤집힌다')
  m.motorAngle = Math.PI
  eq(commutatorPhase(m), -1, 'π(돌림힘 최대)에서는 위상이 뒤집히지 않는다')
  m.motorAngle = (3 * Math.PI) / 2 - 0.001
  eq(commutatorPhase(m), -1, '3π/2 직전까지는 위상 −1')
  m.motorAngle = (3 * Math.PI) / 2 + 0.001
  eq(commutatorPhase(m), 1, '3π/2(죽은점)를 넘으면 다시 +1로 돌아온다')

  // 위상은 "전류를 그대로 뒀을 때 돌림힘 부호"와 항상 같아야 한다 — 그래야 실제 돌림힘이
  // 한 방향으로 유지된다.
  for (let i = 0; i < 72; i++) {
    m.motorAngle = (i / 72) * Math.PI * 2
    const rawSign = Math.sign(Math.cos(m.motorAngle))
    if (Math.abs(Math.cos(m.motorAngle)) > 1e-6) {
      eq(commutatorPhase(m), rawSign, `회전각 ${m.motorAngle.toFixed(2)}에서 위상이 cos θ 부호와 일치`)
    }
  }
})()

// 13-1) 정류자 틈 — 죽은점 부근에서 전류가 잠깐 끊기고, 그동안 돌림힘도 0이다
;(function commutatorBreak() {
  const m = createModel()
  setMode(m, 'motor')
  setCurrent(m, MAX_CURRENT)

  m.motorAngle = 0
  assert(!isCommutatorBreak(m), '돌림힘이 최대인 지점에서는 전류가 끊기지 않는다')
  eq(Math.abs(motorTorque(m)) > 0, true, '그때 돌림힘이 있다')

  for (const dead of [Math.PI / 2, (3 * Math.PI) / 2]) {
    m.motorAngle = dead
    assert(isCommutatorBreak(m), `죽은점 ${dead.toFixed(2)}에서 전류가 끊긴다`)
    eq(motorTorque(m), 0, `끊긴 동안에는 돌림힘이 0 (회전각 ${dead.toFixed(2)})`)

    m.motorAngle = dead - COMMUTATOR_BREAK_HALF_ANGLE - 0.02
    assert(!isCommutatorBreak(m), `죽은점 직전(틈 밖)에서는 전류가 흐른다`)
  }

  // 스위치가 꺼져 있으면 애초에 흐를 전류가 없으니 "끊김"도 아니다
  setOn(m, false)
  m.motorAngle = Math.PI / 2
  assert(!isCommutatorBreak(m), '전류가 없으면 끊김 상태로 보지 않는다')
})()

// 13-2) 전류가 끊겨도 관성으로 죽은점을 지나 계속 돈다
;(function coastsThroughBreak() {
  const m = createModel()
  setMode(m, 'motor')
  setCurrent(m, MAX_CURRENT)
  let turns = 0
  let prev = m.motorAngle
  let minSpeed = Infinity
  for (let t = 0; t < 8; t += 1 / 60) {
    stepMotor(m, 1 / 60)
    if (t > 1) minSpeed = Math.min(minSpeed, m.motorSpeed)
    if (m.motorAngle < prev) turns++
    prev = m.motorAngle
  }
  assert(turns >= 3, `정류자 틈이 있어도 여러 바퀴를 돈다 (바퀴 수=${turns})`)
  assert(minSpeed > 0, `틈을 지나는 동안에도 멈추거나 뒤로 돌지 않는다 (최저 각속도=${minSpeed.toFixed(2)})`)
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
