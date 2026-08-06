// 「우리 집 전기 사용」 시뮬레이터의 순수 로직 — DOM을 모른다. test.html에서 그대로 검증한다.
//
// 성취기준 [9과14-03] 해설이 "소비 전력은 **정량 계산보다 에너지 전환 관점으로**, 효율적
// 전기 사용의 중요성 인식"이라고 못 박고 있다. 그래서 이 시뮬레이터는 학생에게 계산을
// 시키지 않는다 — 숫자는 시뮬이 내주고, 학생은 **무엇이 크더라·왜 그럴까**를 관찰한다.
//
// ⚠️ 관찰 결과를 말로 풀어주는 함수는 두지 않는다. "열을 내는 기구가 전기를 많이 쓴다" 같은
//    문장은 학생이 표를 보고 스스로 찾아내야 할 결론이다(2026-08-06 사용자 피드백).

/**
 * 전기 기구 목록.
 *
 * `watt`는 실제 가정용 기기의 대표값에 가깝게 잡았다(정확한 제품 사양이 아니라 비교용 어림값).
 * `standby`는 꺼도 흘러나가는 대기 전력 — 코드를 꽂아만 둬도 쓰이는 전기다. 리모컨으로 끄는
 * 기기와 어댑터가 달린 기기에만 있고, 스위치로 완전히 끊는 기기(전등·선풍기·다리미)는 0이다.
 *
 * `energy`는 '주로 어떤 에너지로 바뀌는가'다. **기본 화면에서는 감춘다** — 학습지에서 학생이
 * 직접 채워야 하는 칸이라 처음부터 보여주면 답을 알려주는 꼴이 된다('에너지 전환 보기' 토글).
 */
export const APPLIANCES = [
  { id: 'led', name: 'LED 전등', watt: 8, standby: 0, energy: '빛' },
  { id: 'incandescent', name: '백열전구', watt: 60, standby: 0, energy: '빛과 열' },
  { id: 'charger', name: '휴대폰 충전기', watt: 5, standby: 1, energy: '화학' },
  { id: 'fan', name: '선풍기', watt: 50, standby: 0, energy: '운동' },
  { id: 'fridge', name: '냉장고', watt: 40, standby: 0, energy: '운동과 열' },
  { id: 'tv', name: 'TV', watt: 100, standby: 2, energy: '빛과 소리' },
  { id: 'iron', name: '전기다리미', watt: 1200, standby: 0, energy: '열' },
  { id: 'aircon', name: '에어컨', watt: 1800, standby: 3, energy: '열과 운동' },
]

/**
 * 전기요금·온실가스 환산 계수.
 * 주택용 전기요금은 실제로는 누진 구간이 있지만, 이 화면의 목적은 요금을 정확히 맞히는 게
 * 아니라 "무엇을 켜면 확 늘어나는지" 비교하는 것이라 평균값 하나로 단순화했다.
 */
export const WON_PER_KWH = 130
/** 우리나라 전력 배출계수 어림값(kgCO₂/kWh) */
export const GRAM_CO2_PER_KWH = 460

export function createModel() {
  return {
    /** 켜져 있는 기구 id 집합 */
    on: new Set(['led', 'fridge']),
    /** 대기 전력을 계산에 넣을지 — 껐는데도 새는 전기를 눈으로 보여주는 토글 */
    countStandby: false,
  }
}

export function getAppliance(id) {
  return APPLIANCES.find((a) => a.id === id)
}

export function isOn(model, id) {
  return model.on.has(id)
}

export function toggle(model, id) {
  if (model.on.has(id)) model.on.delete(id)
  else model.on.add(id)
  return model
}

export function allOff(model) {
  model.on.clear()
  return model
}

export function setStandby(model, value) {
  model.countStandby = !!value
  return model
}

/** 기구 하나가 지금 쓰고 있는 전력(W) — 꺼져 있어도 대기 전력이 있으면 그만큼 쓴다. */
export function applianceWatt(model, id) {
  const a = getAppliance(id)
  if (!a) return 0
  if (isOn(model, id)) return a.watt
  return model.countStandby ? a.standby : 0
}

/** 지금 이 집이 쓰고 있는 전력의 합(W) */
export function totalWatt(model) {
  return APPLIANCES.reduce((sum, a) => sum + applianceWatt(model, a.id), 0)
}

/** 꺼져 있는데도 새어 나가는 전력의 합(W) — '대기 전력' 토글을 켰을 때만 0이 아니다 */
export function standbyWatt(model) {
  if (!model.countStandby) return 0
  return APPLIANCES.reduce((sum, a) => sum + (isOn(model, a.id) ? 0 : a.standby), 0)
}

/** 1시간 동안 썼을 때의 전력량(kWh) */
export function kwhPerHour(model) {
  return totalWatt(model) / 1000
}

/** 1시간 요금(원). 정수로 반올림해 돌려준다. */
export function wonPerHour(model) {
  return Math.round(kwhPerHour(model) * WON_PER_KWH)
}

/** 1시간에 나오는 이산화 탄소(g) */
export function gramCo2PerHour(model) {
  return Math.round(kwhPerHour(model) * GRAM_CO2_PER_KWH)
}

/** 이 집이 한 번에 쓸 수 있는 최대치(모든 기구를 켰을 때) — 막대 그래프의 기준으로 쓴다 */
export function maxWatt() {
  return APPLIANCES.reduce((sum, a) => sum + a.watt, 0)
}

// ── 전구 비교 ─────────────────────────────────────────────────────────
//
// 같은 전기 에너지를 넣었을 때 얼마만큼이 빛이 되고 얼마만큼이 열로 빠져나가는지 비교한다.
// 교과서 그림 VII-10과 같은 이야기다. 비율은 대표적인 어림값이다.

export const BULBS = [
  { id: 'incandescent', name: '백열전구', lightRatio: 0.05 },
  { id: 'led', name: 'LED 전구', lightRatio: 0.4 },
]

/** 넣은 전기 에너지 중 빛으로 바뀌는 몫(0~1) */
export function lightShare(bulbId) {
  return BULBS.find((b) => b.id === bulbId)?.lightRatio ?? 0
}

/** 열로 빠져나가는 몫(0~1). 넣은 에너지는 사라지지 않으므로 빛과 열의 합은 언제나 1이다. */
export function heatShare(bulbId) {
  return 1 - lightShare(bulbId)
}
