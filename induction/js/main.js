// 부트스트랩: DOM 이벤트 ↔ 순수 모델 ↔ 그리기. 이 파일만 DOM을 직접 건드린다.

import {
  createModel,
  setRodCharge,
  setRodTipX,
  setMode,
  stepCan,
  stepScope,
  resetCan,
  ROD_W,
  ATTRACT,
  REPEL,
  NONE,
} from './model.js'
import { computeLayout, screenToLogical, drawCanMode, drawScopeMode } from './render.js'

const model = createModel()
const state = { showCharges: true, time: 0 }

const canvas = document.getElementById('board')
const ctx = canvas.getContext('2d')
const hintBar = document.getElementById('hint-bar')

// 안내 문구는 "무엇을 해 보라"까지만 말한다. 관찰 결과를 대신 말해주면 학생이 스스로 알아낼
// 것이 없어진다(2026-08-06 사용자 피드백으로 결과 설명을 전부 걷어냈다).
const HINTS = {
  can: '대전체를 끌어서 물체에 가까이 가져가 보세요. 닿게 하면 어떻게 될까요?',
  scope: '대전체를 끌어서 검전기 금속판에 가까이 가져가 보세요. 금속판에 닿게 한 뒤 다시 치워 보면?',
}

// --- 모드 전환 ---
function applyMode(mode) {
  setMode(model, mode)
  document.getElementById('tab-can').classList.toggle('selected', mode === 'can')
  document.getElementById('tab-scope').classList.toggle('selected', mode === 'scope')
  document.getElementById('tab-can').setAttribute('aria-selected', String(mode === 'can'))
  document.getElementById('tab-scope').setAttribute('aria-selected', String(mode === 'scope'))
  if (mode === 'can') resetCan(model)
  hintBar.textContent = HINTS[mode]
  syncChips()
}
document.getElementById('tab-can').addEventListener('click', () => applyMode('can'))
document.getElementById('tab-scope').addEventListener('click', () => applyMode('scope'))

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

// --- 되돌리기 ---
document.getElementById('btn-reset')?.addEventListener('click', () => {
  resetCan(model)
  syncChips()
})

// --- 칩 버튼들 ---
function bindChips(selector, attr, apply) {
  for (const btn of document.querySelectorAll(selector)) {
    btn.addEventListener('click', () => {
      apply(btn.dataset[attr])
      syncChips()
    })
  }
}
// 막대 종류를 바꾸면 새 막대를 든 셈이라, 앞서 나눠준 전하도 함께 처음 상태로 되돌린다.
bindChips('#rod-buttons .chip', 'rod', (v) => {
  setRodCharge(model, Number(v))
  resetCan(model)
})

function syncChips() {
  for (const b of document.querySelectorAll('#rod-buttons .chip')) {
    // rodCharge는 부호가 붙은 **개수**라 부호끼리 견준다
    b.classList.toggle('selected', Number(b.dataset.rod) === Math.sign(model.rodCharge))
  }
}

// --- 전하 보기 토글 ---
for (const btn of document.querySelectorAll('[data-show-charges]')) {
  btn.addEventListener('click', () => {
    state.showCharges = btn.dataset.showCharges === 'on'
    for (const b of document.querySelectorAll('[data-show-charges]')) b.classList.toggle('selected', b === btn)
  })
}

// --- 막대를 직접 끌어 옮긴다 ---
// 슬라이더로도 되게 했었지만, 대전체를 손으로 가져가는 동작이 훨씬 직관적이라 드래그만 남겼다.
let dragging = false

function pointerLogical(e) {
  const rect = canvas.getBoundingClientRect()
  const layout = computeLayout(rect.width, rect.height)
  return screenToLogical(layout, e.clientX - rect.left, e.clientY - rect.top)
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerLogical(e)
  // 막대 근처를 눌렀을 때만 잡는다. 손가락으로는 정밀하게 누르기 어려워 여유를 크게 준다.
  if (p.x >= model.rodTipX - ROD_W - 40 && p.x <= model.rodTipX + 40) {
    dragging = true
    canvas.setPointerCapture?.(e.pointerId)
  }
})

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  setRodTipX(model, pointerLogical(e).x)
})

function endDrag() {
  dragging = false
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
let lastTs = 0
function frame(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0
  lastTs = ts
  state.time += dt

  // 캔은 실제로 굴러다닌다. 검전기는 고정된 장치라 움직이지 않지만, 막대가 닿았는지는 봐야 한다.
  if (model.mode === 'can') stepCan(model, dt)
  else if (stepScope(model)) syncChips() // 접촉으로 대전됐으면 '검전기 상태' 칩도 맞춰준다

  const rect = canvas.getBoundingClientRect()
  if (model.mode === 'can') drawCanMode(ctx, rect.width, rect.height, model, state)
  else drawScopeMode(ctx, rect.width, rect.height, model, state)

  requestAnimationFrame(frame)
}

resizeCanvas()
applyMode('can')
requestAnimationFrame(frame)

window.__sim = { model, state, ATTRACT, REPEL, NONE }
