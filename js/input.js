// 포인터 좌표 → 격자 간선/부품 히트테스트. DOM 이벤트 리스너 등록은 main.js가 한다 —
// 여기 있는 함수들은 좌표만 받아 순수하게 판정 결과를 돌려준다.

import { EDGE_LIST } from './model.js'
import { EDGE_HIT_WIDTH } from './config.js'
import { computeLayout, screenToLogical, nodePoint as renderNodePoint } from './render.js'

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + dx * t
  const cy = y1 + dy * t
  return Math.hypot(px - cx, py - cy)
}

/**
 * 화면 좌표(캔버스 CSS px 기준)에 가장 가까운 간선을 찾는다.
 * @returns {{ edge: object, item: object|null, items: object[] } | null}
 */
export function pick(cssWidth, cssHeight, model, screenX, screenY) {
  const layout = computeLayout(cssWidth, cssHeight)
  const { x, y } = screenToLogical(layout, screenX, screenY)

  let best = null
  let bestDist = EDGE_HIT_WIDTH
  for (const edge of EDGE_LIST) {
    const p1 = renderNodePoint(edge.r, edge.c)
    const p2 = edge.orientation === 'h' ? renderNodePoint(edge.r, edge.c + 1) : renderNodePoint(edge.r + 1, edge.c)
    const d = distanceToSegment(x, y, p1.x, p1.y, p2.x, p2.y)
    if (d < bestDist) {
      bestDist = d
      best = edge
    }
  }
  if (!best) return null

  const items = model.items.get(best.key) ?? []
  if (items.length <= 1) {
    return { edge: best, item: items[0] ?? null, items }
  }
  // 두 개 겹쳐 있으면 수직 오프셋 중 어느 쪽에 더 가까운지로 판정
  const p1 = renderNodePoint(best.r, best.c)
  const p2 = best.orientation === 'h' ? renderNodePoint(best.r, best.c + 1) : renderNodePoint(best.r + 1, best.c)
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const perp = { x: -dy / len, y: dx / len }
  const rel = (x - (p1.x + p2.x) / 2) * perp.x + (y - (p1.y + p2.y) / 2) * perp.y
  const item = rel < 0 ? items[0] : items[1]
  return { edge: best, item, items }
}
