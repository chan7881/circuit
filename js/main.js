// 부트스트랩: DOM 이벤트 ↔ 순수 모듈(model/solver/hints/presets/render/input) 연결.
// 이 파일만 DOM을 직접 건드린다 — 나머지 모듈은 전부 순수 함수라 test.html에서 독립 검증된다.

import {
  COMPONENT_TYPES,
  PALETTE_ORDER,
  COMPONENT_COLOR,
  bulbResistance,
  bulbRatedPower,
  BULB_OVERPOWER_RATIO,
  FLOW_MODE_CURRENT,
  FLOW_MODE_ELECTRON,
} from './config.js'
import {
  createModel,
  createHistory,
  pushHistory,
  undo,
  clearModel,
  placeComponent,
  removeComponent,
  updateComponent,
  findComponent,
  canPlace,
} from './model.js'
import { solveCircuit } from './solver.js'
import { diagnose } from './hints.js'
import { PRESETS, applyPreset } from './presets.js'
import { draw } from './render.js'
import { pick } from './input.js'

let model = createModel()
const history = createHistory()

let placingType = null
let selectedUid = null
let solveResult = solveCircuit(model)
let hintResult = null
let flowPhase = 0
let flowVisible = false
let flowMode = FLOW_MODE_CURRENT

const canvas = document.getElementById('board')
const ctx = canvas.getContext('2d')
const hintBar = document.getElementById('hint-bar')
const paletteEl = document.getElementById('palette')
const btnUndo = document.getElementById('btn-undo')
const btnClear = document.getElementById('btn-clear')
const btnPresets = document.getElementById('btn-presets')
const presetMenu = document.getElementById('preset-menu')
const btnExpand = document.getElementById('btn-expand')
const btnFlowSettings = document.getElementById('btn-flow-settings')
const flowSettingsMenu = document.getElementById('flow-settings-menu')
const toggleFlowVisible = document.getElementById('toggle-flow-visible')
const toggleFlowMode = document.getElementById('toggle-flow-mode')

const sheet = document.getElementById('sheet')
const sheetBackdrop = document.getElementById('sheet-backdrop')
const sheetTitle = document.getElementById('sheet-title')
const sheetBody = document.getElementById('sheet-body')
const btnFlip = document.getElementById('btn-flip')
const btnToggleSwitch = document.getElementById('btn-toggle-switch')
const btnDelete = document.getElementById('btn-delete')
const btnSheetClose = document.getElementById('btn-sheet-close')

// --- 팔레트 구성 ---
for (const type of PALETTE_ORDER) {
  const def = COMPONENT_TYPES[type]
  const btn = document.createElement('button')
  btn.className = 'palette-btn tap-target'
  btn.dataset.type = type
  btn.setAttribute('aria-pressed', 'false')
  btn.innerHTML = `<span class="swatch" style="background:${COMPONENT_COLOR[type]}"></span><span>${def.label}</span>`
  btn.addEventListener('click', () => {
    if (placingType === type) {
      setPlacingType(null)
    } else {
      setPlacingType(type)
    }
  })
  paletteEl.appendChild(btn)
}

function setPlacingType(type) {
  placingType = type
  closeSheet()
  for (const btn of paletteEl.querySelectorAll('.palette-btn')) {
    const on = btn.dataset.type === type
    btn.classList.toggle('selected', on)
    btn.setAttribute('aria-pressed', String(on))
  }
}

// --- 예제 회로 메뉴 ---
for (const preset of PRESETS) {
  const btn = document.createElement('button')
  btn.textContent = preset.label
  btn.addEventListener('click', () => {
    pushHistory(history, model)
    applyPreset(model, preset.id)
    selectedUid = null
    closeSheet()
    closePresetMenu()
    afterModelChange()
  })
  presetMenu.appendChild(btn)
}

function closePresetMenu() {
  presetMenu.hidden = true
  btnPresets.setAttribute('aria-expanded', 'false')
}

btnPresets.addEventListener('click', () => {
  const willOpen = presetMenu.hidden
  closeFlowSettingsMenu()
  presetMenu.hidden = !willOpen
  btnPresets.setAttribute('aria-expanded', String(willOpen))
})

document.addEventListener('click', (e) => {
  if (!presetMenu.hidden && !e.target.closest('.preset-wrap')) closePresetMenu()
  if (!flowSettingsMenu.hidden && !e.target.closest('.flow-wrap')) closeFlowSettingsMenu()
})

// --- 전류 흐름 표시 설정(표시/숨김, 전류 방향 ↔ 전자 이동 방향) ---
function closeFlowSettingsMenu() {
  flowSettingsMenu.hidden = true
  btnFlowSettings.setAttribute('aria-expanded', 'false')
}

btnFlowSettings.addEventListener('click', () => {
  const willOpen = flowSettingsMenu.hidden
  closePresetMenu()
  flowSettingsMenu.hidden = !willOpen
  btnFlowSettings.setAttribute('aria-expanded', String(willOpen))
})

toggleFlowVisible.addEventListener('click', () => {
  flowVisible = !flowVisible
  toggleFlowVisible.setAttribute('aria-checked', String(flowVisible))
  toggleFlowMode.disabled = !flowVisible
})

toggleFlowMode.addEventListener('click', () => {
  flowMode = flowMode === FLOW_MODE_ELECTRON ? FLOW_MODE_CURRENT : FLOW_MODE_ELECTRON
  toggleFlowMode.setAttribute('aria-checked', String(flowMode === FLOW_MODE_ELECTRON))
})

// --- 되돌리기 / 전체 지우기 ---
btnUndo.addEventListener('click', () => {
  const prev = undo(history, model)
  if (!prev) return
  model = prev
  selectedUid = null
  closeSheet()
  afterModelChange()
})

btnClear.addEventListener('click', () => {
  pushHistory(history, model)
  clearModel(model)
  selectedUid = null
  closeSheet()
  afterModelChange()
})

// --- 크게 보기(전체화면 우선, 실패하면 새 탭) ---
btnExpand.addEventListener('click', async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {})
    return
  }
  try {
    await document.documentElement.requestFullscreen()
  } catch {
    window.open(location.href, '_blank', 'noopener')
  }
})

// --- 캔버스 입력 ---
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const hit = pick(rect.width, rect.height, model, x, y)
  if (!hit) return

  if (placingType) {
    if (canPlace(model, hit.edge.key, placingType)) {
      pushHistory(history, model)
      placeComponent(model, hit.edge.key, placingType)
      setPlacingType(null)
      afterModelChange()
    }
    return
  }

  if (hit.item) {
    selectedUid = hit.item.uid
    openSheet(hit.item)
  } else {
    selectedUid = null
    closeSheet()
  }
})

// --- 하단 시트(부품 편집) ---
function openSheet(item) {
  const def = COMPONENT_TYPES[item.type]
  sheetTitle.textContent = def.label
  sheetBody.innerHTML = ''
  btnFlip.hidden = item.type !== 'battery'
  btnToggleSwitch.hidden = item.type !== 'switch'

  if (def.options) {
    for (const value of def.options) {
      const b = document.createElement('button')
      b.className = 'value-btn tap-target'
      b.textContent = `${value}${def.unit}`
      b.classList.toggle('selected', item.value === value)
      b.addEventListener('click', () => {
        updateComponent(model, item.uid, { value })
        afterModelChange()
        openSheet(findComponent(model, item.uid))
      })
      sheetBody.appendChild(b)
    }
  }

  // ⚠️ 값 버튼과 정보 표시는 **둘 다** 나와야 한다.
  //    전구에 options 를 붙이면서 else-if 사슬 때문에 정보 표시가 통째로 사라졌었다
  //    (2026-08-26). 값을 고를 수 있는 부품이라고 해서 상태를 안 보여 줄 이유가 없다.
  if (item.type === 'bulb') {
    const info = document.createElement('div')
    info.className = 'sheet-info'
    sheetBody.appendChild(info)
    updateBulbInfo(info, item)
  }

  if (item.type === 'ammeter' || item.type === 'voltmeter') {
    const info = document.createElement('div')
    info.className = 'sheet-info'
    sheetBody.appendChild(info)
    updateMeterInfo(info, item)
  } else if (item.type === 'switch') {
    const info = document.createElement('div')
    info.textContent = item.closed ? '지금 닫혀 있어요 (전류가 흘러요)' : '지금 열려 있어요 (전류가 끊겨요)'
    sheetBody.appendChild(info)
  }

  btnToggleSwitch.textContent = item.closed ? '스위치 열기' : '스위치 닫기'

  sheet.hidden = false
  sheetBackdrop.hidden = false
}

// 계기판·정보 텍스트는 크기(절댓값)만 보여준다 — 방향은 캔버스의 전류 흐름 애니메이션이 알려준다.
function updateMeterInfo(el, item) {
  const current = Math.abs(solveResult.current.get(item.uid) ?? 0)
  if (item.type === 'ammeter') {
    el.textContent = `측정값: ${current.toFixed(3)} A`
  } else {
    el.textContent = `측정값: ${(current * 1_000_000).toFixed(3)} V`
  }
}

function updateBulbInfo(el, item) {
  const current = Math.abs(solveResult.current.get(item.uid) ?? 0)
  const R = bulbResistance(item.value)
  const rated = bulbRatedPower(item.value)
  const power = current * current * R
  const ratio = power / rated
  // 규격과 함께 보여 준다 — «0.9W» 라는 숫자만으로는 센지 약한지 알 수 없다.
  let state = ''
  if (ratio > BULB_OVERPOWER_RATIO) state = ' · 과전류! 끊어질 위험'
  else if (ratio > 1) state = ' · 과전류'
  el.textContent =
    `규격: ${item.value}V (${R.toFixed(0)}Ω · ${rated.toFixed(2)}W) · ` +
    `전류: ${current.toFixed(3)} A · 소비전력: ${power.toFixed(2)} W` +
    ` (정격의 ${(ratio * 100).toFixed(0)}%)${state}`
}

function closeSheet() {
  sheet.hidden = true
  sheetBackdrop.hidden = true
}

btnFlip.addEventListener('click', () => {
  if (!selectedUid) return
  const item = findComponent(model, selectedUid)
  updateComponent(model, selectedUid, { flipped: !item.flipped })
  afterModelChange()
})

btnToggleSwitch.addEventListener('click', () => {
  if (!selectedUid) return
  const item = findComponent(model, selectedUid)
  updateComponent(model, selectedUid, { closed: !item.closed })
  afterModelChange()
  openSheet(findComponent(model, selectedUid))
})

btnDelete.addEventListener('click', () => {
  if (!selectedUid) return
  pushHistory(history, model)
  removeComponent(model, selectedUid)
  selectedUid = null
  closeSheet()
  afterModelChange()
})

btnSheetClose.addEventListener('click', () => {
  selectedUid = null
  closeSheet()
})

sheetBackdrop.addEventListener('click', () => {
  selectedUid = null
  closeSheet()
})

// --- 모델이 바뀔 때마다: 해석 → 힌트 → UI 갱신 ---
function afterModelChange() {
  solveResult = solveCircuit(model)
  hintResult = diagnose(model, solveResult)
  hintBar.textContent = hintResult ? hintResult.message : ''
  if (hintResult) hintBar.dataset.level = hintResult.level
  else hintBar.removeAttribute('data-level')
  btnUndo.disabled = history.stack.length === 0
  if (selectedUid) {
    const item = findComponent(model, selectedUid)
    if (item) openSheet(item) // 값 변경 후 시트 내용 갱신(선택 표시 등)
  }
}

// --- 캔버스 크기 대응(리사이즈·DPR) ---
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

const resizeObserver = new ResizeObserver(resizeCanvas)
resizeObserver.observe(canvas)
window.addEventListener('orientationchange', resizeCanvas)

// --- 렌더 루프(전류 흐름 애니메이션) ---
let lastTs = 0
function frame(ts) {
  const dt = lastTs ? (ts - lastTs) / 1000 : 0
  lastTs = ts
  flowPhase += dt
  const rect = canvas.getBoundingClientRect()
  draw(ctx, rect.width, rect.height, model, {
    placingType,
    selectedUid,
    current: solveResult.current,
    flowPhase,
    flowVisible,
    flowMode,
  })
  requestAnimationFrame(frame)
}

// localStorage는 iOS 서드파티 스토리지 차단 등으로 실패할 수 있어 항상 감싼다.
// (현재 버전은 자동 저장을 사용하지 않지만, 추후 기능 추가 시를 대비해 헬퍼를 남겨둔다)
function safeLocalStorage() {
  try {
    const testKey = '__circuit_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return window.localStorage
  } catch {
    return null
  }
}
safeLocalStorage()

resizeCanvas()
afterModelChange()
requestAnimationFrame(frame)
