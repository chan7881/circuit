// 부트스트랩: DOM 이벤트 ↔ 순수 모델 ↔ 그리기. 이 파일만 DOM을 직접 건드린다.

import { MAX_PUMP, PIPE_LEVELS, createModel, setPump, setPipe, toggleOpen, flow } from './model.js'
import { draw } from './render.js'

const model = createModel()
const state = { time: 0, phase: 0, showMapping: false }

const canvas = document.getElementById('board')
const ctx = canvas.getContext('2d')
const hintBar = document.getElementById('hint-bar')
const pumpSlider = document.getElementById('pump-slider')
const pumpValue = document.getElementById('pump-value')
const pipeButtons = document.getElementById('pipe-buttons')
const btnGate = document.getElementById('btn-gate')
const btnMapping = document.getElementById('btn-mapping')

// 안내 문구는 "무엇을 해 보라"까지만. 관찰 결과는 학생이 스스로 말해야 한다.
hintBar.textContent = '펌프 세기와 관의 굵기를 바꿔 보고, 밸브를 잠가 보세요.'

// --- 펌프 세기(=전지) 슬라이드바 ---
// 끝까지 내리면(0) 펌프가 꺼져 물이 흐르지 않는다.
pumpSlider.max = String(MAX_PUMP)
pumpSlider.value = String(model.pump)
pumpSlider.addEventListener('input', () => {
  setPump(model, pumpSlider.value)
  syncChips()
})

// --- 관 굵기(=저항) ---
PIPE_LEVELS.forEach((level, i) => {
  const btn = document.createElement('button')
  btn.className = 'chip tap-target'
  btn.dataset.pipe = String(i)
  btn.textContent = level.label
  btn.addEventListener('click', () => {
    setPipe(model, i)
    syncChips()
  })
  pipeButtons.appendChild(btn)
})

// --- 밸브(=스위치) ---
btnGate.addEventListener('click', () => {
  toggleOpen(model)
  syncChips()
})

// --- 대응 관계 보기 ---
// 기본은 꺼짐이다. 이 대응이 학습지에서 학생이 채울 빈칸이라 처음부터 보여주면 답을 알려주는
// 셈이 된다 — 스스로 짝지어 본 뒤 확인용으로 켠다.
btnMapping.addEventListener('click', () => {
  state.showMapping = !state.showMapping
  syncChips()
})

function syncChips() {
  // 슬라이드바 값은 최댓값에 대한 비율(%)로 보여 준다 — 4.0 같은 숫자보다 읽기 쉽다.
  pumpValue.textContent = `${Math.round((model.pump / MAX_PUMP) * 100)}%`
  for (const b of pipeButtons.querySelectorAll('.chip')) {
    b.classList.toggle('selected', Number(b.dataset.pipe) === model.pipe)
  }
  btnGate.textContent = model.open ? '밸브·스위치 잠그기' : '밸브·스위치 열기'
  btnGate.classList.toggle('selected', !model.open)
  btnMapping.classList.toggle('selected', state.showMapping)
}

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
  // 입자가 고리를 도는 속도 = 흐름의 세기. 양쪽이 같은 값을 쓰므로 언제나 나란히 움직인다.
  state.phase = (state.phase + dt * flow(model) * 0.45) % 1

  const rect = canvas.getBoundingClientRect()
  draw(ctx, rect.width, rect.height, model, state)
  requestAnimationFrame(frame)
}

resizeCanvas()
syncChips()
requestAnimationFrame(frame)

window.__sim = { model, state }
