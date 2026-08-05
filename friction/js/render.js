// 캔버스 렌더링. state를 읽기만 하는 순수 그리기 함수들이다.

import { getPair, electronCount, protonCount, netCharge, ATTRACT, REPEL } from './model.js'

// 논리 좌표계(화면 크기에 맞춰 레터박스로 스케일)
export const LOGICAL_WIDTH = 620
export const LOGICAL_HEIGHT = 360

const CHARGE_R = 9
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

function drawPlus(ctx, x, y) {
  ctx.fillStyle = PLUS_COLOR
  ctx.beginPath()
  ctx.arc(x, y, CHARGE_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - 4.5, y)
  ctx.lineTo(x + 4.5, y)
  ctx.moveTo(x, y - 4.5)
  ctx.lineTo(x, y + 4.5)
  ctx.stroke()
}

function drawMinus(ctx, x, y) {
  ctx.fillStyle = MINUS_COLOR
  ctx.beginPath()
  ctx.arc(x, y, CHARGE_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - 4.5, y)
  ctx.lineTo(x + 4.5, y)
  ctx.stroke()
}

/**
 * 한 물체 안에 전하 기호를 격자로 배치한다.
 *
 * chargeMode:
 *  - 'all'  : 양성자(+)와 전자(−)를 모두 그린다 — "중성이란 +와 −가 같은 수"라는 걸 보여준다
 *  - 'diff' : 서로 상쇄하고 남은 알짜 전하만 그린다 — 결과를 한눈에 읽게 한다
 *  - 'none' : 아무것도 안 그린다 — 겉모습만으로는 대전 여부를 알 수 없다는 걸 체감시킨다
 * PhET의 '전하 보기' 토글에서 가져온 방식이다.
 */
function drawCharges(ctx, box, protons, electrons, chargeMode) {
  if (chargeMode === 'none') return

  const symbols = []
  if (chargeMode === 'all') {
    for (let i = 0; i < protons; i++) symbols.push('+')
    for (let i = 0; i < electrons; i++) symbols.push('-')
  } else {
    const net = protons - electrons
    for (let i = 0; i < Math.abs(net); i++) symbols.push(net > 0 ? '+' : '-')
  }
  if (symbols.length === 0) {
    // 'diff' 모드에서 알짜 전하가 0이면 "중성"이라고 글자로 알려준다(빈칸은 오해를 부른다)
    ctx.fillStyle = '#64748b'
    ctx.font = '13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('중성', box.x + box.w / 2, box.y + box.h / 2)
    return
  }

  // + 와 − 를 섞어 두 줄로 배치한다(같은 종류가 뭉쳐 있으면 세지 않고 색만 보게 된다)
  const cols = Math.ceil(symbols.length / 2)
  const rows = symbols.length > cols ? 2 : 1
  const padX = 18
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

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawObjectBox(ctx, box, name, color, chargeLabel) {
  ctx.save()
  ctx.fillStyle = '#fff'
  roundedRect(ctx, box.x, box.y, box.w, box.h, 14)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = color
  ctx.font = 'bold 15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(name, box.x + box.w / 2, box.y - 8)

  if (chargeLabel) {
    ctx.fillStyle = '#334155'
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText(chargeLabel, box.x + box.w / 2, box.y + box.h + 8)
  }
  ctx.restore()
}

function chargeText(net) {
  if (net > 0) return `(+)전기 · +${net}`
  if (net < 0) return `(−)전기 · ${net}`
  return '중성 · 0'
}

// ── 모드 1: 문지르기 ──────────────────────────────────────────────────

const RUB_BOX_W = 230
const RUB_BOX_H = 130
const RUB_GAP = 40
const RUB_TOP = 110

export function rubBoxes() {
  const totalW = RUB_BOX_W * 2 + RUB_GAP
  const startX = (LOGICAL_WIDTH - totalW) / 2
  return {
    a: { x: startX, y: RUB_TOP, w: RUB_BOX_W, h: RUB_BOX_H },
    b: { x: startX + RUB_BOX_W + RUB_GAP, y: RUB_TOP, w: RUB_BOX_W, h: RUB_BOX_H },
  }
}

/** 두 물체 사이의 '문지르는 자리' — 이 위를 좌우로 드래그하면 문질러진다. */
export function rubZone() {
  const boxes = rubBoxes()
  return { x: boxes.a.x, y: RUB_TOP - 40, w: boxes.b.x + boxes.b.w - boxes.a.x, h: RUB_BOX_H + 80 }
}

export function drawRubMode(ctx, cssWidth, cssHeight, model, state) {
  beginLogical(ctx, cssWidth, cssHeight)
  const pair = getPair(model.pairId)
  const boxes = rubBoxes()

  // 안내 문구
  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('두 물체 위를 손가락(마우스)으로 좌우로 문질러 보세요', LOGICAL_WIDTH / 2, 24)

  // 문지르는 중이면 물체가 살짝 흔들린다(조작이 먹히고 있다는 즉각적 신호)
  const shake = state.rubbing ? Math.sin(state.time * 40) * 3 : 0

  for (const which of ['a', 'b']) {
    const box = { ...boxes[which] }
    box.x += which === 'a' ? shake : -shake
    const info = pair[which]
    const net = netCharge(model, which)
    drawObjectBox(ctx, box, info.name, info.color, chargeText(net))
    drawCharges(ctx, box, protonCount(), electronCount(model, which), state.chargeMode)
  }

  // 옮겨가는 전자 애니메이션 — 어느 쪽에서 어느 쪽으로 가는지가 이 화면의 핵심이다
  if (state.movingElectrons.length > 0) {
    for (const e of state.movingElectrons) {
      const from = pair.donor === 'a' ? boxes.a : boxes.b
      const to = pair.donor === 'a' ? boxes.b : boxes.a
      const x0 = from.x + from.w / 2
      const x1 = to.x + to.w / 2
      const y = RUB_TOP + RUB_BOX_H / 2
      const x = x0 + (x1 - x0) * e.t
      const lift = Math.sin(e.t * Math.PI) * 46
      drawMinus(ctx, x, y - lift)
    }
  }

  ctx.restore()
}

// ── 모드 2: 힘 관찰 ───────────────────────────────────────────────────

const FORCE_BOX_W = 150
const FORCE_BOX_H = 150
const FORCE_TOP = 110

export function forceBoxes(offset = 0) {
  const gap = 150
  const cx = LOGICAL_WIDTH / 2
  return {
    left: { x: cx - gap / 2 - FORCE_BOX_W + offset, y: FORCE_TOP, w: FORCE_BOX_W, h: FORCE_BOX_H },
    right: { x: cx + gap / 2 - offset, y: FORCE_TOP, w: FORCE_BOX_W, h: FORCE_BOX_H },
  }
}

function drawForceArrow(ctx, x, y, dir, color) {
  // dir: +1 오른쪽, -1 왼쪽
  const len = 46
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + len * dir, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + len * dir, y)
  ctx.lineTo(x + (len - 14) * dir, y - 9)
  ctx.lineTo(x + (len - 14) * dir, y + 9)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function drawForceMode(ctx, cssWidth, cssHeight, forceModel, kind, state) {
  beginLogical(ctx, cssWidth, cssHeight)

  // 힘의 종류에 따라 두 물체가 실제로 벌어지거나 가까워진다
  const wobble = Math.sin(state.time * 3) * 0.5 + 0.5
  let offset = 0
  if (kind === REPEL) offset = -28 * wobble
  else if (kind === ATTRACT) offset = 28 * wobble
  const boxes = forceBoxes(offset)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('두 물체가 띠는 전기를 골라 보세요', LOGICAL_WIDTH / 2, 24)

  const labels = { left: '물체 A', right: '물체 B' }
  for (const side of ['left', 'right']) {
    const box = boxes[side]
    const charge = forceModel[side]
    const color = charge > 0 ? PLUS_COLOR : charge < 0 ? MINUS_COLOR : '#94a3b8'
    drawObjectBox(ctx, box, labels[side], color, chargeText(charge * 3))
    // 전하 기호는 알짜 전하만(이 화면의 관심사는 '부호'다)
    drawCharges(ctx, box, charge > 0 ? 3 : 0, charge < 0 ? 3 : 0, charge === 0 ? 'diff' : 'diff')
  }

  // 힘 화살표 — 서로 미는지 끄는지를 화살표 방향으로 보여준다
  if (kind !== 'none') {
    const y = FORCE_TOP + FORCE_BOX_H / 2
    const leftEdge = boxes.left.x + boxes.left.w
    const rightEdge = boxes.right.x
    if (kind === REPEL) {
      drawForceArrow(ctx, leftEdge - 60, y, -1, '#0f766e')
      drawForceArrow(ctx, rightEdge + 60, y, 1, '#0f766e')
    } else {
      drawForceArrow(ctx, leftEdge + 6, y, 1, '#0f766e')
      drawForceArrow(ctx, rightEdge - 6, y, -1, '#0f766e')
    }
  }

  ctx.restore()
}
