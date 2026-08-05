// solver.js·hints.js 물리 검증. test.html에서 모듈로 로드되어 브라우저 화면과 콘솔에
// PASS/FAIL을 출력한다. 빌드 도구 없이 순수 ES 모듈만으로 동작한다.

import { createModel, placeComponentWithValue, allComponents } from './model.js'
import { solveCircuit } from './solver.js'
import { diagnose } from './hints.js'
import { PRESETS, applyPreset } from './presets.js'
import { WIRE_R, BATTERY_INTERNAL_R } from './config.js'

const results = []

function approx(actual, expected, relTol, label) {
  const ok = Math.abs(actual - expected) <= relTol * Math.max(Math.abs(expected), 1e-9)
  results.push({ ok, label: `${label} (실제=${actual.toFixed(4)}, 기대=${expected.toFixed(4)})` })
}

function assert(cond, label) {
  results.push({ ok: !!cond, label })
}

// --- 루프 간선 상수 (presets.js와 동일한 3열×4행 직사각형 고리) ---
const LOOP_TOP = ['h_0_0', 'h_0_1']
const LOOP_RIGHT = ['v_0_2', 'v_1_2', 'v_2_2']
const LOOP_BOTTOM = ['h_3_1', 'h_3_0']
const LOOP_LEFT = ['v_2_0', 'v_1_0', 'v_0_0']
const LOOP_ALL = [...LOOP_TOP, ...LOOP_RIGHT, ...LOOP_BOTTOM, ...LOOP_LEFT]

function wireRest(model, exclude) {
  for (const key of LOOP_ALL) {
    if (!exclude.has(key)) placeComponentWithValue(model, key, 'wire')
  }
}

function batteryUid(model) {
  return allComponents(model).find((c) => c.type === 'battery').uid
}

// 1) 직렬 회로: I = V / (배터리 내부저항 + R1 + R2 + 도선 7개)
;(function seriesTest() {
  const model = createModel()
  placeComponentWithValue(model, 'v_1_0', 'battery', { value: 4.5 })
  placeComponentWithValue(model, 'h_0_0', 'resistor', { value: 10 })
  placeComponentWithValue(model, 'h_0_1', 'resistor', { value: 20 })
  wireRest(model, new Set(['v_1_0', 'h_0_0', 'h_0_1']))
  const { current } = solveCircuit(model)
  const rTotal = BATTERY_INTERNAL_R + 10 + 20 + 7 * WIRE_R
  approx(Math.abs(current.get(batteryUid(model))), 4.5 / rTotal, 0.01, '직렬 회로 전류(옴의 법칙)')
})()

// 2) 병렬 회로: 같은 간선에 저항 두 개 겹침 = 병렬. 전체 전류·분배 비율 확인
;(function parallelTest() {
  const model = createModel()
  placeComponentWithValue(model, 'v_1_0', 'battery', { value: 3 })
  placeComponentWithValue(model, 'h_0_0', 'resistor', { value: 10 })
  placeComponentWithValue(model, 'h_0_0', 'resistor', { value: 20 })
  wireRest(model, new Set(['v_1_0', 'h_0_0']))
  const { current } = solveCircuit(model)
  const rParallel = (10 * 20) / (10 + 20)
  const rTotal = BATTERY_INTERNAL_R + rParallel + 8 * WIRE_R
  const iTotalExpected = 3 / rTotal
  const iBattery = Math.abs(current.get(batteryUid(model)))
  approx(iBattery, iTotalExpected, 0.01, '병렬 회로 합성저항(전체 전류)')

  const [r1, r2] = allComponents(model).filter((c) => c.type === 'resistor')
  const i1 = Math.abs(current.get(r1.uid))
  const i2 = Math.abs(current.get(r2.uid))
  approx(i1 + i2, iBattery, 0.01, '병렬 분기 전류의 합 = 전체 전류')
  approx(i1 / i2, 20 / 10, 0.02, '병렬 전류 분배비(저항에 반비례)')
})()

// 3) 전압계 병렬 연결: 전압계를 달아도 전류가 거의 안 바뀌어야 하고, 읽는 전압도 정확해야 함
;(function voltmeterTest() {
  const withoutVm = createModel()
  placeComponentWithValue(withoutVm, 'v_1_0', 'battery', { value: 6 })
  placeComponentWithValue(withoutVm, 'h_0_0', 'resistor', { value: 20 })
  placeComponentWithValue(withoutVm, 'h_0_1', 'resistor', { value: 10 })
  wireRest(withoutVm, new Set(['v_1_0', 'h_0_0', 'h_0_1']))
  const iWithout = Math.abs(solveCircuit(withoutVm).current.get(batteryUid(withoutVm)))

  const withVm = createModel()
  placeComponentWithValue(withVm, 'v_1_0', 'battery', { value: 6 })
  placeComponentWithValue(withVm, 'h_0_0', 'resistor', { value: 20 })
  placeComponentWithValue(withVm, 'h_0_1', 'resistor', { value: 10 })
  placeComponentWithValue(withVm, 'h_0_1', 'voltmeter') // R2와 병렬로 겹쳐 놓기
  wireRest(withVm, new Set(['v_1_0', 'h_0_0', 'h_0_1']))
  const solved = solveCircuit(withVm)
  const iWith = Math.abs(solved.current.get(batteryUid(withVm)))
  approx(iWith, iWithout, 0.01, '전압계 부착 전후 전류 변화 1% 이내')

  const rTotal = BATTERY_INTERNAL_R + 20 + 10 + 7 * WIRE_R
  const iExpected = 6 / rTotal
  const vR2Expected = iExpected * 10
  const vm = allComponents(withVm).find((c) => c.type === 'voltmeter')
  const vReading = Math.abs(solved.current.get(vm.uid)) * 1_000_000 // I*R = V (전압계 자신의 저항 기준)
  approx(vReading, vR2Expected, 0.02, '전압계 측정값 = R2 양단 전압')
})()

// 4) 전류계 직렬 삽입: AMMETER_R === WIRE_R 이므로 전류 변화가 사실상 0이어야 함
;(function ammeterTest() {
  const withoutAm = createModel()
  placeComponentWithValue(withoutAm, 'v_1_0', 'battery', { value: 3 })
  placeComponentWithValue(withoutAm, 'v_1_2', 'bulb')
  wireRest(withoutAm, new Set(['v_1_0', 'v_1_2']))
  const iWithout = Math.abs(solveCircuit(withoutAm).current.get(batteryUid(withoutAm)))

  const withAm = createModel()
  placeComponentWithValue(withAm, 'v_1_0', 'battery', { value: 3 })
  placeComponentWithValue(withAm, 'v_1_2', 'bulb')
  placeComponentWithValue(withAm, 'h_0_0', 'ammeter')
  wireRest(withAm, new Set(['v_1_0', 'v_1_2', 'h_0_0']))
  const solved = solveCircuit(withAm)
  const iWith = Math.abs(solved.current.get(batteryUid(withAm)))
  approx(iWith, iWithout, 0.01, '전류계 삽입 전후 전류 변화 1% 이내')

  const am = allComponents(withAm).find((c) => c.type === 'ammeter')
  approx(Math.abs(solved.current.get(am.uid)), iWith, 0.001, '전류계 자신의 측정값 = 회로 전류')
})()

// 5) 열린 회로(스위치 open): 모든 전류 ≈ 0
;(function openSwitchTest() {
  const model = createModel()
  placeComponentWithValue(model, 'v_1_0', 'battery', { value: 3 })
  placeComponentWithValue(model, 'v_1_2', 'bulb')
  placeComponentWithValue(model, 'h_0_0', 'switch', { closed: false })
  wireRest(model, new Set(['v_1_0', 'v_1_2', 'h_0_0']))
  const { current } = solveCircuit(model)
  const maxCurrent = Math.max(...Array.from(current.values()).map(Math.abs))
  assert(maxCurrent < 1e-6, `스위치 개방 시 모든 전류 ≈ 0 (최대=${maxCurrent.toExponential(2)})`)

  const diag = diagnose(model, { current })
  assert(diag && diag.message.includes('스위치'), '스위치 개방 힌트 메시지')
})()

// 6) 합선: 배터리 간선에 도선을 겹쳐 놓아 자기 자신을 단락
;(function shortCircuitTest() {
  const model = createModel()
  placeComponentWithValue(model, 'v_1_0', 'battery', { value: 3 })
  placeComponentWithValue(model, 'v_1_0', 'wire') // 배터리와 같은 간선에 겹쳐 = 직접 단락
  const { current } = solveCircuit(model)
  const iBattery = Math.abs(current.get(batteryUid(model)))
  assert(iBattery > 5, `합선 시 배터리 전류가 5A 초과 (실제=${iBattery.toFixed(2)}A)`)
  const diag = diagnose(model, { current })
  assert(diag && diag.message.includes('합선'), '합선 힌트 메시지')
})()

// 7) 직렬 전지 두 개: 같은 방향이면 전압이 더해지고, 하나를 뒤집으면 빼진다
;(function seriesBatteryTest() {
  const rTotal = 2 * BATTERY_INTERNAL_R + 8 * WIRE_R

  const aiding = createModel()
  placeComponentWithValue(aiding, 'v_0_0', 'battery', { value: 3 })
  placeComponentWithValue(aiding, 'v_1_0', 'battery', { value: 1.5 })
  wireRest(aiding, new Set(['v_0_0', 'v_1_0']))
  const iAiding = Math.abs(solveCircuit(aiding).current.get(allComponents(aiding).find((c) => c.edgeKey === 'v_0_0').uid))
  approx(iAiding, (3 + 1.5) / rTotal, 0.01, '전지 두 개 같은 방향(전압 합산)')

  const opposing = createModel()
  placeComponentWithValue(opposing, 'v_0_0', 'battery', { value: 3 })
  placeComponentWithValue(opposing, 'v_1_0', 'battery', { value: 1.5, flipped: true })
  wireRest(opposing, new Set(['v_0_0', 'v_1_0']))
  const iOpposing = Math.abs(
    solveCircuit(opposing).current.get(allComponents(opposing).find((c) => c.edgeKey === 'v_0_0').uid),
  )
  approx(iOpposing, Math.abs(3 - 1.5) / rTotal, 0.02, '전지 하나 뒤집으면(전압 상쇄)')
})()

// 8) 전구 밝기: 정상 범위 vs 과전력
;(function bulbPowerTest() {
  const normal = createModel()
  placeComponentWithValue(normal, 'v_1_0', 'battery', { value: 3 })
  placeComponentWithValue(normal, 'v_1_2', 'bulb')
  wireRest(normal, new Set(['v_1_0', 'v_1_2']))
  const diagNormal = diagnose(normal, solveCircuit(normal))
  assert(diagNormal === null, `정상 범위 전구는 힌트 없음 (실제=${diagNormal && diagNormal.message})`)

  const overpower = createModel()
  placeComponentWithValue(overpower, 'v_1_0', 'battery', { value: 9 })
  placeComponentWithValue(overpower, 'v_1_2', 'bulb')
  wireRest(overpower, new Set(['v_1_0', 'v_1_2']))
  const diagOver = diagnose(overpower, solveCircuit(overpower))
  assert(diagOver && diagOver.message.includes('전구'), '9V 전지 + 전구 단독 회로는 과전력 힌트')
})()

// 9) 전지 없음 / 전압계 직렬 단독 / 회로 미완성 힌트
;(function generalHintsTest() {
  const noBattery = createModel()
  placeComponentWithValue(noBattery, 'h_0_0', 'bulb')
  wireRest(noBattery, new Set(['h_0_0']))
  const d1 = diagnose(noBattery, solveCircuit(noBattery))
  assert(d1 && d1.message.includes('전지'), '전지 없음 힌트')

  const brokenLoop = createModel()
  placeComponentWithValue(brokenLoop, 'v_1_0', 'battery', { value: 3 })
  // 고리를 다 잇지 않음(h_0_0 비워둠) → 열린 회로
  wireRest(brokenLoop, new Set(['v_1_0', 'h_0_0']))
  const d2 = diagnose(brokenLoop, solveCircuit(brokenLoop))
  assert(d2 && d2.message.includes('끊겨'), '고리 미완성 힌트')

  const seriesVm = createModel()
  placeComponentWithValue(seriesVm, 'v_1_0', 'battery', { value: 3 })
  placeComponentWithValue(seriesVm, 'h_0_0', 'voltmeter') // 단독으로 직렬 삽입
  wireRest(seriesVm, new Set(['v_1_0', 'h_0_0']))
  const d3 = diagnose(seriesVm, solveCircuit(seriesVm))
  assert(d3 && d3.message.includes('나란히'), '전압계 직렬 단독 삽입 힌트')
})()

// 10) 프리셋 6종이 전부 에러 없이 로드되고 힌트가 없어야(정상 동작) 함 — 병렬 프리셋만 예외 확인용 로그
;(function presetsTest() {
  for (const preset of PRESETS) {
    const model = createModel()
    let ok = true
    let message = ''
    try {
      applyPreset(model, preset.id)
      const solved = solveCircuit(model)
      const diag = diagnose(model, solved)
      if (diag && diag.level === 'error') {
        ok = false
        message = `힌트=${diag.message}`
      }
    } catch (e) {
      ok = false
      message = String(e)
    }
    assert(ok, `프리셋 "${preset.label}" 정상 로드${message ? ' — ' + message : ''}`)
  }
})()

export function runAll() {
  return results
}
