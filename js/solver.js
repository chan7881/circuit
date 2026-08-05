// 노드 해석(전도도 행렬) 기반 회로 솔버. DOM 의존 없는 순수 함수 — test.html에서 직접 검증한다.
//
// 모든 부품을 노턴 등가(전도도 G + 병렬 전류원 I)로 바꾸면 전압원 특별취급 없는 대칭 행렬
// G·v = i 하나로 전체 회로를 풀 수 있다. 같은 간선에 부품을 두 개 겹쳐 놓으면 그건 그냥
// "같은 두 노드 사이의 병렬 연결"이라 전도도가 더해지기만 하면 되고, 부품별 개별 전류는
// 그 부품 자신의 국소 모델로 별도 계산한다 — 그래서 겹쳐 놓기(예: 전압계 병렬 측정)가
// 솔버 쪽에 특별한 분기 없이 자연스럽게 성립한다.

import { GRID_COLS, GRID_ROWS } from './config.js'
import { allComponents, EDGE_BY_KEY } from './model.js'
import {
  WIRE_R,
  BATTERY_INTERNAL_R,
  SWITCH_CLOSED_R,
  AMMETER_R,
  VOLTMETER_R,
  BULB_R,
} from './config.js'

const NODE_COUNT = GRID_COLS * GRID_ROWS

/** 부품 하나의 국소 전기적 모델: {p, q, G, Isrc} — p에서 q로 Isrc만큼의 전류원이 내부적으로
 *  흐르고, 그와 병렬로 전도도 G가 연결되어 있다는 뜻(표준 노턴 등가). 배터리만 극성(flipped)에
 *  따라 p/q가 뒤집힌다 — 나머지 부품은 좌우 대칭이라 방향이 의미 없다. */
function localModel(item, u, v) {
  switch (item.type) {
    case 'wire':
      return { p: u, q: v, G: 1 / WIRE_R, Isrc: 0 }
    case 'resistor':
      return { p: u, q: v, G: 1 / item.value, Isrc: 0 }
    case 'bulb':
      return { p: u, q: v, G: 1 / BULB_R, Isrc: 0 }
    case 'switch':
      return item.closed ? { p: u, q: v, G: 1 / SWITCH_CLOSED_R, Isrc: 0 } : { p: u, q: v, G: 0, Isrc: 0 }
    case 'ammeter':
      return { p: u, q: v, G: 1 / AMMETER_R, Isrc: 0 }
    case 'voltmeter':
      return { p: u, q: v, G: 1 / VOLTMETER_R, Isrc: 0 }
    case 'battery': {
      const G = 1 / BATTERY_INTERNAL_R
      const Isrc = item.value / BATTERY_INTERNAL_R
      // flipped=false: v가 + 극(전류가 내부에서 u->v로 흘러 나가 외부회로에서 v가 +단자).
      const [p, q] = item.flipped ? [v, u] : [u, v]
      return { p, q, G, Isrc }
    }
    default:
      return { p: u, q: v, G: 0, Isrc: 0 }
  }
}

class DisjointSet {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]]
      x = this.parent[x]
    }
    return x
  }
  union(a, b) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent[ra] = rb
  }
}

/** 부분 피벗 가우스 소거로 A x = b 를 푼다. A는 (n x n) 배열의 배열, b는 길이 n 배열. */
function gaussianSolve(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    let maxAbs = Math.abs(M[col][col])
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxAbs) {
        maxAbs = Math.abs(M[r][col])
        pivot = r
      }
    }
    if (maxAbs < 1e-15) continue // 특이 열(고립 노드 등) — 접지 처리로 사실상 발생하지 않음
    if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]]
    const diag = M[col][col]
    for (let k = col; k <= n; k++) M[col][k] /= diag
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = M[r][col]
      if (factor === 0) continue
      for (let k = col; k <= n; k++) M[r][k] -= factor * M[col][k]
    }
  }
  return M.map((row) => row[n])
}

/**
 * 회로를 풀어 노드 전압과 부품별 전류를 계산한다.
 * @returns {{ nodeVoltage: number[], current: Map<string, number>, power: Map<string, number> }}
 */
export function solveCircuit(model) {
  const G = Array.from({ length: NODE_COUNT }, () => new Array(NODE_COUNT).fill(0))
  const I = new Array(NODE_COUNT).fill(0)
  const dsu = new DisjointSet(NODE_COUNT)
  const degree = new Array(NODE_COUNT).fill(0)

  const components = allComponents(model)
  const locals = [] // { item, p, q, G, Isrc }

  for (const item of components) {
    const edge = edgeOf(item.edgeKey)
    const lm = localModel(item, edge.u, edge.v)
    locals.push({ item, ...lm })
    if (lm.G > 0) {
      const { p, q, G: Gc, Isrc } = lm
      G[p][p] += Gc
      G[q][q] += Gc
      G[p][q] -= Gc
      G[q][p] -= Gc
      I[p] -= Isrc
      I[q] += Isrc
      dsu.union(p, q)
      degree[p]++
      degree[q]++
    }
  }

  // 접지: 연결된 성분마다 대표 노드 하나를 v=0으로 고정, 고립 노드(연결 하나도 없는 노드)도
  // 특이 행 방지를 위해 v=0으로 고정. 둘 다 "해당 행을 단위행으로 덮어쓰기"로 처리한다.
  const grounded = new Set()
  for (let n = 0; n < NODE_COUNT; n++) {
    const root = degree[n] > 0 ? dsu.find(n) : `isolated_${n}`
    if (!grounded.has(root)) {
      grounded.add(root)
      groundNode(G, I, n)
    }
  }

  const v = gaussianSolve(G, I)

  const current = new Map()
  const power = new Map()
  for (const { item, p, q, G: Gc, Isrc } of locals) {
    const i = Gc * (v[p] - v[q]) + Isrc
    current.set(item.uid, i)
    power.set(item.uid, i * i * (Gc > 0 ? 1 / Gc : 0))
  }

  return { nodeVoltage: v, current, power }
}

function groundNode(G, I, n) {
  for (let k = 0; k < G.length; k++) G[n][k] = 0
  G[n][n] = 1
  I[n] = 0
}

function edgeOf(edgeKey) {
  return EDGE_BY_KEY.get(edgeKey)
}
