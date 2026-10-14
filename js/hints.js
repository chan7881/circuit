// 해석 결과를 보고 학생이 흔히 하는 실수를 진단해 메시지 하나(가장 우선순위 높은 것)를
// 돌려준다. DOM 의존 없는 순수 함수 — test.html에서 solver.js 결과와 함께 검증한다.

import { allComponents } from './model.js'
import {
  BATTERY_INTERNAL_R,
  SHORT_CIRCUIT_DROP_RATIO,
  ZERO_CURRENT_EPS,
  SERIES_VOLTMETER_CURRENT_EPS,
  bulbResistance,
  bulbRatedPower,
  BULB_OVERPOWER_RATIO,
} from './config.js'

/**
 * @param {import('./model.js').createModel extends () => infer M ? M : never} model
 * @param {{ current: Map<string, number> }} solveResult
 * @returns {{ level: 'info'|'warn'|'error', message: string } | null}
 */
export function diagnose(model, solveResult) {
  const components = allComponents(model)
  const { current } = solveResult

  const batteries = components.filter((c) => c.type === 'battery')
  const switches = components.filter((c) => c.type === 'switch')
  const voltmeters = components.filter((c) => c.type === 'voltmeter')
  const bulbs = components.filter((c) => c.type === 'bulb')

  const allNearZero = components.every((c) => Math.abs(current.get(c.uid) ?? 0) < ZERO_CURRENT_EPS)
  const hasOpenSwitch = switches.some((s) => !s.closed)

  if (batteries.length === 0) {
    return { level: 'info', message: '전지를 놓아야 회로에 전류가 흘러요.' }
  }

  // 전압계가 전구·저항·전류계와 **직렬로** 놓여 회로를 사실상 끊어놓은 경우 — 전압계는 저항이
  // 매우 커서(1MΩ) 직렬로 놓으면 새는 전류가 μA대에 머문다. 이건 allNearZero(1μA 미만)보다
  // 느슨한 기준으로 따로 잡아야 한다 — 전압이 크면 새는 전류가 1μA를 넘어 "회로 미완성"으로
  // 오분류되기 때문.
  // ⚠️ «전압계 전류가 작다»만으로 판정하면 안 된다. 병렬로 **바르게** 단 전압계도 늘 μA대다.
  //    예전에는 그 기준만 써서, 도선으로 따로 이어 병렬 연결한 전압계(교과서 그림 그대로)에
  //    «직렬로 달면…» 힌트가 떴다(2026-10-14 발견). 직렬이라는 증거는 **같은 μA 전류가
  //    다른 부하(전구·저항·전류계)에도 흐른다**는 것이다 — 그 부하가 전압계에 막혀 있다는 뜻.
  //    전지 양 끝에 전압계만 단 경우(전지 전압 측정)는 부하가 없으니 걸리지 않는다.
  const loads = components.filter((c) => c.type === 'bulb' || c.type === 'resistor' || c.type === 'ammeter')
  const seriesVoltmeter = voltmeters.some((vm) => {
    const iVm = Math.abs(current.get(vm.uid) ?? 0)
    if (iVm < ZERO_CURRENT_EPS || iVm >= SERIES_VOLTMETER_CURRENT_EPS) return false
    return loads.some((ld) => Math.abs(Math.abs(current.get(ld.uid) ?? 0) - iVm) < iVm * 0.01)
  })
  if (seriesVoltmeter) {
    return {
      level: 'info',
      message: '전압계는 측정할 부품과 나란히(병렬로) 연결해요. 직렬로 달면 전류가 거의 흐르지 않아요.',
    }
  }

  if (allNearZero) {
    if (hasOpenSwitch) {
      return { level: 'info', message: '스위치가 열려 있어요. 탭해서 닫아 보세요.' }
    }
    return { level: 'info', message: '회로가 끊겨 있어요. 전지에서 나가 다시 전지로 돌아오는 길이 이어져야 해요.' }
  }

  // 합선 = 전지 바깥 저항이 거의 0이라 전지 전압이 내부저항에서 다 깎이는 상태.
  // ⚠️ 전류 크기(예전 기준 5A)로 판정하면 9V에 5Ω 네 개를 병렬로 단 정상 회로(7.2A)도
  //    «부품 없이 바로 이어졌다»고 잘못 알렸다(2026-10-14 발견). 단자 전압이 얼마나 깎였는지로 본다.
  const shortCircuit = batteries.some(
    (b) => Math.abs(current.get(b.uid) ?? 0) * BATTERY_INTERNAL_R > SHORT_CIRCUIT_DROP_RATIO * b.value,
  )
  if (shortCircuit) {
    return { level: 'error', message: '합선이에요! 전지 양 끝이 부품 없이 바로 이어졌어요.' }
  }

  // 전구마다 규격이 다르다 — 자기 규격에 견줘 판단한다.
  // 정격을 넘으면 «과전류», 정격의 BULB_OVERPOWER_RATIO 배를 넘으면 «끊어질 만큼 위험».
  const ratios = bulbs.map((bulb) => {
    const i = current.get(bulb.uid) ?? 0
    const p = i * i * bulbResistance(bulb.value)
    return p / bulbRatedPower(bulb.value)
  })
  const worst = ratios.length ? Math.max(...ratios) : 0
  if (worst > BULB_OVERPOWER_RATIO) {
    return {
      level: 'error',
      message: '전구가 규격보다 훨씬 센 전류를 받고 있어요. 이대로면 끊어져요 — 전압을 낮추거나 저항을 넣어 보세요.',
    }
  }
  if (worst > 1) {
    return {
      level: 'warn',
      message: '전구 규격보다 센 전류가 흐르고 있어요(과전류). 규격이 더 큰 전구로 바꾸거나 전압을 낮춰 보세요.',
    }
  }

  return null
}
