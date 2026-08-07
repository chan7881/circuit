// 정전기 유도 시뮬레이터의 순수 로직 — DOM을 모른다. test.html에서 그대로 검증한다.
//
// 이 시뮬레이터가 반드시 지켜야 하는 교육적 사실:
//   1) 유도에서는 전하가 **새로 생기지 않는다** — 물체 안에서 위치만 옮겨간다.
//      그래서 (접촉하지 않는 한) 금속 전체의 알짜 전하는 언제나 0이다.
//   2) 옮겨 다니는 것은 **자유 전자뿐**이다.
//   3) 대전체가 (+)든 (−)든, 가까운 쪽은 **항상 반대 전하**가 되므로 **항상 끌린다**.
//      (이게 학생들이 가장 많이 놓치는 지점이라, 부호를 바꿔가며 확인하게 만든다.)
//   4) 그런데 **닿아버리면** 이야기가 달라진다 — 전하가 실제로 옮겨와 캔이 막대와 **같은**
//      전기를 띠고, 그때부터는 밀려난다. 유도와 접촉 대전을 가르는 결정적 장면이다.
//   5) 닿아서 옮겨갈 때 **대전체가 가진 전하도 그만큼 줄어든다**. 전하는 어디서 생기는 게
//      아니라 옮겨 다닐 뿐이기 때문이다. 대전체의 전하 개수를 고정해 두면 "전하가 복사된다"는
//      오개념을 심는다(2026-08-07 사용자 지적) — 그래서 막대 전하도 개수로 들고 다닌다.
//
// ⚠️ 관찰 결과를 말로 풀어주는 함수는 두지 않는다. 무엇이 일어났는지는 학생이 화면을 보고
//    스스로 말해야 한다(2026-08-06 사용자 피드백 — 설명 문구 일괄 삭제).

/** 물체 안에 그려 넣을 전하 쌍의 개수(=자유 전자 후보의 개수). */
export const CHARGE_PAIRS = 6

/** 대전체가 처음에 가지고 있는 전하의 개수. 닿아서 나눠주면 이보다 줄어든다. */
export const ROD_FULL_CHARGES = 6

/** 이 거리(논리 px)보다 멀면 유도가 일어나지 않는다고 본다. */
export const FAR_GAP = 220

/**
 * 실험대의 좌우 막이 — 캔은 이 안에서만 굴러다닌다.
 * 왼쪽을 실험대 끝까지 넓힌 이유: 막대는 학생 손에서 **실험대 밖에서 들어오는** 물건이라
 * 막이가 막대까지 가로막으면 "왜 더 못 가져가지?"가 된다. 캔만 막으면 충분하다.
 */
export const TRACK = { left: 36, right: 604 }

export const CAN_W = 120
export const CAN_H = 150
export const ROD_W = 26
export const ROD_H = 150

/** 접촉했을 때 막대에서 캔으로 옮겨오는 전하의 크기 */
export const CONTACT_AMOUNT = 3

/** 검전기 모드에서 금속판의 왼쪽 면 x — 캔과 달리 움직이지 않으므로 상수다. */
export const SCOPE_PLATE_LEFT = 330

export function createModel() {
  return {
    /** 'can'(금속 캔) | 'scope'(검전기) — 막대와 물체 사이 거리를 어디서 재는지가 달라진다 */
    mode: 'can',
    /**
     * 대전체(막대)가 지금 가진 전하 — **부호가 붙은 개수**다(예: −6).
     * 부호는 (+)/(−) 전기, 크기는 화면에 그려지는 전하 표시의 개수.
     * 닿아서 물체에 나눠주면 그만큼 **줄어든다**(전하 보존).
     */
    rodCharge: -ROD_FULL_CHARGES,
    /** 막대 **오른쪽 끝**의 x 좌표. 학생이 드래그해서 옮긴다. */
    rodTipX: 44,
    /** 캔의 중심 x와 속도 — 실제로 굴러다닌다 */
    can: { x: 420, v: 0 },
    /** 막대에 닿아서 실제로 옮겨온 전하. 0이 아니면 더 이상 중성이 아니다. */
    contactCharge: 0,
    /** 검전기 모드에서 쓰는, 미리 대전시켜 둔 전하(0이면 중성 상태의 검전기) */
    preCharge: 0,
  }
}

/** 막대의 전기 종류를 정한다. 종류를 바꾸면 새 막대를 든 셈이라 전하량도 가득 찬 상태가 된다. */
export function setRodCharge(model, charge) {
  model.rodCharge = (charge >= 0 ? 1 : -1) * ROD_FULL_CHARGES
  return model
}

/** 막대에 남은 전하의 비율(0~1). 나눠주고 나면 유도도 그만큼 약해진다. */
export function rodStrength(model) {
  return Math.min(1, Math.abs(model.rodCharge) / ROD_FULL_CHARGES)
}

export function setPreCharge(model, charge) {
  model.preCharge = charge
  return model
}

/**
 * 막대를 끌어다 놓는다. 두 모드 모두 물체에 **닿게 할 수 있다** — 닿는 순간 접촉 대전이
 * 일어나고, 그때부터 결과가 달라지는 것이 이 시뮬레이터에서 가장 중요한 장면이다.
 */
export function setRodTipX(model, x) {
  const max = model.mode === 'scope' ? SCOPE_PLATE_LEFT : TRACK.right
  model.rodTipX = Math.max(ROD_W + 4, Math.min(max, x))
  return model
}

export function canLeft(model) {
  return model.can.x - CAN_W / 2
}

export function canRight(model) {
  return model.can.x + CAN_W / 2
}

/** 지금 모드에서 막대가 다가가는 물체의 왼쪽 면 x */
export function objectLeft(model) {
  return model.mode === 'scope' ? SCOPE_PLATE_LEFT : canLeft(model)
}

/** 막대 끝과 물체 왼쪽 면 사이의 빈틈. 0 이하면 닿은 것이다. */
export function gap(model) {
  return objectLeft(model) - model.rodTipX
}

export function setMode(model, mode) {
  model.mode = mode === 'scope' ? 'scope' : 'can'
  // 모드를 바꾸면 막대를 멀리 물리고 대전 상태도 되돌린다 — 앞 모드의 결과가 섞이면
  // 학생이 무엇 때문에 그렇게 됐는지 알 수 없다. 막대의 전하량도 가득 찬 상태로 되돌린다.
  model.rodTipX = 44
  model.contactCharge = 0
  model.preCharge = 0
  model.rodCharge = Math.sign(model.rodCharge || -1) * ROD_FULL_CHARGES
  return model
}

/** 0(아주 멀리) ~ 1(닿음). 유도의 세기를 정하는 값이다. */
export function proximity(model) {
  const g = gap(model)
  if (g >= FAR_GAP) return 0
  if (g <= 0) return 1
  return 1 - g / FAR_GAP
}

/**
 * 유도로 한쪽에 몰린 전자의 개수(0 ~ CHARGE_PAIRS).
 * 가까울수록, 그리고 **막대에 남은 전하가 많을수록** 많이 몰린다.
 */
export function shiftedElectrons(model) {
  return Math.round(proximity(model) * rodStrength(model) * CHARGE_PAIRS)
}

/**
 * 대전체와 **가까운 쪽** 끝이 띠는 알짜 전하.
 * (−)막대가 오면 전자가 밀려나 가까운 쪽은 (+), (+)막대가 오면 전자가 끌려와 가까운 쪽은 (−).
 * 즉 부호는 **언제나 막대와 반대**다.
 */
export function nearSideCharge(model) {
  return -Math.sign(model.rodCharge) * shiftedElectrons(model)
}

/** 대전체와 **먼 쪽** 끝이 띠는 알짜 전하 — 가까운 쪽과 반대(유도만으로는 합이 0이므로). */
export function farSideCharge(model) {
  return -nearSideCharge(model)
}

/**
 * 물체 **전체**의 알짜 전하.
 * 유도만으로는 0이다. 막대에 닿아 전하가 옮겨온 뒤에는 그 값이 남는다.
 */
export function totalCharge(model) {
  return model.contactCharge
}

export const ATTRACT = 'attract'
export const REPEL = 'repel'
export const NONE = 'none'

/**
 * 막대와 캔 사이에 작용하는 힘.
 *
 * - 이미 접촉해서 대전된 캔: 막대와 **같은** 전기를 띠므로 밀려난다.
 * - 중성 도체: 가까운 쪽이 **항상 반대 전하**가 되므로 끌린다 — 유도의 핵심 결론이다.
 * - 부도체: 자유 전자가 없어 이 시뮬레이터에서는 힘을 표시하지 않는다(실제로는 분극으로
 *   약하게 끌리지만, 중학교 수준을 넘고 도체/부도체 대비를 흐린다).
 */
export function forceOnObject(model) {
  if (proximity(model) <= 0) return NONE
  if (model.contactCharge !== 0) {
    return Math.sign(model.contactCharge) === Math.sign(model.rodCharge) ? REPEL : ATTRACT
  }
  return ATTRACT
}

/**
 * 막대가 물체에 닿았을 때 옮겨가는 전하를 계산한다 — **전하 보존**이 지켜지는 유일한 지점이라
 * 캔과 검전기가 이 함수 하나를 같이 쓴다. 옮겨간 만큼 막대에서 정확히 빠져나간다.
 *
 * (−)막대면 전자가 막대 → 물체로 가서 둘 다 (−)가 되고, (+)막대면 전자가 물체 → 막대로
 * 가서 둘 다 (+)가 된다. 어느 쪽이든 **물체는 막대와 같은 전기**를 띠고, 막대는 그만큼 약해진다.
 */
function transferOnContact(model) {
  const sign = Math.sign(model.rodCharge)
  if (sign === 0) return 0
  // 막대에 남은 것보다 많이 줄 수는 없다
  const amount = Math.min(CONTACT_AMOUNT, Math.abs(model.rodCharge))
  if (amount <= 0) return 0
  model.rodCharge -= sign * amount
  return sign * amount
}

// ── 캔의 움직임 ───────────────────────────────────────────────────────
//
// 예전에는 캔이 제자리에서 살짝 흔들리기만 했다. "끌려온다"를 눈으로 보려면 실제로 굴러와야
// 한다(2026-08-06 피드백). 정확한 쿨롱 힘일 필요는 없고, 가까울수록 세지고 벽에 막히는
// 정도면 중학생이 관찰하기에 충분하다.

const CAN_FORCE_K = 90000
const CAN_DAMPING = 2.2
const CAN_MAX_SPEED = 420
const MIN_GAP_FOR_FORCE = 12 // 힘이 무한대로 튀지 않게

/**
 * 한 프레임 진행. 닿으면 접촉 대전이 일어나고, 벽에 부딪히면 멈춘다.
 * 접촉이 일어났는지를 돌려주므로 호출부가 그 순간에만 효과음·애니메이션을 넣을 수 있다.
 */
export function stepCan(model, dt) {
  if (!(dt > 0)) return false
  const step = Math.min(dt, 0.033)
  const kind = forceOnObject(model)
  const g = gap(model)

  if (kind !== NONE) {
    const d = Math.max(MIN_GAP_FOR_FORCE, g)
    const dir = kind === ATTRACT ? -1 : 1 // 끌리면 왼쪽(막대 쪽), 밀리면 오른쪽
    model.can.v += (dir * CAN_FORCE_K) / (d * d) * step
  }

  model.can.v *= Math.exp(-CAN_DAMPING * step)
  model.can.v = Math.max(-CAN_MAX_SPEED, Math.min(CAN_MAX_SPEED, model.can.v))
  model.can.x += model.can.v * step

  // 접촉 — 캔 왼쪽 면이 막대 끝에 닿으면 전하가 실제로 옮겨온다(막대에서는 그만큼 빠진다).
  let touched = false
  if (gap(model) <= 0) {
    model.can.x = model.rodTipX + CAN_W / 2 // 파고들지 못하게 밀어낸다
    if (model.can.v < 0) model.can.v = 0
    if (model.contactCharge === 0) {
      const moved = transferOnContact(model)
      if (moved !== 0) {
        model.contactCharge = moved
        touched = true
      }
    }
  }

  // 벽 — 실험대 밖으로는 못 나간다
  if (canLeft(model) < TRACK.left) {
    model.can.x = TRACK.left + CAN_W / 2
    if (model.can.v < 0) model.can.v = 0
  } else if (canRight(model) > TRACK.right) {
    model.can.x = TRACK.right - CAN_W / 2
    if (model.can.v > 0) model.can.v = 0
  }
  return touched
}

export function resetCan(model) {
  model.can.x = 420
  model.can.v = 0
  model.contactCharge = 0
  model.rodTipX = 44
  // 막대도 새것으로 — 나눠준 전하를 되돌리지 않으면 몇 번 하다가 막대가 바닥나 버린다.
  model.rodCharge = Math.sign(model.rodCharge || -1) * ROD_FULL_CHARGES
  return model
}

// ── 검전기 ────────────────────────────────────────────────────────────

/**
 * 검전기도 막대가 금속판에 **닿으면** 전하가 옮겨와 그대로 대전된다.
 * 캔과 달리 검전기는 움직이지 않으므로 결과가 금속박에 남는다 — 막대를 치워도 금속박이
 * 벌어진 채로 있는 것이 접촉 대전의 증거다(유도만 걸렸을 때는 치우면 닫힌다).
 * 옮겨온 전하는 preCharge에 넣는다 — '미리 대전된 검전기'와 물리적으로 같은 상태다.
 *
 * 접촉이 방금 일어났으면 true를 돌려준다(호출부가 조작 칩을 맞춰 그릴 수 있게).
 */
export function stepScope(model) {
  if (model.mode !== 'scope') return false
  if (gap(model) > 0) return false
  if (model.preCharge !== 0) return false
  const moved = transferOnContact(model)
  if (moved === 0) return false
  model.preCharge = moved
  return true
}

/**
 * 검전기 금속박이 벌어진 정도(0~1).
 *
 * - 중성 검전기: 막대를 가까이 하면 금속박 쪽(먼 쪽)에 같은 종류 전하가 몰려 벌어진다.
 * - 이미 대전된 검전기: **같은 극성**의 막대가 오면 전하가 금속박으로 더 몰려 **더 벌어지고**,
 *   **반대 극성**이면 전하가 위로 끌려 올라가 **오므라든다**. (JavaLab 검전기의 핵심 기능)
 *
 * ⚠️ 같은 극성으로 다가가는 동안에는 **절대로 도로 오므라들면 안 된다.** 예전에는 유도 몫에
 *    임의의 0.8을 곱해 놓아서, 닿는 순간 벌어짐이 1.00 → 0.90으로 **툭 줄었다** — 화면에서는
 *    "가까이 갔더니 금속박이 닫힌다"로 보여 정확히 반대되는 결론을 가르친다(2026-08-07
 *    사용자 지적). 0.8을 없애니 닿기 직전(유도 1.0)과 닿은 직후(가진 전하 0.5 + 유도 0.5)가
 *    자연스럽게 이어진다.
 */
export function foilSpread(model) {
  // 유도로 금속박에 몰리는 정도 — 가까울수록, 막대가 셀수록 크다.
  // 개수(shiftedElectrons)로 재면 계단처럼 툭툭 끊겨서, 여기서는 이어지는 값을 쓴다.
  const induced = proximity(model) * rodStrength(model)
  if (model.preCharge === 0) return Math.max(0, Math.min(1, induced))

  const base = Math.min(1, Math.abs(model.preCharge) / CHARGE_PAIRS)
  const same = Math.sign(model.preCharge) === Math.sign(model.rodCharge)
  return Math.max(0, Math.min(1, base + (same ? induced : -induced)))
}

/** 검전기 금속박이 지금 어떤 상태인지 — 화면 판정이 아니라 테스트에서 규칙을 고정하려고 둔다. */
export function foilTrend(model) {
  if (model.preCharge === 0) return shiftedElectrons(model) > 0 ? 'open' : 'flat'
  if (shiftedElectrons(model) === 0) return 'flat'
  return Math.sign(model.preCharge) === Math.sign(model.rodCharge) ? 'wider' : 'narrower'
}

/**
 * 유도로 옮겨간 전자가 **어느 쪽으로** 가는지.
 * (−)막대면 밀려나 먼 쪽(+1), (+)막대면 끌려와 가까운 쪽(−1).
 * 그리기(render.js)가 전자를 어디로 옮겨 그릴지 정할 때 쓴다.
 */
export function electronDrift(model) {
  return model.rodCharge < 0 ? 1 : -1
}
