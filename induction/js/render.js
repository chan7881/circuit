// 캔버스 렌더링. 모델을 읽기만 하는 순수 그리기 함수들.
//
// ⚠️ 이 파일은 관찰 결과를 글자로 적지 않는다. 물체 이름과 조작 안내만 쓰고, "어느 쪽이 무슨
//    전기를 띠는지"는 전하 기호를 학생이 직접 보고 판단하게 둔다(2026-08-06 사용자 피드백).

import {
  CONDUCTOR,
  CHARGE_PAIRS,
  CAN_W,
  CAN_H,
  ROD_W,
  ROD_H,
  TRACK,
  SCOPE_PLATE_LEFT,
  shiftedElectrons,
  electronDrift,
  foilSpread,
  canLeft,
} from './model.js'

export const LOGICAL_WIDTH = 640
export const LOGICAL_HEIGHT = 340

const PLUS_COLOR = '#dc2626'
const MINUS_COLOR = '#2563eb'
const CHARGE_R = 7

/**
 * 캔 실험은 **위에서 내려다보는 시점**이다(2026-08-06 사용자 지시).
 * 옆에서 본 그림이면 캔이 굴러가는 것과 미끄러지는 것을 구별할 수 없고, 실제 교과서 실험도
 * 책상 위에 눕혀 놓은 캔을 위에서 보며 하는 활동이다.
 * 그래서 캔은 눕힌 원기둥을 위에서 본 모습 = **가로 폭이 지름(구르는 방향), 세로 길이가 캔의
 * 길이**인 직사각형으로 그리고, 표면 줄무늬가 굴러간 거리만큼 흘러가게 해서 회전을 보여준다.
 */
const TABLE_TOP = 96
const CAN_TOP = TABLE_TOP + 18

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
  ctx.lineWidth = r * 0.3
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
  ctx.lineWidth = r * 0.3
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

/** 위에서 본 책상과 좌우 막이 — 캔이 왜 여기까지만 굴러가는지가 그림으로 설명돼야 한다 */
function drawTable(ctx) {
  const top = TABLE_TOP
  const height = CAN_H + 36
  ctx.save()
  ctx.fillStyle = '#f5f5f4'
  ctx.fillRect(TRACK.left - 16, top, TRACK.right - TRACK.left + 32, height)
  ctx.strokeStyle = '#e7e5e4'
  ctx.lineWidth = 2
  ctx.strokeRect(TRACK.left - 16, top, TRACK.right - TRACK.left + 32, height)

  // 좌우 막이 — 캔이 실험대 밖으로 굴러 떨어지지 않게 막아 둔 것
  ctx.fillStyle = '#a8a29e'
  ctx.fillRect(TRACK.left - 16, top, 16, height)
  ctx.fillRect(TRACK.right, top, 16, height)
  ctx.restore()
}

// ── 대전체(막대) ──────────────────────────────────────────────────────

/**
 * 대전체 막대. tipX가 물체를 향한(오른쪽) 끝이다.
 *
 * `orientation`이 'horizontal'이면 책상에 눕혀 놓은 막대를 위에서 본 모습(캔 모드),
 * 'vertical'이면 손에 세워 든 막대를 옆에서 본 모습(검전기 모드)이다.
 * 시점이 다른 두 화면에 같은 그림을 쓰면 어느 쪽이 위인지 헷갈린다.
 */
function drawRod(ctx, tipX, centerY, charge, orientation) {
  const color = charge > 0 ? PLUS_COLOR : MINUS_COLOR
  const horizontal = orientation === 'horizontal'
  const w = horizontal ? ROD_H : ROD_W
  const h = horizontal ? ROD_W : ROD_H
  const x = tipX - w
  const y = centerY - h / 2
  ctx.save()

  // 손잡이(대전되지 않은 부분) — "어디를 잡고 있는지"가 보이게 한다
  ctx.fillStyle = '#78716c'
  if (horizontal) roundedRect(ctx, x - 34, centerY - 7, 36, 14, 6)
  else roundedRect(ctx, x + w / 2 - 7, y - 34, 14, 36, 6)
  ctx.fill()

  const grad = horizontal
    ? ctx.createLinearGradient(0, y, 0, y + h)
    : ctx.createLinearGradient(x, 0, x + w, 0)
  grad.addColorStop(0, '#f8fafc')
  grad.addColorStop(1, '#e2e8f0')
  ctx.fillStyle = grad
  roundedRect(ctx, x, y, w, h, 10)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.stroke()

  // 막대에 고르게 박힌 전하 — 대전체(부도체)는 전하가 이동하지 않는다는 점도 같이 보인다
  const n = 5
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const cx = horizontal ? x + t * w : x + w / 2
    const cy = horizontal ? centerY : y + t * h
    if (charge > 0) drawPlus(ctx, cx, cy, 7)
    else drawMinus(ctx, cx, cy, 7)
  }
  ctx.restore()
}

// ── 모드 1: 금속 캔 ───────────────────────────────────────────────────

/**
 * 눕혀 놓은 캔을 **위에서 본** 모습. 가로 폭이 지름(구르는 방향), 세로가 캔 길이다.
 *
 * 굴러가는 것을 보이게 하는 게 이 그림의 핵심이다 — 표면 줄무늬를 굴러간 거리만큼 흘려서
 * "미끄러지는 게 아니라 구른다"가 보이게 한다. 줄무늬 간격은 굴렁쇠처럼 원둘레를 나눈 값이라,
 * 캔이 지름만큼 가면 줄무늬도 딱 그만큼 돈다.
 */
function drawCan(ctx, box, isConductor, rollDistance) {
  ctx.save()
  const { x, y, w, h } = box
  const edge = isConductor ? '#475569' : '#a16207'

  // 원기둥을 위에서 보면 가운데가 밝고 양옆(둥글게 말리는 쪽)이 어둡다
  const grad = ctx.createLinearGradient(x, 0, x + w, 0)
  if (isConductor) {
    grad.addColorStop(0, '#64748b')
    grad.addColorStop(0.18, '#cbd5e1')
    grad.addColorStop(0.42, '#f8fafc')
    grad.addColorStop(0.75, '#cbd5e1')
    grad.addColorStop(1, '#64748b')
  } else {
    grad.addColorStop(0, '#b45309')
    grad.addColorStop(0.18, '#fde68a')
    grad.addColorStop(0.42, '#fffbeb')
    grad.addColorStop(0.75, '#fde68a')
    grad.addColorStop(1, '#b45309')
  }

  ctx.fillStyle = grad
  roundedRect(ctx, x, y, w, h, 8)
  ctx.fill()

  // 표면 줄무늬 — 굴러간 거리만큼 흘러간다
  ctx.save()
  roundedRect(ctx, x, y, w, h, 8)
  ctx.clip()
  const circumference = Math.PI * w // 지름 w인 원의 둘레
  const stripeGap = circumference / 10
  const offset = ((rollDistance % stripeGap) + stripeGap) % stripeGap
  ctx.strokeStyle = isConductor ? 'rgba(71,85,105,0.30)' : 'rgba(161,98,7,0.30)'
  ctx.lineWidth = 2
  for (let sx = x - stripeGap + offset; sx < x + w; sx += stripeGap) {
    ctx.beginPath()
    ctx.moveTo(sx, y + 6)
    ctx.lineTo(sx, y + h - 6)
    ctx.stroke()
  }
  ctx.restore()

  // 양 끝(캔의 뚜껑·바닥) — 위에서 보면 테두리 띠로 보인다
  ctx.fillStyle = isConductor ? 'rgba(100,116,139,0.55)' : 'rgba(180,83,9,0.45)'
  ctx.fillRect(x, y, w, 9)
  ctx.fillRect(x, y + h - 9, w, 9)

  ctx.strokeStyle = edge
  ctx.lineWidth = 2.5
  roundedRect(ctx, x, y, w, h, 8)
  ctx.stroke()
  ctx.restore()
}

/**
 * 물체 안의 전하를 그린다.
 *
 * 도체: 양성자(+)는 제자리에 고정, 자유 전자(−)만 한쪽으로 몰린다.
 *       → "왜 한쪽이 (+)가 되는가"가 그림만으로 설명된다(전자가 빠져나가서).
 * 부도체: 전자가 원자에 묶여 있어 +/−가 짝을 이룬 채 제자리에 머문다.
 * 접촉으로 대전된 뒤에는 옮겨온 전하를 통째로 더 그린다.
 */
function drawCanCharges(ctx, box, model, showCharges) {
  if (!showCharges) return
  const shifted = shiftedElectrons(model)
  const drift = electronDrift(model) // +1이면 먼(오른) 쪽, −1이면 가까운(왼) 쪽
  const rows = 2
  const cols = Math.ceil(CHARGE_PAIRS / rows)
  const padX = 22
  const cellW = (box.w - padX * 2) / cols
  const cellH = (box.h - 40) / (rows + 1)

  // 몰려간 전자가 놓일 자리 — 겹쳐 쌓이면 몇 개인지 셀 수가 없으므로, 몰린 쪽 가장자리에
  // 개수에 맞춰 위아래로 고르게 편다.
  const pileX = drift > 0 ? box.x + box.w - 20 : box.x + 20
  const pileTop = box.y + 24
  const pileSpan = box.h - 48
  const pileSpots = Array.from({ length: shifted }, (_, k) =>
    shifted === 1 ? pileTop + pileSpan / 2 : pileTop + (pileSpan * k) / (shifted - 1),
  )

  for (let i = 0; i < CHARGE_PAIRS; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const homeX = box.x + padX + cellW * (c + 0.5)
    const y = box.y + 26 + cellH * (r + 1)

    drawPlus(ctx, homeX, y - 10) // 양성자는 언제나 제자리

    if (model.material === CONDUCTOR && i < shifted) {
      drawMinus(ctx, pileX, pileSpots[i])
    } else {
      drawMinus(ctx, homeX, y + 10) // 아직 안 움직인 전자 / 부도체는 원자에 묶여 제자리
    }
  }

  // 접촉으로 옮겨온 전하 — 유도(자리만 바뀜)와 접촉(전하가 실제로 늘어남)의 차이가 보이게
  if (model.contactCharge !== 0) {
    for (let i = 0; i < Math.abs(model.contactCharge); i++) {
      const x = box.x + box.w / 2 + (i - 1) * 22
      if (model.contactCharge > 0) drawPlus(ctx, x, box.y + box.h - 26, 8)
      else drawMinus(ctx, x, box.y + box.h - 26, 8)
    }
  }
}

export function canBox(model) {
  return { x: canLeft(model), y: CAN_TOP, w: CAN_W, h: CAN_H }
}

export function drawCanMode(ctx, cssWidth, cssHeight, model, state) {
  begin(ctx, cssWidth, cssHeight)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('대전체를 끌어서 물체에 가까이 가져가 보세요', LOGICAL_WIDTH / 2, 14)
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('(위에서 내려다본 모습)', LOGICAL_WIDTH / 2, 34)

  drawTable(ctx)

  const box = canBox(model)
  const isConductor = model.material === CONDUCTOR
  drawCan(ctx, box, isConductor, model.can.x)

  ctx.save()
  ctx.fillStyle = isConductor ? '#475569' : '#a16207'
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(isConductor ? '금속 캔' : '플라스틱 컵', box.x + box.w / 2, CAN_TOP + CAN_H + 24)
  ctx.restore()

  drawCanCharges(ctx, box, model, state.showCharges)
  drawRod(ctx, model.rodTipX, CAN_TOP + CAN_H / 2, model.rodCharge, 'horizontal')

  ctx.restore()
}

// ── 모드 2: 검전기 ────────────────────────────────────────────────────
//
// 예전에는 검전기가 작고, 유도로 **치우친 전하만** 그려서 중성 상태가 텅 비어 보였다.
// 그러면 "원래 +와 −가 같은 수로 골고루 있다가 자리만 바뀐다"는 핵심이 안 보인다.
// 이제 검전기를 화면 대부분을 쓰도록 키우고, 금속판·기둥·금속박 세 구역에 전하 쌍을
// 처음부터 골고루 깔아둔 뒤 전자만 옮겨 다니게 그린다(2026-08-06 피드백, JavaLab 검전기 참고).

const SCOPE_X = SCOPE_PLATE_LEFT + 75 // 금속판 중심
const SCOPE_PLATE_W = 150
const SCOPE_PLATE_Y = 66
const SCOPE_PLATE_H = 20
const SCOPE_STEM_TOP = SCOPE_PLATE_Y + SCOPE_PLATE_H
const SCOPE_STEM_LEN = 96
const SCOPE_FOIL_TOP = SCOPE_STEM_TOP + SCOPE_STEM_LEN
const SCOPE_FOIL_LEN = 92
/** 세워 든 막대의 세로 중심 — 손잡이까지 화면 안에 들어오도록 잡은 값이다 */
const SCOPE_ROD_CENTER_Y = 150

/** 전하를 놓을 세 구역. index 0이 대전체와 가장 가까운 쪽(금속판)이다. */
function scopeZones(spread) {
  const angle = (8 + spread * 40) * (Math.PI / 180)
  return {
    plate: { x: SCOPE_X, y: SCOPE_PLATE_Y + SCOPE_PLATE_H / 2 },
    stem: { x: SCOPE_X, y: SCOPE_STEM_TOP + SCOPE_STEM_LEN / 2 },
    foil: { x: SCOPE_X, y: SCOPE_FOIL_TOP, angle },
  }
}

/** 금속박 위의 점 — t는 0(뿌리)~1(끝), dir는 좌우 */
function foilPoint(angle, t, dir) {
  return {
    x: SCOPE_X + Math.sin(angle) * SCOPE_FOIL_LEN * t * dir,
    y: SCOPE_FOIL_TOP + Math.cos(angle) * SCOPE_FOIL_LEN * t,
  }
}

function drawScopeCharges(ctx, model, showCharges, spread) {
  if (!showCharges) return
  const zones = scopeZones(spread)
  const shifted = shiftedElectrons(model)
  const drift = electronDrift(model) // +1: 금속박(먼 쪽)으로, −1: 금속판(가까운 쪽)으로

  // 전하 쌍을 세 구역에 나눠 깔아둔다. 중성 상태에서 +와 −가 **같은 수로 골고루** 있는 것이
  // 보여야 하므로, 전자도 처음에는 자기 양성자 바로 옆에 그린다.
  const homes = []
  for (let i = 0; i < CHARGE_PAIRS; i++) {
    if (i < 2) {
      homes.push({ x: zones.plate.x + (i - 0.5) * 46, y: zones.plate.y })
    } else if (i < 4) {
      homes.push({ x: zones.stem.x, y: zones.stem.y + (i - 3) * 34 })
    } else {
      // 금속박이 닫혀 있으면 두 장이 거의 겹치므로, 좌우로 최소 간격을 보장한다.
      // (그냥 금속박 위 점을 쓰면 닫힌 상태에서 전하 네 개가 한 덩어리로 뭉쳐 안 읽힌다)
      const dir = i % 2 === 0 ? -1 : 1
      const p = foilPoint(zones.foil.angle, 0.55, dir)
      homes.push({ x: SCOPE_X + dir * Math.max(30, Math.abs(p.x - SCOPE_X)), y: p.y })
    }
  }

  // 옮겨간 전자가 도착할 자리 — 몇 개가 몰렸는지 **세어서 읽을 수 있어야** 하므로 겹치지 않게
  // 편다. 금속박 쪽은 두 장에 번갈아 나눠 붙이고, 금속판 쪽은 판 위에 가로로 늘어놓는다.
  const farSpots = Array.from({ length: CHARGE_PAIRS }, (_, k) =>
    foilPoint(zones.foil.angle, 0.5 + Math.floor(k / 2) * 0.2, k % 2 === 0 ? -1 : 1),
  )
  const nearSpots = Array.from({ length: CHARGE_PAIRS }, (_, k) => ({
    x: zones.plate.x + (k - (CHARGE_PAIRS - 1) / 2) * 23,
    y: zones.plate.y,
  }))

  for (let i = 0; i < CHARGE_PAIRS; i++) {
    const home = homes[i]
    drawPlus(ctx, home.x - 9, home.y) // 양성자(원자핵)는 절대 안 움직인다

    const moved = i < shifted
    let ex = home.x + 9
    let ey = home.y
    if (moved) {
      const spot = drift > 0 ? farSpots[i] : nearSpots[i]
      ex = spot.x
      ey = spot.y
    }
    drawMinus(ctx, ex, ey)
  }

  // 미리 대전시켜 둔 전하(검전기를 이미 (−)로 만들어 둔 상태)
  if (model.preCharge !== 0) {
    for (let i = 0; i < Math.abs(model.preCharge); i++) {
      const p = foilPoint(zones.foil.angle, 0.92, i % 2 === 0 ? -1 : 1)
      if (model.preCharge > 0) drawPlus(ctx, p.x, p.y + Math.floor(i / 2) * 15, 7)
      else drawMinus(ctx, p.x, p.y + Math.floor(i / 2) * 15, 7)
    }
  }
}

export function drawScopeMode(ctx, cssWidth, cssHeight, model, state) {
  begin(ctx, cssWidth, cssHeight)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('대전체를 끌어서 검전기 금속판에 가까이 가져가 보세요', LOGICAL_WIDTH / 2, 14)

  const spread = foilSpread(model)
  const angle = (8 + spread * 40) * (Math.PI / 180)

  ctx.save()

  // 유리병 — 금속박이 바람에 흔들리지 않게 감싸는 부분. 반투명으로 안이 비쳐 보이게.
  const jarX = SCOPE_X - 105
  const jarY = SCOPE_STEM_TOP + 34
  const jarW = 210
  const jarH = 190
  ctx.fillStyle = 'rgba(186, 230, 253, 0.20)'
  roundedRect(ctx, jarX, jarY, jarW, jarH, 14)
  ctx.fill()
  ctx.strokeStyle = '#7dd3fc'
  ctx.lineWidth = 2.5
  ctx.stroke()
  // 병 목(마개)
  ctx.fillStyle = '#d6d3d1'
  roundedRect(ctx, SCOPE_X - 40, jarY - 16, 80, 20, 5)
  ctx.fill()
  ctx.strokeStyle = '#a8a29e'
  ctx.lineWidth = 2
  ctx.stroke()

  // 금속 기둥
  ctx.fillStyle = '#cbd5e1'
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2
  ctx.fillRect(SCOPE_X - 6, SCOPE_STEM_TOP, 12, SCOPE_STEM_LEN)
  ctx.strokeRect(SCOPE_X - 6, SCOPE_STEM_TOP, 12, SCOPE_STEM_LEN)

  // 금속판 — 대전체가 다가오는 면
  const plateGrad = ctx.createLinearGradient(0, SCOPE_PLATE_Y, 0, SCOPE_PLATE_Y + SCOPE_PLATE_H)
  plateGrad.addColorStop(0, '#f1f5f9')
  plateGrad.addColorStop(1, '#cbd5e1')
  ctx.fillStyle = plateGrad
  roundedRect(ctx, SCOPE_X - SCOPE_PLATE_W / 2, SCOPE_PLATE_Y, SCOPE_PLATE_W, SCOPE_PLATE_H, 7)
  ctx.fill()
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // 금속박 두 장 — 벌어진 각도가 이 화면의 결과값이다
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  for (const dir of [-1, 1]) {
    const end = foilPoint(angle, 1, dir)
    ctx.beginPath()
    ctx.moveTo(SCOPE_X, SCOPE_FOIL_TOP)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  }
  ctx.restore()

  drawScopeCharges(ctx, model, state.showCharges, spread)
  drawRod(ctx, model.rodTipX, SCOPE_ROD_CENTER_Y, model.rodCharge, 'vertical')

  ctx.restore()
}
