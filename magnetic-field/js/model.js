// 「코일 주위의 자기장」 시뮬레이터의 순수 로직 — DOM을 모른다. test.html에서 그대로 검증한다.
//
// 성취기준 [9과14-04] 해설이 "전류 세기·방향에 따른 자기장을 **정성적으로** 확인"하라고
// 못 박고 있다. 그래서 이 모델은 실제 자기장 공식(비오-사바르 법칙)을 정확히 재현하지 않고,
// **정성적으로 맞는 모양**만 만든다 — 코일에서는 막대자석처럼 굽이치는 장, 직선 도선에서는
// 도선을 감싸는 동심원. 세기·방향을 바꾸면 나침반이 그에 맞게 반응하는 것이 핵심이다.
//
// ⚠️ 관찰 결과를 말로 풀어주는 함수는 두지 않는다. "전류가 셀수록 자기장이 세진다" 같은
//    문장은 학생이 나침반을 보고 스스로 찾아내야 할 결론이다(2026-08-06 사용자 피드백).
//
// **나침반이 지구 자기장과 코일(또는 도선)의 자기장을 동시에 느낀다**는 것이 이 모델의 핵심
// 설계다 — 두 자기장을 실제로 벡터 합산한 뒤, 그 합벡터 방향으로 바늘이 정렬된다. 그래서
// "전류를 약하게 하면 나침반이 지구 자기장 쪽으로 덜 벗어난다"는 관찰이 별도 규칙 없이
// 자연스럽게 나온다 — 그냥 두 벡터를 더한 것뿐이다.

export const MAX_CURRENT = 4

export function createModel() {
  return {
    /** 'coil'(코일) | 'wire'(직선 도선) */
    mode: 'coil',
    on: true,
    /** +1 또는 −1 — 전류 방향 */
    direction: 1,
    /** 0 ~ MAX_CURRENT */
    current: 2,
  }
}

export function setMode(model, mode) {
  model.mode = mode === 'wire' ? 'wire' : 'coil'
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

export function setCurrent(model, value) {
  model.current = Math.max(0, Math.min(MAX_CURRENT, Math.round(value)))
  return model
}

/** 지금 흐르는 전류의 세기(0~1). 스위치가 꺼져 있으면 0. */
export function currentLevel(model) {
  if (!model.on) return 0
  return model.current / MAX_CURRENT
}

// ── 지구 자기장 ───────────────────────────────────────────────────────
//
// 화면 오른쪽을 지구 자기 북극 방향으로 삼는다(자기 나침반은 항상 이쪽을 가리키려 한다).
// 세기는 상수 하나로 고정 — 코일·도선의 자기장이 이보다 훨씬 세지면 나침반이 그쪽으로
// 끌려가고, 약하면 여전히 지구 자기장 쪽을 가리킨다.

export const EARTH_FIELD = { x: 1, y: 0 }
export const EARTH_MAGNITUDE = 1

// ── 코일(자석 비유) 모델 ─────────────────────────────────────────────
//
// 실제 자기 쌍극자 공식(정확히는 막대자석 하나가 만드는 장과 같은 형태)을 그대로 쓴다 —
// 계수만 임의로 잡았을 뿐 방향·모양은 진짜 자석 자기력선과 같다. 코일 축을 화면의 가로
// 방향(x축)으로 두고, 전류 방향이 바뀌면 어느 쪽이 N극인지가 뒤집힌다.

const COIL_MOMENT_SCALE = 4000000
/** 이보다 가까운 거리는 이 값으로 잘라 쓴다 — 안 그러면 코일 바로 옆에서 세기가 무한대로 튄다. */
const MIN_DIST = 34

/** 코일(원점, 축이 x방향인 자기 쌍극자)이 점 p(코일 중심 기준 상대 좌표)에 만드는 자기장 벡터 */
export function coilFieldAt(model, p) {
  const level = currentLevel(model)
  if (level === 0) return { x: 0, y: 0 }

  const moment = model.direction * level * COIL_MOMENT_SCALE
  const rawDist = Math.hypot(p.x, p.y)
  const dist = Math.max(MIN_DIST, rawDist)
  const rx = p.x / (rawDist || 1)
  const ry = p.y / (rawDist || 1)
  // 쌍극자 공식: B = (3(m·r̂)r̂ − m) / dist³ , m = moment * (1, 0)
  const dot = moment * rx // m·r̂ (m이 x축 방향이라 x성분만 남는다)
  const k = 1 / (dist * dist * dist)
  return {
    x: k * (3 * dot * rx - moment),
    y: k * (3 * dot * ry),
  }
}

// ── 직선 도선 모델 ────────────────────────────────────────────────────
//
// 도선이 화면과 수직으로(종이를 뚫고) 지나간다고 본다 — 왼손·오른손 법칙 실험에서 흔히
// 쓰는 배치다. 자기장은 도선을 중심으로 동심원을 그리며, 세기는 거리에 반비례한다.

const WIRE_FIELD_SCALE = 900

export function wireFieldAt(model, p) {
  const level = currentLevel(model)
  if (level === 0) return { x: 0, y: 0 }

  const dist = Math.max(MIN_DIST * 0.6, Math.hypot(p.x, p.y))
  const rx = p.x / dist
  const ry = p.y / dist
  // 반지름 방향을 90도 돌리면 접선 방향이 나온다. 전류 방향이 부호를 뒤집는다(회전 방향 반전).
  const tangent = { x: -ry, y: rx }
  const magnitude = (model.direction * level * WIRE_FIELD_SCALE) / dist
  return { x: tangent.x * magnitude, y: tangent.y * magnitude }
}

/** 지금 모드에 맞는 자기장 벡터(코일 또는 도선만의 몫 — 지구 자기장은 안 더한 값) */
export function localFieldAt(model, p) {
  return model.mode === 'wire' ? wireFieldAt(model, p) : coilFieldAt(model, p)
}

/**
 * 나침반이 실제로 느끼는 자기장 — **지구 자기장과 코일(또는 도선)의 자기장을 더한 값**이다.
 * 나침반 바늘은 이 합벡터 방향을 가리킨다. 별도의 "약하면 지구 쪽으로" 같은 규칙을 두지
 * 않아도, 두 벡터를 더하기만 하면 그 현상이 저절로 나온다.
 */
export function needleFieldAt(model, p) {
  const local = localFieldAt(model, p)
  return { x: EARTH_FIELD.x * EARTH_MAGNITUDE + local.x, y: EARTH_FIELD.y * EARTH_MAGNITUDE + local.y }
}

/** 나침반 바늘이 가리켜야 할 각도(라디안, atan2 규약) */
export function needleAngle(model, p) {
  const v = needleFieldAt(model, p)
  return Math.atan2(v.y, v.x)
}

/** 지금 위치에서 코일·도선의 자기장이 지구 자기장보다 얼마나 센지(0이면 지구가 지배적) */
export function localOverEarthRatio(model, p) {
  const local = localFieldAt(model, p)
  return Math.hypot(local.x, local.y) / EARTH_MAGNITUDE
}

// ── 나침반 배치 ───────────────────────────────────────────────────────
//
// 좌표는 전부 코일(또는 도선) 중심을 원점으로 하는 논리 좌표다. render.js가 화면 중심으로
// 옮겨 그린다.

/**
 * 코일 모드 나침반 8개 — 막대자석 자기력선처럼 코일을 감싸는 자리에 둔다.
 * 축(가로) 위 두 점은 코일 양 끝 바깥에서 자기력선이 곧장 빠져나가는 자리,
 * 나머지는 위아래로 코일을 감싸며 자기력선이 휘어 도는 자리다.
 */
export const COIL_COMPASS_POSITIONS = [
  { x: -170, y: 0 },
  { x: 170, y: 0 },
  { x: -85, y: -78 },
  { x: 85, y: -78 },
  { x: -85, y: 78 },
  { x: 85, y: 78 },
  { x: 0, y: -128 },
  { x: 0, y: 128 },
]

/** 직선 도선 모드 나침반 8개 — 도선을 중심으로 한 원 위에 고르게. */
export const WIRE_COMPASS_RADIUS = 130
export const WIRE_COMPASS_POSITIONS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2
  return { x: Math.cos(a) * WIRE_COMPASS_RADIUS, y: Math.sin(a) * WIRE_COMPASS_RADIUS }
})

export function compassPositions(model) {
  return model.mode === 'wire' ? WIRE_COMPASS_POSITIONS : COIL_COMPASS_POSITIONS
}
