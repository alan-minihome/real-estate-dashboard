import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'

// 공통: 현재가·배당률 enrichment
function enrichWithMarket(
  db: ReturnType<typeof getDb>,
  rows: Array<Record<string, unknown>>,
  tickerKey = 'ticker',
  assetKey = 'asset_type',
) {
  // 필요한 티커 목록
  const tickers = [...new Set(rows.map(r => String(r[tickerKey])))]
  if (tickers.length === 0) return rows

  const placeholders = tickers.map(() => '?').join(',')

  const stockMap = new Map<string, { price: number; div_yield: number; sector: string }>()
  const etfMap   = new Map<string, { last_price: number; div_yield: number; category: string }>()
  const krMap    = new Map<string, { last_price: number; div_yield: number; issuer: string }>()

  ;(db.prepare(`
    SELECT sd.ticker, sd.price, sd.div_yield, sd.sector
    FROM stock_data sd
    INNER JOIN (SELECT ticker, MAX(fetched_at) ma FROM stock_data GROUP BY ticker) l
      ON sd.ticker = l.ticker AND sd.fetched_at = l.ma
    WHERE sd.ticker IN (${placeholders})
  `).all(...tickers) as Array<Record<string, unknown>>).forEach(r => {
    stockMap.set(String(r.ticker), { price: Number(r.price), div_yield: Number(r.div_yield), sector: String(r.sector ?? '') })
  })

  ;(db.prepare(`SELECT ticker, last_price, div_yield, category FROM etf_universe WHERE ticker IN (${placeholders})`).all(...tickers) as Array<Record<string, unknown>>).forEach(r => {
    etfMap.set(String(r.ticker), { last_price: Number(r.last_price), div_yield: Number(r.div_yield), category: String(r.category ?? '') })
  })

  ;(db.prepare(`SELECT ticker, last_price, div_yield, issuer FROM kr_etf_universe WHERE ticker IN (${placeholders})`).all(...tickers) as Array<Record<string, unknown>>).forEach(r => {
    krMap.set(String(r.ticker), { last_price: Number(r.last_price), div_yield: Number(r.div_yield), issuer: String(r.issuer ?? '') })
  })

  return rows.map(r => {
    const ticker    = String(r[tickerKey])
    const assetType = String(r[assetKey])
    const sm  = assetType === 'stock'  ? stockMap.get(ticker) : undefined
    const em  = assetType === 'us_etf' ? etfMap.get(ticker)   : undefined
    const km  = assetType === 'kr_etf' ? krMap.get(ticker)    : undefined

    const curPrice = sm?.price ?? em?.last_price ?? km?.last_price ?? null
    const divYield = sm?.div_yield ?? em?.div_yield ?? km?.div_yield ?? null
    const sector   = sm?.sector ?? em?.category ?? null
    const issuer   = km?.issuer ?? null

    const shares       = Number(r.shares) || 0
    const avgPrice     = r.avg_price != null ? Number(r.avg_price) : null
    const evalAmount   = curPrice != null ? curPrice * shares : null
    const costBasis    = avgPrice != null ? avgPrice * shares : null
    const profitLoss   = evalAmount != null && costBasis != null ? evalAmount - costBasis : null
    const profitLossPct = costBasis && costBasis > 0 && profitLoss != null
      ? (profitLoss / costBasis) * 100 : null
    const annualGross  = curPrice != null && divYield != null
      ? curPrice * (divYield / 100) * shares : null

    return {
      ...r,
      shares,
      avg_price:       avgPrice,
      current_price:   curPrice,
      div_yield:       divYield,
      sector,
      issuer,
      eval_amount:     evalAmount,
      cost_basis:      costBasis,
      profit_loss:     profitLoss,
      profit_loss_pct: profitLossPct,
      annual_gross:    annualGross,
    }
  })
}

// GET /api/holdings?view=positions (default) | ?view=trades
export function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') ?? 'positions'

  try {
    const db = getDb()

    if (view === 'trades') {
      // 개별 매수 이력 (전체)
      const rawTrades = db.prepare(`
        SELECT id, ticker, name, asset_type, account_type,
               shares, price, traded_at, memo, added_at
        FROM trades
        ORDER BY traded_at DESC, added_at DESC
      `).all() as Array<Record<string, unknown>>

      // trades는 avg_price 대신 price 필드 사용 — enrichWithMarket에 맞게 변환
      const withAvg = rawTrades.map(r => ({ ...r, avg_price: r.price }))
      const enriched = enrichWithMarket(db, withAvg)
      // 개별 매수 비용
      const result = enriched.map(r => ({
        ...r,
        price:      (r as Record<string, unknown>).price,
        trade_cost: (r as Record<string, unknown>).price != null
          ? Number((r as Record<string, unknown>).price) * Number(r.shares)
          : null,
      }))
      return NextResponse.json(result)
    }

    // 포지션 뷰: 티커 × 계좌 단위로 집계
    const positions = db.prepare(`
      SELECT
        ticker,
        MAX(name)        AS name,
        MAX(asset_type)  AS asset_type,
        account_type,
        SUM(shares)      AS shares,
        SUM(shares * price) / SUM(shares) AS avg_price,
        MIN(traded_at)   AS first_traded,
        MAX(traded_at)   AS last_traded,
        COUNT(*)         AS trade_count
      FROM trades
      GROUP BY ticker, account_type
      ORDER BY MAX(asset_type), ticker
    `).all() as Array<Record<string, unknown>>

    const enriched = enrichWithMarket(db, positions)
    return NextResponse.json(enriched)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/holdings → trades 테이블에 신규 매수 기록
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { ticker, name, asset_type, account_type, shares, avg_price, purchased_at, memo } = body
    if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

    const db  = getWriteDb()
    const now = new Date().toISOString()
    const result = db.prepare(`
      INSERT INTO trades (ticker, name, asset_type, account_type, shares, price, traded_at, memo, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticker.toUpperCase(),
      name || ticker,
      asset_type || 'stock',
      account_type || 'general',
      shares || 0,
      avg_price ?? null,
      purchased_at || null,
      memo || null,
      now,
    )
    return NextResponse.json({ ok: true, id: result.lastInsertRowid })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
