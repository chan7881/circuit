// 부트스트랩: DOM 이벤트 ↔ 순수 모델(model.js) ↔ 그리기(render.js).
// 이 파일만 DOM을 직접 건드린다.

import {
  PAIRS,
  getPair,
  createModel,
  rubByDistance,
  reset,
  setPair,
  createHockeyModel,
  resetHockey,
  setHockeyCharge,
  movePaddle,
  releasePaddle,
  stepHockey,
  ATTRACT,
  REPEL,
  NONE,
} from './model.js'
import {
  computeLayout,
  screenToLogical,
  drawRubMode,
  drawHockeyMode,
  defaultHandPos,
  clampHandPos,
  handBox,
  isTouching,
  toFieldCoords,
} from './render.js'

const model = createModel()
const hockey = createHockeyModel()

const state = {
  mode: 'rub', // 'rub' | 'hockey'
  chargeMode: 'all',
  rubbing: false,
  time: 0,
  handPos: defaultHandPos(),
  movingElectrons: [], // { t } — 0→1로 진행하는 애니메이션
}

const canvas = document.getElementById('board')
const ctx = canvas.getContext('2d')
const hintBar = document.getElementById('hint-bar')
const tabRub = document.getElementById('tab-rub')
const tabForce = document.getElementById('tab-force')
const controlsRub = document.getElementById('controls-rub')
const controlsForce = document.getElementById('controls-force')
const pairButtons = document.getElementById('pair-buttons')
const btnReset = document.getElementById('btn-reset')

// 안내 문구는 "무엇을 해 보라"까지만 말한다. 관찰 결과를 대신 말해주면 학생이 스스로 알아낼
// 것이 없어진다(2026-08-06 사용자 피드백으로 결과 설명을 전부 걷어냈다).
const HINTS = {
  rub: '물체를 끌어다 서로 맞대고 문질러 보세요.',
  hockey: '채를 끌고 다니며 퍽을 움직여 보세요. 전기의 종류를 바꿔가며 해 보세요.',
}

// --- 물체 쌍 버튼 ---
for (const pair of PAIRS) {
  const btn = document.createElement('button')
  btn.className = 'chip tap-target'
  btn.dataset.pairId = pair.id
  btn.textContent = pair.label
  if (pair.id === model.pairId) btn.classList.add('selected')
  btn.addEventListener('click', () => {
    setPair(model, pair.id)
    state.movingElectrons.length = 0
    state.handPos = defaultHandPos()
    for (const b of pairButtons.querySelectorAll('.chip')) b.classList.toggle('selected', b.dataset.pairId === pair.id)
  })
  pairButtons.appendChild(btn)
}

// --- 전하 보기 모드 ---
for (const btn of document.querySelectorAll('[data-charge-mode]')) {
  btn.addEventListener('click', () => {
    state.chargeMode = btn.dataset.chargeMode
    for (const b of document.querySelectorAll('[data-charge-mode]')) b.classList.toggle('selected', b === btn)
  })
}

// --- 모드 전환 ---
function setMode(mode) {
  state.mode = mode
  tabRub.classList.toggle('selected', mode === 'rub')
  tabForce.classList.toggle('selected', mode === 'hockey')
  tabRub.setAttribute('aria-selected', String(mode === 'rub'))
  tabForce.setAttribute('aria-selected', String(mode === 'hockey'))
  controlsRub.hidden = mode !== 'rub'
  controlsForce.hidden = mode !== 'hockey'
  hintBar.textContent = HINTS[mode]
  dragging = null
}
tabRub.addEventListener('click', () => setMode('rub'))
tabForce.addEventListener('click', () => setMode('hockey'))

// --- 에어하키 전하 선택 ---
for (const row of document.querySelectorAll('[data-side]')) {
  const which = row.dataset.side // 'paddle' | 'puck'
  for (const btn of row.querySelectorAll('.chip')) {
    btn.addEventListener('click', () => {
      setHockeyCharge(hockey, which, Number(btn.dataset.charge))
      for (const b of row.querySelectorAll('.chip')) b.classList.toggle('selected', b === btn)
    })
  }
}

// --- 크게 보기 (전체화면 우선, 막혀 있으면 새 탭) ---
// 학습지 iframe은 16:9로 납작해서 이 안에서는 캔버스가 너무 작다 — 학생이 제대로 관찰하려면
// 이 버튼으로 키워야 한다. 학습지 앱의 iframe에 allow="fullscreen"이 없는 경우를 대비해
// 전체화면 요청이 실패하면 새 탭으로 여는 폴백을 둔다(circuit 시뮬레이터와 같은 방식).
document.getElementById('btn-expand').addEventListener('click', async () => {
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

// --- 되돌리기 ---
btnReset.addEventListener('click', () => {
  if (state.mode === 'rub') {
    reset(model)
    state.movingElectrons.length = 0
    state.handPos = defaultHandPos()
  } else {
    resetHockey(hockey)
  }
})

// --- 드래그 조작 ---
// 문지르기: 위쪽 물체를 직접 끌고 다닌다. 두 물체가 맞닿은 채로 움직인 거리만 쌓인다.
// 에어하키: 채를 끌고 다닌다.

let dragging = null // null | 'hand' | 'paddle'
let lastPointer = null

function pointerLogical(e) {
  const rect = canvas.getBoundingClientRect()
  const layout = computeLayout(rect.width, rect.height)
  return screenToLogical(layout, e.clientX - rect.left, e.clientY - rect.top)
}

function insideBox(p, box, pad = 10) {
  return p.x >= box.x - pad && p.x <= box.x + box.w + pad && p.y >= box.y - pad && p.y <= box.y + box.h + pad
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerLogical(e)
  if (state.mode === 'rub') {
    // 물체를 정확히 집지 않아도 잡히게 여유를 둔다 — 손가락으로는 정밀하게 누르기 어렵다
    if (!insideBox(p, handBox(state.handPos), 22)) return
    dragging = 'hand'
    state.rubbing = true
  } else {
    dragging = 'paddle'
    const f = toFieldCoords(p)
    movePaddle(hockey, f.x, f.y, 0)
  }
  lastPointer = p
  canvas.setPointerCapture?.(e.pointerId)
})

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  const p = pointerLogical(e)

  if (dragging === 'hand') {
    const next = clampHandPos({ x: p.x, y: p.y })
    // 맞닿아 있을 때만 문지른 거리로 친다 — 허공에서 휘저으면 아무 일도 일어나지 않는다.
    // (그래야 "문질러야 대전된다"는 조건 자체가 관찰 대상이 된다)
    if (isTouching(next) && lastPointer) {
      const distance = Math.hypot(next.x - state.handPos.x, next.y - state.handPos.y)
      const moved = rubByDistance(model, distance)
      for (let i = 0; i < moved; i++) state.movingElectrons.push({ t: 0 })
    }
    state.handPos = next
  } else {
    const f = toFieldCoords(p)
    // dt는 렌더 루프가 아니라 포인터 이벤트 간격으로 잡아야 채의 속도가 실제 손놀림을 따라간다
    movePaddle(hockey, f.x, f.y, Math.max(0.008, (e.timeStamp - (lastPointer?.ts ?? e.timeStamp)) / 1000))
  }
  p.ts = e.timeStamp
  lastPointer = p
})

function endDrag() {
  if (dragging === 'paddle') releasePaddle(hockey)
  dragging = null
  state.rubbing = false
  lastPointer = null
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', endDrag)
canvas.addEventListener('pointerleave', endDrag)

// --- 캔버스 크기 대응 ---
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
new ResizeObserver(resizeCanvas).observe(canvas)
window.addEventListener('orientationchange', resizeCanvas)

// --- 렌더 루프 ---
const ELECTRON_SPEED = 1.6 // 1초에 진행하는 t 값
let lastTs = 0
function frame(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0
  lastTs = ts
  state.time += dt

  for (const e of state.movingElectrons) e.t += dt * ELECTRON_SPEED
  state.movingElectrons = state.movingElectrons.filter((e) => e.t < 1)

  const rect = canvas.getBoundingClientRect()
  if (state.mode === 'rub') {
    drawRubMode(ctx, rect.width, rect.height, model, state)
  } else {
    stepHockey(hockey, dt)
    drawHockeyMode(ctx, rect.width, rect.height, hockey)
  }

  requestAnimationFrame(frame)
}

resizeCanvas()
setMode('rub')
requestAnimationFrame(frame)

// 브라우저 자동화·수동 점검에서 상태를 들여다볼 수 있게 열어둔다(기능에는 영향 없음).
window.__sim = { model, hockey, state, getPair, ATTRACT, REPEL, NONE }
