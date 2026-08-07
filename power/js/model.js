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
 * `standby`는 꺼도 흘러나가는 대기 전력 — 코드를 꽂아만 둬도 쓰이는 전기다.
 * **모든 기구에 있다**(2026-08-07 사용자 지시). 코드를 뽑지 않는 한 크든 작든 새어 나가는데,
 * 일부만 0으로 두면 "이 기구는 꽂아 둬도 전기를 안 쓴다"는 오해를 준다. 크기는 기기 성격에
 * 맞게 다르게 잡았다 — 리모컨·어댑터가 달린 기기가 크고, 스위치로 끊는 기기는 작다.
 *
 * `energy`는 '주로 어떤 에너지로 바뀌는가'다. **기본 화면에서는 감춘다** — 학습지에서 학생이
 * 직접 채워야 하는 칸이라 처음부터 보여주면 답을 알려주는 꼴이 된다('에너지 전환 보기' 토글).
 */
export const APPLIANCES = [
  { id: 'led', name: 'LED 전등', watt: 8, standby: 0.3, energy: '빛' },
  { id: 'incandescent', name: '백열전구', watt: 60, standby: 0.2, energy: '빛과 열' },
  { id: 'charger', name: '휴대폰 충전기', watt: 5, standby: 1, energy: '화학' },
  { id: 'fan', name: '선풍기', watt: 50, standby: 0.8, energy: '운동' },
  { id: 'fridge', name: '냉장고', watt: 40, standby: 1.5, energy: '운동과 열' },
  { id: 'tv', name: 'TV', watt: 100, standby: 2, energy: '빛과 소리' },
  { id: 'iron', name: '전기다리미', watt: 1200, standby: 0.5, energy: '열' },
  { id: 'aircon', name: '에어컨', watt: 1800, standby: 3, energy: '열과 운동' },
]

/**
 * 요금 단가(원/kWh).
 *
 * **누진제를 일부러 반영하지 않은 평탄 단가다.** 실제 주택용 전기요금은 월 사용량이
 * 200·400 kWh를 넘을 때마다 단가가 뛰고, 여기에 기본요금·부가세·전력산업기반기금이 더 붙는다.
 * 그걸 다 넣으면 이 화면이 '요금 계산기'가 되어 버리는데, 성취기준 해설이 정량 계산을
 * 지양하라고 못 박고 있다. 그래서 단가 하나로 단순화하고, 대신 화면에 누진제를 안 넣었다는
 * 단서를 적어 학생이 실제 요금과 다르다는 것을 알게 한다(2026-08-06 사용자 결정).
 *
 * ⚠️ 학습지에서 학생이 가상의 요금제로 직접 계산해 보게 할 계획이므로, 그 단가와 이 값이
 *    어긋나면 안 된다. 학습지를 고칠 때 이 상수도 같이 맞출 것.
 */
export const WON_PER_KWH = 130

/**
 * 한 달을 몇 시간으로 볼지. "이 상태로 한 달 내내 쓰면"이 이 화면의 기준이다.
 * 1시간 기준이면 요금이 몇 원 단위로 나와 차이가 눈에 안 들어온다 — 한 달로 늘리면
 * 어떤 기구를 켜 두는 것이 얼마나 큰일인지가 숫자 크기로 바로 보인다.
 */
export const HOURS_PER_MONTH = 24 * 30

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

/**
 * 이 상태로 **1시간** 썼을 때의 전력량(kWh).
 *
 * 화면에는 이 값을 보여 준다. 한 달 전력량을 대신 보여주면 학생이 "1시간 값 × 시간"을
 * 직접 해 볼 거리가 없어진다 — 학습지에서 그 계산을 시킬 계획이라, 중간 과정을 시뮬레이터가
 * 대신 해 버리면 안 된다(2026-08-07 사용자 결정).
 */
export function kwhPerHour(model) {
  return totalWatt(model) / 1000
}

/** 이 상태로 한 달 내내(하루 24시간) 썼을 때의 전력량(kWh) — 요금 계산에만 쓴다. */
export function kwhPerMonth(model) {
  return (totalWatt(model) * HOURS_PER_MONTH) / 1000
}

/** 한 달 요금(원). 누진제는 반영하지 않는다(위 WON_PER_KWH 주석 참고). */
export function wonPerMonth(model) {
  return Math.round(kwhPerMonth(model) * WON_PER_KWH)
}

/** 이 집이 한 번에 쓸 수 있는 최대치(모든 기구를 켰을 때) — 막대 그래프의 기준으로 쓴다 */
export function maxWatt() {
  return APPLIANCES.reduce((sum, a) => sum + a.watt, 0)
}
