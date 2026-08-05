// 부품 사양·격자 크기·물리 상수를 한 곳에 모은다. 값을 바꿀 땐 여기만 고치면 된다.

export const GRID_COLS = 6 // 노드 열 개수 (0-indexed 0..5)
export const GRID_ROWS = 4 // 노드 행 개수 (0-indexed 0..3)

// --- 물리 상수 (단위: 옴, 볼트, 암페어, 와트) ---
export const WIRE_R = 0.01
export const BATTERY_INTERNAL_R = 0.1
export const SWITCH_CLOSED_R = 0.01
export const AMMETER_R = 0.01
export const VOLTMETER_R = 1_000_000

export const BULB_R = 10 // 전구 저항(고정, 선형 모델)
export const BULB_RATED_POWER = 0.9 // W — 이 전력에서 최대 밝기(포화)
export const BULB_OVERPOWER_RATIO = 2 // 정격의 이 배수를 넘으면 "너무 센 전류" 힌트

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
  bulb: { label: '전구', category: 'passive' },
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
