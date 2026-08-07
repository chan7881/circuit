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

/**
 * 전류 세기를 0 ~ MAX_CURRENT 범위로 정한다. 슬라이드바로 조절하므로 **정수로 반올림하지
 * 않는다** — 중간값도 그대로 받아 자기장 세기가 이어지듯 변한다.
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

// ── 지구 자기장 ───────────────────────────────────────────────────────
//
// 화면 오른쪽을 지구 자기 북극 방향으로 삼는다(자기 나침반은 항상 이쪽을 가리키려 한다).
// 세기는 상수 하나로 고정 — 코일·도선의 자기장이 이보다 훨씬 세지면 나침반이 그쪽으로
// 끌려가고, 약하면 여전히 지구 자기장 쪽을 가리킨다.

export const EARTH_FIELD = { x: 1, y: 0 }
export const EARTH_MAGNITUDE = 1

// ── 코일 모델 ────────────────────────────────────────────────────────
//
// 코일을 **한 점의 자기 쌍극자**로 근사하지 않고, 실제로 감긴 고리 5개의 전류를
// **비오-사바르 법칙으로 적분해서** 자기장을 구한다. 코일 축은 화면의 가로 방향(x축)이고,
// 전류 방향이 바뀌면 어느 쪽이 N극인지가 뒤집힌다.
//
// 왜 근사를 버렸나: 쌍극자 근사는 코일에서 충분히 멀 때만 맞는데, 나침반이 놓인 자리에서도
// 실제 장과 방향이 최대 **25.7°** 나 어긋났다. 그 상태에서 자기력선을 실제 모양대로 그리면
// 나침반 바늘이 자기력선을 따라가지 않는 것처럼 보인다 — 학생이 관찰로 규칙을 찾아내야 하는
// 시뮬레이터에서 이건 그냥 틀린 그림이다(2026-08-07 사용자 피드백).
//
// ⚠️ 성취기준 [9과14-04]가 요구하는 것은 여전히 **정성적** 확인이다. 정확한 적분을 쓰는 건
//    "얼마나 센가"를 계산시키려는 게 아니라, 눈에 보이는 그림이 실제와 어긋나지 않게 하려는
//    것이다. 세기의 절대값은 여전히 임의 계수(COIL_FIELD_SCALE)로 맞춘다.

export const COIL_RADIUS = 26 // 고리 반지름
export const COIL_HALF_LEN = 62 // 코일 반길이
export const COIL_LOOPS = 5 // 감은 고리 수
const LOOP_SEGMENTS = 24 // 고리 하나를 몇 조각으로 나눠 적분할지
/** 지구 자기장(=1)과 견줄 만한 크기가 되도록 맞춘 계수 — 물리적 의미는 없다. */
const COIL_FIELD_SCALE = 700
/** 도선 바로 위에서 값이 무한대로 튀지 않게 하는 최소 거리² */
const SOFTEN_R2 = 9

/** 이보다 가까운 거리는 이 값으로 잘라 쓴다 — 직선 도선 모델이 쓴다. */
const MIN_DIST = 34

/**
 * 코일(중심이 원점, 축이 x방향)이 점 p에 만드는 자기장 벡터.
 * 코일은 축 대칭이라 p.y는 "축에서 떨어진 거리"로 보면 되고, 부호는 그대로 따라간다.
 */
export function coilFieldAt(model, p) {
  const level = currentLevel(model)
  if (level === 0) return { x: 0, y: 0 }

  const rho = Math.abs(p.y)
  const sign = p.y < 0 ? -1 : 1
  let bx = 0
  let br = 0
  const dphi = (Math.PI * 2) / LOOP_SEGMENTS
  for (let i = 0; i < COIL_LOOPS; i++) {
    const x0 = -COIL_HALF_LEN + ((COIL_HALF_LEN * 2) / (COIL_LOOPS - 1)) * i
    for (let k = 0; k < LOOP_SEGMENTS; k++) {
      const phi = (k + 0.5) * dphi
      const cs = Math.cos(phi)
      const sn = Math.sin(phi)
      // 전류 조각 dl = a·dφ·(0, −sinφ, cosφ), 그 위치 s = (x0, a·cosφ, a·sinφ)
      const dly = -COIL_RADIUS * sn * dphi
      const dlz = COIL_RADIUS * cs * dphi
      // 재는 점을 (p.x, rho, 0)으로 두면 축 대칭이라 일반성을 잃지 않는다
      const rx = p.x - x0
      const ry = rho - COIL_RADIUS * cs
      const rz = -COIL_RADIUS * sn
      const r2 = Math.max(rx * rx + ry * ry + rz * rz, SOFTEN_R2)
      const r3 = r2 * Math.sqrt(r2)
      // (dl × r)의 x성분과 반지름 방향 성분. 나머지 성분은 한 바퀴 돌면 상쇄된다.
      bx += (dly * rz - dlz * ry) / r3
      br += (dlz * rx) / r3
    }
  }
  const k = model.direction * level * COIL_FIELD_SCALE
  return { x: k * bx, y: k * sign * br }
}

// ── 직선 도선 모델 ────────────────────────────────────────────────────
//
// 도선이 실험대를 수직으로 뚫고 지나간다. 자기장은 도선을 중심으로 동심원을 그리며,
// 세기는 거리에 반비례한다.
//
// **회전 방향은 오른손 법칙(B ∝ Î × r̂)으로 정해진다.** 화면에서 direction=+1이면 전류가
// 위(장면 +y)로 흐르도록 그리고, 모델 좌표 {x, y}는 장면의 {x, z}에 대응한다. 그러면
//   Î × r̂ = (0,1,0) × (rx, 0, rz) = (rz, 0, −rx)
// 이므로 모델 좌표에서 접선은 (p.y, −p.x) 방향이다.
//
// ⚠️ 예전에는 이 부호가 반대(−p.y, p.x)여서 나침반이 실제와 **정확히 180° 반대**를 가리켰다.
//    "접선 방향"만 맞으면 된다고 보고 회전 방향(손잡이)을 확인하지 않아 놓친 것이다.
//    아래 tests.js에 오른손 법칙 검증을 넣어 다시는 뒤집히지 않게 했다(2026-08-07 사용자 지적).

const WIRE_FIELD_SCALE = 900

export function wireFieldAt(model, p) {
  const level = currentLevel(model)
  if (level === 0) return { x: 0, y: 0 }

  const dist = Math.max(MIN_DIST * 0.6, Math.hypot(p.x, p.y))
  const rx = p.x / dist
  const ry = p.y / dist
  // 반지름 방향을 90도 돌리면 접선 방향이 나온다(오른손 법칙에 맞는 쪽으로).
  const tangent = { x: ry, y: -rx }
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
