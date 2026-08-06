// 캔버스 렌더링. 모델을 읽기만 하는 순수 그리기 함수들.
//
// 이 화면의 설계 핵심: **양쪽 회로를 완전히 같은 모양의 고리로 그린다.**
// 펌프와 전지가 같은 자리(왼쪽), 밸브와 스위치가 같은 자리(위), 좁은 관과 저항이 같은
// 자리(오른쪽), 물레방아와 전구가 같은 자리(아래)에 오도록 했다. 그러면 어느 것이 어느 것에
// 대응하는지를 **글자로 알려주지 않아도** 자리만 보고 학생이 스스로 짝지을 수 있다.
//
// ⚠️ 관찰 결과를 글자로 적지 않는다. 부품 이름과 조작 안내까지만 쓴다(2026-08-06 피드백).

import { PIPE_LEVELS, MAPPING, flow, output, pipeLevel } from './model.js'

export const LOGICAL_WIDTH = 680
export const LOGICAL_HEIGHT = 360

const WATER_COLOR = '#2563eb'
const CURRENT_COLOR = '#f59e0b' // circuit 시뮬레이터의 전류 색과 같게 맞춘다
const PIPE_FILL = '#e0f2fe'
const WIRE_COLOR = '#334155'

export function computeLayout(cssWidth, cssHeight) {
  const scale = Math.min(cssWidth / LOGICAL_WIDTH, cssHeight / LOGICAL_HEIGHT)
  return {
    scale,
    offsetX: (cssWidth - LOGICAL_WIDTH * scale) / 2,
    offsetY: (cssHeight - LOGICAL_HEIGHT * scale) / 2,
  }
}

export function screenToLogical(layout, x, y) {
  return { x: (x - layout.offsetX) / layout.scale, y: (y - layout.offsetY) / layout.scale }
}

function begin(ctx, cssWidth, cssHeight) {
  const layout = computeLayout(cssWidth, cssHeight)
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  ctx.save()
  ctx.translate(layout.offsetX, layout.offsetY)
  ctx.scale(layout.scale, layout.scale)
  return layout
}

// ── 고리(회로) 경로 ───────────────────────────────────────────────────
//
// 양쪽 다 같은 직사각 고리다. 시계 방향으로 도는 매개변수 t(0~1)로 좌표를 얻어 입자를 흘린다.

const LOOP_W = 250
const LOOP_H = 160
const LOOP_TOP = 104

/** 왼쪽(물)·오른쪽(전기) 고리의 왼쪽 위 모서리 */
export function loopOrigin(side) {
  const gap = 40
  const totalW = LOOP_W * 2 + gap
  const startX = (LOGICAL_WIDTH - totalW) / 2
  return { x: side === 'water' ? startX : startX + LOOP_W + gap, y: LOOP_TOP }
}

/** 고리 위의 점. t=0은 왼쪽 위 모서리, 시계 방향으로 진행한다. */
export function loopPoint(origin, t) {
  const perimeter = (LOOP_W + LOOP_H) * 2
  let d = (((t % 1) + 1) % 1) * perimeter
  if (d < LOOP_W) return { x: origin.x + d, y: origin.y } // 위쪽 →
  d -= LOOP_W
  if (d < LOOP_H) return { x: origin.x + LOOP_W, y: origin.y + d } // 오른쪽 ↓
  d -= LOOP_H
  if (d < LOOP_W) return { x: origin.x + LOOP_W - d, y: origin.y + LOOP_H } // 아래쪽 ←
  d -= LOOP_W
  return { x: origin.x, y: origin.y + LOOP_H - d } // 왼쪽 ↑
}

/** 각 부품이 고리 위 어디에 오는지 — 양쪽이 **같은 t**를 쓰는 것이 이 화면의 핵심이다. */
export const SLOT_T = {
  gate: 0.125 * 1, // 위 한가운데 근처
  resist: 0.375,
  load: 0.625,
  source: 0.875,
}

function slotPoint(origin, key) {
  const perimeter = (LOOP_W + LOOP_H) * 2
  // 위/아래 변의 한가운데, 좌/우 변의 한가운데가 되도록 t를 실제 길이로 잡는다
  const dists = {
    gate: LOOP_W / 2,
    resist: LOOP_W + LOOP_H / 2,
    load: LOOP_W + LOOP_H + LOOP_W / 2,
    source: LOOP_W * 2 + LOOP_H + LOOP_H / 2,
  }
  return loopPoint(origin, dists[key] / perimeter)
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ── 배관·전선 ─────────────────────────────────────────────────────────

/** 관의 굵기는 저항 단계에 따라 달라진다 — 오른쪽 변(저항 자리)만 좁아진다. */
function pipeWidthAt(key, level) {
  if (key !== 'resist') return 16
  return [16, 10, 5][level] ?? 10
}

function drawLoopPipe(ctx, origin, model, isWater) {
  const level = model.pipe
  ctx.save()
  ctx.lineCap = 'round'

  const segments = [
    { key: 'top', from: { x: origin.x, y: origin.y }, to: { x: origin.x + LOOP_W, y: origin.y } },
    { key: 'resist', from: { x: origin.x + LOOP_W, y: origin.y }, to: { x: origin.x + LOOP_W, y: origin.y + LOOP_H } },
    { key: 'bottom', from: { x: origin.x + LOOP_W, y: origin.y + LOOP_H }, to: { x: origin.x, y: origin.y + LOOP_H } },
    { key: 'left', from: { x: origin.x, y: origin.y + LOOP_H }, to: { x: origin.x, y: origin.y } },
  ]

  for (const seg of segments) {
    const w = pipeWidthAt(seg.key, level)
    if (isWater) {
      // 물: 관 벽 + 안쪽 물
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = w + 5
      ctx.beginPath()
      ctx.moveTo(seg.from.x, seg.from.y)
      ctx.lineTo(seg.to.x, seg.to.y)
      ctx.stroke()
      ctx.strokeStyle = PIPE_FILL
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(seg.from.x, seg.from.y)
      ctx.lineTo(seg.to.x, seg.to.y)
      ctx.stroke()
    } else {
      // 전기: 전선. 저항 자리는 굵기 대신 지그재그 기호로 표현하므로 선만 얇게 긋는다
      ctx.strokeStyle = WIRE_COLOR
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(seg.from.x, seg.from.y)
      ctx.lineTo(seg.to.x, seg.to.y)
      ctx.stroke()
    }
  }
  ctx.restore()
}

// ── 부품 그림 ─────────────────────────────────────────────────────────

/**
 * 부품 이름표. `badge` 색을 주면 알약 모양 배경으로 그린다.
 *
 * 대응 관계를 켰을 때 양쪽 부품을 점선으로 이어봤더니 그 선이 이름표를 관통해 글자가
 * 읽히지 않았다(2026-08-06 확인). 어차피 두 회로를 같은 모양·같은 자리로 그려놨으므로
 * 선을 긋지 않아도 자리만으로 짝이 보인다 — 여기에 같은 색 배지를 더해 확실히 한다.
 * (색만으로 구분하게 두지 않는다는 원칙에 따라, 위치와 색을 함께 쓴다.)
 */
function drawLabel(ctx, x, y, text, color, badge) {
  ctx.save()
  ctx.font = 'bold 12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  if (badge) {
    const w = ctx.measureText(text).width + 14
    ctx.fillStyle = badge
    roundedRect(ctx, x - w / 2, y - 3, w, 19, 9)
    ctx.fill()
    ctx.fillStyle = '#fff'
  } else {
    ctx.fillStyle = color
  }
  ctx.fillText(text, x, y)
  ctx.restore()
}

/** 펌프 — 물을 밀어 올리는 장치. 세기가 셀수록 날개가 빨리 돈다. */
function drawPump(ctx, p, model, time) {
  const r = 24
  ctx.save()
  ctx.fillStyle = '#fecaca'
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 3
  ctx.stroke()

  // 임펠러 — 흐름이 있을 때만 돈다
  const spin = time * flow(model) * 9
  ctx.translate(p.x, p.y)
  ctx.rotate(spin)
  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -r + 7)
    ctx.stroke()
  }
  ctx.restore()
}

/** 전지 — 긴 선(+)과 짧은 선(−). 세기가 셀수록 칸이 많아진다(직렬로 더 이은 것처럼). */
function drawBattery(ctx, p, model) {
  ctx.save()
  const cells = Math.max(1, model.pump)
  const cellH = 13
  const totalH = cells * cellH
  let y = p.y - totalH / 2
  for (let i = 0; i < cells; i++) {
    ctx.strokeStyle = model.pump === 0 ? '#cbd5e1' : '#dc2626'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath() // 긴 선(+)
    ctx.moveTo(p.x - 15, y)
    ctx.lineTo(p.x + 15, y)
    ctx.stroke()
    ctx.beginPath() // 짧은 선(−)
    ctx.moveTo(p.x - 8, y + 7)
    ctx.lineTo(p.x + 8, y + 7)
    ctx.stroke()
    y += cellH
  }
  ctx.restore()
}

/** 밸브 / 스위치 — 열림·닫힘이 '길이 이어졌는가'로 보여야 한다 */
function drawGate(ctx, p, open, isWater) {
  ctx.save()
  if (isWater) {
    ctx.fillStyle = open ? '#ddd6fe' : '#7c3aed'
    ctx.strokeStyle = '#7c3aed'
    ctx.lineWidth = 3
    roundedRect(ctx, p.x - 16, p.y - 14, 32, 28, 5)
    ctx.fill()
    ctx.stroke()
    // 손잡이 — 열리면 관과 나란히, 닫히면 관을 가로지른다
    ctx.strokeStyle = '#4c1d95'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    if (open) {
      ctx.moveTo(p.x - 11, p.y)
      ctx.lineTo(p.x + 11, p.y)
    } else {
      ctx.moveTo(p.x, p.y - 11)
      ctx.lineTo(p.x, p.y + 11)
    }
    ctx.stroke()
  } else {
    // 스위치 — 닫히면 이어지고 열리면 끊긴다
    ctx.strokeStyle = WIRE_COLOR
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(p.x - 16, p.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(p.x + 16, p.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // `open`은 "길이 열려 있어 흐른다"는 뜻이다. 스위치는 **닿아 있어야** 흐르므로,
    // 흐를 때 레버를 내려 잇고 안 흐를 때 들어 올려 끊는다.
    // (밸브의 '열림'과 스위치의 '닫힘'이 같은 상태라 방향을 반대로 그리기 쉬운 자리다 —
    //  실제로 처음엔 뒤집혀 있어서 흐르는데도 스위치가 끊긴 것처럼 보였다.)
    ctx.beginPath()
    ctx.moveTo(p.x - 16, p.y)
    if (open) ctx.lineTo(p.x + 16, p.y)
    else ctx.lineTo(p.x + 11, p.y - 15)
    ctx.stroke()
  }
  ctx.restore()
}

/** 저항 — 전기 쪽만. 물 쪽은 관이 좁아지는 것으로 이미 보인다. */
function drawResistor(ctx, p, level) {
  ctx.save()
  const h = 34
  const w = [14, 20, 26][level] ?? 20 // 저항이 클수록 기호도 크게
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = WIRE_COLOR
  ctx.lineWidth = 3
  roundedRect(ctx, p.x - w / 2, p.y - h / 2, w, h, 3)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** 물레방아 — 흐름이 셀수록 빨리 돈다 */
function drawWheel(ctx, p, model, time) {
  const r = 26
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(-time * output(model) * 7) // 아래쪽 물살은 왼쪽으로 흐르므로 반시계
  ctx.strokeStyle = '#0f766e'
  ctx.lineWidth = 3
  ctx.fillStyle = '#ccfbf1'
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  for (let i = 0; i < 8; i++) {
    ctx.rotate((Math.PI * 2) / 8)
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.35)
    ctx.lineTo(0, -r)
    ctx.stroke()
  }
  ctx.restore()
}

/** 전구 — 흐름이 셀수록 밝다 */
function drawBulb(ctx, p, model) {
  const level = output(model)
  const r = 22
  ctx.save()
  if (level > 0) {
    const glow = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 2.4)
    glow.addColorStop(0, `rgba(250, 204, 21, ${0.55 * Math.min(1, level * 1.6)})`)
    glow.addColorStop(1, 'rgba(250, 204, 21, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = level > 0 ? `rgba(253, 224, 71, ${0.35 + Math.min(1, level * 1.6) * 0.65})` : '#f1f5f9'
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = WIRE_COLOR
  ctx.lineWidth = 3
  ctx.stroke()
  // 필라멘트
  ctx.strokeStyle = level > 0 ? '#b45309' : '#94a3b8'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(p.x - 10, p.y + 4)
  ctx.lineTo(p.x - 4, p.y - 6)
  ctx.lineTo(p.x + 2, p.y + 4)
  ctx.lineTo(p.x + 8, p.y - 6)
  ctx.lineTo(p.x + 10, p.y + 2)
  ctx.stroke()
  ctx.restore()
}

// ── 흐르는 입자 ───────────────────────────────────────────────────────

function drawParticles(ctx, origin, model, phase, isWater) {
  if (flow(model) <= 0) return
  const count = 26
  ctx.save()
  for (let i = 0; i < count; i++) {
    const t = (i / count + phase) % 1
    const p = loopPoint(origin, t)
    if (isWater) {
      ctx.fillStyle = WATER_COLOR
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = CURRENT_COLOR
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** 세기 막대 — 숫자 대신 길이로만 보여준다(단위 있는 수치는 다음 소단원의 몫) */
function drawGauge(ctx, origin, model, isWater, showMapping) {
  const value = flow(model)
  const w = LOOP_W
  const x = origin.x
  const y = LOOP_TOP + LOOP_H + 44
  ctx.save()
  ctx.fillStyle = '#e2e8f0'
  roundedRect(ctx, x, y, w, 12, 6)
  ctx.fill()
  if (value > 0) {
    ctx.fillStyle = isWater ? WATER_COLOR : CURRENT_COLOR
    roundedRect(ctx, x, y, Math.max(10, w * value), 12, 6)
    ctx.fill()
  }
  ctx.restore()
  drawLabel(ctx, x + w / 2, y + 17, isWater ? '물의 흐름' : '전류', '#64748b', showMapping ? MAPPING.find((m) => m.id === 'flow').color : null)
}

// ── 전체 그리기 ───────────────────────────────────────────────────────

export function draw(ctx, cssWidth, cssHeight, model, state) {
  begin(ctx, cssWidth, cssHeight)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('아래 조작으로 양쪽을 함께 바꿔 보세요', LOGICAL_WIDTH / 2, 12)

  const waterOrigin = loopOrigin('water')
  const elecOrigin = loopOrigin('electric')

  // 두 회로 제목
  ctx.fillStyle = '#334155'
  ctx.font = 'bold 15px system-ui, sans-serif'
  ctx.fillText('물이 흐르는 길', waterOrigin.x + LOOP_W / 2, LOOP_TOP - 58)
  ctx.fillText('전기가 흐르는 길', elecOrigin.x + LOOP_W / 2, LOOP_TOP - 58)

  for (const side of ['water', 'electric']) {
    const isWater = side === 'water'
    const origin = isWater ? waterOrigin : elecOrigin
    drawLoopPipe(ctx, origin, model, isWater)
    drawParticles(ctx, origin, model, state.phase, isWater)

    const gate = slotPoint(origin, 'gate')
    const resist = slotPoint(origin, 'resist')
    const load = slotPoint(origin, 'load')
    const source = slotPoint(origin, 'source')

    drawGate(ctx, gate, model.open, isWater)
    if (!isWater) drawResistor(ctx, resist, model.pipe)
    if (isWater) {
      drawPump(ctx, source, model, state.time)
      drawWheel(ctx, load, model, state.time)
    } else {
      drawBattery(ctx, source, model)
      drawBulb(ctx, load, model)
    }

    // 부품 이름 — 이름 자체는 결론이 아니라 사물의 명칭이라 항상 보여준다.
    // 대응 관계(어느 것이 어느 것에 해당하는가)만 토글로 감춘다.
    const badge = (id) => (state.showMapping ? MAPPING.find((m) => m.id === id).color : null)
    drawLabel(ctx, gate.x, gate.y - 32, isWater ? '밸브' : '스위치', '#64748b', badge('gate'))
    drawLabel(ctx, resist.x - 48, resist.y - 7, isWater ? pipeLevel(model).label : pipeLevel(model).resistorLabel, '#64748b', badge('resist'))
    drawLabel(ctx, load.x, load.y + 32, isWater ? '물레방아' : '전구', '#64748b', badge('load'))
    drawLabel(ctx, source.x + 48, source.y - 7, isWater ? '펌프' : '전지', '#64748b', badge('source'))

    drawGauge(ctx, origin, model, isWater, state.showMapping)
  }

  ctx.restore()
}

export { PIPE_LEVELS }
