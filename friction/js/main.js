// 부트스트랩: DOM 이벤트 ↔ 순수 모델(model.js) ↔ 그리기(render.js).
// 이 파일만 DOM을 직접 건드린다.

import {
  PAIRS,
  MAX_TRANSFER,
  getPair,
  createModel,
  rub,
  reset,
  setPair,
  netCharge,
  totalElectrons,
  createForceModel,
  setForceCharge,
  forceKind,
  forceLabel,
  euroParticle,
  ATTRACT,
  REPEL,
  NONE,
} from './model.js'
import { computeLayout, screenToLogical, rubZone, drawRubMode, drawForceMode } from './render.js'

const model = createModel()
const forceModel = createForceModel()

const state = {
  mode: 'rub', // 'rub' | 'force'
  chargeMode: 'all',
  rubbing: false,
  time: 0,
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
const btnRub = document.getElementById('btn-rub')
const btnReset = document.getElementById('btn-reset')

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
    for (const b of pairButtons.querySelectorAll('.chip')) b.classList.toggle('selected', b.dataset.pairId === pair.id)
    updateHint()
  })
  pairButtons.appendChild(btn)
}

// --- 전하 보기 모드 ---
for (const btn of document.querySelectorAll('[data-charge-mode]')) {
  btn.addEventListener('click', () => {
    state.chargeMode = btn.dataset.chargeMode
    for (const b of document.querySelectorAll('[data-charge-mode]')) b.classList.toggle('selected', b === btn)
    updateHint()
  })
}

// --- 모드 전환 ---
function setMode(mode) {
  state.mode = mode
  tabRub.classList.toggle('selected', mode === 'rub')
  tabForce.classList.toggle('selected', mode === 'force')
  tabRub.setAttribute('aria-selected', String(mode === 'rub'))
  tabForce.setAttribute('aria-selected', String(mode === 'force'))
  controlsRub.hidden = mode !== 'rub'
  controlsForce.hidden = mode !== 'force'
  updateHint()
}
tabRub.addEventListener('click', () => setMode('rub'))
tabForce.addEventListener('click', () => setMode('force'))

// --- 힘 관찰 모드의 전하 선택 ---
for (const row of document.querySelectorAll('[data-side]')) {
  const side = row.dataset.side
  for (const btn of row.querySelectorAll('.chip')) {
    btn.addEventListener('click', () => {
      setForceCharge(forceModel, side, Number(btn.dataset.charge))
      for (const b of row.querySelectorAll('.chip')) b.classList.toggle('selected', b === btn)
      updateHint()
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
  reset(model)
  state.movingElectrons.length = 0
  updateHint()
})

// --- 문지르기 ---
function doRub() {
  if (model.transferred >= MAX_TRANSFER) {
    updateHint()
    return
  }
  rub(model, 1)
  state.movingElectrons.push({ t: 0 })
  updateHint()
}

btnRub.addEventListener('click', doRub)

// 캔버스 위를 좌우로 드래그해도 문질러진다 — 실제로 '문지르는' 손동작에 가깝다.
// 일정 거리(RUB_DISTANCE)를 움직일 때마다 전자 하나가 옮겨간다.
const RUB_DISTANCE = 60
let dragging = false
let lastX = 0
let accumulated = 0

function pointerLogical(e) {
  const rect = canvas.getBoundingClientRect()
  const layout = computeLayout(rect.width, rect.height)
  return screenToLogical(layout, e.clientX - rect.left, e.clientY - rect.top)
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'rub') return
  const p = pointerLogical(e)
  const zone = rubZone()
  if (p.x < zone.x || p.x > zone.x + zone.w || p.y < zone.y || p.y > zone.y + zone.h) return
  dragging = true
  state.rubbing = true
  lastX = p.x
  accumulated = 0
  canvas.setPointerCapture?.(e.pointerId)
})

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  const p = pointerLogical(e)
  accumulated += Math.abs(p.x - lastX)
  lastX = p.x
  while (accumulated >= RUB_DISTANCE) {
    accumulated -= RUB_DISTANCE
    doRub()
  }
})

function endDrag() {
  dragging = false
  state.rubbing = false
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', endDrag)
canvas.addEventListener('pointerleave', endDrag)

// --- 안내 문구 ---
function updateHint() {
  if (state.mode === 'force') {
    const kind = forceKind(forceModel)
    hintBar.textContent = forceLabel(kind)
    hintBar.dataset.tone = kind === NONE ? 'info' : 'result'
    return
  }

  const pair = getPair(model.pairId)
  if (model.transferred === 0) {
    hintBar.textContent = '아직 문지르지 않았어요. 두 물체 모두 중성입니다.'
    hintBar.dataset.tone = 'info'
    return
  }
  const donorName = pair[pair.donor].name
  const acceptor = pair.donor === 'a' ? 'b' : 'a'
  const acceptorName = pair[acceptor].name
  const full = model.transferred >= MAX_TRANSFER ? ' (더 문지를 수 없어요)' : ''
  hintBar.textContent =
    `전자 ${model.transferred}개가 ${donorName} → ${acceptorName}${euroParticle(acceptorName)} 옮겨갔어요. ` +
    `${donorName} ${signText(netCharge(model, pair.donor))}, ${acceptorName} ${signText(netCharge(model, acceptor))} · ` +
    `전자 총합 ${totalElectrons(model)}개(변하지 않음)${full}`
  hintBar.dataset.tone = 'result'
}

function signText(net) {
  if (net > 0) return '(+)전기'
  if (net < 0) return '(−)전기'
  return '중성'
}

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
  if (state.mode === 'rub') drawRubMode(ctx, rect.width, rect.height, model, state)
  else drawForceMode(ctx, rect.width, rect.height, forceModel, forceKind(forceModel), state)

  requestAnimationFrame(frame)
}

resizeCanvas()
setMode('rub')
requestAnimationFrame(frame)

// 브라우저 자동화·수동 점검에서 상태를 들여다볼 수 있게 열어둔다(기능에는 영향 없음).
window.__sim = { model, forceModel, state, ATTRACT, REPEL, NONE }
