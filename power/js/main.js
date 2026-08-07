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
  wonPerMonth,
  maxWatt,
} from './model.js'
import { drawHome, computeLayout as houseLayout, screenToLogical as houseToLogical, hitTest } from './home.js'

const model = createModel()
const state = { showEnergy: false, time: 0 }

const houseCanvas = document.getElementById('house')
const houseCtx = houseCanvas.getContext('2d')
const hintBar = document.getElementById('hint-bar')

const btnStandby = document.getElementById('btn-standby')
const btnAllOff = document.getElementById('btn-alloff')
const btnEnergy = document.getElementById('btn-energy')

// 안내 문구는 "무엇을 해 보라"까지만. 관찰 결과는 학생이 스스로 말해야 한다.
const HINT = '집 안의 기구를 눌러 켜고 끄면서, 전선과 숫자가 어떻게 달라지는지 살펴보세요.'

// --- 집 그림에서 기구를 눌러 켜고 끈다 ---
houseCanvas.addEventListener('pointerdown', (e) => {
  const rect = houseCanvas.getBoundingClientRect()
  const layout = houseLayout(rect.width, rect.height)
  const p = houseToLogical(layout, e.clientX - rect.left, e.clientY - rect.top)
  const id = hitTest(p, layout.g)
  if (!id) return
  toggle(model, id)
  syncHome()
})

// 화면 낭독기를 쓰는 학생을 위해, 그림 대신 읽어 줄 내용을 캔버스 라벨에 담아 둔다.
function describeHouse() {
  const parts = APPLIANCES.map((a) => `${a.name} ${applianceWatt(model, a.id)}와트 ${isOn(model, a.id) ? '켜짐' : '꺼짐'}`)
  houseCanvas.setAttribute('aria-label', `집 안의 전기 기구. ${parts.join(', ')}. 기구를 눌러 켜고 끌 수 있다`)
}

function syncHome() {
  describeHouse()
  const watt = totalWatt(model)
  document.getElementById('t-watt').textContent = `${watt.toLocaleString('ko-KR')} W`
  // 1시간 전력량은 0.048 kWh처럼 작은 값이라 소수점을 살려야 한다(반올림하면 0이 되어 버린다)
  document.getElementById('t-kwh').textContent = `${kwhPerHour(model).toLocaleString('ko-KR', { maximumFractionDigits: 3 })} kWh`
  document.getElementById('t-won').textContent = `${wonPerMonth(model).toLocaleString('ko-KR')} 원`
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
function fitCanvas(el, c) {
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  el.width = Math.max(1, Math.round(rect.width * dpr))
  el.height = Math.max(1, Math.round(rect.height * dpr))
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  return true
}

new ResizeObserver(() => fitCanvas(houseCanvas, houseCtx)).observe(houseCanvas)
window.addEventListener('orientationchange', () => fitCanvas(houseCanvas, houseCtx))

// 집 화면은 선풍기가 돌고 전선에 전기가 흐르는 등 움직이는 것이 있어 계속 그린다.
let lastTs = 0
function frame(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0
  lastTs = ts
  state.time += dt
  {
    const rect = houseCanvas.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) drawHome(houseCtx, rect.width, rect.height, model, state)
  }
  requestAnimationFrame(frame)
}

fitCanvas(houseCanvas, houseCtx)
syncHome()
hintBar.textContent = HINT
requestAnimationFrame(frame)

window.__sim = { model, state, applianceWatt, totalWatt, standbyWatt }
