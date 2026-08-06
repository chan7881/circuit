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

export function setCurrent(model, value) {
  model.current = Math.max(0, Math.min(MAX_CURRENT, Math.round(value)))
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

const SWING_FORCE_K = 26
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
// 만드는 힘의 방향(=회전 방향)은 한 바퀴 내내 한쪽으로 유지된다. 그래서 목표 각속도는
// forceSign 하나로만 정해지고, 회전각과 무관하다 — 정류자가 하는 일이 바로 그것이다.

const MOTOR_SPEED_K = 14 // 전류 최대일 때 목표 각속도(rad/s)
const MOTOR_RESPONSIVENESS = 2.4 // 목표 각속도로 다가가는 빠르기(관성·마찰을 뭉뚱그린 값)

function normalizeAngle2Pi(a) {
  const twoPi = Math.PI * 2
  return ((a % twoPi) + twoPi) % twoPi
}

export function stepMotor(model, dt) {
  const target = forceSign(model) * forceMagnitude(model) * MOTOR_SPEED_K
  model.motorSpeed += (target - model.motorSpeed) * Math.min(1, MOTOR_RESPONSIVENESS * dt)
  model.motorAngle = normalizeAngle2Pi(model.motorAngle + model.motorSpeed * dt)
  return model
}

export function resetMotor(model) {
  model.motorAngle = 0
  model.motorSpeed = 0
  return model
}

/**
 * 지금 회전각에서 정류자가 어느 쪽 결선 상태인지(+1 | −1). 반 바퀴(π)마다 뒤집힌다 — 코일의
 * 두 변에 흐르는 실제 전류 방향은 이 값 때문에 계속 바뀌지만, 힘(=회전 방향)은 그대로 유지된다.
 */
export function commutatorPhase(model) {
  return Math.floor(model.motorAngle / Math.PI) % 2 === 0 ? 1 : -1
}

/** 지금 모드에 맞는 물리를 한 스텝 진행한다. */
export function step(model, dt) {
  return model.mode === 'motor' ? stepMotor(model, dt) : stepSwing(model, dt)
}
