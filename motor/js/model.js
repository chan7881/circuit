// 「전기 그네와 전동기」 시뮬레이터의 순수 로직 — DOM을 모른다. test.html에서 그대로 검증한다.
//
// 성취기준 [9과14-04] 해설이 "자기장 안에 놓인 전류가 흐르는 코일이 받는 힘의 특성을 추리"라고
// 못 박고 있다 — 오른손 법칙을 수식(비오-사바르 법칙, 벡터 외적)으로 다루지 않고, **정성적
// 규칙 하나**로 힘의 방향을 결정한다:
//
//   전류 방향만 반대가 되면 힘도 반대가 된다.
//   자석 극 배치만 반대가 되면 힘도 반대가 된다.
//   둘 다 반대가 되면 힘은 원래와 같다.
//
// 이 규칙(forceSign = direction * magnetPolarity)이 이 파일 전체의 핵심이다. 세기는 전류가
// 셀수록 커진다는 것만 반영한다(forceMagnitude = currentLevel).
//
// ⚠️ 관찰 결과를 말로 풀어주는 함수는 두지 않는다 — 그네가 어느 쪽으로 움직이는지, 전동기가
//    어느 방향으로 도는지는 학생이 화면을 보고 스스로 확인해야 할 결론이다.
//
// **같은 코일을 두 가지 방식으로 매단다**는 것이 이 시뮬레이터의 설계 축이다 — 모드 A(전기
// 그네)는 코일을 위쪽 지지대에 매달아 진자처럼 흔들리게 하고, 모드 B(전동기)는 같은 코일을
// 중심축에 매달아 한 바퀴씩 계속 돌게 한다(정류자가 매 반 바퀴마다 전류 방향을 바꿔줘서
// 회전 방향이 한쪽으로 유지된다). 두 모드가 "같은 힘의 연속"임을 이어서 보여주려는 의도다.

export const MAX_CURRENT = 4

export function createModel() {
  return {
    /** 'swing'(전기 그네) | 'motor'(전동기) */
    mode: 'swing',
    on: true,
    /** +1 또는 −1 — 전류 방향 */
    direction: 1,
    /** +1 또는 −1 — 자석 극 배치(어느 쪽이 N인지) */
    magnetPolarity: 1,
    /** 0 ~ MAX_CURRENT */
    current: 2,
    /** 그네(모드 A) 진자 각도(라디안)·각속도 */
    swingAngle: 0,
    swingVelocity: 0,
    /** 전동기(모드 B) 회전각(0~2π로 정규화)·각속도 */
    motorAngle: 0,
    motorSpeed: 0,
  }
}

export function setMode(model, mode) {
  model.mode = mode === 'motor' ? 'motor' : 'swing'
  return model
}

export function setOn(model, value) {
  model.on = !!value
  return model
}

export function setDirection(model, dir) {
  model.direction = dir >= 0 ? 1 : -1
  return model
}

export function setMagnetPolarity(model, polarity) {
  model.magnetPolarity = polarity >= 0 ? 1 : -1
  return model
}

/**
 * 전류 세기를 0 ~ MAX_CURRENT 범위로 정한다. 슬라이드바로 조절하므로 **정수로 반올림하지
 * 않는다** — 중간값도 그대로 받아 힘의 크기가 이어지듯 변한다.
 */
export function setCurrent(model, value) {
  const v = Number(value)
  model.current = Number.isFinite(v) ? Math.max(0, Math.min(MAX_CURRENT, v)) : 0
  return model
}

/** 지금 흐르는 전류의 세기(0~1). 스위치가 꺼져 있으면 0. */
export function currentLevel(model) {
  if (!model.on) return 0
  return model.current / MAX_CURRENT
}

/**
 * 코일이 받는 힘의 부호 — 이 시뮬레이터의 핵심 규칙.
 * 전류만 반대 → −1배, 자석만 반대 → −1배, 둘 다 반대 → 그대로(부호가 두 번 뒤집혀 원래대로).
 */
export function forceSign(model) {
  if (currentLevel(model) <= 0) return 0
  return model.direction * model.magnetPolarity
}

/** 힘의 세기(0~1) — 전류가 셀수록 크다(정성적 비례). */
export function forceMagnitude(model) {
  return currentLevel(model)
}

// ── 모드 A: 전기 그네(진자) ──────────────────────────────────────────

// 전류가 최대일 때 자리잡는 각도가 FORCE_K/RESTORE_K = 약 0.55 rad(≈32°)가 되도록 잡았다.
// 한계각(SWING_MAX_ANGLE)에 닿지 않아야 전류 세기 단계별 차이가 각도로 그대로 보이고,
// 이 정도 각도라야 코일의 아래 도선이 말굽자석의 극 사이를 벗어나지 않는다(그림상 자연스럽다).
const SWING_FORCE_K = 10
const SWING_RESTORE_K = 18
const SWING_DAMPING = 2.2
export const SWING_MAX_ANGLE = 1.15

export function stepSwing(model, dt) {
  const drive = forceSign(model) * forceMagnitude(model) * SWING_FORCE_K
  const accel = drive - SWING_RESTORE_K * model.swingAngle - SWING_DAMPING * model.swingVelocity
  model.swingVelocity += accel * dt
  model.swingAngle += model.swingVelocity * dt
  if (model.swingAngle > SWING_MAX_ANGLE) {
    model.swingAngle = SWING_MAX_ANGLE
    model.swingVelocity = 0
  } else if (model.swingAngle < -SWING_MAX_ANGLE) {
    model.swingAngle = -SWING_MAX_ANGLE
    model.swingVelocity = 0
  }
  return model
}

export function resetSwing(model) {
  model.swingAngle = 0
  model.swingVelocity = 0
  return model
}

// ── 모드 B: 전동기(연속 회전) ────────────────────────────────────────
//
// 정류자가 매 반 바퀴(π 라디안)마다 코일에 흐르는 전류의 방향을 바꿔주기 때문에, 회전을
// 만드는 돌림힘(토크)의 방향은 한 바퀴 내내 한쪽으로 유지된다 — 정류자가 하는 일이 바로
// 그것이다. 그래서 회전각은 **반 바퀴 주기**로 같은 상태가 반복된다.
//
// 돌림힘의 크기는 코일 면이 자기장과 나란할 때 가장 크고, 수직일 때 0이 된다(τ ∝ cos θ) —
// 자바실험실 직류 전동기 시뮬레이션과 같은 규칙이다. τ가 0이 되는 순간(죽은점)에도 이미
// 돌고 있던 관성 때문에 그냥 지나쳐 계속 돈다.

const MOTOR_TORQUE_K = 30 // 돌림힘 → 각가속도 환산(회전 관성을 뭉뚱그린 값)
const MOTOR_FRICTION = 1.6 // 마찰(각속도에 비례)
export const MOTOR_MAX_SPEED = 16

function normalizeAngle2Pi(a) {
  const twoPi = Math.PI * 2
  return ((a % twoPi) + twoPi) % twoPi
}

/**
 * 정류자 덕분에 반 바퀴(π)마다 같은 상태가 반복되므로, 그 한 주기 안의 각도(−π/2 ~ π/2)로
 * 줄여서 본다. 이 각도가 0이면 코일 면이 자기장과 나란해 돌림힘이 가장 크고, ±π/2이면
 * 코일 면이 자기장과 수직이라 돌림힘이 0이다(죽은점).
 */
export function reducedMotorAngle(model) {
  let a = model.motorAngle % Math.PI
  if (a > Math.PI / 2) a -= Math.PI
  return a
}

/**
 * 정류자의 **틈**이 브러시를 지나가는 순간인지. 이때는 회로가 잠깐 끊겨 전류가 흐르지 않고,
 * 따라서 힘도 돌림힘도 0이다 — 그래도 이미 돌던 관성 때문에 그냥 지나쳐 계속 돈다.
 *
 * 틈은 코일이 **죽은점(코일 면이 자기장과 수직, 회전각 π/2·3π/2)** 을 지날 때 브러시에 오도록
 * 맞춰져 있다. 실제 직류 전동기가 그렇게 만들어져 있다 — 어차피 돌림힘이 0이라 잃을 게 없는
 * 순간에 전류를 갈아타야 회전이 끊기지 않기 때문이다.
 */
export const COMMUTATOR_BREAK_HALF_ANGLE = 0.18

export function isCommutatorBreak(model) {
  if (currentLevel(model) <= 0) return false
  // 죽은점(π/2, 3π/2)까지 남은 각도 — 반 바퀴 주기라 π로 나눈 나머지로 본다.
  const fromDeadPoint = Math.abs(Math.abs(reducedMotorAngle(model)) - Math.PI / 2)
  return fromDeadPoint < COMMUTATOR_BREAK_HALF_ANGLE
}

/** 지금 회전각에서 코일이 받는 돌림힘(−1 ~ 1). 부호가 회전 방향을 정한다. */
export function motorTorque(model) {
  if (isCommutatorBreak(model)) return 0 // 전류가 끊긴 동안에는 힘이 없다
  return forceSign(model) * forceMagnitude(model) * Math.cos(reducedMotorAngle(model))
}

export function stepMotor(model, dt) {
  const accel = motorTorque(model) * MOTOR_TORQUE_K - MOTOR_FRICTION * model.motorSpeed
  model.motorSpeed = Math.max(-MOTOR_MAX_SPEED, Math.min(MOTOR_MAX_SPEED, model.motorSpeed + accel * dt))
  model.motorAngle = normalizeAngle2Pi(model.motorAngle + model.motorSpeed * dt)
  return model
}

export function resetMotor(model) {
  model.motorAngle = 0
  model.motorSpeed = 0
  return model
}

/**
 * 지금 회전각에서 정류자가 어느 쪽 결선 상태인지(+1 | −1). 코일의 두 변에 흐르는 실제 전류
 * 방향은 이 값 때문에 반 바퀴마다 뒤집히지만, 그래서 오히려 힘(=회전 방향)은 그대로 유지된다.
 *
 * ⚠️ 뒤집히는 지점은 **죽은점(π/2·3π/2)** 이지, 돌림힘이 가장 큰 지점(0·π)이 아니다.
 *    전류를 그대로 두면 돌림힘 부호가 뒤집히는 바로 그 순간에 전류를 갈아타야, 돌림힘이
 *    한 바퀴 내내 같은 쪽으로 유지된다. (cos θ의 부호가 바뀌는 곳과 같은 자리다.)
 */
export function commutatorPhase(model) {
  const a = model.motorAngle
  return a < Math.PI / 2 || a >= (3 * Math.PI) / 2 ? 1 : -1
}

/** 지금 모드에 맞는 물리를 한 스텝 진행한다. */
export function step(model, dt) {
  return model.mode === 'motor' ? stepMotor(model, dt) : stepSwing(model, dt)
}
