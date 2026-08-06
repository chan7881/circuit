// 부트스트랩: DOM 이벤트 ↔ 순수 모델 ↔ 그리기. 이 파일만 DOM을 직접 건드린다.

import {
  APPLIANCES,
  createModel,
  isOn,
  toggle,
  allOff,
  setStandby,
  applianceWatt,
  totalWatt,
  standbyWatt,
  kwhPerHour,
  wonPerHour,
  gramCo2PerHour,
  maxWatt,
} from './model.js'
import { drawCompare } from './render.js'

const model = createModel()
const state = { mode: 'home', showEnergy: false, showNumbers: false }

const cardsEl = document.getElementById('cards')
const hintBar = document.getElementById('hint-bar')
const homeEl = document.getElementById('home')
const compareWrap = document.getElementById('compare-wrap')
const controlsHome = document.getElementById('controls-home')
const controlsCompare = document.getElementById('controls-compare')
const canvas = document.getElementById('board')
const ctx = canvas.getContext('2d')

const btnStandby = document.getElementById('btn-standby')
const btnAllOff = document.getElementById('btn-alloff')
const btnEnergy = document.getElementById('btn-energy')
const btnNumbers = document.getElementById('btn-numbers')

// 안내 문구는 "무엇을 해 보라"까지만. 관찰 결과는 학생이 스스로 말해야 한다.
const HINTS = {
  home: '기구를 켜고 끄면서 숫자가 어떻게 달라지는지 살펴보세요.',
  compare: '두 전구에서 빛과 열의 굵기를 비교해 보세요.',
}

// --- 기구 카드 ---
for (const a of APPLIANCES) {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'card tap-target'
  card.dataset.id = a.id
  card.innerHTML = `
    <span class="cname"></span>
    <span class="cwatt"></span>
    <span class="cstate"></span>
    <span class="cenergy"></span>
    <span class="cstandby"></span>`
  card.querySelector('.cname').textContent = a.name
  card.querySelector('.cwatt').textContent = `${a.watt} W`
  card.addEventListener('click', () => {
    toggle(model, a.id)
    syncHome()
  })
  cardsEl.appendChild(card)
}

function syncHome() {
  for (const card of cardsEl.querySelectorAll('.card')) {
    const id = card.dataset.id
    const a = APPLIANCES.find((x) => x.id === id)
    const on = isOn(model, id)
    card.setAttribute('aria-pressed', String(on))
    card.querySelector('.cstate').textContent = on ? '켜짐' : '꺼짐'
    // 에너지 전환은 학습지에서 학생이 채울 칸이라 기본은 감춘다
    card.querySelector('.cenergy').textContent = state.showEnergy ? a.energy : ''
    // 대기 전력은 껐을 때만 의미가 있다 — 껐는데도 전기가 나가는 게 이 토글의 관찰 거리다
    const leaking = model.countStandby && !on && a.standby > 0
    card.querySelector('.cstandby').textContent = leaking ? `대기 ${a.standby} W` : ''
    card.setAttribute(
      'aria-label',
      `${a.name} ${a.watt}와트, ${on ? '켜짐' : '꺼짐'}${leaking ? `, 대기 전력 ${a.standby}와트` : ''}`,
    )
  }

  const watt = totalWatt(model)
  document.getElementById('t-watt').textContent = `${watt.toLocaleString('ko-KR')} W`
  document.getElementById('t-kwh').textContent = `${kwhPerHour(model).toFixed(2)} kWh`
  document.getElementById('t-won').textContent = `${wonPerHour(model).toLocaleString('ko-KR')} 원`
  document.getElementById('t-co2').textContent = `${gramCo2PerHour(model).toLocaleString('ko-KR')} g`
  document.getElementById('t-bar').style.width = `${Math.min(100, (watt / maxWatt()) * 100)}%`

  const leak = standbyWatt(model)
  document.getElementById('t-note').textContent = leak > 0 ? `그중 꺼 놓은 기구에서 ${leak} W` : ''

  btnStandby.classList.toggle('selected', model.countStandby)
  btnEnergy.classList.toggle('selected', state.showEnergy)
}

btnStandby.addEventListener('click', () => {
  setStandby(model, !model.countStandby)
  syncHome()
})
btnAllOff.addEventListener('click', () => {
  allOff(model)
  syncHome()
})
btnEnergy.addEventListener('click', () => {
  state.showEnergy = !state.showEnergy
  syncHome()
})
btnNumbers.addEventListener('click', () => {
  state.showNumbers = !state.showNumbers
  btnNumbers.classList.toggle('selected', state.showNumbers)
  drawNow()
})

// --- 모드 전환 ---
function setMode(mode) {
  state.mode = mode
  document.getElementById('tab-home').classList.toggle('selected', mode === 'home')
  document.getElementById('tab-compare').classList.toggle('selected', mode === 'compare')
  document.getElementById('tab-home').setAttribute('aria-selected', String(mode === 'home'))
  document.getElementById('tab-compare').setAttribute('aria-selected', String(mode === 'compare'))
  homeEl.hidden = mode !== 'home'
  compareWrap.hidden = mode !== 'compare'
  controlsHome.hidden = mode !== 'home'
  controlsCompare.hidden = mode !== 'compare'
  hintBar.textContent = HINTS[mode]
  if (mode === 'compare') {
    resizeCanvas()
    drawNow()
  }
}
document.getElementById('tab-home').addEventListener('click', () => setMode('home'))
document.getElementById('tab-compare').addEventListener('click', () => setMode('compare'))

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

// --- 캔버스 ---
// 이 화면은 움직이는 것이 없어서 렌더 루프를 돌리지 않는다 — 값이 바뀔 때만 다시 그린다.
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function drawNow() {
  if (state.mode !== 'compare') return
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  drawCompare(ctx, rect.width, rect.height, state)
}

new ResizeObserver(() => {
  resizeCanvas()
  drawNow()
}).observe(canvas)
window.addEventListener('orientationchange', () => {
  resizeCanvas()
  drawNow()
})

syncHome()
setMode('home')

window.__sim = { model, state, applianceWatt, totalWatt, standbyWatt, drawNow }
