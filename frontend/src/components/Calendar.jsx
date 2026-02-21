import React, { useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { useStore } from '../store'
import { getTasks, getTips, completeTask, deleteTask } from '../api'
import { CategoryChip, PriorityBadge, DurationLabel } from './UI'
import toast from 'react-hot-toast'

dayjs.locale('ru')

const PRIO_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => (PRIO_ORDER[a.priority] ?? 2) - (PRIO_ORDER[b.priority] ?? 2))
}

// ─── SINGLE TASK ROW ────────────────────────────────────────────────────────
function TaskRow({ task, onComplete, onDelete }) {
  const isDone = task.status === 'completed'
  const isOverdue = !isDone && task.deadline && new Date(task.deadline) < new Date()

  const prioColor = {
    critical: 'bg-red-500',
    high: 'bg-amber-400',
    medium: 'bg-blue-400',
    low: 'bg-gray-600',
  }[task.priority] || 'bg-gray-600'

  return (
    <div className={`group flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-[var(--surface2)] transition-all fade-in ${isDone ? 'opacity-50' : ''}`}>
      {/* Priority dot */}
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${prioColor}`} />

      {/* Checkbox */}
      <button
        onClick={() => !isDone && onComplete(task.id)}
        className={`mt-0.5 w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-all cursor-pointer ${
          isDone ? 'bg-emerald-500/20 border-emerald-500/40' : 'border-[var(--border)] hover:border-[var(--accent)]'
        }`}
      >
        {isDone && <span className="text-emerald-400 text-[9px]">✓</span>}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${isDone ? 'line-through text-[var(--text3)]' : isOverdue ? 'text-red-400' : 'text-[var(--text)]'}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <CategoryChip category={task.category} />
          {task.duration_minutes && <DurationLabel minutes={task.duration_minutes} />}
          {task.start_datetime && (
            <span className="text-[10px] font-mono text-[var(--text3)]">
              {dayjs(task.start_datetime).format('HH:mm')}
            </span>
          )}
          {isOverdue && <span className="text-[10px] text-red-400 font-mono">ПРОСРОЧЕНО</span>}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-400/10 text-[var(--text3)] hover:text-red-400 transition-all cursor-pointer flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}

// ─── DAY VIEW ───────────────────────────────────────────────────────────────
function DayView({ tasks, onComplete, onDelete }) {
  if (!tasks.length) return (
    <div className="flex flex-col items-center justify-center h-48 text-[var(--text3)]">
      <div className="text-3xl mb-3">◻</div>
      <div className="text-sm">Нет задач на этот день</div>
    </div>
  )
  return (
    <div className="flex flex-col gap-1 p-2">
      {sortTasks(tasks).map(t => (
        <TaskRow key={t.id} task={t} onComplete={onComplete} onDelete={onDelete} />
      ))}
    </div>
  )
}

// ─── WEEK VIEW ──────────────────────────────────────────────────────────────
function WeekView({ tasks, currentDate, onComplete, onDelete }) {
  const monday = dayjs(currentDate).startOf('week')
  const days = Array.from({ length: 7 }, (_, i) => monday.add(i, 'day'))
  const today = dayjs().format('YYYY-MM-DD')

  return (
    <div className="grid grid-cols-7 gap-2 h-full">
      {days.map(day => {
        const ds = day.format('YYYY-MM-DD')
        const dayTasks = tasks.filter(t => t.start_datetime && dayjs(t.start_datetime).format('YYYY-MM-DD') === ds)
        const isToday = ds === today

        return (
          <div key={ds} className={`rounded-xl border p-2 flex flex-col gap-1 min-h-[200px] ${isToday ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
            <div className={`text-xs font-mono mb-1 text-center ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text3)]'}`}>
              <div>{day.format('dd').toUpperCase()}</div>
              <div className={`text-lg font-bold ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{day.format('D')}</div>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto flex-1">
              {sortTasks(dayTasks).map(t => (
                <div
                  key={t.id}
                  className={`text-[11px] px-1.5 py-1 rounded cursor-pointer transition-all group relative ${
                    t.status === 'completed' ? 'opacity-40 line-through' : ''
                  } ${
                    { critical: 'bg-red-500/10 text-red-300', high: 'bg-amber-400/10 text-amber-300', medium: 'bg-blue-400/10 text-blue-300', low: 'bg-gray-500/10 text-gray-400' }[t.priority]
                  }`}
                  onClick={() => t.status !== 'completed' && onComplete(t.id)}
                >
                  <div className="truncate">{t.title}</div>
                  {t.duration_minutes && (
                    <div className="text-[9px] opacity-60 font-mono">{Math.floor(t.duration_minutes / 60)}:{String(t.duration_minutes % 60).padStart(2,'0')}ч</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── MONTH VIEW ─────────────────────────────────────────────────────────────
function MonthView({ tasks, currentDate, onComplete }) {
  const startOfMonth = dayjs(currentDate).startOf('month')
  const daysInMonth = startOfMonth.daysInMonth()
  const startDow = (startOfMonth.day() + 6) % 7  // Monday = 0
  const cells = Array.from({ length: startDow }, (_, i) => null)
    .concat(Array.from({ length: daysInMonth }, (_, i) => startOfMonth.add(i, 'day')))
  const today = dayjs().format('YYYY-MM-DD')
  const DAYS = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС']

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-[10px] font-mono text-[var(--text3)] py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const ds = day.format('YYYY-MM-DD')
          const dayTasks = tasks.filter(t => {
            const ts = t.start_datetime ? dayjs(t.start_datetime).format('YYYY-MM-DD') : null
            const dl = t.deadline ? dayjs(t.deadline).format('YYYY-MM-DD') : null
            return ts === ds || dl === ds
          })
          const isToday = ds === today
          const hasOverdue = dayTasks.some(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < new Date())

          return (
            <div
              key={ds}
              className={`rounded-lg p-1.5 min-h-[70px] border transition-all cursor-pointer hover:border-[var(--accent)]/30 ${
                isToday ? 'border-[var(--accent)]/50 bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--surface)]'
              } ${hasOverdue ? 'border-l-2 border-l-red-500/50' : ''}`}
            >
              <div className={`text-xs font-mono mb-1 ${isToday ? 'text-[var(--accent)] font-bold' : 'text-[var(--text3)]'}`}>
                {day.format('D')}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    className={`text-[9px] px-1 py-0.5 rounded truncate ${
                      t.status === 'completed' ? 'opacity-40 line-through' : ''
                    } ${
                      { critical: 'bg-red-500/15 text-red-300', high: 'bg-amber-400/15 text-amber-300', medium: 'bg-blue-400/15 text-blue-300', low: 'bg-gray-500/15 text-gray-400' }[t.priority]
                    }`}
                    onClick={() => t.status !== 'completed' && onComplete(t.id)}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[9px] text-[var(--text3)] font-mono px-1">+{dayTasks.length - 3}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── YEAR VIEW ──────────────────────────────────────────────────────────────
function YearView({ tasks, currentDate }) {
  const year = dayjs(currentDate).year()
  const months = Array.from({ length: 12 }, (_, i) => dayjs(`${year}-${String(i+1).padStart(2,'0')}-01`))
  const MONTH_NAMES = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

  return (
    <div className="grid grid-cols-4 gap-4">
      {months.map((m, mi) => {
        const daysInMonth = m.daysInMonth()
        const startDow = (m.day() + 6) % 7
        const cells = Array(startDow).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))
        const today = dayjs().format('YYYY-MM-DD')

        return (
          <div key={mi} className="card p-3">
            <div className="text-xs font-mono text-[var(--text3)] mb-2 uppercase">{MONTH_NAMES[mi]}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="w-4 h-4" />
                const ds = `${year}-${String(mi+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                const dayTasks = tasks.filter(t => {
                  const ts = t.start_datetime ? dayjs(t.start_datetime).format('YYYY-MM-DD') : null
                  return ts === ds
                })
                const hasTask = dayTasks.length > 0
                const hasCritical = dayTasks.some(t => t.priority === 'critical')
                const isToday = ds === today
                const allDone = hasTask && dayTasks.every(t => t.status === 'completed')

                return (
                  <div
                    key={i}
                    title={hasTask ? `${d}: ${dayTasks.length} задач` : `${d}`}
                    className={`w-4 h-4 rounded-sm transition-all ${
                      isToday ? 'ring-1 ring-[var(--accent)]' :
                      allDone ? 'bg-emerald-500/40' :
                      hasCritical ? 'bg-red-500/50' :
                      hasTask ? 'bg-[var(--accent)]/30' :
                      'bg-[var(--surface3)]'
                    }`}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── MAIN CALENDAR COMPONENT ────────────────────────────────────────────────
export default function Calendar({ onAddTask }) {
  const { view, setView, currentDate, setDate, navigateDate, goToday, tasks, setTasks, setTips, setLoadInfo } = useStore()

  const load = useCallback(async () => {
    try {
      const [tasksRes, tipsRes] = await Promise.all([
        getTasks(view, currentDate),
        getTips(),
      ])
      setTasks(tasksRes.data.tasks)
      setTips(tipsRes.data.tips)
      setLoadInfo(tipsRes.data.load)
    } catch (e) {
      console.error(e)
    }
  }, [view, currentDate])

  useEffect(() => { load() }, [load])

  const handleComplete = async (id) => {
    try {
      await completeTask(id)
      await load()
      toast.success('Задача выполнена! ✓')
    } catch { toast.error('Ошибка') }
  }

  const handleDelete = async (id) => {
    try {
      await deleteTask(id)
      await load()
      toast.success('Удалено')
    } catch { toast.error('Ошибка') }
  }

  const formatPeriod = () => {
    const d = dayjs(currentDate)
    if (view === 'day') return d.format('D MMMM YYYY')
    if (view === 'week') {
      const mon = d.startOf('week')
      return `${mon.format('D MMM')} — ${mon.add(6, 'day').format('D MMM YYYY')}`
    }
    if (view === 'month') return d.format('MMMM YYYY')
    return d.format('YYYY')
  }

  const VIEW_BTNS = [
    { key: 'day', label: 'День' },
    { key: 'week', label: 'Неделя' },
    { key: 'month', label: 'Месяц' },
    { key: 'year', label: 'Год' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        {/* View switcher */}
        <div className="flex gap-1 bg-[var(--surface2)] rounded-lg p-1">
          {VIEW_BTNS.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                view === v.key ? 'bg-[var(--accent)] text-white' : 'text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigateDate('prev')} className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] cursor-pointer transition-all">←</button>
          <button onClick={goToday} className="px-3 py-1 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--surface2)] text-[var(--text2)] cursor-pointer transition-all">Сегодня</button>
          <button onClick={() => navigateDate('next')} className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] cursor-pointer transition-all">→</button>
        </div>

        {/* Period label */}
        <div className="text-sm font-medium text-[var(--text2)] capitalize">{formatPeriod()}</div>

        {/* Add task button */}
        <button
          onClick={onAddTask}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:bg-[#7c75ff] text-white text-xs font-medium rounded-lg transition-all cursor-pointer"
        >
          + Задача
        </button>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'day' && <DayView tasks={tasks} onComplete={handleComplete} onDelete={handleDelete} />}
        {view === 'week' && <WeekView tasks={tasks} currentDate={currentDate} onComplete={handleComplete} onDelete={handleDelete} />}
        {view === 'month' && <MonthView tasks={tasks} currentDate={currentDate} onComplete={handleComplete} />}
        {view === 'year' && <YearView tasks={tasks} currentDate={currentDate} />}
      </div>
    </div>
  )
}
