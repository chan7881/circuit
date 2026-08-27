// 부품 사양·격자 크기·물리 상수를 한 곳에 모은다. 값을 바꿀 땐 여기만 고치면 된다.

export const GRID_COLS = 6 // 노드 열 개수 (0-indexed 0..5)
export const GRID_ROWS = 4 // 노드 행 개수 (0-indexed 0..3)

// --- 물리 상수 (단위: 옴, 볼트, 암페어, 와트) ---
// 도선·닫힌 스위치·전류계는 "이상적인 도체"로 취급한다 — 저항을 정확히 0으로 두면 노턴 등가의
// 전도도(1/R)가 무한대가 되어 계산이 깨지므로, 계산상 필요한 최소한으로만 작게 잡는다. 중학생이
// 손으로 V=IR·직렬/병렬 공식을 계산했을 때와 시뮬레이터 측정값이 어긋나 보이지 않도록, 실제
// 저항값(5~50Ω)에 비해 완전히 무시할 수 있는 크기(10만분의 1 수준)로 둔다.
export const WIRE_R = 0.0001
export const SWITCH_CLOSED_R = 0.0001
export const AMMETER_R = 0.0001
// 전지 내부저항도 같은 이유로 작게 잡되, 도선보다는 조금 커서 "전지만 도선으로 직접 이은
// 합선" 같은 극단적인 경우에도 전류가 유한한 값으로 안정적으로 계산되게 한다.
export const BATTERY_INTERNAL_R = 0.001
export const VOLTMETER_R = 1_000_000

// --- 전구 ---
// 전구에는 **규격(정격 전압)** 이 있다. 실제 꼬마전구도 «3V 0.3A» 처럼 적혀 있다.
// 정격 전류를 0.3A 로 고정하고 규격 전압으로 저항을 정한다: R = V정격 / 0.3
//   1.5V → 5Ω(0.45W) · 3V → 10Ω(0.9W) · 6V → 20Ω(1.8W)
// ⚠️ 기본값 3V 는 예전의 고정값(10Ω·0.9W)과 **정확히 같다** — 기존 예제 회로와
//    계산 결과가 달라지지 않게 일부러 그렇게 골랐다.
export const BULB_RATED_CURRENT = 0.3 // A
export const BULB_VOLTAGES = [1.5, 3, 6]
export const BULB_DEFAULT_VOLTAGE = 3

export function bulbResistance(ratedV) {
  return (ratedV ?? BULB_DEFAULT_VOLTAGE) / BULB_RATED_CURRENT
}
export function bulbRatedPower(ratedV) {
  return (ratedV ?? BULB_DEFAULT_VOLTAGE) * BULB_RATED_CURRENT
}

// 정격의 몇 배까지를 어떻게 볼 것인가.
//  1배 넘으면 «과전류»(경고), 이 배수를 넘으면 «끊어질 만큼 위험».
export const BULB_OVERPOWER_RATIO = 2

export const SHORT_CIRCUIT_CURRENT = 5 // A — 전지 전류가 이보다 크면 합선 경고
export const ZERO_CURRENT_EPS = 1e-6 // A — 이보다 작으면 "전류 없음"으로 취급
// 전압계(1MΩ)를 직렬로 단독 삽입하면 전지 전압이 몇 V든 새는 전류가 수 μA대에 머문다 —
// 정상적인 회로 전류(보통 수십 mA~수 A)보다 훨씬 작으므로 이 값을 기준으로 구분한다.
export const SERIES_VOLTMETER_CURRENT_EPS = 1e-3

// --- 선택 가능한 값들 ---
export const BATTERY_VOLTAGES = [1.5, 3, 4.5, 6, 9]
export const RESISTOR_VALUES = [5, 10, 20, 50]

// --- 부품 종류 정의 ---
// value: 초깃값, options: 버튼으로 고를 수 있는 값 목록(있으면), unit: 표시 단위
export const COMPONENT_TYPES = {
  wire: { label: '도선', category: 'wire' },
  battery: { label: '전지', category: 'source', defaultValue: 3, options: BATTERY_VOLTAGES, unit: 'V' },
  resistor: { label: '저항', category: 'passive', defaultValue: 10, options: RESISTOR_VALUES, unit: 'Ω' },
  bulb: {
    label: '전구',
    category: 'passive',
    defaultValue: BULB_DEFAULT_VOLTAGE,
    options: BULB_VOLTAGES,
    unit: 'V',
  },
  switch: { label: '스위치', category: 'switch' },
  ammeter: { label: '전류계', category: 'meter' },
  voltmeter: { label: '전압계', category: 'meter' },
}

export const PALETTE_ORDER = ['wire', 'battery', 'resistor', 'bulb', 'switch', 'ammeter', 'voltmeter']

// 한 간선(두 노드 사이)에 최대 몇 개의 부품을 겹쳐 놓을 수 있는지. 겹쳐 놓으면 전기적으로는
// 병렬 연결과 같다 — 전압계를 다른 부품과 나란히 놓아 "병렬 측정"을 표현하는 데 쓴다.
export const MAX_ITEMS_PER_EDGE = 2

// --- 레이아웃(렌더링·히트테스트 공용) ---
// 논리 좌표계는 격자 칸 하나를 100 단위로 두고, 화면 크기에 맞춰 레터박스로 스케일한다.
export const CELL_UNIT = 100
export const LOGICAL_MARGIN = 60
export const LOGICAL_WIDTH = (GRID_COLS - 1) * CELL_UNIT + LOGICAL_MARGIN * 2
export const LOGICAL_HEIGHT = (GRID_ROWS - 1) * CELL_UNIT + LOGICAL_MARGIN * 2

export const NODE_RADIUS = 7
export const EDGE_HIT_WIDTH = 34 // 탭 판정 폭(논리 단위) — 손가락 오차를 넉넉히 흡수
export const STACK_OFFSET = 26 // 같은 간선에 두 번째 부품을 겹칠 때 수직으로 띄우는 거리
export const MIN_TAP_TARGET_PX = 44

// 부품 종류별 강조색(단색 아이콘 정책과 별개 — 회로도는 부품 구분을 위해 색+기호+글자 세 겹으로
// 표기한다. 색만으로 구분하지 않도록 항상 기호·라벨을 같이 그린다).
export const COMPONENT_COLOR = {
  wire: '#6b7280',
  battery: '#dc6803',
  resistor: '#1d4ed8',
  bulb: '#a16207',
  switch: '#7c3aed',
  ammeter: '#0f766e',
  voltmeter: '#0f766e',
}

// --- 전류 흐름 표시 ---
// 전류 방향(+ → -, 회로도의 관례적 방향)과 전자의 실제 이동 방향(- → +)은 서로 반대다 —
// 이 둘을 헷갈리기 쉬운 대표적인 개념이라 토글로 전환해 볼 수 있게 한다.
export const FLOW_MODE_CURRENT = 'current'
export const FLOW_MODE_ELECTRON = 'electron'
export const FLOW_PARTICLE_SPACING = 26 // 입자(화살표/전자 표시) 사이 간격(논리 단위)

// 흐름 애니메이션의 속도. 입자 간격은 고정이고 **속도만** 전류에 비례시킨다.
//   한 점을 지나가는 입자 수/초 = 속도 / 간격  →  전류에 비례한다.
//   (I = nqAv 에서 운반자 밀도 n 을 고정하고 표류 속도 v 만 바꾸는 것과 같다)
// ⚠️ 상한이 있다. 너무 빠르면 화살표가 뭉개져 방향조차 안 보인다. 다만 상한에 걸리면
//    그 위로는 전류가 더 세져도 화면이 같아진다 — 어디서 걸리는지는 FLOW_SPEED_MAX_CURRENT.
export const FLOW_SPEED_PER_AMP = 40 // 논리단위/초 per A
// 상한을 4A 로 잡은 이유: 교실에서 만들 수 있는 회로가 실제로 3A 를 넘는다.
// 9V 전지에 5Ω 두 개를 병렬(=2.5Ω)로 걸면 3.6A 다 — 정상적인 «병렬 연결» 실험인데
// 상한이 3A 면 그 회로부터 세기를 반영하지 못했다(2026-08-28 확인).
// 4A 위는 합선 경고(5A)와 겹치는 영역이라 실용상 문제되지 않는다.
export const FLOW_SPEED_CAP = 160 // 논리단위/초
export const FLOW_SPEED_MAX_CURRENT = FLOW_SPEED_CAP / FLOW_SPEED_PER_AMP // = 4A

export function flowSpeed(current) {
  return Math.min(Math.abs(current) * FLOW_SPEED_PER_AMP, FLOW_SPEED_CAP)
}
export const CURRENT_FLOW_COLOR = '#f59e0b' // 전류 방향 화살표 — 호박색(부품별 강조색과 겹치지 않게)
export const ELECTRON_FLOW_COLOR = '#2563eb' // 전자 표시 — 파란색(음전하 관례)
