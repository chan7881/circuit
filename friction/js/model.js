// 마찰 전기 시뮬레이터의 순수 로직 — DOM을 전혀 모른다. test.html에서 그대로 검증한다.
//
// 이 시뮬레이터가 반드시 지켜야 하는 교육적 사실 두 가지를 모델 수준에서 강제한다.
//   1) 마찰로 옮겨가는 것은 **전자뿐**이다. 원자핵(양성자)은 절대 움직이지 않는다.
//   2) 두 물체의 전자 수 **합은 언제나 일정**하다 — 전하는 새로 생기지 않고 옮겨갈 뿐이다.
// 그래서 상태를 "각 물체의 전자 수"로 따로 들고 있지 않고, **옮겨간 개수(transferred) 하나**로만
// 표현한다. 이렇게 하면 합이 어긋나는 상태 자체를 만들 수 없다.
//
// ⚠️ 이 파일에는 관찰 결과를 말로 풀어주는 함수를 두지 않는다. "무엇이 일어났는지"는 학생이
//    화면을 보고 스스로 말해야 하는 것이라, 시뮬레이터가 먼저 결론을 말해버리면 탐구가 사라진다.
//    (2026-08-06 사용자 피드백 — 설명 문구 일괄 삭제.)

/** 각 물체가 처음에 가지고 있는 전자 수(=양성자 수). 이 상태에서는 전기적으로 중성이다. */
export const BASE_ELECTRONS = 8

/** 문질러서 옮길 수 있는 전자의 최대 개수. 너무 많으면 기호가 빽빽해 읽기 어렵다. */
export const MAX_TRANSFER = 6

/**
 * 전자 하나가 옮겨가는 데 필요한 '문지른 거리'(논리 좌표 기준).
 *
 * 왜 이렇게 큰가: 예전에는 조금만 움직여도 최대치까지 순식간에 차버려서 "많이 문지를수록 많이
 * 옮겨간다"는 관계가 전혀 안 보였다(2026-08-06 피드백). 화면 폭이 620이므로 이 값이면 좌우로
 * 한 번 왕복해야 전자 하나가 옮겨가고, 최대치까지는 예닐곱 번 왕복해야 한다.
 */
export const RUB_DISTANCE_PER_ELECTRON = 520

/**
 * 물체 쌍. `donor`가 전자를 **잃는**(→ (+)전기를 띠는) 쪽이다.
 *
 * 쌍마다 어느 쪽이 (+)가 되는지 달라지는 것이 이 시뮬레이터의 핵심 관찰 거리다 —
 * "빨대는 항상 (−)" 같은 오개념을 막고, 대전 결과가 **상대적**임을 보여준다.
 *
 * `shape`는 그리기(render.js)가 어떤 모습으로 그릴지 고르는 값이다. 예전에는 둘 다 네모
 * 상자였는데, 그러면 무엇을 문지르고 있는지가 안 보였다(2026-08-06 피드백).
 * `a`가 손에 쥐고 움직이는 쪽, `b`가 바닥에 놓여 있는 쪽이다.
 */
export const PAIRS = [
  {
    id: 'straw',
    label: '빨대 + 털가죽',
    a: { name: '빨대', color: '#dc6803', shape: 'straw' },
    b: { name: '털가죽', color: '#8b5cf6', shape: 'fur' },
    donor: 'b', // 털가죽이 전자를 잃는다 → 털가죽 (+), 빨대 (−)
  },
  {
    id: 'glass',
    label: '유리막대 + 비단',
    a: { name: '유리막대', color: '#0891b2', shape: 'glassRod' },
    b: { name: '비단', color: '#db2777', shape: 'silk' },
    donor: 'a', // 유리막대가 전자를 잃는다 → 유리막대 (+), 비단 (−)
  },
]

export function getPair(pairId) {
  return PAIRS.find((p) => p.id === pairId) ?? PAIRS[0]
}

/**
 * 목적격 조사 '을/를'을 앞말의 받침에 맞춰 고른다 — "빨대을(를)"처럼 어색하게 나오는 걸 막는다.
 * 물체 이름이 쌍마다 달라서(빨대·유리막대·털가죽·비단) 안내 문구를 그때그때 만들어야 한다.
 */
export function objectParticle(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return '를' // 한글이 아니면 기본형
  return code % 28 === 0 ? '를' : '을'
}

export function createModel(pairId = PAIRS[0].id) {
  return {
    pairId,
    transferred: 0,
    /** 아직 전자 하나를 채우지 못하고 남은 문지른 거리 — 0 ~ RUB_DISTANCE_PER_ELECTRON */
    rubProgress: 0,
  }
}

/**
 * 두 물체가 **맞닿은 채로** 움직인 거리를 넣는다. 쌓인 거리가 한 칸을 채울 때마다 전자가
 * 하나씩 옮겨간다. 옮겨간 개수를 돌려주므로 호출부가 그만큼 애니메이션을 만들 수 있다.
 *
 * 최대치에 도달하면 남은 거리를 쌓아두지 않는다 — 안 그러면 최대치에서 한참 문지른 뒤
 * 초기화했을 때 첫 움직임에 전자가 우르르 옮겨가는 이상한 일이 생긴다.
 */
export function rubByDistance(model, distance) {
  if (!(distance > 0)) return 0
  if (model.transferred >= MAX_TRANSFER) {
    model.rubProgress = 0
    return 0
  }
  model.rubProgress += distance
  let moved = 0
  while (model.rubProgress >= RUB_DISTANCE_PER_ELECTRON && model.transferred < MAX_TRANSFER) {
    model.rubProgress -= RUB_DISTANCE_PER_ELECTRON
    model.transferred++
    moved++
  }
  if (model.transferred >= MAX_TRANSFER) model.rubProgress = 0
  return moved
}

/** 다음 전자 한 개까지 얼마나 왔는지(0~1). 진행 막대로 보여줘 "더 문질러야 한다"를 체감시킨다. */
export function rubFraction(model) {
  if (model.transferred >= MAX_TRANSFER) return 1
  return model.rubProgress / RUB_DISTANCE_PER_ELECTRON
}

export function reset(model) {
  model.transferred = 0
  model.rubProgress = 0
  return model
}

export function setPair(model, pairId) {
  model.pairId = getPair(pairId).id
  model.transferred = 0 // 쌍을 바꾸면 처음부터 다시 문질러야 한다
  model.rubProgress = 0
  return model
}

/** 물체가 지금 가진 전자 수. which는 'a' | 'b' */
export function electronCount(model, which) {
  const pair = getPair(model.pairId)
  const isDonor = pair.donor === which
  return BASE_ELECTRONS + (isDonor ? -model.transferred : model.transferred)
}

/** 물체의 양성자(원자핵) 수 — 문질러도 절대 변하지 않는다. */
export function protonCount() {
  return BASE_ELECTRONS
}

/**
 * 물체가 띠는 알짜 전하. 양수면 (+)전기, 음수면 (−)전기, 0이면 중성.
 * 값의 크기는 "몇 개만큼 치우쳤는지"를 뜻한다.
 */
export function netCharge(model, which) {
  return protonCount() - electronCount(model, which)
}

/** 두 물체의 전자 수 합 — 문지르기와 무관하게 언제나 일정해야 한다(전하량 보존). */
export function totalElectrons(model) {
  return electronCount(model, 'a') + electronCount(model, 'b')
}

// ── 전기력 ────────────────────────────────────────────────────────────

export const ATTRACT = 'attract'
export const REPEL = 'repel'
export const NONE = 'none'

/**
 * 두 전하 사이에 작용하는 전기력의 종류.
 * 어느 한쪽이라도 중성(0)이면 이 시뮬레이터에서는 힘을 표시하지 않는다 —
 * 실제로는 정전기 유도로 끌리지만, 그건 **다음 소단원(정전기 유도)**의 주제라
 * 여기서 미리 보여주면 이번 시간의 결론("같은 전기는 밀고 다른 전기는 끈다")이 흐려진다.
 */
export function forceBetween(chargeA, chargeB) {
  if (chargeA === 0 || chargeB === 0) return NONE
  return Math.sign(chargeA) === Math.sign(chargeB) ? REPEL : ATTRACT
}

// ── 힘 관찰 모드: 에어하키 ────────────────────────────────────────────
//
// 예전에는 두 상자의 전하를 고르면 상자가 조금 흔들리는 화면이었다. 그걸로는 "밀린다/끌린다"가
// 남의 일처럼 보여서, 사방이 막힌 판 위에서 학생이 직접 **채(paddle)를 끌고 다니며** 퍽을
// 밀어내거나 끌어당기게 바꿨다(2026-08-06 피드백). 힘을 손으로 느끼듯 다루는 것이 목표라
// 전하의 부호만 바뀌어도 조작감이 확 달라져야 한다.
//
// 물리는 "중학생이 납득할 만큼"만 맞으면 된다 — 거리 제곱에 반비례하는 힘, 벽 반사,
// 채와 퍽의 탄성 충돌. 정확한 쿨롱 상수 같은 건 의미가 없다.

/** 경기장 안쪽 크기(논리 좌표). render.js가 같은 값을 쓴다. */
export const FIELD = { x: 0, y: 0, w: 560, h: 300 }

export const PUCK_R = 26
export const PADDLE_R = 34

/** 힘의 세기 계수 — 화면에서 "훅 밀리는" 느낌이 나도록 눈으로 맞춘 값이다. */
const FORCE_K = 260000
/** 힘이 무한대로 튀는 것을 막는 최소 거리. 채와 퍽이 겹칠 때의 수치 폭발 방지. */
const MIN_DIST = PUCK_R + PADDLE_R
/** 공기 저항 — 없으면 퍽이 영원히 튕겨 다녀서 관찰이 어렵다. */
const DAMPING = 0.6
/** 벽·채에 부딪혔을 때 남는 속도 비율 */
const RESTITUTION = 0.75
const MAX_SPEED = 900

export function createHockeyModel() {
  return {
    paddleCharge: -1,
    puckCharge: -1,
    paddle: { x: FIELD.w * 0.25, y: FIELD.h / 2, vx: 0, vy: 0 },
    puck: { x: FIELD.w * 0.7, y: FIELD.h / 2, vx: 0, vy: 0 },
  }
}

export function resetHockey(model) {
  model.paddle.x = FIELD.w * 0.25
  model.paddle.y = FIELD.h / 2
  model.paddle.vx = 0
  model.paddle.vy = 0
  model.puck.x = FIELD.w * 0.7
  model.puck.y = FIELD.h / 2
  model.puck.vx = 0
  model.puck.vy = 0
  return model
}

export function setHockeyCharge(model, which, charge) {
  if (which === 'paddle') model.paddleCharge = charge
  else model.puckCharge = charge
  return model
}

/** 채는 손가락을 그대로 따라간다(운동학적) — 경기장 밖으로는 못 나간다. */
export function movePaddle(model, x, y, dt) {
  const nx = clamp(x, FIELD.x + PADDLE_R, FIELD.x + FIELD.w - PADDLE_R)
  const ny = clamp(y, FIELD.y + PADDLE_R, FIELD.y + FIELD.h - PADDLE_R)
  if (dt > 0) {
    model.paddle.vx = (nx - model.paddle.x) / dt
    model.paddle.vy = (ny - model.paddle.y) / dt
  }
  model.paddle.x = nx
  model.paddle.y = ny
  return model
}

/** 손을 뗐을 때 — 채는 멈춘 것으로 본다(속도가 남아 있으면 다음 충돌이 엉뚱해진다). */
export function releasePaddle(model) {
  model.paddle.vx = 0
  model.paddle.vy = 0
  return model
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * 한 프레임 진행. dt는 초 단위.
 *
 * 순서가 중요하다: 전기력 → 감쇠 → 이동 → 벽 충돌 → 채 충돌.
 * 채 충돌을 마지막에 두어야 겹친 상태로 프레임이 끝나지 않는다.
 */
export function stepHockey(model, dt) {
  if (!(dt > 0)) return model
  const step = Math.min(dt, 0.033) // 탭 전환 등으로 프레임이 크게 튀면 물리가 폭발한다
  const { puck, paddle } = model

  // 1) 전기력 — 같은 부호면 밀고, 다른 부호면 끈다
  const dx = puck.x - paddle.x
  const dy = puck.y - paddle.y
  const dist = Math.max(MIN_DIST, Math.hypot(dx, dy))
  const product = model.paddleCharge * model.puckCharge
  if (product !== 0) {
    // product > 0 (같은 부호) → 채에서 멀어지는 방향(+), < 0 → 가까워지는 방향(−)
    const magnitude = (FORCE_K * Math.sign(product)) / (dist * dist)
    puck.vx += (dx / dist) * magnitude * step
    puck.vy += (dy / dist) * magnitude * step
  }

  // 2) 감쇠
  const decay = Math.exp(-DAMPING * step)
  puck.vx *= decay
  puck.vy *= decay

  const speed = Math.hypot(puck.vx, puck.vy)
  if (speed > MAX_SPEED) {
    puck.vx = (puck.vx / speed) * MAX_SPEED
    puck.vy = (puck.vy / speed) * MAX_SPEED
  }

  // 3) 이동
  puck.x += puck.vx * step
  puck.y += puck.vy * step

  // 4) 벽 — 사방이 막혀 있어 화면 밖으로 나가지 않는다
  const minX = FIELD.x + PUCK_R
  const maxX = FIELD.x + FIELD.w - PUCK_R
  const minY = FIELD.y + PUCK_R
  const maxY = FIELD.y + FIELD.h - PUCK_R
  if (puck.x < minX) {
    puck.x = minX
    puck.vx = Math.abs(puck.vx) * RESTITUTION
  } else if (puck.x > maxX) {
    puck.x = maxX
    puck.vx = -Math.abs(puck.vx) * RESTITUTION
  }
  if (puck.y < minY) {
    puck.y = minY
    puck.vy = Math.abs(puck.vy) * RESTITUTION
  } else if (puck.y > maxY) {
    puck.y = maxY
    puck.vy = -Math.abs(puck.vy) * RESTITUTION
  }

  // 5) 채와의 충돌 — 끌어당기는 조합에서는 퍽이 채에 붙어버리므로 물리적으로 막아준다.
  //    (전기력만 있으면 퍽이 채 안으로 파고들어 "닿았는데 통과한다"처럼 보인다.)
  resolvePaddleCollision(model)
  return model
}

function resolvePaddleCollision(model) {
  const { puck, paddle } = model
  let dx = puck.x - paddle.x
  let dy = puck.y - paddle.y
  let dist = Math.hypot(dx, dy)
  const minDist = PUCK_R + PADDLE_R
  if (dist >= minDist) return

  if (dist === 0) {
    // 정확히 겹친 극단적 경우 — 방향을 하나 정해준다
    dx = 1
    dy = 0
    dist = 1
  }
  const nx = dx / dist
  const ny = dy / dist

  // 겹친 만큼 밀어내되, 채는 손가락이 잡고 있으므로 퍽만 움직인다
  puck.x = paddle.x + nx * minDist
  puck.y = paddle.y + ny * minDist

  // 채 기준 상대속도의 법선 성분만 뒤집는다(접선 성분은 미끄러지듯 유지)
  const rvx = puck.vx - paddle.vx
  const rvy = puck.vy - paddle.vy
  const normal = rvx * nx + rvy * ny
  if (normal < 0) {
    const j = -(1 + RESTITUTION) * normal
    puck.vx += j * nx
    puck.vy += j * ny
  }
  // 채가 움직이는 중이면 그 속도를 퍽에 얹어준다 — 실제로 쳐서 날리는 느낌
  puck.vx += paddle.vx * 0.35
  puck.vy += paddle.vy * 0.35
  return model
}

/** 지금 채와 퍽 사이에 작용하는 힘의 종류 — 화살표를 그릴지 판단할 때만 쓴다. */
export function hockeyForceKind(model) {
  return forceBetween(model.paddleCharge, model.puckCharge)
}
