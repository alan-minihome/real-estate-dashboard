'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (res.ok) {
        window.location.href = '/'
      } else {
        setError(data.error ?? '로그인 실패')
      }
    } catch {
      setError('서버 연결 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-10 w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📊</div>
          <h1 className="text-xl font-bold text-[#0F172A]">배당주 대시보드</h1>
          <p className="text-sm text-[#64748B] mt-1">개인 투자 모니터링</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1.5">아이디</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="아이디 입력"
              className="w-full border border-[#E2E8F0] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB]/20 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="비밀번호 입력"
              className="w-full border border-[#E2E8F0] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB]/20 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-[#1A56DB] text-white font-medium py-2.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
