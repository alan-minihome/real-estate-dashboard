'use client'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="ml-56 min-h-screen p-8">{children}</main>
    </>
  )
}
