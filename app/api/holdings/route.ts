import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'

function safeParse(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object') return {}
  return v as Record<string, unknown>
}

export function GET() {
  try {
    const db = getDb()
    // holdings + 현재가 조인 (stock_data 최신, etf_universe, kr_etf_universe)
    const rows = db.prepare(`
      SELECT
        h.*,
        COALESCE(s.price,  eu.last_price, ke.last_price) AS current_price,
        COALESCE(s.div_yield, eu.div_yield, ke.div_yield) AS div_yield,
        s.sector,
        eu.category,
        ke.issuer
      FROM holdings h
      LEFT JOIN (
        SELECT sd.ticker, sd.price, sd.div_yield, sd.sector
        FROM stock_data sd
        INNER JOIN (
          SELECT ticker, MAX(fetched_at) ma FROM stock_data GROUP BY ticker
        ) latest ON sd.ticker = latest.ticker AND sd.fetched_at = latest.ma
      ) s ON h.ticker = s.ticker AND h.asset_type = 'stock'
      LEFT JOIN etf_universe eu ON h.ticker = eu.ticker AND h.asset_type = 'us_etf'
      LEFT JOIN kr_etf_universe ke ON h.ticker = ke.ticker AND h.asset_type = 'kr_etf'
      ORDER BY h.added_at DESC
    `).all() as Array<Record<string, unknown>>

    const result = rows.map(r => {
      const shares    = Number(r.shares)    || 0
      const avgPrice  = r.avg_price != null ? Number(r.avg_price) : null
      const curPrice  = r.current_price != null ? Number(r.current_price) : null
      const divYield  = r.div_yield != null ? Number(r.div_yield) : null

      const evalAmount   = curPrice != null ? curPrice * shares : null
      const costBasis    = avgPrice != null ? avgPrice * shares : null
      const profitLoss   = evalAmount != null && costBasis != null ? evalAmount - costBasis : null
      const profitLossPct = costBasis != null && costBasis > 0 && profitLoss != null
        ? (profitLoss / costBasis) * 100 : null
      const annualGross  = curPrice != null && divYield != null
        ? curPrice * (divYield / 100) * shares : null

      return {
        id:             r.id,
        ticker:         r.ticker,
        name:           r.name,
        asset_type:     r.asset_type,
        account_type:   r.account_type,
        shares,
        avg_price:      avgPrice,
        purchased_at:   r.purchased_at,
        memo:           r.memo,
        added_at:       r.added_at,
        current_price:  curPrice,
        div_yield:      divYield,
        sector:         r.sector ?? r.category ?? null,
        issuer:         r.issuer ?? null,
        eval_amount:    evalAmount,
        cost_basis:     costBasis,
        profit_loss:    profitLoss,
        profit_loss_pct: profitLossPct,
        annual_gross:   annualGross,
      }
    })

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { ticker, name, asset_type, account_type, shares, avg_price, purchased_at, memo } = body
    if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

    const db = getWriteDb()
    const now = new Date().toISOString()
    const result = db.prepare(`
      INSERT INTO holdings (ticker, name, asset_type, account_type, shares, avg_price, purchased_at, memo, added_at)
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
