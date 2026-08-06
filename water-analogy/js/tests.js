// model.js 검증. test.html에서 모듈로 로드되어 화면·콘솔에 PASS/FAIL을 출력한다.

import {
  MAX_PUMP,
  PIPE_LEVELS,
  MAPPING,
  createModel,
  setPump,
  setPipe,
  toggleOpen,
  pipeLevel,
  flow,
  output,
  isFlowing,
} from './model.js'

const results = []
function assert(cond, label) {
  results.push({ ok: !!cond, label })
}
function eq(actual, expected, label) {
  results.push({ ok: actual === expected, label: `${label} (실제=${actual}, 기대=${expected})` })
}

// 1) 밸브(스위치)를 닫으면 흐르지 않는다 — 끊긴 길로는 흐를 수 없다
;(function closedGateStopsFlow() {
  const m = createModel()
  setPump(m, MAX_PUMP)
  assert(flow(m) > 0, '(사전 조건) 열려 있으면 흐른다')
  toggleOpen(m)
  eq(flow(m), 0, '밸브·스위치를 닫으면 흐름이 0')
  eq(isFlowing(m), false, '흐르지 않는 상태로 판정된다')
  eq(output(m), 0, '물레방아·전구도 멈춘다')
})()

// 2) 펌프(전지)를 끄면 흐르지 않는다
;(function noSourceNoFlow() {
  const m = createModel()
  setPump(m, 0)
  eq(flow(m), 0, '펌프·전지가 꺼져 있으면 흐르지 않는다')
})()

// 3) 펌프(전지)가 셀수록 흐름이 세진다
;(function strongerSourceMoreFlow() {
  const m = createModel()
  let prev = -1
  for (let p = 0; p <= MAX_PUMP; p++) {
    setPump(m, p)
    const f = flow(m)
    assert(f > prev, `펌프 ${p}단계에서 흐름이 더 세진다 (${prev.toFixed(3)} → ${f.toFixed(3)})`)
    prev = f
  }
})()

// 4) 관이 좁을수록(저항이 클수록) 흐름이 약해진다
;(function narrowerPipeLessFlow() {
  const m = createModel()
  setPump(m, MAX_PUMP)
  let prev = Infinity
  for (let i = 0; i < PIPE_LEVELS.length; i++) {
    setPipe(m, i)
    const f = flow(m)
    assert(f < prev, `${PIPE_LEVELS[i].label}일수록 흐름이 약해진다 (${prev === Infinity ? '—' : prev.toFixed(3)} → ${f.toFixed(3)})`)
    prev = f
  }
})()

// 5) **이 시뮬레이터의 핵심** — 물 쪽과 전기 쪽은 하나의 값이 함께 몰고 간다.
//    두 값이 갈라지면 "펌프를 세게 했는데 전류는 그대로"인 화면이 되어 비유가 무너진다.
;(function oneValueDrivesBoth() {
  const m = createModel()
  for (let p = 0; p <= MAX_PUMP; p++) {
    for (let i = 0; i < PIPE_LEVELS.length; i++) {
      for (const open of [true, false]) {
        setPump(m, p)
        setPipe(m, i)
        m.open = open
        eq(output(m), flow(m), `펌프${p}·관${i}·${open ? '열림' : '닫힘'}에서 물레방아/전구가 받는 세기 = 흐름의 세기`)
      }
    }
  }
})()

// 6) 흐름의 세기는 항상 0~1 안에 있다(막대 길이로 그대로 쓴다)
;(function flowRange() {
  const m = createModel()
  for (let p = 0; p <= MAX_PUMP; p++) {
    for (let i = 0; i < PIPE_LEVELS.length; i++) {
      setPump(m, p)
      setPipe(m, i)
      const f = flow(m)
      assert(f >= 0 && f <= 1, `흐름이 0~1 안에 있다 (펌프${p}·관${i} → ${f.toFixed(3)})`)
    }
  }
})()

// 7) 조작값이 범위를 벗어나지 않는다
;(function clamping() {
  const m = createModel()
  setPump(m, 999)
  eq(m.pump, MAX_PUMP, '펌프 세기는 최대치를 넘지 않는다')
  setPump(m, -5)
  eq(m.pump, 0, '펌프 세기는 0 아래로 내려가지 않는다')
  setPipe(m, 999)
  eq(m.pipe, PIPE_LEVELS.length - 1, '관 단계는 마지막을 넘지 않는다')
  setPipe(m, -3)
  eq(m.pipe, 0, '관 단계는 0 아래로 내려가지 않는다')
})()

// 8) 밸브는 눌렀다 누르면 원래대로 돌아온다
;(function gateToggles() {
  const m = createModel()
  const before = m.open
  toggleOpen(m)
  eq(m.open, !before, '한 번 누르면 반대가 된다')
  toggleOpen(m)
  eq(m.open, before, '두 번 누르면 처음으로 돌아온다')
})()

// 9) 관 단계 정의가 온전한지 — 굵을수록 저항이 작아야 한다
;(function pipeLevelsWellFormed() {
  assert(PIPE_LEVELS.length >= 3, '관 굵기 단계가 3가지 이상이다')
  for (let i = 1; i < PIPE_LEVELS.length; i++) {
    assert(
      PIPE_LEVELS[i].flowResistance > PIPE_LEVELS[i - 1].flowResistance,
      `${PIPE_LEVELS[i].label}은 ${PIPE_LEVELS[i - 1].label}보다 흐름을 더 방해한다`,
    )
  }
  const m = createModel()
  setPipe(m, 0)
  eq(pipeLevel(m).id, PIPE_LEVELS[0].id, 'pipeLevel이 고른 단계를 돌려준다')
  assert(
    PIPE_LEVELS.every((l) => l.label && l.resistorLabel),
    '모든 단계에 물 쪽·전기 쪽 이름이 정의되어 있다',
  )
})()

// 10) 대응표 — 학습지 빈칸과 짝이 맞아야 한다
;(function mappingWellFormed() {
  const ids = MAPPING.map((m) => m.id)
  assert(new Set(ids).size === ids.length, '대응 항목의 id가 겹치지 않는다')
  assert(
    MAPPING.every((m) => m.water && m.electric && m.color),
    '모든 대응 항목에 물 쪽·전기 쪽 이름과 색이 있다',
  )
  for (const [water, electric] of [
    ['펌프', '전지'],
    ['밸브', '스위치'],
    ['좁은 관', '저항'],
    ['물레방아', '전구'],
    ['물의 흐름', '전류'],
  ]) {
    assert(
      MAPPING.some((m) => m.water === water && m.electric === electric),
      `${water} ↔ ${electric} 대응이 정의되어 있다`,
    )
  }
})()

export function runAll() {
  return results
}
