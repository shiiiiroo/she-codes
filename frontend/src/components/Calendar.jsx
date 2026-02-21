import React, { useEffect, useCallback, useState } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { useStore } from '../store'
import { getTasks, getTips, completeTask, deleteTask, updateTask } from '../api'
import toast from 'react-hot-toast'

dayjs.locale('ru')

const PRIO_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
const sortTasks = (tasks) =>
  [...tasks].sort((a, b) => (PRIO_ORDER[a.priority] ?? 2) - (PRIO_ORDER[b.priority] ?? 2))

const CAT_MAP = {
  work:     { label: 'Работа',        color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  study:    { label: 'Учёба',          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  health:   { label: 'Здоровье',       color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  personal: { label: 'Личное',         color: '#6c63ff', bg: 'rgba(108,99,255,0.12)' },
  finance:  { label: 'Финансы',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  social:   { label: 'Социальное',     color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  unsorted: { label: 'Без сортировки', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
}

const PRIO_MAP = {
  critical: { label: 'Критично', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   dot: 'bg-red-500'   },
  high:     { label: 'Высокий',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  dot: 'bg-amber-400' },
  medium:   { label: 'Средний',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  dot: 'bg-blue-400'  },
  low:      { label: 'Низкий',   color: '#6b7280', bg: 'rgba(107,114,128,0.12)', dot: 'bg-gray-500'  },
}

// ─── TASK DETAIL MODAL ───────────────────────────────────────────────────────
function TaskModal({ task, onClose, onComplete, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    category: task.category,
    priority: task.priority,
    duration_minutes: task.duration_minutes || '',
    start_datetime: task.start_datetime ? task.start_datetime.slice(0, 16) : '',
    deadline: task.deadline ? task.deadline.slice(0, 16) : '',
  })
  const [saving, setSaving] = useState(false)
  const isDone = task.status === 'completed'
  const isOverdue = !isDone && task.deadline && new Date(task.deadline) < new Date()
  const cat = CAT_MAP[task.category] || CAT_MAP.unsorted
  const prio = PRIO_MAP[task.priority] || PRIO_MAP.medium
  const doneSubs = (task.subtasks || []).filter(s => s.done).length
  const totalSubs = (task.subtasks || []).length

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(task.id, {
        ...form,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        start_datetime: form.start_datetime || null,
        deadline: form.deadline || null,
      })
      setEditing(false)
      toast.success('Задача обновлена')
    } catch { toast.error('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  const inp = 'w-full bg-[var(--surface3)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all'
  const lbl = 'text-[10px] uppercase tracking-widest text-[var(--text3)] font-mono mb-1 block'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl slide-up max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
          <div className="flex-1 min-w-0 pr-4">
            {editing
              ? <input className={inp + ' text-base font-semibold'} value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} autoFocus />
              : <h2 className={`text-base font-semibold leading-snug ${isDone ? 'line-through text-[var(--text3)]' : ''}`}>{task.title}</h2>
            }
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!editing && (
              <button onClick={() => setEditing(true)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface2)] cursor-pointer transition-all">
                ✎ Изменить
              </button>
            )}
            <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)] cursor-pointer text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            {editing ? (
              <>
                <select className={inp + ' flex-1'} value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}>
                  <option value="critical">🔴 Критично</option>
                  <option value="high">🟡 Высокий</option>
                  <option value="medium">🔵 Средний</option>
                  <option value="low">⚪ Низкий</option>
                </select>
                <select className={inp + ' flex-1'} value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
                  <option value="work">💼 Работа</option>
                  <option value="study">📚 Учёба</option>
                  <option value="health">🏃 Здоровье</option>
                  <option value="personal">🙂 Личное</option>
                  <option value="finance">💰 Финансы</option>
                  <option value="social">👥 Социальное</option>
                  <option value="unsorted">📋 Без сортировки</option>
                </select>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border"
                  style={{ color: prio.color, background: prio.bg, borderColor: prio.color + '40' }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} /> {prio.label}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ color: cat.color, background: cat.bg }}>
                  {cat.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                  isDone ? 'bg-emerald-500/15 text-emerald-400' :
                  isOverdue ? 'bg-red-500/15 text-red-400' :
                  task.status === 'overdue' ? 'bg-red-500/15 text-red-400' :
                  'bg-[var(--surface3)] text-[var(--text3)]'
                }`}>
                  {isDone ? '✓ Выполнено' : (isOverdue || task.status === 'overdue') ? '⚠ Просрочено' : '● Активно'}
                </span>
                {task.ai_generated && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-[var(--accent)]/10 text-[var(--accent)]">✦ ИИ</span>
                )}
              </>
            )}
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Описание</label>
            {editing
              ? <textarea className={inp} rows={3} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Детали задачи..." />
              : <p className="text-sm text-[var(--text2)] leading-relaxed">{task.description || <span className="text-[var(--text3)] italic">Нет описания</span>}</p>
            }
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Длительность', key: 'duration_minutes', type: 'number', placeholder: 'мин',
                display: task.duration_minutes
                  ? (Math.floor(task.duration_minutes/60) > 0 ? Math.floor(task.duration_minutes/60)+'ч ' : '') + (task.duration_minutes%60 > 0 ? task.duration_minutes%60+'м' : '')
                  : '—' },
              { label: 'Начало', key: 'start_datetime', type: 'datetime-local',
                display: task.start_datetime ? dayjs(task.start_datetime).format('DD.MM HH:mm') : '—' },
              { label: 'Дедлайн', key: 'deadline', type: 'datetime-local',
                display: task.deadline ? dayjs(task.deadline).format('DD.MM HH:mm') : '—',
                red: isOverdue },
            ].map(f => (
              <div key={f.key}>
                <label className={lbl}>{f.label}</label>
                {editing
                  ? <input className={inp} type={f.type} placeholder={f.placeholder}
                      value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} />
                  : <div className={`text-sm ${f.red ? 'text-red-400 font-medium' : 'text-[var(--text2)]'}`}>{f.display}</div>
                }
              </div>
            ))}
          </div>

          {/* AI notes */}
          {task.ai_notes && (
            <div className="bg-[var(--accent)]/8 border border-[var(--accent)]/20 rounded-xl p-3">
              <div className="text-[10px] font-mono text-[var(--accent)] mb-1 uppercase tracking-wider">✦ ИИ-анализ</div>
              <p className="text-xs text-[var(--text2)] leading-relaxed">{task.ai_notes}</p>
            </div>
          )}

          {/* Subtasks */}
          {totalSubs > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={lbl + ' mb-0'}>Подзадачи</label>
                <span className="text-[10px] font-mono text-[var(--text3)]">{doneSubs}/{totalSubs}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {(task.subtasks || []).map((s, i) => (
                  <div key={i} className={`flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface2)] text-sm ${s.done ? 'opacity-50' : ''}`}>
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-emerald-500/20 border-emerald-400/40' : 'border-[var(--border)]'}`}>
                      {s.done && <span className="text-emerald-400 text-[9px]">✓</span>}
                    </div>
                    <span className={s.done ? 'line-through text-[var(--text3)]' : 'text-[var(--text2)]'}>{s.title || s.t}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 h-1 bg-[var(--surface3)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--accent)] rounded-full transition-all"
                  style={{ width: `${totalSubs ? (doneSubs/totalSubs)*100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* Actions */}
          {editing ? (
            <div className="flex gap-2 pt-1 border-t border-[var(--border)]">
              <button onClick={() => setEditing(false)}
                className="flex-1 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text3)] hover:bg-[var(--surface2)] cursor-pointer transition-all">
                Отмена
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[#7c75ff] disabled:opacity-50 cursor-pointer transition-all font-medium">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 pt-1 border-t border-[var(--border)]">
              <button onClick={() => onComplete(task.id, isDone)}
                className={`flex-1 py-2 text-sm rounded-lg font-medium cursor-pointer transition-all ${
                  isDone
                    ? 'bg-[var(--surface2)] border border-[var(--border)] text-[var(--text3)] hover:text-amber-400 hover:border-amber-400/30'
                    : 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/25'
                }`}>
                {isDone ? '↩ Возобновить' : '✓ Выполнено'}
              </button>
              <button onClick={() => { onDelete(task.id); onClose() }}
                className="px-4 py-2 text-sm rounded-lg border border-red-400/20 text-red-400 hover:bg-red-400/10 cursor-pointer transition-all">
                Удалить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── UNDATED PANEL ────────────────────────────────────────────────────────────
function UndatedPanel({ tasks, onOpen }) {
  const [collapsed, setCollapsed] = useState(false)
  if (!tasks || tasks.length === 0) return null

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface2)] transition-all cursor-pointer"
      >
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text3)]">
          Без даты
        </span>
        <div className="flex items-center gap-1.5">
          {/* Mini priority dots preview */}
          {tasks.slice(0, 5).map((t, i) => {
            const prio = PRIO_MAP[t.priority] || PRIO_MAP.medium
            return <div key={i} className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
          })}
          {tasks.length > 5 && <span className="text-[10px] text-[var(--text3)] font-mono">+{tasks.length - 5}</span>}
        </div>
        <span className="text-[10px] font-mono text-[var(--text3)] ml-auto">{tasks.length} задач</span>
        <span className="text-[10px] text-[var(--text3)] ml-1">{collapsed ? '▲' : '▼'}</span>
      </button>

      {/* Task chips */}
      {!collapsed && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {sortTasks(tasks).map(t => {
            const prio = PRIO_MAP[t.priority] || PRIO_MAP.medium
            const cat = CAT_MAP[t.category] || CAT_MAP.unsorted
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                style={{
                  background: prio.bg,
                  borderColor: prio.color + '30',
                }}
              >
                {/* Prio dot */}
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${prio.dot}`} />
                {/* Title */}
                <span className="text-xs font-medium max-w-[140px] truncate" style={{ color: prio.color }}>
                  {t.title}
                </span>
                {/* Cat label */}
                <span className="text-[9px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                  style={{ color: cat.color, background: cat.bg }}>
                  {cat.label}
                </span>
                {/* AI badge */}
                {t.ai_generated && (
                  <span className="text-[9px] text-[var(--accent)] flex-shrink-0">✦</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── TASK ROW ─────────────────────────────────────────────────────────────────
function TaskRow({ task, onOpen }) {
  const isDone = task.status === 'completed'
  const isOverdue = !isDone && (task.status === 'overdue' || (task.deadline && new Date(task.deadline) < new Date()))
  const prio = PRIO_MAP[task.priority] || PRIO_MAP.medium
  const cat = CAT_MAP[task.category] || CAT_MAP.unsorted

  return (
    <div onClick={() => onOpen(task)}
      className={`group flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer hover:bg-[var(--surface2)] transition-all fade-in border border-transparent hover:border-[var(--border)] ${isDone ? 'opacity-45' : ''}`}>
      <div className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5"
        style={{ background: isDone ? 'var(--text3)' : isOverdue ? '#ef4444' : prio.color }} />
      <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
        isDone ? 'bg-emerald-500/20 border-emerald-400/40' : 'border-[var(--border)]'}`}>
        {isDone && <span className="text-emerald-400 text-[9px]">✓</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-[var(--text3)]' : isOverdue ? 'text-red-400' : 'text-[var(--text)]'}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: cat.color, background: cat.bg }}>{cat.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono border" style={{ color: prio.color, background: prio.bg, borderColor: prio.color + '30' }}>{prio.label}</span>
          {task.duration_minutes && (
            <span className="text-[10px] text-[var(--text3)] font-mono">
              ⏱ {task.duration_minutes < 60 ? task.duration_minutes+'м' : Math.floor(task.duration_minutes/60)+'ч'+(task.duration_minutes%60 ? ' '+task.duration_minutes%60+'м' : '')}
            </span>
          )}
          {task.start_datetime && <span className="text-[10px] text-[var(--text3)] font-mono">🕐 {dayjs(task.start_datetime).format('HH:mm')}</span>}
          {isOverdue && <span className="text-[10px] text-red-400 font-mono font-semibold">ПРОСРОЧЕНО</span>}
          {task.subtasks?.length > 0 && (
            <span className="text-[10px] text-[var(--text3)] font-mono">☑ {task.subtasks.filter(s=>s.done).length}/{task.subtasks.length}</span>
          )}
        </div>
      </div>
      <span className="text-[var(--text3)] opacity-0 group-hover:opacity-100 transition-opacity text-xs mt-0.5 flex-shrink-0">›</span>
    </div>
  )
}

// ─── DAY VIEW ─────────────────────────────────────────────────────────────────
function DayView({ tasks, onOpen }) {
  if (!tasks.length) return (
    <div className="flex flex-col items-center justify-center h-48 text-[var(--text3)]">
      <div className="text-3xl mb-3 opacity-30">◻</div>
      <div className="text-sm">Нет задач на этот день</div>
    </div>
  )
  const active = sortTasks(tasks.filter(t => t.status !== 'completed'))
  const done = tasks.filter(t => t.status === 'completed')
  return (
    <div className="flex flex-col gap-1 p-2">
      {active.map(t => <TaskRow key={t.id} task={t} onOpen={onOpen} />)}
      {done.length > 0 && (
        <>
          <div className="flex items-center gap-2 my-2 px-2">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-[10px] font-mono text-[var(--text3)] uppercase tracking-wider">Выполнено · {done.length}</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
          {done.map(t => <TaskRow key={t.id} task={t} onOpen={onOpen} />)}
        </>
      )}
    </div>
  )
}

// ─── WEEK VIEW ────────────────────────────────────────────────────────────────
function WeekView({ tasks, currentDate, onOpen }) {
  const monday = dayjs(currentDate).startOf('week')
  const days = Array.from({ length: 7 }, (_, i) => monday.add(i, 'day'))
  const today = dayjs().format('YYYY-MM-DD')

  return (
    <div className="grid grid-cols-7 gap-2 h-full">
      {days.map(day => {
        const ds = day.format('YYYY-MM-DD')
        const dayTasks = tasks.filter(t => {
          if (t.start_datetime && dayjs(t.start_datetime).format('YYYY-MM-DD') === ds) return true
          if (!t.start_datetime && t.deadline && dayjs(t.deadline).format('YYYY-MM-DD') === ds) return true
          // Overdue tasks — show on today
          if (t.status === 'overdue' && ds === today) return true
          return false
        })
        const active = sortTasks(dayTasks.filter(t => t.status !== 'completed'))
        const done = dayTasks.filter(t => t.status === 'completed')
        const isToday = ds === today

        return (
          <div key={ds} className={`rounded-xl border p-2 flex flex-col gap-1 min-h-[200px] ${isToday ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
            <div className={`text-center mb-1 pb-1.5 border-b ${isToday ? 'border-[var(--accent)]/20' : 'border-[var(--border)]'}`}>
              <div className={`text-[9px] font-mono uppercase tracking-wider ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text3)]'}`}>{day.format('dd')}</div>
              <div className={`text-xl font-bold leading-tight ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{day.format('D')}</div>
              {dayTasks.length > 0 && (
                <div className="text-[9px] font-mono text-[var(--text3)] mt-0.5">
                  {active.length > 0 ? active.length+' акт.' : ''}{done.length > 0 ? (active.length > 0 ? ' · ' : '')+done.length+' ✓' : ''}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto flex-1">
              {active.map(t => {
                const prio = PRIO_MAP[t.priority] || PRIO_MAP.medium
                const cat = CAT_MAP[t.category] || CAT_MAP.unsorted
                const isOv = t.status === 'overdue' || (!t.start_datetime && t.deadline && new Date(t.deadline) < new Date())
                return (
                  <div key={t.id} onClick={() => onOpen(t)}
                    className="text-[11px] px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] border"
                    style={{ background: isOv ? 'rgba(239,68,68,0.1)' : prio.bg, borderColor: (isOv ? '#ef4444' : prio.color)+'30', color: isOv ? '#ef4444' : prio.color }}>
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-[9px] opacity-70 mt-0.5">{cat.label}{t.duration_minutes ? ` · ${t.duration_minutes}м` : ''}{isOv ? ' · ⚠ просрочено' : ''}</div>
                  </div>
                )
              })}
              {done.map(t => (
                <div key={t.id} onClick={() => onOpen(t)}
                  className="text-[10px] px-2 py-1 rounded cursor-pointer opacity-35 bg-[var(--surface3)] line-through text-[var(--text3)] truncate">
                  {t.title}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── MONTH VIEW ───────────────────────────────────────────────────────────────
function MonthView({ tasks, currentDate, onOpen }) {
  const startOfMonth = dayjs(currentDate).startOf('month')
  const daysInMonth = startOfMonth.daysInMonth()
  const startDow = (startOfMonth.day() + 6) % 7
  const cells = Array.from({ length: startDow }, () => null)
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
          const isToday = ds === today
          const dayTasks = tasks.filter(t => {
            const ts = t.start_datetime ? dayjs(t.start_datetime).format('YYYY-MM-DD') : null
            const dl = t.deadline ? dayjs(t.deadline).format('YYYY-MM-DD') : null
            if (t.status === 'overdue' && isToday) return true
            return ts === ds || dl === ds
          })
          const active = dayTasks.filter(t => t.status !== 'completed')
          const allDone = dayTasks.length > 0 && active.length === 0
          const hasOverdue = active.some(t => t.status === 'overdue' || (t.deadline && new Date(t.deadline) < new Date()))

          return (
            <div key={ds} className={`rounded-lg p-1.5 min-h-[80px] border transition-all ${
              isToday ? 'border-[var(--accent)]/50 bg-[var(--accent)]/5' :
              allDone ? 'border-emerald-400/20 bg-emerald-400/5' :
              hasOverdue ? 'border-red-400/30 bg-red-400/5' :
              'border-[var(--border)] bg-[var(--surface)]'
            }`}>
              <div className={`text-xs font-bold mb-1 ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text3)]'}`}>{day.format('D')}</div>
              <div className="flex flex-col gap-0.5">
                {dayTasks.slice(0, 3).map(t => {
                  const prio = PRIO_MAP[t.priority] || PRIO_MAP.medium
                  const isDone = t.status === 'completed'
                  const isOv = t.status === 'overdue'
                  return (
                    <div key={t.id} onClick={() => onOpen(t)}
                      className={`text-[9px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${isDone ? 'line-through opacity-30 bg-[var(--surface3)] text-[var(--text3)]' : ''}`}
                      style={!isDone ? { background: isOv ? 'rgba(239,68,68,0.15)' : prio.bg, color: isOv ? '#ef4444' : prio.color } : {}}>
                      {t.title}
                    </div>
                  )
                })}
                {dayTasks.length > 3 && <div className="text-[9px] text-[var(--text3)] font-mono px-1">+{dayTasks.length-3}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── YEAR VIEW ────────────────────────────────────────────────────────────────
function YearView({ tasks, currentDate }) {
  const year = dayjs(currentDate).year()
  const months = Array.from({ length: 12 }, (_, i) => dayjs(`${year}-${String(i+1).padStart(2,'0')}-01`))
  const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const today = dayjs().format('YYYY-MM-DD')

  return (
    <div className="grid grid-cols-4 gap-4">
      {months.map((m, mi) => {
        const daysInMonth = m.daysInMonth()
        const startDow = (m.day() + 6) % 7
        const cells = Array(startDow).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i+1))
        return (
          <div key={mi} className="card p-3">
            <div className="text-xs font-medium text-[var(--text2)] mb-2">{MONTH_NAMES[mi]}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="w-4 h-4" />
                const ds = `${year}-${String(mi+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                const dayTasks = tasks.filter(t => t.start_datetime && dayjs(t.start_datetime).format('YYYY-MM-DD') === ds)
                const allDone = dayTasks.length > 0 && dayTasks.every(t => t.status === 'completed')
                const hasCritical = dayTasks.some(t => t.priority === 'critical' && t.status !== 'completed')
                const hasOverdue = dayTasks.some(t => t.status === 'overdue')
                const isToday = ds === today
                return (
                  <div key={i} title={dayTasks.length > 0 ? `${d}: ${dayTasks.length} задач` : String(d)}
                    className={`w-4 h-4 rounded-sm transition-all ${
                      isToday ? 'ring-1 ring-[var(--accent)]' :
                      allDone ? 'bg-emerald-500/50' :
                      hasOverdue ? 'bg-red-500/60' :
                      hasCritical ? 'bg-red-400/40' :
                      dayTasks.length > 0 ? 'bg-[var(--accent)]/35' :
                      'bg-[var(--surface3)]'
                    }`} />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── MAIN CALENDAR ────────────────────────────────────────────────────────────
export default function Calendar({ onAddTask, onRefresh }) {
  const { view, setView, currentDate, navigateDate, goToday, tasks, setTasks, undatedTasks, setUndatedTasks, setTips, setLoadInfo } = useStore()
  const [selectedTask, setSelectedTask] = useState(null)

  const load = useCallback(async () => {
    try {
      const [tasksRes, tipsRes] = await Promise.all([getTasks(view, currentDate), getTips()])
      setTasks(tasksRes.data.tasks || [])
      // Backend also returns undated tasks in same response
      if (tasksRes.data.undated) setUndatedTasks(tasksRes.data.undated)
      setTips(tipsRes.data.tips)
      setLoadInfo(tipsRes.data.load)
    } catch (e) { console.error(e) }
  }, [view, currentDate])

  useEffect(() => { load() }, [load])

  const handleComplete = async (id, currentlyDone) => {
    try {
      if (currentlyDone) {
        await updateTask(id, { status: 'pending' })
        toast.success('Задача возобновлена')
      } else {
        await completeTask(id)
        toast.success('✓ Задача выполнена!')
      }
      setSelectedTask(prev => prev?.id === id ? { ...prev, status: currentlyDone ? 'pending' : 'completed' } : prev)
      await load()
      onRefresh?.()
    } catch { toast.error('Ошибка') }
  }

  const handleDelete = async (id) => {
    try {
      await deleteTask(id)
      toast.success('Задача удалена')
      setSelectedTask(null)
      await load()
      onRefresh?.()
    } catch { toast.error('Ошибка') }
  }

  const handleUpdate = async (id, data) => {
    await updateTask(id, data)
    setSelectedTask(prev => prev?.id === id ? { ...prev, ...data } : prev)
    await load()
    onRefresh?.()
  }

  const formatPeriod = () => {
    const d = dayjs(currentDate)
    if (view === 'day') return d.format('D MMMM YYYY')
    if (view === 'week') { const mon = d.startOf('week'); return `${mon.format('D MMM')} — ${mon.add(6,'day').format('D MMM YYYY')}` }
    if (view === 'month') return d.format('MMMM YYYY')
    return d.format('YYYY')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex gap-1 bg-[var(--surface2)] rounded-lg p-1">
          {['day','week','month','year'].map((v, i) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${view === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text3)] hover:text-[var(--text)]'}`}>
              {['День','Неделя','Месяц','Год'][i]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigateDate('prev')} className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] cursor-pointer transition-all">←</button>
          <button onClick={goToday} className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--surface2)] text-[var(--text2)] cursor-pointer transition-all">Сегодня</button>
          <button onClick={() => navigateDate('next')} className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] cursor-pointer transition-all">→</button>
        </div>
        <div className="text-sm font-medium text-[var(--text2)] capitalize">{formatPeriod()}</div>
        <button onClick={onAddTask}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:bg-[#7c75ff] text-white text-xs font-medium rounded-lg transition-all cursor-pointer">
          + Задача
        </button>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'day'   && <DayView   tasks={tasks} onOpen={setSelectedTask} />}
        {view === 'week'  && <WeekView  tasks={tasks} currentDate={currentDate} onOpen={setSelectedTask} />}
        {view === 'month' && <MonthView tasks={tasks} currentDate={currentDate} onOpen={setSelectedTask} />}
        {view === 'year'  && <YearView  tasks={tasks} currentDate={currentDate} />}
      </div>

      {/* Undated tasks panel — collapsible strip at bottom */}
      <UndatedPanel tasks={undatedTasks} onOpen={setSelectedTask} />

      {/* Task modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
