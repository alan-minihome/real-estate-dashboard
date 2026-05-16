import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'realestate.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      ttl_ms INTEGER NOT NULL DEFAULT 3600000
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page TEXT NOT NULL,
      query TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `)
}

export function cacheGet<T>(key: string): T | null {
  const db = getDb()
  const row = db.prepare(
    'SELECT value, created_at, ttl_ms FROM cache WHERE key = ?'
  ).get(key) as { value: string; created_at: number; ttl_ms: number } | undefined
  if (!row) return null
  if (Date.now() - row.created_at > row.ttl_ms) {
    db.prepare('DELETE FROM cache WHERE key = ?').run(key)
    return null
  }
  return JSON.parse(row.value) as T
}

export function cacheSet(key: string, value: unknown, ttlMs = 3_600_000) {
  getDb().prepare(
    'INSERT OR REPLACE INTO cache (key, value, created_at, ttl_ms) VALUES (?, ?, ?, ?)'
  ).run(key, JSON.stringify(value), Date.now(), ttlMs)
}

export function saveHistory(page: string, query: string) {
  getDb().prepare(
    'INSERT INTO search_history (page, query) VALUES (?, ?)'
  ).run(page, query)
}

export function getHistory(page?: string, limit = 10) {
  const db = getDb()
  if (page) {
    return db.prepare(
      'SELECT * FROM search_history WHERE page = ? ORDER BY created_at DESC LIMIT ?'
    ).all(page, limit)
  }
  return db.prepare(
    'SELECT * FROM search_history ORDER BY created_at DESC LIMIT ?'
  ).all(limit)
}
