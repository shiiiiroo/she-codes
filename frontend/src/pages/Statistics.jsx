import React, { useEffect, useState } from 'react'
import { getStatsOverview, getDailyStats, getHeatmap } from '../api'
import { StatCard } from '../components/UI'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts'
import dayjs from 'dayjs'

const CAT_COLORS = {
  work: '#60a5fa',
  study: '#a78bfa',
  health: '#34d399',
  personal: '#6c63ff',
  finance: '#f59e0b',
  social: '#f472b6',
  unsorted: '#4a4a6a',
}

const CAT_LABELS = {
  work: 'Работа', study: 'Учёба', health: 'Здоровье',
  personal: 'Личное', finance: 'Финансы', social: 'Социальное', unsorted: 'Без сортировки'
}

const PRIO_COLORS = { critical: '#ef4444', high: '#f59e0b', medium: '#60a5fa', low: '#4a4a6a' }
const PRIO_LABELS = { critical: 'Критичный', high: 'Высокий', medium: 'Средний', low: 'Низкий' }

// GitHub-style heatmap
function HeatmapCell({ date, data }) {
  const val = data?.completed || 0
  const allDone = data?.all_done
  const intensity = val === 0 ? 0 : Math.min(val / 5, 1)
  const bg = allDone
    ? 'rgba(52,211,153,0.7)'
    : val > 0
    ? `rgba(108,99,255,${0.2 + intensity * 0.7})`
    : 'rgba(255,255,255,0.04)'
  const isToday = date === dayjs().format('YYYY-MM-DD')

  return (
    <div
      title={`${date}: ${val} выполнено${allDone ? ' ✓ Все!' : ''}`}
      style={{
        width: 13, height: 13,
        borderRadius: 2,
        background: bg,
        outline: isToday ? '1px solid var(--accent)' : 'none',
        cursor: 'default',
        transition: 'all 0.15s',
      }}
    />
  )
}

function Heatmap({ heatmapData, year }) {
  const start = dayjs(`${year}-01-01`)
  const end = dayjs(`${year}-12-31`)
  const weeks = []
  let current = start.startOf('week')
  while (current.isBefore(end) || current.isSame(end, 'week')) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const day = current.add(d, 'day')
      if (day.year() === year) {
        week.push(day.format('YYYY-MM-DD'))
      } else {
        week.push(null)
      }
    }
    weeks.push(week)
    current = current.add(1, 'week')
  }

  const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

  return (
    <div>
      <div className="flex gap-0.5 mb-1 ml-6">
        {MONTHS.map((m, i) => (
          <div key={i} style={{ flex: i < 11 ? '1' : 'none', minWidth: 0 }} className="text-[9px] font-mono text-[var(--text3)]">{m}</div>
        ))}
      </div>
      <div className="flex gap-1">
        <div className="flex flex-col gap-0.5 mr-1">
          {['Пн','','Ср','','Пт','','Вс'].map((d, i) => (
            <div key={i} className="text-[9px] font-mono text-[var(--text3)] h-[13px] flex items-center">{d}</div>
          ))}
        </div>
        <div className="flex gap-0.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                day ? <HeatmapCell key={di} date={day} data={heatmapData[day]} />
                    : <div key={di} style={{ width: 13, height: 13 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 ml-6">
        <span className="text-[9px] text-[var(--text3)] font-mono">Меньше</span>
        {[0, 0.2, 0.5, 0.8, 1].map(v => (
          <div key={v} style={{ width: 11, height: 11, borderRadius: 2, background: `rgba(108,99,255,${v === 0 ? 0.04 : v * 0.9})` }} />
        ))}
        <span className="text-[9px] text-[var(--text3)] font-mono">Больше</span>
        <div style={{ width: 11, height: 11, borderRadius: 2, background: 'rgba(52,211,153,0.7)' }} />
        <span className="text-[9px] text-[var(--text3)] font-mono">100%</span>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs">
      <div className="font-mono text-[var(--text3)] mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill || p.stroke }} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill || p.stroke }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function Statistics() {
  const [overview, setOverview] = useState(null)
  const [daily, setDaily] = useState([])
  const [heatmap, setHeatmap] = useState({})
  const [loading, setLoading] = useState(true)
  const year = dayjs().year()

  useEffect(() => {
    Promise.all([
      getStatsOverview(),
      getDailyStats(30),
      getHeatmap(year),
    ]).then(([ov, da, hm]) => {
      setOverview(ov.data)
      setDaily(da.data.map(d => ({
        ...d,
        date: dayjs(d.date).format('DD/MM'),
      })))
      setHeatmap(hm.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-[var(--text3)]">Загрузка аналитики...</div>
    </div>
  )

  // Category pie data
  const catData = Object.entries(overview?.by_category || {})
    .filter(([_, v]) => v > 0)
    .map(([k, v]) => ({ name: CAT_LABELS[k] || k, value: v, color: CAT_COLORS[k] || '#888' }))

  // Priority bar data
  const prioData = Object.entries(overview?.by_priority || {})
    .map(([k, v]) => ({ name: PRIO_LABELS[k] || k, value: v, color: PRIO_COLORS[k] || '#888' }))

  return (
    <div className="overflow-y-auto h-full p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Аналитика</h1>
        <p className="text-sm text-[var(--text3)] mt-1">Ваша продуктивность и прогресс</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Всего задач" value={overview?.total_tasks || 0} icon="📋" />
        <StatCard label="Выполнено" value={overview?.completed || 0} color="green" icon="✓" />
        <StatCard label="Процент выполнения" value={`${overview?.completion_rate || 0}%`} color="gold" icon="📈" />
        <StatCard label="Просрочено" value={overview?.overdue || 0} color="red" icon="⚠️" />
        <StatCard label="В ожидании" value={overview?.pending || 0} color="blue" icon="⏳" />
        <StatCard label="Стрик дней" value={`${overview?.streak_days || 0}д`} color="gold" icon="🔥"
          sub={overview?.streak_days > 0 ? 'подряд выполнял все задачи' : 'Нет активного стрика'} />
      </div>

      {/* Activity heatmap */}
      <div className="card p-6 mb-6 overflow-x-auto">
        <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider mb-5">Активность {year}</h2>
        <Heatmap heatmapData={heatmap} year={year} />
      </div>

      {/* Daily chart */}
      {daily.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider mb-5">Задачи за 30 дней</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="completed" name="Выполнено" fill="#34d399" radius={[3,3,0,0]} />
              <Bar dataKey="overdue" name="Просрочено" fill="#ef4444" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Load chart */}
      {daily.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider mb-5">Нагрузка (%)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={daily} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 150]} />
              <Tooltip content={<CustomTooltip />} />
              <Line dataKey="load_score" name="Нагрузка %" stroke="#6c63ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category + Priority side by side */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {catData.length > 0 && (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider mb-5">По категориям</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {catData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {catData.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--text3)]">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  {c.name}: {c.value}
                </div>
              ))}
            </div>
          </div>
        )}

        {prioData.length > 0 && (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider mb-5">По приоритету</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={prioData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Задач" radius={[0,4,4,0]}>
                  {prioData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
