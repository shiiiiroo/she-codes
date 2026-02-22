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
    // Уменьшили общую ширину (w-[180px]) и верхний отступ (py-2), чтобы все было выше
    <div className="w-[180px] flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col py-2 px-3 gap-1">
      
      {/* Блок Лого + Название: уменьшили mb-2, чтобы меню прижалось выше */}
      <div className="flex items-center gap-2 px-2 mb-2">
        {/* ЛОГО: Уменьшили до w-8 h-8 */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" className="w-8 h-8 flex-shrink-0">
          <defs>
            <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#1e3a8a" />
              <stop offset="100%" stop-color="#0f172a" />
            </linearGradient>
            <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#38bdf8" />
              <stop offset="100%" stop-color="#2563eb" />
            </linearGradient>
            <linearGradient id="yellow-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fcd34d" />
              <stop offset="100%" stop-color="#f59e0b" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="95" fill="url(#bg-gradient)" />
          <circle cx="100" cy="100" r="90" fill="none" stroke="url(#yellow-gradient)" stroke-width="2" opacity="0.8"/>
          <path d="M 100 35 L 50 145 L 75 145 L 100 85 L 125 145 L 150 145 Z" fill="url(#blue-gradient)" />
          <path d="M 60 115 Q 100 130 145 85" fill="none" stroke="url(#yellow-gradient)" stroke-width="12" stroke-linecap="round" />
          <polygon points="135,75 155,75 145,95" fill="#f59e0b" transform="rotate(15 145 85)"/>
        </svg>

        {/* НАДПИСЬ: Сделали больше (text-lg) и жирнее */}
        <span className="font-bold text-lg tracking-tight text-[var(--text)]">Armanda</span>
      </div>

      {/* Навигация: Уменьшили вертикальные отступы py-1.5, чтобы пункты стояли плотнее */}
      <div className="flex flex-col gap-0.5">
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
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
      </div>

      {/* Статус в самом низу */}
      <div className="mt-auto px-3 py-2 bg-[var(--surface2)] rounded-lg">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-[10px] text-[var(--text3)] font-mono">ИИ активен</span>
        </div>
        <div className="text-[9px] text-[var(--text3)] font-mono">Armanda AI</div>
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