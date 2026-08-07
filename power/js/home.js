// 「우리 집」 화면의 캔버스 그리기 + 탭 판정.
//
// 참고 그림(교과서 삽화)을 따라 **위에서 비스듬히 내려다본 단면 조감도**로 그린다.
//   · 방 넷의 크기가 제각각인 **실제 평면도**
//   · 방마다 가구가 놓이고 벽에 문·창문이 있다
//   · 기구 이름·소비 전력은 **집 밖으로 뺀 말풍선**에 적고 지시선으로 잇는다
//
// **말풍선을 집 밖에 두는 것이 핵심 결정이다.** 이름표를 기구 바로 아래 붙이면 조감도에서는
// 서로 포개진다(격자로 줄 세워 봤지만 그건 '집'이 아니라 표처럼 보였다). 말풍선을 좌우
// 기둥에 **고정 칸으로 쌓으면 겹칠 수가 없고**, 지시선 덕분에 어느 기구인지도 분명하다 —
// 참고 그림이 쓰는 방법 그대로다(2026-08-07 사용자 요청).
//
// **연결선(전선)** 은 장식이 아니다 — 배전반에서 나온 전선이 각 기구로 갈라져 들어가고,
// 켜진 기구로 가는 선에서만 전기가 흐른다(움직이는 점). 굵기는 소비 전력에 따라 달라져서,
// 어떤 기구가 전기를 많이 먹는지가 **숫자를 읽기 전에 굵기로 먼저 보인다.**
//
// ⚠️ 관찰 결과를 글자로 적지 않는다. "열을 내는 기구가 전기를 많이 쓴다"는 학생이 찾아낼
//    결론이므로, 화면은 굵기·밝기 같은 **관찰 가능한 것**만 보여 준다.

import { APPLIANCES, isOn, applianceWatt } from './model.js'

// ── 집 평면도 ─────────────────────────────────────────────────────────
//
// 바닥 좌표 (u, v). u는 집의 가로, v는 안쪽으로 들어가는 깊이.
const FLOOR_U = 420
const FLOOR_V = 330

/** 방 넷 — 일부러 크기를 다르게 잡았다(실제 집 평면도처럼). */
// nameU·nameV는 방 이름을 적을 자리 — 가구나 기구에 가리지 않는 빈 구석으로 골랐다.
const ROOMS = [
  { id: 'bed', name: '안방', u0: 0, v0: 0, u1: 190, v1: 150, nameU: 30, nameV: 108 },
  { id: 'study', name: '공부방', u0: 190, v0: 0, u1: 420, v1: 135, nameU: 300, nameV: 20 },
  { id: 'living', name: '거실', u0: 190, v0: 135, u1: 420, v1: 330, nameU: 232, nameV: 175 },
  { id: 'kitchen', name: '주방', u0: 0, v0: 150, u1: 190, v1: 330, nameU: 150, nameV: 175 },
]

/** 기구가 놓인 자리와, 이름표를 어느 쪽 기둥에 붙일지. */
const PLACES = {
  charger: { u: 55, v: 42, side: 'left', slot: 0 },
  iron: { u: 138, v: 108, side: 'left', slot: 1 },
  fridge: { u: 52, v: 205, side: 'left', slot: 2 },
  led: { u: 132, v: 288, side: 'left', slot: 3 },
  incandescent: { u: 252, v: 40, side: 'right', slot: 0 },
  fan: { u: 358, v: 95, side: 'right', slot: 1 },
  aircon: { u: 372, v: 180, side: 'right', slot: 2 },
  tv: { u: 250, v: 268, side: 'right', slot: 3 },
}

/** 배전반 — 모든 전선이 여기서 나간다. 왼쪽 이름표 기둥과 겹치지 않게 집 안쪽으로 들여 둔다. */
const PANEL = { u: 62, v: 300 }

/** 가구 — 집처럼 보이게 하는 최소한의 소품. 기구를 가리지 않는 자리에만 둔다. */
const FURNITURE = [
  { kind: 'bed', u: 130, v: 40, w: 96, d: 68 },
  { kind: 'desk', u: 285, v: 92, w: 92, d: 34 },
  { kind: 'sofa', u: 300, v: 300, w: 110, d: 40 },
  { kind: 'counter', u: 40, v: 250, w: 44, d: 92 },
]

// 참고 그림의 따뜻한 색을 따른다 — 회색·파랑 도식보다 '집'으로 읽힌다.
const FLOOR_FILL = '#fdf6ec'
const FLOOR_EDGE = '#e8d9c5'
const WALL_FACE = '#f0c8c0'
const WALL_TOP = '#f8e0da'
const WALL_LINE = '#d9a49a'
const ROOM_LINE = '#e4cfc0'
const WIRE_OFF = '#cfc4b6'
const WIRE_ON = '#f59e0b'
const TEXT = '#3f2f26'
const SUBTEXT = '#7a6455'

const WALL_H = 62
const PARTITION_H = 26

/**
 * 화면 모양에 따라 두 가지 배치.
 *  · 넓은 화면: 집을 가운데 두고 말풍선을 **좌우 기둥**에 4개씩 (참고 그림과 같은 모양)
 *  · 세로 폰 : 집을 위에 두고 말풍선을 **아래 2열×4행**으로 (가로가 좁아 좌우로 못 편다)
 * 어느 쪽이든 말풍선은 **미리 정해진 칸**에 들어가므로 서로 겹칠 수 없다.
 */
const WIDE = {
  kx: 0.86, ky: 0.38, OX: 462, OY: 132, W: 1000, H: 440,
  card: { w: 176, h: 62, gap: 12, leftX: 14, rightX: 810, topY: 74 },
}
const TALL = {
  kx: 0.62, ky: 0.30, OX: 236, OY: 92, W: 500, H: 620,
  card: { w: 224, h: 54, gap: 8, cols: [16, 260], topY: 348 },
}

export function pickGeom(cssWidth, cssHeight) {
  return cssWidth / Math.max(cssHeight, 1) >= 1.35 ? WIDE : TALL
}

function project(g, u, v, lift = 0) {
  return { x: g.OX + (u - v) * g.kx, y: g.OY + (u + v) * g.ky - lift }
}

export function computeLayout(cssWidth, cssHeight) {
  const g = pickGeom(cssWidth, cssHeight)
  const scale = Math.min(cssWidth / g.W, cssHeight / g.H)
  return { g, scale, offsetX: (cssWidth - g.W * scale) / 2, offsetY: (cssHeight - g.H * scale) / 2 }
}

export function screenToLogical(layout, x, y) {
  return { x: (x - layout.offsetX) / layout.scale, y: (y - layout.offsetY) / layout.scale }
}

/** 이름표(말풍선)가 놓이는 네모. 칸이 정해져 있어 절대 겹치지 않는다. */
export function cardRect(g, id) {
  const p = PLACES[id]
  const c = g.card
  if (c.cols) {
    const col = p.side === 'left' ? 0 : 1
    return { x: c.cols[col], y: c.topY + p.slot * (c.h + c.gap), w: c.w, h: c.h }
  }
  return {
    x: p.side === 'left' ? c.leftX : c.rightX,
    y: c.topY + p.slot * (c.h + c.gap),
    w: c.w,
    h: c.h,
  }
}

/** 기구가 그려지는 자리(집 안)와 이름표 자리(집 밖)를 함께 돌려준다. */
export function slots(g) {
  return APPLIANCES.map((a) => {
    const p = PLACES[a.id]
    const at = project(g, p.u, p.v)
    return { id: a.id, u: p.u, v: p.v, x: at.x, y: at.y, depth: p.u + p.v, card: cardRect(g, a.id) }
  })
}

/**
 * 논리 좌표 위의 한 점이 어느 기구를 눌렀는지. 없으면 null.
 * **기구 그림과 이름표 둘 다** 누를 수 있게 한다 — 이름표가 크고 누르기 쉬워서 손가락으로는
 * 그쪽이 더 편하다.
 */
export function hitTest(p, g) {
  const list = slots(g).sort((a, b) => b.depth - a.depth)
  for (const s of list) {
    const c = s.card
    if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) return s.id
    if (Math.abs(p.x - s.x) <= 30 && p.y >= s.y - 46 && p.y <= s.y + 14) return s.id
  }
  return null
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

/** 바닥 좌표 위의 네모(방·가구)를 조감도 사각형으로 */
function quad(ctx, g, u0, v0, u1, v1, lift = 0) {
  const a = project(g, u0, v0, lift)
  const b = project(g, u1, v0, lift)
  const c = project(g, u1, v1, lift)
  const d = project(g, u0, v1, lift)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineTo(c.x, c.y)
  ctx.lineTo(d.x, d.y)
  ctx.closePath()
}

// ── 기구 아이콘 ───────────────────────────────────────────────────────
//
// 하나하나가 무엇인지 한눈에 알아볼 수 있는 게 목적이라, 사실적인 그림보다 단순한 실루엣으로
// 그린다. 켜지면 색이 살아나고 꺼져 있으면 흐릿해진다.

function iconLed(ctx, on) {
  ctx.fillStyle = on ? '#fde68a' : '#e2e8f0'
  ctx.strokeStyle = on ? '#f59e0b' : '#94a3b8'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(-16, 2)
  ctx.lineTo(16, 2)
  ctx.lineTo(10, -14)
  ctx.lineTo(-10, -14)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  if (on) {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 2
    for (const dx of [-12, 0, 12]) {
      ctx.beginPath()
      ctx.moveTo(dx, 8)
      ctx.lineTo(dx * 1.35, 20)
      ctx.stroke()
    }
  }
}

function iconBulb(ctx, on) {
  ctx.fillStyle = on ? '#fef08a' : '#e2e8f0'
  ctx.strokeStyle = on ? '#eab308' : '#94a3b8'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(0, -6, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = on ? '#a16207' : '#94a3b8'
  roundedRect(ctx, -6, 7, 12, 9, 2)
  ctx.fill()
  if (on) {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 18, -6 + Math.sin(a) * 18)
      ctx.lineTo(Math.cos(a) * 24, -6 + Math.sin(a) * 24)
      ctx.stroke()
    }
  }
}

function iconCharger(ctx, on) {
  // 휴대폰 + 충전 표시
  ctx.fillStyle = on ? '#dbeafe' : '#f1f5f9'
  ctx.strokeStyle = on ? '#2563eb' : '#94a3b8'
  ctx.lineWidth = 2.5
  roundedRect(ctx, -11, -18, 22, 36, 4)
  ctx.fill()
  ctx.stroke()
  if (on) {
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.moveTo(2, -9)
    ctx.lineTo(-5, 2)
    ctx.lineTo(0, 2)
    ctx.lineTo(-2, 11)
    ctx.lineTo(5, 0)
    ctx.lineTo(0, 0)
    ctx.closePath()
    ctx.fill()
  }
}

function iconFan(ctx, on, time) {
  ctx.strokeStyle = on ? '#0891b2' : '#94a3b8'
  ctx.lineWidth = 2.5
  ctx.beginPath() // 기둥
  ctx.moveTo(0, 8)
  ctx.lineTo(0, 20)
  ctx.moveTo(-9, 20)
  ctx.lineTo(9, 20)
  ctx.stroke()
  ctx.save()
  if (on) ctx.rotate(time * 9)
  ctx.fillStyle = on ? '#a5f3fc' : '#e2e8f0'
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3)
    ctx.beginPath()
    ctx.ellipse(0, -9, 5, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
  ctx.fillStyle = on ? '#0891b2' : '#94a3b8'
  ctx.beginPath()
  ctx.arc(0, 0, 3, 0, Math.PI * 2)
  ctx.fill()
}

function iconFridge(ctx, on) {
  ctx.fillStyle = on ? '#e0f2fe' : '#f1f5f9'
  ctx.strokeStyle = on ? '#0284c7' : '#94a3b8'
  ctx.lineWidth = 2.5
  roundedRect(ctx, -14, -20, 28, 40, 4)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath() // 냉장실/냉동실 칸막이
  ctx.moveTo(-14, -4)
  ctx.lineTo(14, -4)
  ctx.stroke()
  ctx.beginPath() // 손잡이
  ctx.moveTo(9, -14)
  ctx.lineTo(9, -8)
  ctx.moveTo(9, 2)
  ctx.lineTo(9, 12)
  ctx.stroke()
}

function iconTv(ctx, on) {
  ctx.fillStyle = on ? '#bfdbfe' : '#e2e8f0'
  ctx.strokeStyle = on ? '#1d4ed8' : '#94a3b8'
  ctx.lineWidth = 2.5
  roundedRect(ctx, -20, -15, 40, 26, 3)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath() // 받침
  ctx.moveTo(-8, 17)
  ctx.lineTo(8, 17)
  ctx.moveTo(0, 11)
  ctx.lineTo(0, 17)
  ctx.stroke()
  if (on) {
    // 화면이 켜진 느낌 — 밝은 띠 몇 줄
    ctx.fillStyle = '#60a5fa'
    ctx.fillRect(-15, -10, 30, 4)
    ctx.fillRect(-15, -3, 20, 4)
  }
}

function iconIron(ctx, on) {
  ctx.fillStyle = on ? '#fecaca' : '#f1f5f9'
  ctx.strokeStyle = on ? '#dc2626' : '#94a3b8'
  ctx.lineWidth = 2.5
  ctx.beginPath() // 다리미 옆모습
  ctx.moveTo(-18, 10)
  ctx.lineTo(18, 10)
  ctx.lineTo(14, 0)
  ctx.lineTo(-12, -2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.beginPath() // 손잡이
  ctx.moveTo(-8, -2)
  ctx.bezierCurveTo(-6, -18, 10, -18, 12, -1)
  ctx.stroke()
  if (on) {
    // 뜨거움 — 아지랑이
    ctx.strokeStyle = '#f87171'
    ctx.lineWidth = 2
    for (const dx of [-8, 4]) {
      ctx.beginPath()
      ctx.moveTo(dx, 14)
      ctx.quadraticCurveTo(dx + 5, 19, dx, 24)
      ctx.stroke()
    }
  }
}

function iconAircon(ctx, on, time) {
  ctx.fillStyle = on ? '#ccfbf1' : '#f1f5f9'
  ctx.strokeStyle = on ? '#0d9488' : '#94a3b8'
  ctx.lineWidth = 2.5
  roundedRect(ctx, -22, -14, 44, 20, 4)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath() // 바람 나오는 틈
  ctx.moveTo(-16, 2)
  ctx.lineTo(16, 2)
  ctx.stroke()
  if (on) {
    ctx.strokeStyle = '#2dd4bf'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      const off = ((time * 30 + i * 9) % 27) + 6
      ctx.globalAlpha = 1 - off / 34
      ctx.beginPath()
      ctx.moveTo(-12 + i * 12, 4 + off)
      ctx.lineTo(-6 + i * 12, 10 + off)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

const ICONS = {
  led: iconLed,
  incandescent: iconBulb,
  charger: iconCharger,
  fan: iconFan,
  fridge: iconFridge,
  tv: iconTv,
  iron: iconIron,
  aircon: iconAircon,
}



// ── 가구 ──────────────────────────────────────────────────────────────

function drawFurniture(ctx, g, f) {
  const h = f.kind === 'counter' ? 16 : f.kind === 'bed' ? 12 : 14
  const u0 = f.u - f.w / 2
  const u1 = f.u + f.w / 2
  const v0 = f.v - f.d / 2
  const v1 = f.v + f.d / 2
  const body = { bed: '#cfe3f5', desk: '#e7d3b8', sofa: '#cfd9e8', counter: '#e3ddd2' }[f.kind]
  const side = { bed: '#a9c6df', desk: '#c9b190', sofa: '#adbacd', counter: '#c6bfb1' }[f.kind]

  // 앞·옆면(두께)
  ctx.fillStyle = side
  const a = project(g, u0, v1)
  const b = project(g, u1, v1)
  const c = project(g, u1, v0)
  for (const [p, q] of [
    [a, b],
    [b, c],
  ]) {
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.lineTo(q.x, q.y - h)
    ctx.lineTo(p.x, p.y - h)
    ctx.closePath()
    ctx.fill()
  }
  // 윗면
  ctx.fillStyle = body
  quad(ctx, g, u0, v0, u1, v1, h)
  ctx.fill()
  ctx.strokeStyle = side
  ctx.lineWidth = 1.5
  ctx.stroke()

  if (f.kind === 'bed') {
    ctx.fillStyle = '#ffffff' // 베개 — 침대로 보이게
    quad(ctx, g, u0 + 8, v0 + 6, u0 + 34, v1 - 6, h + 1)
    ctx.fill()
  }
}

// ── 집 ────────────────────────────────────────────────────────────────

function drawFloor(ctx, g) {
  ctx.save()
  // 방마다 바닥을 칠한다 — 크기가 제각각인 것이 그대로 보인다
  for (const r of ROOMS) {
    ctx.fillStyle = FLOOR_FILL
    quad(ctx, g, r.u0, r.v0, r.u1, r.v1)
    ctx.fill()
    ctx.strokeStyle = ROOM_LINE
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ctx.strokeStyle = FLOOR_EDGE
  ctx.lineWidth = 3
  quad(ctx, g, 0, 0, FLOOR_U, FLOOR_V)
  ctx.stroke()
  ctx.restore()
}

/** 벽 한 장(바닥 위의 선분에서 위로 세운다). 문·창문 구멍을 낼 수 있다. */
function drawWall(ctx, g, u0, v0, u1, v1, height, opening) {
  const a = project(g, u0, v0)
  const b = project(g, u1, v1)
  ctx.fillStyle = WALL_FACE
  ctx.strokeStyle = WALL_LINE
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineTo(b.x, b.y - height)
  ctx.lineTo(a.x, a.y - height)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // 윗면(잘라낸 단면)
  ctx.fillStyle = WALL_TOP
  ctx.beginPath()
  ctx.moveTo(a.x, a.y - height)
  ctx.lineTo(b.x, b.y - height)
  ctx.lineTo(b.x, b.y - height - 5)
  ctx.lineTo(a.x, a.y - height - 5)
  ctx.closePath()
  ctx.fill()

  if (!opening) return
  // 문 또는 창문 — 벽 길이의 t0~t1 구간에 낸다
  const [kind, t0, t1] = opening
  const p0 = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 }
  const p1 = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 }
  const top = kind === 'door' ? height * 0.86 : height * 0.66
  const bottom = kind === 'door' ? 0 : height * 0.26
  ctx.fillStyle = kind === 'door' ? '#8b5e3c' : '#d6ecf7'
  ctx.strokeStyle = kind === 'door' ? '#6b4630' : '#9cc6dd'
  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y - bottom)
  ctx.lineTo(p1.x, p1.y - bottom)
  ctx.lineTo(p1.x, p1.y - top)
  ctx.lineTo(p0.x, p0.y - top)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

/** 바깥벽 — 안쪽 두 면만 세운다. 앞쪽은 잘라내야 방 안이 보인다. */
function drawOuterWalls(ctx, g) {
  ctx.save()
  drawWall(ctx, g, 0, FLOOR_V, 0, 0, WALL_H, ['window', 0.55, 0.8])
  drawWall(ctx, g, 0, 0, FLOOR_U, 0, WALL_H, ['window', 0.55, 0.78])
  ctx.restore()
}

/**
 * 방 칸막이 — 낮게 세워 기구를 가리지 않는다. 문을 내어 방끼리 이어진 것처럼 보이게 한다.
 * ⚠️ **바닥을 칠한 뒤에** 그려야 한다. 먼저 그리면 방바닥이 그 위를 덮어 칸막이가 사라진다.
 */
const PARTITIONS = [
  { u0: 190, v0: 0, u1: 190, v1: 150, opening: ['door', 0.35, 0.62] },
  { u0: 0, v0: 150, u1: 190, v1: 150, opening: ['door', 0.4, 0.68] },
  { u0: 190, v0: 135, u1: 420, v1: 135, opening: ['door', 0.3, 0.55] },
  { u0: 190, v0: 150, u1: 190, v1: 330, opening: null },
]

/**
 * 칸막이와 가구를 **깊이 순으로 섞어서** 그린다.
 *
 * 둘을 따로 그리면 어느 한쪽이 늘 위로 올라간다 — 가구를 나중에 그렸더니 벽 앞에 있어야 할
 * 이유가 없는 가구까지 벽 위에 얹혔다(2026-08-07 사용자 지적). 조감도에서는 **앞에 있는 것
 * (u+v가 큰 것)이 뒤에 있는 것을 가려야** 하므로, 둘을 한 목록에 넣고 깊이로 정렬해 그린다.
 */
function drawPartitionsAndFurniture(ctx, g) {
  const items = [
    ...PARTITIONS.map((w) => ({
      depth: (w.u0 + w.u1) / 2 + (w.v0 + w.v1) / 2,
      draw: () => drawWall(ctx, g, w.u0, w.v0, w.u1, w.v1, PARTITION_H, w.opening),
    })),
    ...FURNITURE.map((f) => ({
      depth: f.u + f.v,
      draw: () => drawFurniture(ctx, g, f),
    })),
  ]
  items.sort((a, b) => a.depth - b.depth)
  ctx.save()
  for (const it of items) it.draw()
  ctx.restore()
}

function drawRoomNames(ctx, g) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.fillStyle = SUBTEXT
  for (const r of ROOMS) {
    const p = project(g, r.nameU, r.nameV)
    ctx.fillText(r.name, p.x, p.y)
  }
  ctx.restore()
}

function drawPanel(ctx, g, anyOn) {
  const p = project(g, PANEL.u, PANEL.v)
  ctx.save()
  ctx.fillStyle = anyOn ? '#fef3c7' : '#f1f5f9'
  ctx.strokeStyle = anyOn ? '#d97706' : '#94a3b8'
  ctx.lineWidth = 2.5
  roundedRect(ctx, p.x - 26, p.y - 34, 52, 30, 5)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = anyOn ? '#b45309' : '#64748b'
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('배전반', p.x, p.y - 19)
  ctx.restore()
}

/**
 * 배전반에서 기구까지 전선이 지나갈 길(바닥 좌표).
 *
 * **바닥의 가로(u)·세로(v) 방향으로만 꺾어서** 간다 — 조감도에서는 이 두 방향이 곧 벽과
 * 나란한 방향이라, 실제로 벽을 타고 배선한 것처럼 보인다. 비스듬한 직선으로 이으면
 * 방을 가로질러 날아가는 선이 되어 배선처럼 보이지 않는다(2026-08-07 사용자 지적).
 *
 * 여러 전선이 같은 자리를 지나면 굵은 선이 얇은 선을 덮어 버리므로, 기구마다 **자기 차선**을
 * 준다. 안쪽(v가 작은) 기구일수록 더 안쪽 차선을 써서 서로 엇갈리지 않는다.
 */
function wirePath(id) {
  const p = PLACES[id]
  const order = Object.entries(PLACES)
    .sort((a, b) => b[1].v - a[1].v)
    .map(([k]) => k)
  const lane = PANEL.v - order.indexOf(id) * 6
  return [
    { u: PANEL.u, v: PANEL.v },
    { u: PANEL.u, v: lane },
    { u: p.u, v: lane },
    { u: p.u, v: p.v },
  ]
}

/** 전선 — 켜지면 굵고 노랗게, 전기가 흐르는 것이 점으로 보인다. */
function drawWire(ctx, g, floorPts, on, thickness, time, phase) {
  const pts = floorPts.map((q) => project(g, q.u, q.v))
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = on ? WIRE_ON : WIRE_OFF
  ctx.lineWidth = on ? thickness : 1.8
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y)
  ctx.stroke()

  if (on) {
    const segs = []
    let total = 0
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      if (len > 0) segs.push({ a: pts[i - 1], b: pts[i], len })
      total += len
    }
    ctx.fillStyle = '#fff7ed'
    const spacing = 32
    for (let d = (time * 58 + phase) % spacing; d < total; d += spacing) {
      let rest = d
      for (const s of segs) {
        if (rest <= s.len) {
          const t = rest / s.len
          ctx.beginPath()
          ctx.arc(s.a.x + (s.b.x - s.a.x) * t, s.a.y + (s.b.y - s.a.y) * t, thickness * 0.4, 0, Math.PI * 2)
          ctx.fill()
          break
        }
        rest -= s.len
      }
    }
  }
  ctx.restore()
}

/** 이름표(말풍선) + 기구까지 잇는 지시선 — 참고 그림과 같은 방식. */
function drawCard(ctx, s, a, model, state, on, watt) {
  const c = s.card
  const anchorX = c.x + c.w / 2 < s.x ? c.x + c.w : c.x
  const anchorY = c.y + c.h / 2
  ctx.save()
  ctx.strokeStyle = on ? '#e0a44a' : '#c9bcae'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(anchorX, anchorY)
  ctx.lineTo(s.x, s.y - 16)
  ctx.stroke()
  ctx.fillStyle = on ? '#e0a44a' : '#c9bcae'
  ctx.beginPath()
  ctx.arc(s.x, s.y - 16, 3, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = on ? '#fff7e6' : '#ffffff'
  ctx.strokeStyle = on ? '#e0a44a' : '#ddd2c4'
  ctx.lineWidth = on ? 2.5 : 1.5
  roundedRect(ctx, c.x, c.y, c.w, c.h, 10)
  ctx.fill()
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = TEXT
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.fillText(a.name, c.x + 11, c.y + 8)
  ctx.fillStyle = on ? '#b45309' : SUBTEXT
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.fillText(watt + ' W', c.x + 11, c.y + 26)

  ctx.font = '11px system-ui, sans-serif'
  if (state.showEnergy) {
    ctx.fillStyle = '#0f766e'
    ctx.fillText('→ ' + a.energy, c.x + 66, c.y + 27)
  }
  if (!on && model.countStandby && a.standby > 0) {
    ctx.fillStyle = '#b91c1c'
    ctx.fillText('대기 ' + a.standby + ' W', c.x + 11, c.y + 43)
  } else {
    ctx.fillStyle = on ? '#b45309' : '#a09080'
    ctx.fillText(on ? '켜짐 — 눌러서 끄기' : '꺼짐 — 눌러서 켜기', c.x + 11, c.y + 43)
  }
  ctx.restore()
}

export function drawHome(ctx, cssWidth, cssHeight, model, state) {
  const layout = computeLayout(cssWidth, cssHeight)
  const g = layout.g
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  ctx.save()
  ctx.translate(layout.offsetX, layout.offsetY)
  ctx.scale(layout.scale, layout.scale)

  const time = state.time || 0
  const anyOn = APPLIANCES.some((a) => isOn(model, a.id))
  const maxW = Math.max(...APPLIANCES.map((a) => a.watt))
  const list = slots(g)

  drawOuterWalls(ctx, g)
  drawFloor(ctx, g)
  drawPartitionsAndFurniture(ctx, g) // 바닥 뒤에, 서로는 깊이 순으로
  drawRoomNames(ctx, g) // 가구·벽 뒤에 그려야 가리지 않는다

  list.forEach((s, i) => {
    const a = APPLIANCES.find((x) => x.id === s.id)
    const on = isOn(model, s.id)
    const thickness = 2.5 + 4.5 * (Math.log(a.watt + 1) / Math.log(maxW + 1))
    drawWire(ctx, g, wirePath(s.id), on, thickness, time, i * 9)
  })
  drawPanel(ctx, g, anyOn)

  // 기구는 뒤에서 앞으로 — 앞의 것이 뒤의 것을 가려야 입체로 보인다
  const back2front = [...list].sort((p, q) => p.depth - q.depth)
  for (const s of back2front) {
    const on = isOn(model, s.id)
    if (on) {
      ctx.save()
      ctx.fillStyle = 'rgba(245, 158, 11, 0.20)'
      ctx.beginPath()
      ctx.ellipse(s.x, s.y, 30, 12, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.save()
    ctx.fillStyle = 'rgba(60, 40, 20, 0.12)'
    ctx.beginPath()
    ctx.ellipse(s.x, s.y, 17, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.translate(s.x, s.y - 18)
    ctx.scale(0.82, 0.82) // 집 안에 놓이니 조금 작게
    if (ICONS[s.id]) ICONS[s.id](ctx, on, time)
    ctx.restore()
  }

  // 이름표는 맨 위에 — 무엇에도 가리지 않아야 한다
  for (const s of list) {
    const a = APPLIANCES.find((x) => x.id === s.id)
    drawCard(ctx, s, a, model, state, isOn(model, s.id), applianceWatt(model, s.id))
  }

  ctx.restore()
}
