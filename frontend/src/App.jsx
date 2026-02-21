import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import MainPage from './pages/Main'
import ProfilePage from './pages/Profile'
import Statistics from './pages/Statistics'

const NAV = [
  { to: '/', label: 'Главная', icon: '◫' },
  { to: '/profile', label: 'Профиль', icon: '◉' },
  { to: '/stats', label: 'Аналитика', icon: '◈' },
]

function Sidebar() {
  return (
    <div className="w-[200px] flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col py-5 px-3 gap-1">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-6">
        <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white text-xs font-bold">TF</div>
        <span className="font-semibold text-sm tracking-tight">TaskFlow</span>
      </div>

      {/* Nav */}
      {NAV.map(n => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
              isActive
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface2)]'
            }`
          }
        >
          <span className="text-base">{n.icon}</span>
          {n.label}
        </NavLink>
      ))}

      {/* Bottom status */}
      <div className="mt-auto px-3 py-2 bg-[var(--surface2)] rounded-lg">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-[10px] text-[var(--text3)] font-mono">ИИ активен</span>
        </div>
        <div className="text-[9px] text-[var(--text3)] font-mono">Claude · SQLite</div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/stats" element={<Statistics />} />
          </Routes>
        </div>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--surface2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#000' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#000' } },
        }}
      />
    </BrowserRouter>
  )
}
