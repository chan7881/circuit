// 예제 회로. 격자 왼쪽 3열(c=0..2)의 직사각형 고리를 기본 틀로 쓰고, 오른쪽 여유 칸(c=3..5)은
// 손대지 않는다 — 학생이 프리셋을 불러온 뒤 이어서 실험을 확장할 공간으로 남겨둔다.
//
// 고리 간선(위→오른쪽→아래→왼쪽 순서):
//   위쪽:   h_0_0, h_0_1                (0,0)-(0,1)-(0,2)
//   오른쪽: v_0_2, v_1_2, v_2_2          (0,2)-(1,2)-(2,2)-(3,2)
//   아래쪽: h_3_1, h_3_0                (3,2)-(3,1)-(3,0)
//   왼쪽:   v_2_0, v_1_0, v_0_0          (3,0)-(2,0)-(1,0)-(0,0)

import { clearModel, placeComponentWithValue } from './model.js'

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

export const PRESETS = [
  {
    id: 'basic',
    label: '기본 회로',
    build(model) {
      placeComponentWithValue(model, 'v_1_0', 'battery', { value: 3 })
      placeComponentWithValue(model, 'v_1_2', 'bulb')
      wireRest(model, new Set(['v_1_0', 'v_1_2']))
    },
  },
  {
    id: 'series',
    label: '직렬 연결',
    build(model) {
      placeComponentWithValue(model, 'v_1_0', 'battery', { value: 4.5 })
      placeComponentWithValue(model, 'h_0_0', 'resistor', { value: 10 })
      placeComponentWithValue(model, 'h_0_1', 'resistor', { value: 20 })
      wireRest(model, new Set(['v_1_0', 'h_0_0', 'h_0_1']))
    },
  },
  {
    id: 'parallel',
    label: '병렬 연결',
    build(model) {
      placeComponentWithValue(model, 'v_1_0', 'battery', { value: 3 })
      // 같은 간선에 저항 두 개를 겹쳐 놓으면 그 자체로 병렬 연결이 된다.
      placeComponentWithValue(model, 'h_0_0', 'resistor', { value: 10 })
      placeComponentWithValue(model, 'h_0_0', 'resistor', { value: 20 })
      wireRest(model, new Set(['v_1_0', 'h_0_0']))
    },
  },
  {
    id: 'ammeter',
    label: '전류 측정',
    build(model) {
      placeComponentWithValue(model, 'v_1_0', 'battery', { value: 3 })
      placeComponentWithValue(model, 'v_1_2', 'bulb')
      placeComponentWithValue(model, 'h_0_0', 'ammeter')
      wireRest(model, new Set(['v_1_0', 'v_1_2', 'h_0_0']))
    },
  },
  {
    id: 'voltmeter',
    label: '전압 측정',
    build(model) {
      placeComponentWithValue(model, 'v_1_0', 'battery', { value: 3 })
      placeComponentWithValue(model, 'v_1_2', 'bulb')
      // 전구와 같은 간선에 전압계를 겹쳐 놓아 "병렬 측정"을 표현.
      placeComponentWithValue(model, 'v_1_2', 'voltmeter')
      wireRest(model, new Set(['v_1_0', 'v_1_2']))
    },
  },
  {
    id: 'ohm',
    label: '옴의 법칙',
    build(model) {
      placeComponentWithValue(model, 'v_1_0', 'battery', { value: 6 })
      placeComponentWithValue(model, 'h_0_0', 'resistor', { value: 20 })
      placeComponentWithValue(model, 'h_0_0', 'voltmeter')
      placeComponentWithValue(model, 'h_0_1', 'ammeter')
      wireRest(model, new Set(['v_1_0', 'h_0_0', 'h_0_1']))
    },
  },
]

export function applyPreset(model, presetId) {
  const preset = PRESETS.find((p) => p.id === presetId)
  if (!preset) return model
  clearModel(model)
  preset.build(model)
  return model
}
