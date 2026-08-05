// 마찰 전기 시뮬레이터의 순수 로직 — DOM을 전혀 모른다. test.html에서 그대로 검증한다.
//
// 이 시뮬레이터가 반드시 지켜야 하는 교육적 사실 두 가지를 모델 수준에서 강제한다.
//   1) 마찰로 옮겨가는 것은 **전자뿐**이다. 원자핵(양성자)은 절대 움직이지 않는다.
//   2) 두 물체의 전자 수 **합은 언제나 일정**하다 — 전하는 새로 생기지 않고 옮겨갈 뿐이다.
// 그래서 상태를 "각 물체의 전자 수"로 따로 들고 있지 않고, **옮겨간 개수(transferred) 하나**로만
// 표현한다. 이렇게 하면 합이 어긋나는 상태 자체를 만들 수 없다.

/** 각 물체가 처음에 가지고 있는 전자 수(=양성자 수). 이 상태에서는 전기적으로 중성이다. */
export const BASE_ELECTRONS = 8

/** 문질러서 옮길 수 있는 전자의 최대 개수. 너무 많으면 기호가 빽빽해 읽기 어렵다. */
export const MAX_TRANSFER = 6

/**
 * 물체 쌍. `donor`가 전자를 **잃는**(→ (+)전기를 띠는) 쪽이다.
 *
 * 쌍마다 어느 쪽이 (+)가 되는지 달라지는 것이 이 시뮬레이터의 핵심 관찰 거리다 —
 * "빨대는 항상 (−)" 같은 오개념을 막고, 대전 결과가 **상대적**임을 보여준다.
 */
export const PAIRS = [
  {
    id: 'straw',
    label: '빨대 + 털가죽',
    a: { name: '빨대', color: '#dc6803' },
    b: { name: '털가죽', color: '#8b5cf6' },
    donor: 'b', // 털가죽이 전자를 잃는다 → 털가죽 (+), 빨대 (−)
  },
  {
    id: 'glass',
    label: '유리막대 + 비단',
    a: { name: '유리막대', color: '#0891b2' },
    b: { name: '비단', color: '#db2777' },
    donor: 'a', // 유리막대가 전자를 잃는다 → 유리막대 (+), 비단 (−)
  },
]

export function getPair(pairId) {
  return PAIRS.find((p) => p.id === pairId) ?? PAIRS[0]
}

export function createModel(pairId = PAIRS[0].id) {
  return { pairId, transferred: 0 }
}

/** 문지르기 — 옮겨간 전자 수를 늘린다. 최대치를 넘지 않는다. */
export function rub(model, count = 1) {
  model.transferred = Math.max(0, Math.min(MAX_TRANSFER, model.transferred + count))
  return model
}

export function reset(model) {
  model.transferred = 0
  return model
}

export function setPair(model, pairId) {
  model.pairId = getPair(pairId).id
  model.transferred = 0 // 쌍을 바꾸면 처음부터 다시 문질러야 한다
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

export function forceLabel(kind) {
  if (kind === REPEL) return '서로 밀어낸다'
  if (kind === ATTRACT) return '서로 끌어당긴다'
  return '힘이 나타나지 않는다'
}

/**
 * 한글 조사 '(으)로'를 앞말의 받침에 맞춰 고른다 — "빨대으로"처럼 어색하게 나오는 걸 막는다.
 * 받침이 없거나 'ㄹ' 받침이면 '로', 그 밖의 받침이면 '으로'.
 */
export function euroParticle(word) {
  const last = word.charCodeAt(word.length - 1) - 0xac00
  if (last < 0 || last > 11171) return '로' // 한글이 아니면 기본형
  const finalConsonant = last % 28
  return finalConsonant === 0 || finalConsonant === 8 ? '로' : '으로'
}

// ── 힘 관찰 모드의 상태 ───────────────────────────────────────────────

/** 힘 관찰 모드는 두 물체의 전하를 교사·학생이 직접 골라 조합해 보는 화면이다. */
export function createForceModel() {
  return { left: -1, right: -1 } // 기본값: 둘 다 (−) → 밀어냄
}

export function setForceCharge(forceModel, side, charge) {
  forceModel[side] = charge
  return forceModel
}

export function forceKind(forceModel) {
  return forceBetween(forceModel.left, forceModel.right)
}
