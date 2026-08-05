// 부트스트랩: DOM 이벤트 ↔ 순수 모델 ↔ 그리기. 이 파일만 DOM을 직접 건드린다.

import {
  CONDUCTOR,
  INSULATOR,
  createModel,
  setRodCharge,
  setProximity,
  setMaterial,
  setPreCharge,
  shiftedElectrons,
  nearSideCharge,
  farSideCharge,
  totalCharge,
  forceOnObject,
  foilTrend,
  chargeSignText,
  ATTRACT,
  REPEL,
  NONE,
} from './model.js'
import { computeLayout, screenToLogical, canBox, rodX, drawCanMode, drawScopeMode } from './render.js'

const model = createModel()
const state = { mode: 'can', showCharges: true, time: 0 }

const canvas = document.getElementById('board')
const ctx = canvas.getContext('2d')
const hintBar = document.getElementById('hint-bar')
const proximityInput = document.getElementById('proximity')
const materialGroup = document.getElementById('material-group')
const prechargeGroup = document.getElementById('precharge-group')

// --- 모드 전환 ---
function setMode(mode) {
  state.mode = mode
  document.getElementById('tab-can').classList.toggle('selected', mode === 'can')
  document.getElementById('tab-scope').classList.toggle('selected', mode === 'scope')
  document.getElementById('tab-can').setAttribute('aria-selected', String(mode === 'can'))
  document.getElementById('tab-scope').setAttribute('aria-selected', String(mode === 'scope'))
  // 검전기 모드에서는 물체 종류 대신 '검전기 상태'를 고른다
  materialGroup.hidden = mode !== 'can'
  prechargeGroup.hidden = mode !== 'scope'
  if (mode === 'scope') setMaterial(model, CONDUCTOR)
  else setPreCharge(model, 0)
  syncChips()
  updateHint()
}
document.getElementById('tab-can').addEventListener('click', () => setMode('can'))
document.getElementById('tab-scope').addEventListener('click', () => setMode('scope'))

// --- 크게 보기 (전체화면 우선, 막히면 새 탭) ---
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

// --- 칩 버튼들 ---
function bindChips(selector, attr, apply) {
  for (const btn of document.querySelectorAll(selector)) {
    btn.addEventListener('click', () => {
      apply(btn.dataset[attr])
      syncChips()
      updateHint()
    })
  }
}
bindChips('#rod-buttons .chip', 'rod', (v) => setRodCharge(model, Number(v)))
bindChips('#material-buttons .chip', 'material', (v) => setMaterial(model, v === 'insulator' ? INSULATOR : CONDUCTOR))
bindChips('#precharge-buttons .chip', 'precharge', (v) => setPreCharge(model, Number(v)))

function syncChips() {
  for (const b of document.querySelectorAll('#rod-buttons .chip')) {
    b.classList.toggle('selected', Number(b.dataset.rod) === model.rodCharge)
  }
  for (const b of document.querySelectorAll('#material-buttons .chip')) {
    b.classList.toggle('selected', b.dataset.material === model.material)
  }
  for (const b of document.querySelectorAll('#precharge-buttons .chip')) {
    b.classList.toggle('selected', Number(b.dataset.precharge) === model.preCharge)
  }
}

// --- 거리 슬라이더 ---
proximityInput.addEventListener('input', () => {
  setProximity(model, Number(proximityInput.value) / 100)
  updateHint()
})

// --- 캔버스에서 막대를 직접 드래그 ---
// 슬라이더만으로도 되지만, 대전체를 손으로 가져가는 동작이 훨씬 직관적이라 둘 다 지원한다.
let dragging = false
function pointerLogical(e) {
  const rect = canvas.getBoundingClientRect()
  const layout = computeLayout(rect.width, rect.height)
  return screenToLogical(layout, e.clientX - rect.left, e.clientY - rect.top)
}
function proximityFromX(x) {
  const objectLeft = state.mode === 'can' ? canBox(model).x : 400 - 60
  const farX = 30
  const nearX = objectLeft - 26 - 14
  return (x - farX) / (nearX - farX)
}
canvas.addEventListener('pointerdown', (e) => {
  const p = pointerLogical(e)
  const objectLeft = state.mode === 'can' ? canBox(model).x : 400 - 60
  const rx = rodX(model, objectLeft)
  // 막대 근처를 눌렀을 때만 드래그로 취급한다
  if (p.x >= rx - 30 && p.x <= rx + 56) {
    dragging = true
    canvas.setPointerCapture?.(e.pointerId)
  }
})
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  const p = pointerLogical(e)
  setProximity(model, proximityFromX(p.x))
  proximityInput.value = String(Math.round(model.proximity * 100))
  updateHint()
})
function endDrag() {
  dragging = false
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', endDrag)
canvas.addEventListener('pointerleave', endDrag)

// --- 안내 문구 ---
function updateHint() {
  const force = forceOnObject(model)
  model.__force = force // 렌더러가 물체를 끌리거나 밀리게 움직일 때 쓴다

  if (state.mode === 'scope') {
    const trend = foilTrend(model)
    if (trend === 'flat') {
      hintBar.textContent =
        model.preCharge === 0
          ? '대전체를 가까이 가져가 보세요.'
          : `(−)로 대전된 검전기예요. 금속박이 벌어져 있습니다. 대전체를 가까이 가져가 보세요.`
      hintBar.dataset.tone = 'info'
      return
    }
    const texts = {
      open: '금속박이 벌어졌어요 — 금속박 쪽으로 같은 종류의 전하가 몰렸기 때문이에요.',
      wider: '금속박이 더 벌어졌어요 → 대전체는 검전기와 **같은** 종류의 전기를 띠고 있어요.',
      narrower: '금속박이 오므라들었어요 → 대전체는 검전기와 **반대** 종류의 전기를 띠고 있어요.',
    }
    hintBar.textContent = texts[trend].replace(/\*\*/g, '')
    hintBar.dataset.tone = 'result'
    return
  }

  if (model.material === INSULATOR) {
    hintBar.textContent =
      shiftedElectrons(model) === 0 && model.proximity > 0.2
        ? '부도체에는 자유롭게 움직이는 전자가 없어서 전하가 몰리지 않아요.'
        : '플라스틱 통(부도체)입니다. 대전체를 가까이 가져가 보세요.'
    hintBar.dataset.tone = shiftedElectrons(model) === 0 && model.proximity > 0.2 ? 'result' : 'info'
    return
  }

  if (shiftedElectrons(model) === 0) {
    hintBar.textContent = '대전체를 금속 캔 가까이 가져가 보세요.'
    hintBar.dataset.tone = 'info'
    return
  }

  const forceText = force === ATTRACT ? '캔이 끌려와요' : force === REPEL ? '캔이 밀려나요' : ''
  hintBar.textContent =
    `전자 ${shiftedElectrons(model)}개가 이동했어요. ` +
    `가까운 쪽 ${chargeSignText(nearSideCharge(model))}, 먼 쪽 ${chargeSignText(farSideCharge(model))} · ` +
    `캔 전체 전하 ${totalCharge(model)}(변하지 않음) · ${forceText}`
  hintBar.dataset.tone = 'result'
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
let lastTs = 0
function frame(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0
  lastTs = ts
  state.time += dt
  const rect = canvas.getBoundingClientRect()
  if (state.mode === 'can') drawCanMode(ctx, rect.width, rect.height, model, state)
  else drawScopeMode(ctx, rect.width, rect.height, model, state)
  requestAnimationFrame(frame)
}

resizeCanvas()
setMode('can')
requestAnimationFrame(frame)

window.__sim = { model, state, ATTRACT, REPEL, NONE }
