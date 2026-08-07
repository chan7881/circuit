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
const state = { showHelper: false, paused: false, speed: 1 }

const canvas = document.getElementById('board')
const scene = createScene(canvas)
const hintBar = document.getElementById('hint-bar')
const btnSwitch = document.getElementById('btn-switch')
const btnHelper = document.getElementById('btn-helper')
const btnPause = document.getElementById('btn-pause')
const pauseGroup = document.getElementById('pause-group')
const directionButtons = document.getElementById('direction-buttons')
const polarityButtons = document.getElementById('polarity-buttons')
const currentSlider = document.getElementById('current-slider')
const currentValue = document.getElementById('current-value')
const speedButtons = document.getElementById('speed-buttons')
const speedGroup = document.getElementById('speed-group')

// 안내 문구는 "무엇을 해 보라"까지만. 관찰 결과는 학생이 스스로 말해야 한다.
const HINTS = {
  swing: '전류 방향과 자석 극 배치를 바꾸며 그네가 어느 쪽으로 흔들리는지 살펴보세요. (손가락으로 시점을 돌릴 수 있어요)',
  motor: '전류 방향과 자석 극 배치를 바꾸며 전동기가 어느 방향으로 도는지 살펴보세요. 일시정지하면 그 순간의 화살표를 천천히 볼 수 있어요. (손가락으로 시점을 돌릴 수 있어요)',
}

// --- 전류 세기 슬라이드바 ---
// 끝까지 내리면(0) 전류가 흐르지 않는다. 'input'을 쓰므로 끄는 동안에도 실시간으로 반응한다.
currentSlider.max = String(MAX_CURRENT)
currentSlider.value = String(model.current)
currentSlider.addEventListener('input', () => {
  setCurrent(model, currentSlider.value)
  syncChips()
})

// --- 재생 속도 ---
// 전동기가 빨리 돌면 원하는 순간에 멈추기 어려워서, 느리게 돌려 놓고 관찰할 수 있게 한다.
// 물리를 바꾸는 게 아니라 **시간이 흐르는 빠르기**만 바꾼다(dt에 곱한다) — 그래서 느리게
// 돌려도 전류·자기장·힘의 관계는 그대로다.
const SPEEDS = [0.2, 0.5, 1, 2]
for (const s of SPEEDS) {
  const btn = document.createElement('button')
  btn.className = 'chip tap-target'
  btn.dataset.speed = String(s)
  btn.textContent = `${s}×`
  btn.setAttribute('aria-label', `재생 속도 ${s}배`)
  btn.addEventListener('click', () => {
    state.speed = s
    syncChips()
  })
  speedButtons.appendChild(btn)
}

// --- 모드 전환 ---
function setModeUI(mode) {
  setMode(model, mode)
  document.getElementById('tab-swing').classList.toggle('selected', mode === 'swing')
  document.getElementById('tab-motor').classList.toggle('selected', mode === 'motor')
  document.getElementById('tab-swing').setAttribute('aria-selected', String(mode === 'swing'))
  document.getElementById('tab-motor').setAttribute('aria-selected', String(mode === 'motor'))
  hintBar.textContent = HINTS[mode]
  // 일시정지·재생 속도는 계속 도는 전동기에서만 쓸모가 있다(그네는 곧 한 자리에 멈춘다).
  // 그네 모드로 넘어갈 때 멈춤과 배속을 되돌리지 않으면, 버튼이 사라진 채로 그네가 얼어붙거나
  // 느리게 흔들리는 상태가 남는다.
  const isMotor = mode === 'motor'
  pauseGroup.hidden = !isMotor
  speedGroup.hidden = !isMotor
  if (!isMotor) {
    state.paused = false
    state.speed = 1
  }
  syncPause()
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

// --- 일시정지 / 재생 (전동기 모드) ---
function syncPause() {
  btnPause.textContent = state.paused ? '다시 돌리기' : '일시정지'
  btnPause.classList.toggle('selected', state.paused)
  btnPause.setAttribute('aria-pressed', String(state.paused))
}
btnPause.addEventListener('click', () => {
  state.paused = !state.paused
  syncPause()
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
  // 슬라이드바 값은 최댓값에 대한 비율(%)로 보여 준다 — 4.0 같은 숫자보다 읽기 쉽다.
  currentValue.textContent = `${Math.round((model.current / MAX_CURRENT) * 100)}%`
  for (const btn of speedButtons.querySelectorAll('.chip')) {
    btn.classList.toggle('selected', Number(btn.dataset.speed) === state.speed)
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

  // 멈춰 있어도 그리기는 계속한다 — 그래야 멈춘 상태에서도 시점을 돌려 볼 수 있다.
  if (!state.paused) step(model, dt * state.speed)
  scene.update(model, state.showHelper)
  scene.renderFrame()
  requestAnimationFrame(frame)
}

resizeCanvas()
syncChips()
setModeUI('swing')
requestAnimationFrame(frame)

window.__sim = { model, state, scene }
