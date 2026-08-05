// 캔버스 렌더링. 모델을 읽기만 하는 순수 그리기 함수들.

import {
  CONDUCTOR,
  CHARGE_PAIRS,
  shiftedElectrons,
  nearSideCharge,
  farSideCharge,
  foilSpread,
  ATTRACT,
  REPEL,
} from './model.js'

export const LOGICAL_WIDTH = 640
export const LOGICAL_HEIGHT = 340

const PLUS_COLOR = '#dc2626'
const MINUS_COLOR = '#2563eb'
const CHARGE_R = 8

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

function drawPlus(ctx, x, y, r = CHARGE_R) {
  ctx.fillStyle = PLUS_COLOR
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.2
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
  ctx.lineWidth = 2.2
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

// ── 막대 ──────────────────────────────────────────────────────────────

const ROD_W = 26
const ROD_H = 150

/** 막대의 x 위치. proximity 0 → 왼쪽 끝, 1 → 물체 바로 앞 */
export function rodX(model, objectLeft) {
  const farX = 30
  const nearX = objectLeft - ROD_W - 14
  return farX + (nearX - farX) * model.proximity
}

function drawRod(ctx, x, y, charge) {
  const color = charge > 0 ? PLUS_COLOR : MINUS_COLOR
  ctx.save()
  ctx.fillStyle = '#f1f5f9'
  roundedRect(ctx, x, y, ROD_W, ROD_H, 10)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.stroke()

  // 막대에 고르게 박힌 전하 — 대전체는 전하가 이동하지 않는다(부도체)는 점도 함께 보여준다
  const n = 5
  for (let i = 0; i < n; i++) {
    const cy = y + ((i + 0.5) / n) * ROD_H
    if (charge > 0) drawPlus(ctx, x + ROD_W / 2, cy, 7)
    else drawMinus(ctx, x + ROD_W / 2, cy, 7)
  }

  ctx.fillStyle = color
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(charge > 0 ? '(+)대전체' : '(−)대전체', x + ROD_W / 2, y - 8)
  ctx.restore()
}

// ── 모드 1: 금속 캔 ───────────────────────────────────────────────────

const CAN_W = 220
const CAN_H = 150
const CAN_Y = 100

export function canBox(model) {
  // 끌리거나 밀리면 물체가 살짝 움직인다
  const force = model.__force ?? null
  let dx = 0
  if (force === ATTRACT) dx = -10 * model.proximity
  else if (force === REPEL) dx = 10 * model.proximity
  return { x: 330 + dx, y: CAN_Y, w: CAN_W, h: CAN_H }
}

/**
 * 물체 안의 전하를 그린다.
 *
 * 도체: 양성자(+)는 제자리에 고정, 자유 전자(−)만 한쪽으로 몰린다.
 *       → "왜 한쪽이 (+)가 되는가"가 그림만으로 설명된다(전자가 빠져나가서).
 * 부도체: 전자가 원자에 묶여 있어 +/−가 짝을 이룬 채 제자리에 머문다.
 */
function drawObjectCharges(ctx, box, model, showCharges) {
  if (!showCharges) return
  const shifted = shiftedElectrons(model)
  const rows = 2
  const cols = Math.ceil(CHARGE_PAIRS / rows)
  const padX = 26
  const cellW = (box.w - padX * 2) / cols
  const cellH = box.h / (rows + 1)

  for (let i = 0; i < CHARGE_PAIRS; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const homeX = box.x + padX + cellW * (c + 0.5)
    const y = box.y + cellH * (r + 1)

    // 양성자는 언제나 제자리
    drawPlus(ctx, homeX, y - 11)

    if (model.material === CONDUCTOR) {
      // 앞에서부터 shifted개의 전자가 한쪽 끝으로 몰려간다
      const isShifted = i < shifted
      const toFarSide = model.rodCharge < 0 // (−)막대면 전자가 먼(오른) 쪽으로 밀려난다
      const targetX = toFarSide ? box.x + box.w - 26 - (i % 3) * 20 : box.x + 26 + (i % 3) * 20
      const x = isShifted ? targetX : homeX
      drawMinus(ctx, x, y + 11)
    } else {
      drawMinus(ctx, homeX, y + 11) // 부도체: 전자가 원자에 묶여 제자리
    }
  }
}

function drawEndLabel(ctx, x, y, charge, caption) {
  if (charge === 0) return
  ctx.save()
  ctx.fillStyle = charge > 0 ? PLUS_COLOR : MINUS_COLOR
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(`${caption} ${charge > 0 ? '(+)' : '(−)'}`, x, y)
  ctx.restore()
}

export function drawCanMode(ctx, cssWidth, cssHeight, model, state) {
  begin(ctx, cssWidth, cssHeight)
  const box = canBox(model)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('대전체를 드래그하거나 아래 막대로 가까이 가져가 보세요', LOGICAL_WIDTH / 2, 18)

  // 물체
  ctx.save()
  ctx.fillStyle = model.material === CONDUCTOR ? '#f8fafc' : '#fffbeb'
  roundedRect(ctx, box.x, box.y, box.w, box.h, 16)
  ctx.fill()
  ctx.strokeStyle = model.material === CONDUCTOR ? '#64748b' : '#a16207'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = model.material === CONDUCTOR ? '#475569' : '#a16207'
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(model.material === CONDUCTOR ? '금속 캔 (도체)' : '플라스틱 통 (부도체)', box.x + box.w / 2, box.y - 8)
  ctx.restore()

  drawObjectCharges(ctx, box, model, state.showCharges)

  // 양 끝 전하 라벨
  drawEndLabel(ctx, box.x + 42, box.y + box.h + 8, nearSideCharge(model), '가까운 쪽')
  drawEndLabel(ctx, box.x + box.w - 42, box.y + box.h + 8, farSideCharge(model), '먼 쪽')

  drawRod(ctx, rodX(model, box.x), CAN_Y, model.rodCharge)
  ctx.restore()
}

// ── 모드 2: 검전기 ────────────────────────────────────────────────────

const SCOPE_X = 400
const SCOPE_PLATE_Y = 96
const SCOPE_PLATE_W = 120
const SCOPE_ROD_LEN = 78
const SCOPE_FOIL_LEN = 66

export function scopeBox() {
  return { x: SCOPE_X - SCOPE_PLATE_W / 2, y: SCOPE_PLATE_Y, w: SCOPE_PLATE_W, h: 20 }
}

export function drawScopeMode(ctx, cssWidth, cssHeight, model, state) {
  begin(ctx, cssWidth, cssHeight)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('대전체를 검전기 금속판에 가까이 가져가 보세요', LOGICAL_WIDTH / 2, 18)

  const plateY = SCOPE_PLATE_Y
  const rodTop = plateY + 20
  const foilTop = rodTop + SCOPE_ROD_LEN

  // 금속판
  ctx.save()
  ctx.fillStyle = '#e2e8f0'
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2.5
  roundedRect(ctx, SCOPE_X - SCOPE_PLATE_W / 2, plateY, SCOPE_PLATE_W, 20, 6)
  ctx.fill()
  ctx.stroke()

  // 금속 기둥
  ctx.fillStyle = '#cbd5e1'
  ctx.fillRect(SCOPE_X - 5, rodTop, 10, SCOPE_ROD_LEN)
  ctx.strokeRect(SCOPE_X - 5, rodTop, 10, SCOPE_ROD_LEN)

  // 금속박 — 벌어진 각도가 이 화면의 결과값이다
  const spread = foilSpread(model)
  const angle = (10 + spread * 42) * (Math.PI / 180)
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(SCOPE_X, foilTop)
    ctx.lineTo(SCOPE_X + Math.sin(angle) * SCOPE_FOIL_LEN * dir, foilTop + Math.cos(angle) * SCOPE_FOIL_LEN)
    ctx.stroke()
  }

  // 유리병 윤곽
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 2
  roundedRect(ctx, SCOPE_X - 78, rodTop + 26, 156, 130, 10)
  ctx.stroke()
  ctx.restore()

  // 전하 표시 — 금속판 쪽과 금속박 쪽에 어떤 전하가 몰렸는지
  if (state.showCharges) {
    const shifted = shiftedElectrons(model)
    const nearCharge = nearSideCharge(model)
    const n = Math.max(1, Math.abs(shifted))
    for (let i = 0; i < n; i++) {
      const x = SCOPE_X - 34 + (i % 4) * 22
      if (shifted > 0) {
        // 금속판(가까운 쪽)
        if (nearCharge > 0) drawPlus(ctx, x, plateY + 10)
        else drawMinus(ctx, x, plateY + 10)
        // 금속박(먼 쪽)은 반대
        if (nearCharge > 0) drawMinus(ctx, SCOPE_X - 20 + (i % 2) * 40, foilTop + 40)
        else drawPlus(ctx, SCOPE_X - 20 + (i % 2) * 40, foilTop + 40)
      }
    }
    // 미리 대전시켜 둔 전하
    if (model.preCharge !== 0) {
      for (let i = 0; i < Math.abs(model.preCharge); i++) {
        const x = SCOPE_X - 26 + (i % 3) * 26
        if (model.preCharge > 0) drawPlus(ctx, x, foilTop + 62, 7)
        else drawMinus(ctx, x, foilTop + 62, 7)
      }
    }
  }

  drawRod(ctx, rodX(model, SCOPE_X - SCOPE_PLATE_W / 2), plateY - 60, model.rodCharge)
  ctx.restore()
}
