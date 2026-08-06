// 「물의 흐름과 전류」 시뮬레이터의 순수 로직 — DOM을 모른다. test.html에서 그대로 검증한다.
//
// 이 시뮬레이터의 목적은 **비유가 1:1로 대응한다**는 것을 눈으로 확인시키는 것이다.
// 그래서 물 쪽과 전기 쪽을 각각 계산하지 않고, **하나의 값이 양쪽을 함께 몰고 간다**.
// 두 계산식을 따로 두면 언젠가 한쪽만 고쳐져 "펌프를 세게 했는데 전류는 그대로"인 상태가
// 만들어질 수 있고, 그러면 이 시뮬레이터의 존재 이유가 사라진다.
//
//   펌프 세기  ↔ 전지(전압)
//   밸브       ↔ 스위치
//   좁은 관    ↔ 저항
//   물의 흐름  ↔ 전류
//   물레방아   ↔ 전구
//
// ⚠️ 관찰 결과를 말로 풀어주는 함수는 두지 않는다. "펌프를 세게 하면 물살이 세진다" 같은
//    문장은 학생이 화면을 보고 스스로 말해야 한다(2026-08-06 사용자 피드백).
//
// ⚠️ 숫자에 단위(V·A·Ω)를 붙여 보여주지 않는다. 이 소단원은 전류·전압의 **개념**을 잡는
//    자리이고 정량 관계(옴의 법칙)는 다음 소단원이다. 여기서 수치를 들이밀면 다음 시간에
//    학생이 스스로 찾아낼 관계를 미리 알려주는 셈이 된다. 대신 세기를 막대로만 보여준다.

/** 펌프 세기(=전지) 단계. 0은 꺼짐. */
export const MAX_PUMP = 4

/**
 * 관의 굵기 단계. `flowResistance`가 클수록 흐름이 적다.
 * 굵은 관일수록 물이 잘 흐르는 것처럼, 저항이 작을수록 전류가 잘 흐른다.
 */
export const PIPE_LEVELS = [
  { id: 'wide', label: '굵은 관', resistorLabel: '작은 저항', flowResistance: 1 },
  { id: 'medium', label: '보통 관', resistorLabel: '보통 저항', flowResistance: 2 },
  { id: 'narrow', label: '좁은 관', resistorLabel: '큰 저항', flowResistance: 4 },
]

export function createModel() {
  return {
    /** 0 ~ MAX_PUMP */
    pump: 2,
    /** PIPE_LEVELS의 인덱스 */
    pipe: 1,
    /** 밸브(=스위치)가 열려 있는가 */
    open: true,
  }
}

export function setPump(model, value) {
  model.pump = Math.max(0, Math.min(MAX_PUMP, Math.round(value)))
  return model
}

export function setPipe(model, index) {
  model.pipe = Math.max(0, Math.min(PIPE_LEVELS.length - 1, Math.round(index)))
  return model
}

export function toggleOpen(model) {
  model.open = !model.open
  return model
}

export function pipeLevel(model) {
  return PIPE_LEVELS[model.pipe]
}

/**
 * 흐름의 세기(0~1). **이 하나의 값이 물 쪽과 전기 쪽을 함께 몰고 간다.**
 *
 * 밸브(스위치)를 닫으면 0 — 끊긴 길로는 흐르지 않는다.
 * 펌프(전지)를 세게 할수록 커지고, 관이 좁을수록(저항이 클수록) 작아진다.
 * 굳이 정확한 물리량이 아니라 0~1로 정규화한 이유는 위 주석대로 단위 있는 수치를
 * 보여주지 않기 때문이다 — 화면에는 막대 길이와 애니메이션 속도로만 나타난다.
 */
export function flow(model) {
  if (!model.open) return 0
  return model.pump / MAX_PUMP / pipeLevel(model).flowResistance
}

/** 물레방아·전구가 받는 세기 — 흐름과 같은 값이다(같은 흐름이 둘 다 돌리고 밝힌다). */
export function output(model) {
  return flow(model)
}

/** 흐름이 있는가 — 애니메이션을 그릴지 판단할 때 쓴다. */
export function isFlowing(model) {
  return flow(model) > 0
}

/**
 * 비유의 대응표. 화면의 '대응 관계 보기'를 켜면 이 짝들을 같은 색 배지로 이어 보여준다.
 *
 * **기본값은 꺼짐**이다 — 이 대응이 바로 학습지에서 학생이 채워야 할 빈칸이라,
 * 처음부터 보여주면 답을 알려주는 꼴이 된다. 학생이 스스로 짝지어 본 뒤 확인용으로 켠다.
 */
export const MAPPING = [
  { id: 'source', water: '펌프', electric: '전지', color: '#dc2626' },
  { id: 'gate', water: '밸브', electric: '스위치', color: '#7c3aed' },
  { id: 'resist', water: '좁은 관', electric: '저항', color: '#0891b2' },
  { id: 'load', water: '물레방아', electric: '전구', color: '#16a34a' },
  { id: 'flow', water: '물의 흐름', electric: '전류', color: '#ea580c' },
]
