// 정전기 유도 시뮬레이터의 순수 로직 — DOM을 모른다. test.html에서 그대로 검증한다.
//
// 이 시뮬레이터가 반드시 지켜야 하는 교육적 사실:
//   1) 유도에서는 전하가 **새로 생기지 않는다** — 물체 안에서 위치만 옮겨간다.
//      그래서 금속 전체의 알짜 전하는 언제나 0이다.
//   2) 옮겨 다니는 것은 **자유 전자뿐**이다. 그래서 **도체에서만** 유도가 일어난다.
//   3) 대전체가 (+)든 (−)든, 가까운 쪽은 **항상 반대 전하**가 되므로 **항상 끌린다**.
//      (이게 학생들이 가장 많이 놓치는 지점이라, 부호를 바꿔가며 확인하게 만든다.)

export const CONDUCTOR = 'conductor'
export const INSULATOR = 'insulator'

/** 물체 안에 그려 넣을 전하 쌍의 개수(=자유 전자 후보의 개수). */
export const CHARGE_PAIRS = 6

/** 막대가 이만큼(0~1의 근접도) 가까워야 유도가 눈에 띄게 일어난다고 본다. */
export const NEAR_THRESHOLD = 0.15

export function createModel() {
  return {
    /** 대전체(막대)의 전하: +1 또는 −1 */
    rodCharge: -1,
    /** 막대의 근접도. 0 = 아주 멀리, 1 = 물체에 거의 닿음 */
    proximity: 0,
    /** 물체 종류 — 도체(금속)에서만 자유 전자가 이동한다 */
    material: CONDUCTOR,
    /** 검전기 모드에서 쓰는, 미리 대전시켜 둔 전하(0이면 중성 상태의 검전기) */
    preCharge: 0,
  }
}

export function setRodCharge(model, charge) {
  model.rodCharge = charge >= 0 ? 1 : -1
  return model
}

export function setProximity(model, p) {
  model.proximity = Math.max(0, Math.min(1, p))
  return model
}

export function setMaterial(model, material) {
  model.material = material === INSULATOR ? INSULATOR : CONDUCTOR
  return model
}

export function setPreCharge(model, charge) {
  model.preCharge = charge
  return model
}

/**
 * 유도로 한쪽에 몰린 전자의 개수(0 ~ CHARGE_PAIRS).
 * 부도체는 자유 전자가 없으므로 항상 0이다 — 이 한 줄이 도체/부도체 비교의 전부다.
 */
export function shiftedElectrons(model) {
  if (model.material !== CONDUCTOR) return 0
  if (model.proximity < NEAR_THRESHOLD) return 0
  // 가까울수록 더 많이 몰린다(근접도를 개수로 환산)
  const t = (model.proximity - NEAR_THRESHOLD) / (1 - NEAR_THRESHOLD)
  return Math.round(t * CHARGE_PAIRS)
}

/**
 * 대전체와 **가까운 쪽** 끝이 띠는 알짜 전하.
 * (−)막대가 오면 전자가 밀려나 가까운 쪽은 (+), (+)막대가 오면 전자가 끌려와 가까운 쪽은 (−).
 * 즉 부호는 **언제나 막대와 반대**다.
 */
export function nearSideCharge(model) {
  return -Math.sign(model.rodCharge) * shiftedElectrons(model)
}

/** 대전체와 **먼 쪽** 끝이 띠는 알짜 전하 — 가까운 쪽과 반대(합이 0이어야 하므로). */
export function farSideCharge(model) {
  return -nearSideCharge(model)
}

/**
 * 물체 **전체**의 알짜 전하. 유도만으로는 언제나 0이다.
 * (검전기 모드에서 미리 대전시켜 둔 경우에는 그 값이 그대로 남는다.)
 */
export function totalCharge(model) {
  return model.preCharge
}

export const ATTRACT = 'attract'
export const REPEL = 'repel'
export const NONE = 'none'

/**
 * 막대와 물체 사이에 작용하는 힘.
 *
 * 중성 도체라도 **가까운 쪽이 항상 반대 전하**가 되므로 끌린다 — 유도의 핵심 결론이다.
 * 부도체는 자유 전자가 없어 이 시뮬레이터에서는 힘을 표시하지 않는다(실제로는 분극으로
 * 약하게 끌리지만, 중학교 수준에서 다루는 범위를 넘고 도체/부도체 대비를 흐린다).
 */
export function forceOnObject(model) {
  if (model.proximity < NEAR_THRESHOLD) return NONE
  if (model.material !== CONDUCTOR) return NONE
  // 미리 대전된 물체라면 알짜 전하끼리의 힘이 우선한다(검전기 극성 판별의 근거)
  if (model.preCharge !== 0) {
    return Math.sign(model.preCharge) === Math.sign(model.rodCharge) ? REPEL : ATTRACT
  }
  return ATTRACT
}

/**
 * 검전기 금속박이 벌어진 정도(0~1).
 *
 * - 중성 검전기: 막대를 가까이 하면 금속박 쪽(먼 쪽)에 같은 종류 전하가 몰려 벌어진다.
 * - 이미 대전된 검전기: **같은 극성**의 막대가 오면 전하가 금속박으로 더 몰려 **더 벌어지고**,
 *   **반대 극성**이면 전하가 위로 끌려 올라가 **오므라든다**. (JavaLab 검전기의 핵심 기능)
 */
export function foilSpread(model) {
  const induced = shiftedElectrons(model) / CHARGE_PAIRS // 0~1
  if (model.preCharge === 0) return induced

  const base = Math.min(1, Math.abs(model.preCharge) / CHARGE_PAIRS)
  const same = Math.sign(model.preCharge) === Math.sign(model.rodCharge)
  const delta = induced * 0.8
  return Math.max(0, Math.min(1, same ? base + delta : base - delta))
}

/** 검전기 판정 문구용 — 벌어짐이 늘었는지 줄었는지 */
export function foilTrend(model) {
  if (model.preCharge === 0) return shiftedElectrons(model) > 0 ? 'open' : 'flat'
  if (shiftedElectrons(model) === 0) return 'flat'
  return Math.sign(model.preCharge) === Math.sign(model.rodCharge) ? 'wider' : 'narrower'
}

export function chargeSignText(charge) {
  if (charge > 0) return '(+)전기'
  if (charge < 0) return '(−)전기'
  return '중성'
}
