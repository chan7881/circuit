// model.js 검증. test.html에서 모듈로 로드되어 화면·콘솔에 PASS/FAIL을 출력한다.

import {
  APPLIANCES,
  WON_PER_KWH,
  createModel,
  getAppliance,
  isOn,
  toggle,
  allOff,
  setStandby,
  applianceWatt,
  totalWatt,
  standbyWatt,
  HOURS_PER_MONTH,
  kwhPerHour,
  kwhPerMonth,
  wonPerMonth,
  maxWatt,
} from './model.js'

const results = []
function assert(cond, label) {
  results.push({ ok: !!cond, label })
}
function eq(actual, expected, label) {
  results.push({ ok: actual === expected, label: `${label} (실제=${actual}, 기대=${expected})` })
}
function close(actual, expected, label, tol = 1e-9) {
  results.push({ ok: Math.abs(actual - expected) <= tol, label: `${label} (실제=${actual}, 기대=${expected})` })
}

// 1) 모두 끄면 0
;(function allOffIsZero() {
  const m = createModel()
  allOff(m)
  eq(totalWatt(m), 0, '모두 끄면 쓰는 전력이 0')
  eq(wonPerMonth(m), 0, '요금도 0')
})()

// 2) 켠 기구의 소비 전력이 그대로 합계에 더해진다
;(function sumsUp() {
  const m = createModel()
  allOff(m)
  toggle(m, 'fan')
  eq(totalWatt(m), getAppliance('fan').watt, '선풍기만 켜면 그 값만큼')
  toggle(m, 'iron')
  eq(totalWatt(m), getAppliance('fan').watt + getAppliance('iron').watt, '둘을 켜면 두 값의 합')
})()

// 3) 껐다 켰다가 된다
;(function toggling() {
  const m = createModel()
  allOff(m)
  eq(isOn(m, 'tv'), false, '처음엔 꺼져 있다')
  toggle(m, 'tv')
  eq(isOn(m, 'tv'), true, '누르면 켜진다')
  toggle(m, 'tv')
  eq(isOn(m, 'tv'), false, '다시 누르면 꺼진다')
})()

// 4) 대기 전력 — 껐는데도 새어 나가는 전기가 이 시뮬레이터의 관찰 거리다
;(function standby() {
  const m = createModel()
  allOff(m)
  eq(totalWatt(m), 0, '대기 전력을 안 세면 모두 꺼져 있을 때 0')
  eq(standbyWatt(m), 0, '대기 전력 합계도 0')

  setStandby(m, true)
  const expected = APPLIANCES.reduce((s, a) => s + a.standby, 0)
  eq(totalWatt(m), expected, '대기 전력을 세면 모두 꺼도 0이 아니다')
  eq(standbyWatt(m), expected, '새어 나가는 양이 따로 집계된다')
  assert(expected > 0, '대기 전력이 있는 기구가 실제로 존재한다')
})()

// 5) 켜 놓은 기구는 대기 전력을 따로 더하지 않는다(이중 계산 방지)
;(function noDoubleCount() {
  const m = createModel()
  allOff(m)
  setStandby(m, true)
  toggle(m, 'tv')
  const tv = getAppliance('tv')
  eq(applianceWatt(m, 'tv'), tv.watt, '켜져 있으면 정상 소비 전력만 센다(대기 전력을 더하지 않는다)')
  assert(standbyWatt(m) === APPLIANCES.reduce((s, a) => s + (a.id === 'tv' ? 0 : a.standby), 0), '켠 기구는 대기 전력 합계에서 빠진다')
})()

// 6) 전력량·요금이 소비 전력에 비례한다
;(function derivedValues() {
  const m = createModel()
  allOff(m)
  toggle(m, 'iron') // 1200 W
  const kwh = (1200 * HOURS_PER_MONTH) / 1000
  close(kwhPerMonth(m), kwh, `1200 W를 한 달(${HOURS_PER_MONTH}시간) 내내 쓰면 ${kwh} kWh`)
  eq(wonPerMonth(m), Math.round(kwh * WON_PER_KWH), '요금은 전력량에 비례한다')

  // 누진제를 반영하지 않는다 = kWh당 단가가 늘 일정하다.
  // 그래서 소비 전력이 1.5배가 되면 요금도 정확히 1.5배여야 한다(실제 요금이라면 더 뛴다).
  const ironWon = wonPerMonth(m)
  allOff(m)
  toggle(m, 'aircon') // 1800 W = 1200 W의 1.5배
  close(wonPerMonth(m) / ironWon, 1800 / 1200, '소비 전력이 1.5배면 요금도 딱 1.5배(누진제 미반영)', 1e-6)
})()

// 7) **이 시뮬레이터의 관찰 거리** — 열을 내는 기구가 유난히 크다.
//    학생이 표를 보고 스스로 찾아낼 사실이라 화면에는 안 적지만, 데이터 자체는 그래야 한다.
;(function heatingAppliancesAreLarge() {
  const iron = getAppliance('iron').watt
  const aircon = getAppliance('aircon').watt
  const led = getAppliance('led').watt
  const charger = getAppliance('charger').watt
  assert(iron > led * 50, `전기다리미가 LED 전등보다 훨씬 크다 (${iron} vs ${led})`)
  assert(aircon > led * 50, `에어컨이 LED 전등보다 훨씬 크다 (${aircon} vs ${led})`)
  assert(charger < led * 2, `충전기는 아주 작다 (${charger})`)
})()

// 8) 백열전구와 LED — 같은 밝기를 내는 데 드는 전력이 크게 다르다
;(function bulbWattGap() {
  const inc = getAppliance('incandescent').watt
  const led = getAppliance('led').watt
  assert(inc > led * 5, `백열전구가 LED보다 훨씬 많이 쓴다 (${inc} vs ${led})`)
})()

// 8-2) 화면에 보여 주는 것은 **1시간** 전력량이다.
//      한 달 전력량을 대신 보여주면 학생이 "1시간 값 × 시간"을 해 볼 거리가 없어진다.
;(function hourlyEnergy() {
  const m = createModel()
  allOff(m)
  toggle(m, 'iron') // 1200 W
  close(kwhPerHour(m), 1.2, '1200 W를 1시간 쓰면 1.2 kWh')
  toggle(m, 'led') // +8 W
  close(kwhPerHour(m), 1.208, '기구를 더 켜면 그만큼 늘어난다')

  // 한 달 값은 1시간 값의 (24×30)배 — 학생이 직접 할 계산이 시뮬 안에서도 같은 관계여야 한다
  close(kwhPerMonth(m), kwhPerHour(m) * HOURS_PER_MONTH, '한 달 전력량 = 1시간 전력량 × 24 × 30')

  allOff(m)
  eq(kwhPerHour(m), 0, '다 끄면 1시간 전력량도 0')
})()

// 9) 막대 그래프 기준 — 모두 켜면 최대치와 같다
;(function maxIsAllOn() {
  const m = createModel()
  allOff(m)
  for (const a of APPLIANCES) toggle(m, a.id)
  eq(totalWatt(m), maxWatt(), '모두 켜면 합계가 최대치와 같다')
})()

// 10) 기구 정의가 온전한지
;(function appliancesWellFormed() {
  const ids = APPLIANCES.map((a) => a.id)
  assert(new Set(ids).size === ids.length, '기구 id가 겹치지 않는다')
  assert(
    APPLIANCES.every((a) => a.name && a.watt > 0 && a.standby >= 0 && a.energy),
    '모든 기구에 이름·소비 전력·대기 전력·에너지 형태가 정의되어 있다',
  )
  assert(APPLIANCES.length >= 6, '비교할 기구가 6가지 이상이다')
  assert(
    APPLIANCES.some((a) => a.standby === 0),
    '대기 전력이 없는 기구도 있다(스위치로 완전히 끊는 기구)',
  )
})()

// 13) 모르는 id는 조용히 0으로 — 화면이 깨지지 않아야 한다
;(function unknownId() {
  const m = createModel()
  eq(applianceWatt(m, '없는기구'), 0, '모르는 기구의 소비 전력은 0')
})()

export function runAll() {
  return results
}
