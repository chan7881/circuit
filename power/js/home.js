// 「우리 집」 화면의 캔버스 그리기 + 탭 판정.
//
// 예전에는 이 화면이 네모 카드 목록이었다. 기기 이름이 회색 글자로만 적혀 있어 잘 안 보였고,
// 무엇보다 **"버튼을 누른다"가 집에서 전기를 쓴다는 것과 잘 이어지지 않았다**(2026-08-07
// 사용자 피드백). 그래서 **조감도(위에서 비스듬히 내려다본 집)** 안에 기구를 놓고 직접
// 누르게 했다. 정면에서 본 납작한 그림으로도 그려 봤지만, 방바닥이 안 보여서 "집"이라기보다
// 칸이 나뉜 표처럼 보였다 — 참고 그림처럼 바닥이 보여야 방에 기구가 놓인 것으로 읽힌다.
//
// **연결선**은 장식이 아니다 — 배전반에서 나온 전선이 방바닥을 따라 각 기구로 갈라져 들어가고,
// 켜진 기구로 가는 선에서만 전기가 흐른다(움직이는 점). 선의 굵기는 그 기구가 쓰는 전력에
// 따라 달라져서, 어떤 기구가 전기를 많이 먹는지가 **숫자를 읽기 전에 굵기로 먼저 보인다.**
//
// ⚠️ 관찰 결과를 글자로 적지 않는다. "열을 내는 기구가 전기를 많이 쓴다"는 학생이 찾아낼
//    결론이므로, 화면은 굵기·밝기 같은 **관찰 가능한 것**만 보여 준다.

import { APPLIANCES, isOn, applianceWatt } from './model.js'

// ── 조감도 투영 ───────────────────────────────────────────────────────
//
// 바닥 좌표 (u, v)를 화면 좌표로 옮긴다. u는 집의 가로, v는 안쪽으로 들어가는 깊이다.
//   화면x = OX + (u − v) · kx      화면y = OY + (u + v) · ky
//
// ⚠️ 기구 자리를 바닥 좌표로 직접 잡으면 안 된다. 조감도에서는 (u+v)가 같은 두 점이 화면에서
//    같은 높이에 겹쳐 버려서, 바닥에서 멀찍이 떨어뜨려도 이름표가 서로 포개진다(실제로 처음
//    그렇게 짰다가 글자가 뭉갰다). 그래서 **화면에서의 칸(가로 d = u−v, 세로 s = u+v)을 먼저
//    정하고** 거기서 u, v를 거꾸로 구한다 — 이름표 사이 간격이 화면에서 보장된다.
//      u = (s + d) / 2,  v = (s − d) / 2
//
// 화면 모양에 따라 각도와 칸 배치를 달리한다: 넓은 화면은 4칸×2줄, 세로로 긴 폰은 2칸×4줄.
// 조감도는 본래 가로로 퍼지는 그림이라, 세로 화면에 넓은 각도를 그대로 쓰면 배율이 떨어져
// 이름 글자가 7px도 안 됐다.
const FLOOR_U = 470
const FLOOR_V = 470
const WALL_H = 62
/**
 * 바닥 네 귀퉁이를 잘라낸다.
 * 기구는 화면 격자에 맞춰 놓기 때문에 마름모꼴 바닥의 네 귀퉁이(맨 위·아래·좌·우)에는
 * 아무것도 놓이지 않아 휑하게 남는다. 그 부분을 잘라내면 기구가 놓인 만큼만 방이 된다.
 */
// 바닥 좌표 (u,v)와 화면 칸 좌표 (d,s)는 서로 바꿔 쓸 수 있다: d = u−v, s = u+v.
function ds(d, s) {
  return { u: (s + d) / 2, v: (s - d) / 2 }
}

// 전선은 **화면 칸 좌표로 깐다.** 바닥 좌표로 깔면(예: v를 고정) 조감도에서 대각선이 되어
// 방을 가로질러 이름표 위를 지나간다(처음에 그렇게 짰다가 화면이 엉켰다).
//   · s를 고정한 선 → 화면에서 **가로**
//   · d를 고정한 선 → 화면에서 **세로**
// 그래서 칸이 적은 쪽으로 간선을 깔고, 많은 쪽으로 갈라 준다.
const WIDE = {
  kx: 0.86, ky: 0.34,
  cols: [-174, -58, 58, 174],
  rows: [260, 672],
  roomsAcross: 4, // 방 넷이 나란히 — 방마다 위·아래 두 자리에 기구가 하나씩
  busAlong: 'row', // 두 줄 사이를 가로지르는 간선(가로) + 기구마다 세로로 갈라짐
  busS: 466,
  panelD: -232,
  sMin: 150, sMax: 800, dMax: 280,
  OX: 420, OY: 96, W: 840, H: 430,
}
const TALL = {
  kx: 0.5, ky: 0.66,
  cols: [-110, 110],
  rows: [200, 397, 594, 791],
  roomsAcross: 2, // 방 둘씩 두 줄 = 넷
  busAlong: 'col', // 두 칸 사이를 지나는 간선(세로) + 기구마다 가로로 갈라짐
  busD: 0,
  panelS: 120,
  sMin: 96, sMax: 880, dMax: 260,
  OX: 250, OY: 96, W: 500, H: 720,
}

/**
 * 방 배치 — 실제 집처럼 그럴듯하게 묶는다. 방 하나에 기구 둘.
 * 순서가 곧 자리다: i번째 방 = (칸 i%roomsAcross, 줄 i/roomsAcross), 그 방의 두 기구가
 * 그 칸의 위·아래 자리에 들어간다.
 */
const ROOMS = [
  { name: '주방', ids: ['led', 'fridge'] },
  { name: '거실', ids: ['tv', 'aircon'] },
  { name: '안방', ids: ['charger', 'iron'] },
  { name: '공부방', ids: ['incandescent', 'fan'] },
]

/** 기구 id → 화면 칸(칸 번호, 줄 번호) */
function slotOf(g, id) {
  for (const [r, room] of ROOMS.entries()) {
    const k = room.ids.indexOf(id)
    if (k < 0) continue
    const rc = r % g.roomsAcross
    const rr = Math.floor(r / g.roomsAcross)
    return { col: rc, row: rr * 2 + k, room: r }
  }
  return { col: 0, row: 0, room: 0 }
}

/** 가로가 세로의 1.35배보다 넓으면 넓은 각도(4칸×2줄), 아니면 세로로 세운 각도(2칸×4줄). */
export function pickGeom(cssWidth, cssHeight) {
  return cssWidth / Math.max(cssHeight, 1) >= 1.35 ? WIDE : TALL
}

function project(g, u, v, lift = 0) {
  return { x: g.OX + (u - v) * g.kx, y: g.OY + (u + v) * g.ky - lift }
}

/** 갈래 전선이 이름표를 피해 옆으로 비켜 가는 정도(화면 칸 좌표). */
const BRANCH_OFF = 62

const WALL = '#cbd5e1'
const WALL_TOP = '#e2e8f0'
const FLOOR_FILL = '#f8fafc'
const ROOM_LINE = '#dbe3ec'
const WIRE_OFF = '#cbd5e1'
const WIRE_ON = '#f59e0b'
const TEXT = '#1e293b' // 진하게 — 예전 회색(#64748b)은 작은 글씨에서 잘 안 보였다
const SUBTEXT = '#475569'

export function computeLayout(cssWidth, cssHeight) {
  const g = pickGeom(cssWidth, cssHeight)
  const scale = Math.min(cssWidth / g.W, cssHeight / g.H)
  return {
    g,
    scale,
    offsetX: (cssWidth - g.W * scale) / 2,
    offsetY: (cssHeight - g.H * scale) / 2,
  }
}

export function screenToLogical(layout, x, y) {
  return { x: (x - layout.offsetX) / layout.scale, y: (y - layout.offsetY) / layout.scale }
}

/** 기구가 화면 어디에 그려지는지 — 그리기와 탭 판정이 같은 값을 쓴다. */
export function slots(g) {
  return APPLIANCES.map((a) => {
    const at = slotOf(g, a.id)
    const d = g.cols[at.col]
    const s = g.rows[at.row]
    const f = ds(d, s)
    const p = project(g, f.u, f.v)
    return { id: a.id, u: f.u, v: f.v, d, s, x: p.x, y: p.y, depth: s, room: at.room }
  })
}

/** 배전반이 놓인 화면 칸 자리 — 간선이 시작하는 곳이다. */
function panelDS(g) {
  return g.busAlong === 'row'
    ? { d: g.panelD, s: g.busS }
    : { d: g.busD, s: g.panelS }
}

/**
 * 논리 좌표 위의 한 점이 어느 기구를 눌렀는지. 없으면 null.
 * 앞(아래)에 있는 기구가 위로 겹쳐 그려지므로, 판정도 앞에서부터 훑는다.
 */
export function hitTest(p, g) {
  const list = slots(g).sort((a, b) => b.depth - a.depth)
  for (const s of list) {
    if (Math.abs(p.x - s.x) <= 46 && p.y >= s.y - 54 && p.y <= s.y + 40) return s.id
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


// ── 집(조감도) ────────────────────────────────────────────────────────

/** 반평면 하나로 다각형을 자른다(f(p) ≥ 0 인 쪽만 남긴다). */
function clipHalfPlane(poly, f) {
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]
    const prev = poly[(i + poly.length - 1) % poly.length]
    const fc = f(cur)
    const fp = f(prev)
    if (fp >= 0 !== fc >= 0) {
      const t = fp / (fp - fc)
      out.push({ u: prev.u + (cur.u - prev.u) * t, v: prev.v + (cur.v - prev.v) * t })
    }
    if (fc >= 0) out.push(cur)
  }
  return out
}

/** 귀퉁이를 잘라낸 바닥 다각형(바닥 좌표). */
function floorPolygon(g) {
  let poly = [
    { u: 0, v: 0 },
    { u: FLOOR_U, v: 0 },
    { u: FLOOR_U, v: FLOOR_V },
    { u: 0, v: FLOOR_V },
  ]
  for (const f of [
    (p) => p.u + p.v - g.sMin,
    (p) => g.sMax - (p.u + p.v),
    (p) => g.dMax - (p.u - p.v),
    (p) => p.u - p.v + g.dMax,
  ]) {
    poly = clipHalfPlane(poly, f)
  }
  return poly
}

/** 바닥 안에서 u−v = d 인 선분의 양 끝점 — 방을 가르는 칸막이 자리다. */
function dividerEnds(g, d) {
  const s0 = Math.max(g.sMin, Math.abs(d))
  const s1 = Math.min(g.sMax, FLOOR_U + FLOOR_V - Math.abs(d))
  return [
    { u: (s0 + d) / 2, v: (s0 - d) / 2 },
    { u: (s1 + d) / 2, v: (s1 - d) / 2 },
  ]
}

/**
 * 바닥면과 방 칸막이.
 * 칸막이는 **화면에서 기구 칸을 가르는 자리**(d의 중간값)에 긋는다 — 그래야 방 하나에 기구가
 * 고르게 들어간 것으로 보인다. 바닥 좌표에서 반듯하게 반으로 가르면 화면에서는 기구들이
 * 한쪽 방에만 몰려 보인다.
 */
function drawFloor(ctx, g) {
  const c = floorPolygon(g).map((p) => project(g, p.u, p.v))
  ctx.save()
  ctx.fillStyle = FLOOR_FILL
  ctx.strokeStyle = WALL
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(c[0].x, c[0].y)
  for (const p of c.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.restore()
}

/** 방을 가르는 칸막이가 놓이는 자리들. 화면 칸 사이사이에 선다. */
function partitions(g) {
  const out = []
  // 칸(가로) 사이 — 화면에서 세로로 선 벽
  for (let i = 1; i < g.roomsAcross; i++) {
    out.push({ kind: 'd', at: (g.cols[i - 1] + g.cols[i]) / 2 })
  }
  // 줄(세로) 사이 — 방이 위아래로도 나뉘는 배치에서만
  const roomsDown = Math.ceil(g.rows.length / 2)
  for (let r = 1; r < roomsDown; r++) {
    // 방 하나가 두 줄을 쓰므로, 아랫방 첫 줄과 윗방 둘째 줄 사이에 세운다.
    // 딱 가운데에 두면 위 칸 이름표와 겹쳐서, 조금 아래로 내린다.
    const a = g.rows[r * 2 - 1]
    const b = g.rows[r * 2]
    out.push({ kind: 's', at: a + (b - a) * 0.62 })
  }
  return out
}

/**
 * 방 칸막이 — 실제 집처럼 방이 나뉘어 보이게 한다.
 * ⚠️ **기구를 가리면 안 된다.** 그래서 바깥벽(WALL_H)보다 훨씬 낮게 세우고, 기구가 놓인
 *    칸 사이의 빈 자리에만 둔다(2026-08-07 사용자 요청).
 */
const PARTITION_H = 26

function drawPartitions(ctx, g) {
  ctx.save()
  for (const p of partitions(g)) {
    let a
    let b
    if (p.kind === 'd') {
      const [ea, eb] = dividerEnds(g, p.at)
      a = project(g, ea.u, ea.v)
      b = project(g, eb.u, eb.v)
    } else {
      // s가 고정된 선 — 바닥 안에서 d가 갈 수 있는 범위만큼
      const s = p.at
      const dMin = Math.max(-g.dMax, -s, s - 2 * FLOOR_V)
      const dMax = Math.min(g.dMax, s, 2 * FLOOR_U - s)
      const fa = ds(dMin, s)
      const fb = ds(dMax, s)
      a = project(g, fa.u, fa.v)
      b = project(g, fb.u, fb.v)
    }
    ctx.fillStyle = WALL
    ctx.strokeStyle = '#b8c2cf'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(b.x, b.y - PARTITION_H)
    ctx.lineTo(a.x, a.y - PARTITION_H)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // 벽 윗면
    ctx.fillStyle = WALL_TOP
    ctx.beginPath()
    ctx.moveTo(a.x, a.y - PARTITION_H)
    ctx.lineTo(b.x, b.y - PARTITION_H)
    ctx.lineTo(b.x, b.y - PARTITION_H - 4)
    ctx.lineTo(a.x, a.y - PARTITION_H - 4)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/**
 * 방 이름표 — 방마다 어떤 방인지 적는다.
 * 자리는 **벽면 위**다. 바닥에 적으면 기구나 이름표와 부딪히는데, 벽면은 비어 있다.
 */
function drawRoomNames(ctx, g) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.fillStyle = '#64748b'

  const roomsDown = Math.ceil(g.rows.length / 2)
  const parts = partitions(g)
  const sParts = parts.filter((p) => p.kind === 's')

  for (const [i, room] of ROOMS.entries()) {
    const rc = i % g.roomsAcross
    const rr = Math.floor(i / g.roomsAcross)
    if (rc >= g.cols.length || rr >= roomsDown) continue
    const d = g.cols[rc]
    let y
    if (rr === 0) {
      // 맨 안쪽 방 — 바깥 뒷벽에 붙인다
      const backS = Math.max(g.sMin, Math.abs(d))
      y = project(g, ...Object.values(ds(d, backS))).y - WALL_H / 2
    } else {
      // 앞쪽 방 — 바로 뒤에 선 칸막이 벽면에 붙인다
      const wallS = sParts[rr - 1].at
      y = project(g, ...Object.values(ds(d, wallS))).y - PARTITION_H / 2
    }
    ctx.fillText(room.name, g.OX + d * g.kx, y)
  }
  ctx.restore()
}

/** 안쪽 두 벽만 세운다 — 앞쪽은 잘라내야 방 안이 보인다(참고 그림과 같은 단면 조감도). */
function drawWalls(ctx, g) {
  ctx.save()
  // 바닥 다각형의 변 중 **안쪽(깊이가 얕은 쪽)** 변에만 벽을 세운다. 앞쪽 변은 벽이 없어야
  // 방 안이 들여다보인다. 귀퉁이를 잘라낸 뒤로는 안쪽 변이 셋(모서리 깎인 면 포함)이다.
  const poly = floorPolygon(g)
  const BACK_S = g.sMin + 210
  const quads = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if (Math.max(a.u + a.v, b.u + b.v) <= BACK_S) {
      quads.push([project(g, a.u, a.v), project(g, b.u, b.v)])
    }
  }
  for (const [a, b] of quads) {
    ctx.fillStyle = WALL
    ctx.strokeStyle = '#b8c2cf'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(b.x, b.y - WALL_H)
    ctx.lineTo(a.x, a.y - WALL_H)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  // 벽 윗면(두께) — 잘라낸 단면처럼 보이게 얇은 띠를 얹는다
  ctx.fillStyle = WALL_TOP
  for (const [a, b] of quads) {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y - WALL_H)
    ctx.lineTo(b.x, b.y - WALL_H)
    ctx.lineTo(b.x, b.y - WALL_H - 5)
    ctx.lineTo(a.x, a.y - WALL_H - 5)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** 배전반 — 모든 전선이 여기서 나간다. 집 전체가 한 곳에서 전기를 받는다는 것이 보인다. */
function drawPanel(ctx, g, anyOn) {
  const pd = panelDS(g)
  const f = ds(pd.d, pd.s)
  const p = project(g, f.u, f.v)
  ctx.save()
  ctx.fillStyle = anyOn ? '#fef3c7' : '#f1f5f9'
  ctx.strokeStyle = anyOn ? '#d97706' : '#94a3b8'
  ctx.lineWidth = 3
  roundedRect(ctx, p.x - 27, p.y - 38, 54, 32, 5)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = anyOn ? '#b45309' : '#64748b'
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('배전반', p.x, p.y - 22)
  ctx.restore()
}

/**
 * 전선 한 줄(바닥을 따라 놓인다). 켜져 있으면 굵고 노랗게, 전기가 흐르는 것이 점으로 보인다.
 * **굵기는 그 기구가 쓰는 전력에 따라 달라진다** — 많이 쓰는 기구일수록 굵다.
 */
function drawWire(ctx, pts, on, thickness, time, phase) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = on ? WIRE_ON : WIRE_OFF
  ctx.lineWidth = on ? thickness : 2
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.stroke()

  if (on) {
    const segs = []
    let total = 0
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      segs.push({ a: pts[i - 1], b: pts[i], len })
      total += len
    }
    ctx.fillStyle = '#fff7ed'
    const spacing = 34
    for (let d = (time * 60 + phase) % spacing; d < total; d += spacing) {
      let rest = d
      for (const s of segs) {
        if (rest <= s.len) {
          const t = rest / s.len
          ctx.beginPath()
          ctx.arc(s.a.x + (s.b.x - s.a.x) * t, s.a.y + (s.b.y - s.a.y) * t, thickness * 0.42, 0, Math.PI * 2)
          ctx.fill()
          break
        }
        rest -= s.len
      }
    }
  }
  ctx.restore()
}

/**
 * @param state.showEnergy - 에너지 전환 표시 여부(기본은 감춤 — 학습지에서 학생이 채울 칸이다)
 */
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

  drawWalls(ctx, g)
  drawFloor(ctx, g)
  drawPartitions(ctx, g)
  drawRoomNames(ctx, g)

  // 바닥 앞쪽을 가로지르는 간선 — 배전반에서 오른쪽 끝까지
  const list = slots(g)
  const pd = panelDS(g)
  /** 화면 칸 좌표 (d,s) 두 점을 잇는 전선 — 바닥 위에 놓인 것으로 그려진다. */
  const wireDS = (a, b, on, th, phase) => {
    const fa = ds(a.d, a.s)
    const fb = ds(b.d, b.s)
    drawWire(ctx, [project(g, fa.u, fa.v), project(g, fb.u, fb.v)], on, th, time, phase)
  }

  if (g.busAlong === 'row') {
    // 두 줄 사이를 가로지르는 간선 → 기구마다 위·아래로 갈라진다
    const far = Math.max(...g.cols) + BRANCH_OFF + 12
    wireDS({ d: pd.d, s: g.busS }, { d: far, s: g.busS }, anyOn, 5, 0)
  } else {
    // 두 칸 사이를 지나는 간선 → 기구마다 좌·우로 갈라진다
    const far = Math.max(...g.rows) + 40
    wireDS({ d: g.busD, s: pd.s }, { d: g.busD, s: far }, anyOn, 5, 0)
  }

  list.forEach((s, i) => {
    const a = APPLIANCES.find((x) => x.id === s.id)
    const on = isOn(model, s.id)
    // 굵기는 소비 전력에 따라. 로그로 눌러야 8W와 1800W가 한 화면에 같이 보인다.
    const thickness = 3 + 5 * (Math.log(a.watt + 1) / Math.log(maxW + 1))
    if (g.busAlong === 'row') {
      // 간선에서 곧장 기구로 올라가면 이름표 한가운데를 뚫고 지나간다.
      // 옆으로 비켜 올라간 뒤 기구 높이에서 꺾어 들어간다.
      const off = s.d + BRANCH_OFF
      const fa = ds(off, g.busS)
      const fb = ds(off, s.s)
      const fc = ds(s.d, s.s)
      drawWire(
        ctx,
        [project(g, fa.u, fa.v), project(g, fb.u, fb.v), project(g, fc.u, fc.v)],
        on,
        thickness,
        time,
        i * 11,
      )
    } else {
      wireDS({ d: g.busD, s: s.s }, { d: s.d, s: s.s }, on, thickness, i * 11)
    }
  })

  drawPanel(ctx, g, anyOn)

  // 기구는 **뒤에서 앞으로** 그린다 — 앞의 것이 뒤의 것을 가려야 입체로 보인다.
  ;[...list]
    .sort((p, q) => p.depth - q.depth)
    .forEach((s) => {
      const a = APPLIANCES.find((x) => x.id === s.id)
      const on = isOn(model, s.id)
      const watt = applianceWatt(model, s.id)

      if (on) {
        ctx.save()
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)'
        ctx.beginPath()
        ctx.ellipse(s.x, s.y, 40, 15, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      // 바닥 그림자 — 기구가 바닥에 서 있는 느낌을 준다
      ctx.save()
      ctx.fillStyle = 'rgba(15, 23, 42, 0.10)'
      ctx.beginPath()
      ctx.ellipse(s.x, s.y, 22, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.translate(s.x, s.y - 22) // 바닥에 세워 놓는다
      ICONS[s.id]?.(ctx, on, time)
      ctx.restore()

      // 이름과 전력 — 진한 색으로 적는다(예전 회색 글씨는 잘 안 보였다)
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = on ? '#0f172a' : TEXT
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.fillText(a.name, s.x, s.y + 6)
      ctx.fillStyle = on ? '#b45309' : SUBTEXT
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.fillText(`${watt} W`, s.x, s.y + 22)

      let line = s.y + 37
      if (state.showEnergy) {
        ctx.fillStyle = '#0f766e'
        ctx.font = '11px system-ui, sans-serif'
        ctx.fillText(`→ ${a.energy}`, s.x, line)
        line += 14
      }
      if (!on && model.countStandby && a.standby > 0) {
        ctx.fillStyle = '#b91c1c'
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.fillText(`대기 ${a.standby} W`, s.x, line)
      }
      ctx.restore()
    })

  ctx.restore()
}
