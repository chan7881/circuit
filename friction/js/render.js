// 캔버스 렌더링. state를 읽기만 하는 순수 그리기 함수들이다.
//
// ⚠️ 이 파일은 관찰 결과를 글자로 적지 않는다. 물체 이름과 조작 안내만 쓰고, "무슨 전기를
//    띠는지"는 전하 기호를 학생이 직접 세어 판단하게 둔다(2026-08-06 사용자 피드백).

import {
  getPair,
  electronCount,
  protonCount,
  rubFraction,
  objectParticle,
  FIELD,
  PUCK_R,
  PADDLE_R,
  MAX_TRANSFER,
} from './model.js'

// 논리 좌표계(화면 크기에 맞춰 레터박스로 스케일)
export const LOGICAL_WIDTH = 620
export const LOGICAL_HEIGHT = 360

const CHARGE_R = 8
const PLUS_COLOR = '#dc2626'
const MINUS_COLOR = '#2563eb'

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

function beginLogical(ctx, cssWidth, cssHeight) {
  const layout = computeLayout(cssWidth, cssHeight)
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  ctx.save()
  ctx.translate(layout.offsetX, layout.offsetY)
  ctx.scale(layout.scale, layout.scale)
  return layout
}

// ── 전하 기호 ─────────────────────────────────────────────────────────

function drawPlus(ctx, x, y, r = CHARGE_R) {
  ctx.fillStyle = PLUS_COLOR
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = r * 0.28
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - r * 0.5, y)
  ctx.lineTo(x + r * 0.5, y)
  ctx.moveTo(x, y - r * 0.5)
  ctx.lineTo(x, y + r * 0.5)
  ctx.stroke()
}

function drawMinus(ctx, x, y, r = CHARGE_R) {
  ctx.fillStyle = MINUS_COLOR
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = r * 0.28
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - r * 0.5, y)
  ctx.lineTo(x + r * 0.5, y)
  ctx.stroke()
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

// ── 물체 그림 ─────────────────────────────────────────────────────────
//
// 예전에는 둘 다 흰 네모 상자였다. 그러면 "빨대를 털가죽에 문지른다"는 상황 자체가 안 보여서
// 각 물체를 알아볼 수 있게 그린다(2026-08-06 피드백). 실물 사진을 쓰지 않고 도형으로만
// 그리는 이유는 교과서 사진의 저작권 문제를 피하면서도 무엇인지 알아볼 수 있게 하기 위해서다.

/** 빨대 — 가로로 누운 얇은 원기둥. 나선 줄무늬로 '빨대'라는 걸 알아보게 한다. */
function drawStraw(ctx, box) {
  const { x, y, w, h } = box
  ctx.save()
  ctx.fillStyle = '#fdba74'
  roundedRect(ctx, x, y, w, h, h / 2)
  ctx.fill()
  ctx.strokeStyle = '#c2410c'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // 나선 줄무늬
  ctx.save()
  roundedRect(ctx, x, y, w, h, h / 2)
  ctx.clip()
  ctx.strokeStyle = '#fb923c'
  ctx.lineWidth = 5
  for (let sx = x - h; sx < x + w + h; sx += 22) {
    ctx.beginPath()
    ctx.moveTo(sx, y + h)
    ctx.lineTo(sx + h, y)
    ctx.stroke()
  }
  ctx.restore()

  // 끝의 구멍(타원)으로 속이 빈 관이라는 걸 표시
  ctx.fillStyle = '#7c2d12'
  ctx.beginPath()
  ctx.ellipse(x + w - 3, y + h / 2, 3.5, h / 2 - 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** 유리막대 — 투명하게 비치는 유리 느낌(밝은 하늘색 + 하이라이트) */
function drawGlassRod(ctx, box) {
  const { x, y, w, h } = box
  ctx.save()
  const grad = ctx.createLinearGradient(0, y, 0, y + h)
  grad.addColorStop(0, '#e0f2fe')
  grad.addColorStop(0.45, '#bae6fd')
  grad.addColorStop(1, '#7dd3fc')
  ctx.fillStyle = grad
  roundedRect(ctx, x, y, w, h, h / 2)
  ctx.fill()
  ctx.strokeStyle = '#0284c7'
  ctx.lineWidth = 2.5
  ctx.stroke()
  // 길게 흐르는 하이라이트 — 매끈한 유리 표면
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x + 12, y + h * 0.3)
  ctx.lineTo(x + w - 12, y + h * 0.3)
  ctx.stroke()
  ctx.restore()
}

/** 털가죽 — 위쪽 가장자리를 뾰족뾰족한 털로 그린다 */
function drawFur(ctx, box) {
  const { x, y, w, h } = box
  ctx.save()
  const bodyTop = y + 14
  ctx.fillStyle = '#a78bfa'
  roundedRect(ctx, x, bodyTop, w, h - 14, 12)
  ctx.fill()
  ctx.strokeStyle = '#6d28d9'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // 삐죽삐죽한 털
  ctx.fillStyle = '#c4b5fd'
  ctx.beginPath()
  ctx.moveTo(x + 6, bodyTop + 4)
  for (let i = 0; i * 16 < w - 12; i++) {
    const bx = x + 6 + i * 16
    ctx.lineTo(bx + 8, bodyTop - 13 - (i % 2) * 5)
    ctx.lineTo(bx + 16, bodyTop + 4)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#8b5cf6'
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.restore()
}

/** 비단 — 부드럽게 물결치는 천 */
function drawSilk(ctx, box) {
  const { x, y, w, h } = box
  ctx.save()
  const top = y + 12
  const grad = ctx.createLinearGradient(x, 0, x + w, 0)
  grad.addColorStop(0, '#f9a8d4')
  grad.addColorStop(0.5, '#fbcfe8')
  grad.addColorStop(1, '#f472b6')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(x, top + 10)
  // 윗변을 물결로 — 팽팽한 천이 아니라 늘어진 천처럼 보이게
  for (let i = 0; i <= w; i += 10) {
    ctx.lineTo(x + i, top + 10 - Math.sin((i / w) * Math.PI * 3) * 8)
  }
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#db2777'
  ctx.lineWidth = 2.2
  ctx.stroke()

  // 주름
  ctx.strokeStyle = 'rgba(219,39,119,0.35)'
  ctx.lineWidth = 1.6
  for (let i = 1; i < 4; i++) {
    const fx = x + (w / 4) * i
    ctx.beginPath()
    ctx.moveTo(fx, top + 12)
    ctx.quadraticCurveTo(fx + 8, y + h * 0.6, fx, y + h - 4)
    ctx.stroke()
  }
  ctx.restore()
}

const SHAPES = { straw: drawStraw, glassRod: drawGlassRod, fur: drawFur, silk: drawSilk }

function drawShape(ctx, shape, box) {
  ;(SHAPES[shape] ?? drawStraw)(ctx, box)
}

/**
 * 물체 위에 전하 기호를 흩어 놓는다.
 *
 * chargeMode:
 *  - 'all'  : 양성자(+)와 전자(−)를 모두 그린다 — "중성이란 +와 −가 같은 수"라는 걸 보여준다
 *  - 'diff' : 서로 상쇄하고 남은 알짜 전하만 그린다 — 결과를 한눈에 읽게 한다
 *  - 'none' : 아무것도 안 그린다 — 겉모습만으로는 대전 여부를 알 수 없다는 걸 체감시킨다
 */
function drawCharges(ctx, box, protons, electrons, chargeMode) {
  if (chargeMode === 'none') return

  const symbols = []
  if (chargeMode === 'all') {
    // +와 −를 번갈아 넣어야 "골고루 섞여 있다"로 읽힌다. 한쪽에 몰아 그리면
    // 중성 상태가 마치 두 덩어리로 분리된 것처럼 보인다.
    const n = Math.max(protons, electrons)
    for (let i = 0; i < n; i++) {
      if (i < protons) symbols.push('+')
      if (i < electrons) symbols.push('-')
    }
  } else {
    const net = protons - electrons
    for (let i = 0; i < Math.abs(net); i++) symbols.push(net > 0 ? '+' : '-')
  }
  if (symbols.length === 0) return

  const cols = Math.ceil(symbols.length / 2)
  const rows = symbols.length > cols ? 2 : 1
  const padX = 16
  const cellW = (box.w - padX * 2) / Math.max(1, cols)
  const cellH = box.h / (rows + 1)

  symbols.forEach((s, i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    const x = box.x + padX + cellW * (c + 0.5)
    const y = box.y + cellH * (r + 1)
    if (s === '+') drawPlus(ctx, x, y)
    else drawMinus(ctx, x, y)
  })
}

function drawName(ctx, box, name, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.font = 'bold 15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(name, box.x + box.w / 2, box.y - 6)
  ctx.restore()
}

// ── 모드 1: 문지르기 ──────────────────────────────────────────────────
//
// 아래쪽 물체(b)는 바닥에 놓여 있고, 위쪽 물체(a)를 학생이 끌고 다닌다. 두 물체가 겹친 채로
// 움직인 거리만 '문지른 거리'로 쌓인다 — 떨어뜨린 채 휘저으면 아무 일도 일어나지 않는다.

export const HAND_W = 210
export const HAND_H = 46
export const BASE_W = 300
export const BASE_H = 92
const BASE_Y = 210

export function baseBox() {
  return { x: (LOGICAL_WIDTH - BASE_W) / 2, y: BASE_Y, w: BASE_W, h: BASE_H }
}

/** 손에 쥔 물체의 기본 위치(아직 안 잡았을 때) */
export function defaultHandPos() {
  return { x: LOGICAL_WIDTH / 2, y: 120 }
}

export function handBox(pos) {
  return { x: pos.x - HAND_W / 2, y: pos.y - HAND_H / 2, w: HAND_W, h: HAND_H }
}

/** 두 물체가 맞닿아 있는가 — 이때만 문지른 거리가 쌓인다. */
export function isTouching(pos) {
  const hand = handBox(pos)
  const base = baseBox()
  const overlapX = hand.x < base.x + base.w && hand.x + hand.w > base.x
  const overlapY = hand.y + hand.h > base.y - 6 && hand.y < base.y + base.h
  return overlapX && overlapY
}

/** 손에 쥔 물체가 화면 밖으로 나가지 않게 가둔다. */
export function clampHandPos(pos) {
  return {
    x: Math.max(HAND_W / 2 + 6, Math.min(LOGICAL_WIDTH - HAND_W / 2 - 6, pos.x)),
    y: Math.max(HAND_H / 2 + 34, Math.min(BASE_Y + BASE_H - HAND_H / 2, pos.y)),
  }
}

function drawRubProgress(ctx, model) {
  const frac = rubFraction(model)
  const w = 240
  const x = (LOGICAL_WIDTH - w) / 2
  const y = LOGICAL_HEIGHT - 26

  ctx.save()
  // 옮겨간 전자 개수를 칸으로 — 숫자를 말로 풀지 않고 눈금으로만 보여준다
  const cellW = w / MAX_TRANSFER
  for (let i = 0; i < MAX_TRANSFER; i++) {
    const filled = i < model.transferred
    const partial = i === model.transferred ? frac : 0
    ctx.fillStyle = '#e2e8f0'
    roundedRect(ctx, x + cellW * i + 2, y, cellW - 4, 10, 5)
    ctx.fill()
    if (filled || partial > 0) {
      ctx.fillStyle = MINUS_COLOR
      roundedRect(ctx, x + cellW * i + 2, y, (cellW - 4) * (filled ? 1 : partial), 10, 5)
      ctx.fill()
    }
  }
  ctx.restore()
}

export function drawRubMode(ctx, cssWidth, cssHeight, model, state) {
  beginLogical(ctx, cssWidth, cssHeight)
  const pair = getPair(model.pairId)
  const base = baseBox()
  const hand = handBox(state.handPos)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(`${pair.a.name}${objectParticle(pair.a.name)} 끌어다 ${pair.b.name} 위에서 문질러 보세요`, LOGICAL_WIDTH / 2, 12)

  // 바닥 물체
  drawShape(ctx, pair.b.shape, base)
  drawName(ctx, base, pair.b.name, pair.b.color)
  drawCharges(ctx, base, protonCount(), electronCount(model, 'b'), state.chargeMode)

  // 맞닿아 있으면 접촉면을 강조 — "지금 문질러지고 있다"는 신호
  if (isTouching(state.handPos)) {
    ctx.save()
    ctx.strokeStyle = 'rgba(234,88,12,0.55)'
    ctx.lineWidth = 3
    ctx.setLineDash([7, 5])
    roundedRect(ctx, base.x - 4, base.y - 4, base.w + 8, base.h + 8, 14)
    ctx.stroke()
    ctx.restore()
  }

  // 손에 쥔 물체 — 문지르는 중이면 살짝 떨린다
  const shake = state.rubbing ? Math.sin(state.time * 46) * 2.5 : 0
  const handShaken = { ...hand, y: hand.y + shake }
  drawShape(ctx, pair.a.shape, handShaken)
  drawName(ctx, handShaken, pair.a.name, pair.a.color)
  drawCharges(ctx, handShaken, protonCount(), electronCount(model, 'a'), state.chargeMode)

  // 옮겨가는 전자 애니메이션 — 어느 쪽에서 어느 쪽으로 가는지가 이 화면의 핵심이다
  for (const e of state.movingElectrons) {
    const fromBox = pair.donor === 'a' ? handShaken : base
    const toBox = pair.donor === 'a' ? base : handShaken
    const x0 = fromBox.x + fromBox.w / 2
    const y0 = fromBox.y + fromBox.h / 2
    const x1 = toBox.x + toBox.w / 2
    const y1 = toBox.y + toBox.h / 2
    drawMinus(ctx, x0 + (x1 - x0) * e.t, y0 + (y1 - y0) * e.t, 9)
  }

  drawRubProgress(ctx, model)
  ctx.restore()
}

// ── 모드 2: 에어하키 ──────────────────────────────────────────────────

/** 경기장을 논리 좌표 어디에 놓을지 */
export const FIELD_ORIGIN = { x: (LOGICAL_WIDTH - FIELD.w) / 2, y: 44 }

/** 캔버스 좌표 → 경기장 좌표 */
export function toFieldCoords(p) {
  return { x: p.x - FIELD_ORIGIN.x, y: p.y - FIELD_ORIGIN.y }
}

function drawChargedDisc(ctx, x, y, r, charge, label) {
  const color = charge > 0 ? PLUS_COLOR : MINUS_COLOR
  ctx.save()
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(1, charge > 0 ? '#fecaca' : '#bfdbfe')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3.5
  ctx.stroke()

  if (charge > 0) drawPlus(ctx, x, y, r * 0.5)
  else drawMinus(ctx, x, y, r * 0.5)

  ctx.fillStyle = '#475569'
  ctx.font = 'bold 12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(label, x, y + r + 4)
  ctx.restore()
}

export function drawHockeyMode(ctx, cssWidth, cssHeight, hockey) {
  beginLogical(ctx, cssWidth, cssHeight)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('채를 끌고 다니며 퍽을 움직여 보세요', LOGICAL_WIDTH / 2, 14)

  ctx.save()
  ctx.translate(FIELD_ORIGIN.x, FIELD_ORIGIN.y)

  // 경기장 — 사방이 벽으로 막혀 있다는 게 보여야 퍽이 튕기는 이유가 납득된다
  ctx.fillStyle = '#f8fafc'
  roundedRect(ctx, 0, 0, FIELD.w, FIELD.h, 14)
  ctx.fill()
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 6
  ctx.stroke()

  // 바닥 표시(가운데 선과 원) — 에어하키 판이라는 인상을 준다
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(FIELD.w / 2, 6)
  ctx.lineTo(FIELD.w / 2, FIELD.h - 6)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(FIELD.w / 2, FIELD.h / 2, 44, 0, Math.PI * 2)
  ctx.stroke()

  drawChargedDisc(ctx, hockey.puck.x, hockey.puck.y, PUCK_R, hockey.puckCharge, '퍽')
  drawChargedDisc(ctx, hockey.paddle.x, hockey.paddle.y, PADDLE_R, hockey.paddleCharge, '채')

  ctx.restore()
  ctx.restore()
}
