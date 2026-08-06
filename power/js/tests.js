// model.js 검증. test.html에서 모듈로 로드되어 화면·콘솔에 PASS/FAIL을 출력한다.

import {
  APPLIANCES,
  BULBS,
  WON_PER_KWH,
  GRAM_CO2_PER_KWH,
  createModel,
  getAppliance,
  isOn,
  toggle,
  allOff,
  setStandby,
  applianceWatt,
  totalWatt,
  standbyWatt,
  kwhPerHour,
  wonPerHour,
  gramCo2PerHour,
  maxWatt,
  lightShare,
  heatShare,
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
  eq(wonPerHour(m), 0, '요금도 0')
  eq(gramCo2PerHour(m), 0, '이산화 탄소도 0')
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

// 6) 전력량·요금·이산화 탄소가 소비 전력에 비례한다
;(function derivedValues() {
  const m = createModel()
  allOff(m)
  toggle(m, 'iron') // 1200 W
  close(kwhPerHour(m), 1.2, '1200 W를 1시간 쓰면 1.2 kWh')
  eq(wonPerHour(m), Math.round(1.2 * WON_PER_KWH), '요금은 전력량에 비례한다')
  eq(gramCo2PerHour(m), Math.round(1.2 * GRAM_CO2_PER_KWH), '이산화 탄소도 전력량에 비례한다')
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

// 11) 전구 비교 — 넣은 에너지는 사라지지 않는다(빛 + 열 = 1)
;(function energyIsConserved() {
  for (const b of BULBS) {
    close(lightShare(b.id) + heatShare(b.id), 1, `${b.name}: 빛 몫 + 열 몫 = 1(에너지는 사라지지 않는다)`)
  }
})()

// 12) LED가 빛으로 바꾸는 몫이 더 크다 — 이 화면의 핵심 비교
;(function ledIsMoreEfficient() {
  assert(
    lightShare('led') > lightShare('incandescent'),
    `LED가 빛으로 바꾸는 몫이 더 크다 (${lightShare('led')} vs ${lightShare('incandescent')})`,
  )
  assert(heatShare('incandescent') > 0.5, '백열전구는 넣은 에너지의 절반 이상이 열로 빠져나간다')
})()

// 13) 모르는 id는 조용히 0으로 — 화면이 깨지지 않아야 한다
;(function unknownId() {
  const m = createModel()
  eq(applianceWatt(m, '없는기구'), 0, '모르는 기구의 소비 전력은 0')
  eq(lightShare('없는전구'), 0, '모르는 전구의 빛 몫은 0')
})()

export function runAll() {
  return results
}
