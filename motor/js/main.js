// 부트스트랩: DOM 이벤트 ↔ 순수 모델 ↔ three.js 장면. 이 파일만 DOM을 직접 건드린다.

import {
  MAX_CURRENT,
  createModel,
  setMode,
  setOn,
  setDirection,
  setMagnetPolarity,
  setCurrent,
  step,
} from './model.js'
import { createScene } from './render.js'

const model = createModel()
const state = { showHelper: false }

const canvas = document.getElementById('board')
const scene = createScene(canvas)
const hintBar = document.getElementById('hint-bar')
const btnSwitch = document.getElementById('btn-switch')
const btnHelper = document.getElementById('btn-helper')
const directionButtons = document.getElementById('direction-buttons')
const polarityButtons = document.getElementById('polarity-buttons')
const currentButtons = document.getElementById('current-buttons')

// 안내 문구는 "무엇을 해 보라"까지만. 관찰 결과는 학생이 스스로 말해야 한다.
const HINTS = {
  swing: '전류 방향과 자석 극 배치를 바꾸며 그네가 어느 쪽으로 흔들리는지 살펴보세요. (손가락으로 시점을 돌릴 수 있어요)',
  motor: '전류 방향과 자석 극 배치를 바꾸며 전동기가 어느 방향으로 도는지 살펴보세요. (손가락으로 시점을 돌릴 수 있어요)',
}

// --- 전류 세기 버튼 ---
for (let i = 0; i <= MAX_CURRENT; i++) {
  const btn = document.createElement('button')
  btn.className = 'chip tap-target'
  btn.dataset.current = String(i)
  btn.textContent = i === 0 ? '0' : '■'.repeat(i)
  btn.setAttribute('aria-label', `전류 세기 ${i}단계`)
  btn.addEventListener('click', () => {
    setCurrent(model, i)
    syncChips()
  })
  currentButtons.appendChild(btn)
}

// --- 모드 전환 ---
function setModeUI(mode) {
  setMode(model, mode)
  document.getElementById('tab-swing').classList.toggle('selected', mode === 'swing')
  document.getElementById('tab-motor').classList.toggle('selected', mode === 'motor')
  document.getElementById('tab-swing').setAttribute('aria-selected', String(mode === 'swing'))
  document.getElementById('tab-motor').setAttribute('aria-selected', String(mode === 'motor'))
  hintBar.textContent = HINTS[mode]
  scene.focusMode(mode)
}
document.getElementById('tab-swing').addEventListener('click', () => setModeUI('swing'))
document.getElementById('tab-motor').addEventListener('click', () => setModeUI('motor'))

// --- 스위치 ---
btnSwitch.addEventListener('click', () => {
  setOn(model, !model.on)
  syncChips()
})

// --- 전류 방향 ---
for (const btn of directionButtons.querySelectorAll('.chip')) {
  btn.addEventListener('click', () => {
    setDirection(model, Number(btn.dataset.dir))
    syncChips()
  })
}

// --- 자석 극 배치 ---
for (const btn of polarityButtons.querySelectorAll('.chip')) {
  btn.addEventListener('click', () => {
    setMagnetPolarity(model, Number(btn.dataset.polarity))
    syncChips()
  })
}

// --- 오른손 법칙 보기 ---
btnHelper.addEventListener('click', () => {
  state.showHelper = !state.showHelper
  btnHelper.classList.toggle('selected', state.showHelper)
})

function syncChips() {
  btnSwitch.textContent = model.on ? '스위치 켜짐' : '스위치 꺼짐'
  btnSwitch.classList.toggle('selected', model.on)
  for (const btn of directionButtons.querySelectorAll('.chip')) {
    btn.classList.toggle('selected', Number(btn.dataset.dir) === model.direction)
  }
  for (const btn of polarityButtons.querySelectorAll('.chip')) {
    btn.classList.toggle('selected', Number(btn.dataset.polarity) === model.magnetPolarity)
  }
  for (const btn of currentButtons.querySelectorAll('.chip')) {
    btn.classList.toggle('selected', Number(btn.dataset.current) === model.current)
  }
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
  scene.resize(Math.max(1, rect.width), Math.max(1, rect.height))
}
new ResizeObserver(resizeCanvas).observe(canvas)
window.addEventListener('orientationchange', resizeCanvas)

// --- 렌더 루프 ---
let lastTs = 0
function frame(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0
  lastTs = ts

  step(model, dt)
  scene.update(model, state.showHelper)
  scene.renderFrame()
  requestAnimationFrame(frame)
}

resizeCanvas()
syncChips()
setModeUI('swing')
requestAnimationFrame(frame)

window.__sim = { model, state, scene }
