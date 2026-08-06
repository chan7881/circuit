// 부트스트랩: DOM 이벤트 ↔ 순수 모델 ↔ three.js 장면. 이 파일만 DOM을 직접 건드린다.

import { MAX_CURRENT, createModel, setMode, setOn, setDirection, setCurrent, compassPositions, needleAngle } from './model.js'
import { createScene } from './render.js'

const model = createModel()
const state = {
  showFieldLines: false,
  /** 나침반마다 지금 그려지는 각도(라디안) — 목표 각도로 서서히 회전해 간다(아래 참고) */
  needleAngles: compassPositions(model).map(() => 0),
}

const canvas = document.getElementById('board')
const scene = createScene(canvas)
const hintBar = document.getElementById('hint-bar')
const btnSwitch = document.getElementById('btn-switch')
const btnFieldLines = document.getElementById('btn-fieldlines')
const directionButtons = document.getElementById('direction-buttons')
const currentButtons = document.getElementById('current-buttons')

// 안내 문구는 "무엇을 해 보라"까지만. 관찰 결과는 학생이 스스로 말해야 한다.
const HINTS = {
  coil: '전류 방향과 세기를 바꾸며 나침반의 반응을 살펴보세요. (화면을 손가락으로 끌면 시점을 돌릴 수 있어요)',
  wire: '전류 방향과 세기를 바꾸며 나침반의 반응을 살펴보세요. (도선이 실험대를 수직으로 지나갑니다 · 손가락으로 시점을 돌릴 수 있어요)',
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
  document.getElementById('tab-coil').classList.toggle('selected', mode === 'coil')
  document.getElementById('tab-wire').classList.toggle('selected', mode === 'wire')
  document.getElementById('tab-coil').setAttribute('aria-selected', String(mode === 'coil'))
  document.getElementById('tab-wire').setAttribute('aria-selected', String(mode === 'wire'))
  hintBar.textContent = HINTS[mode]
}
document.getElementById('tab-coil').addEventListener('click', () => setModeUI('coil'))
document.getElementById('tab-wire').addEventListener('click', () => setModeUI('wire'))

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

// --- 자기력선 보기 ---
btnFieldLines.addEventListener('click', () => {
  state.showFieldLines = !state.showFieldLines
  btnFieldLines.classList.toggle('selected', state.showFieldLines)
})

function syncChips() {
  btnSwitch.textContent = model.on ? '스위치 켜짐' : '스위치 꺼짐'
  btnSwitch.classList.toggle('selected', model.on)
  for (const btn of directionButtons.querySelectorAll('.chip')) {
    btn.classList.toggle('selected', Number(btn.dataset.dir) === model.direction)
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

// --- 바늘 각도를 -π~π로 정규화 ---
function normalizeAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/** 1초에 최대 이만큼(라디안) 돈다 — 순간 이동이 아니라 실제로 도는 것처럼 보이게 한다. */
const NEEDLE_TURN_SPEED = Math.PI * 2.6

// --- 렌더 루프 ---
let lastTs = 0
function frame(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0
  lastTs = ts

  const positions = compassPositions(model)
  // 코일↔도선 전환 등으로 개수가 달라지면 배열을 다시 맞춘다(모자란 칸은 0으로 시작).
  if (state.needleAngles.length !== positions.length) {
    state.needleAngles = positions.map((_, i) => state.needleAngles[i] ?? 0)
  }

  const maxDelta = NEEDLE_TURN_SPEED * dt
  positions.forEach((p, i) => {
    const target = needleAngle(model, p)
    const diff = normalizeAngle(target - state.needleAngles[i])
    if (Math.abs(diff) <= maxDelta || maxDelta <= 0) {
      state.needleAngles[i] = target
    } else {
      state.needleAngles[i] = state.needleAngles[i] + Math.sign(diff) * maxDelta
    }
  })

  scene.update(model, positions, state.needleAngles, state)
  scene.renderFrame()
  requestAnimationFrame(frame)
}

resizeCanvas()
syncChips()
setModeUI('coil')
requestAnimationFrame(frame)

window.__sim = { model, state, scene }
