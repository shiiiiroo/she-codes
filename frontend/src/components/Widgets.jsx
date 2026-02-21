import React, { useState } from 'react'
import { useStore } from '../store'
import { createTask, postponeTask } from '../api'
import { Input, Select, Textarea, Btn } from './UI'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'

// ─── TIPS BAR ───────────────────────────────────────────────────────────────
export function TipsBar({ onRefresh }) {
  const { tips, loadInfo, overdueTasks } = useStore()
  const [dismissed, setDismissed] = useState([])

  const visibleTips = tips.filter((_, i) => !dismissed.includes(i))

  if (!visibleTips.length && !loadInfo) return null

  const loadPct = loadInfo?.load_percent || 0
  const loadColor = loadPct > 100 ? 'bg-red-500' : loadPct > 75 ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className="border-b border-[var(--border)] px-4 py-2.5 flex items-center gap-4 overflow-x-auto flex-shrink-0 bg-[var(--surface)]/50">
      {/* Load indicator */}
      {loadInfo && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono text-[var(--text3)] uppercase">Нагрузка</span>
          <div className="w-20 h-1.5 bg-[var(--surface3)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${loadColor}`} style={{ width: `${Math.min(loadPct, 100)}%` }} />
          </div>
          <span className={`text-[11px] font-mono ${loadPct > 100 ? 'text-red-400' : loadPct > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {loadPct}%
          </span>
        </div>
      )}

      <div className="w-px h-4 bg-[var(--border)] flex-shrink-0" />

      {/* Tips */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {visibleTips.map((tip, i) => (
          <div key={i} className="flex items-center gap-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 flex-shrink-0 fade-in">
            <span className="text-[11px] text-[var(--text2)] whitespace-nowrap">{tip}</span>
            <button
              onClick={() => setDismissed(d => [...d, i])}
              className="text-[var(--text3)] hover:text-[var(--text)] cursor-pointer text-xs ml-1"
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ADD TASK FORM ──────────────────────────────────────────────────────────
const CAT_OPTIONS = [
  { value: 'work', label: '💼 Работа' },
  { value: 'study', label: '📚 Учёба' },
  { value: 'health', label: '🏃 Здоровье' },
  { value: 'personal', label: '🙂 Личное' },
  { value: 'finance', label: '💰 Финансы' },
  { value: 'social', label: '👥 Социальное' },
  { value: 'unsorted', label: '📋 Без сортировки' },
]

const PRIO_OPTIONS = [
  { value: 'critical', label: '🔴 Критично' },
  { value: 'high', label: '🟡 Высокий' },
  { value: 'medium', label: '🔵 Средний' },
  { value: 'low', label: '⚪ Низкий' },
]

export function AddTaskForm({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'work',
    priority: 'medium',
    duration_minutes: '',
    start_datetime: '',
    deadline: '',
    subtasks_raw: '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Введите название'); return }
    setLoading(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        category: form.category,
        priority: form.priority,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        start_datetime: form.start_datetime || null,
        deadline: form.deadline || null,
        subtasks: form.subtasks_raw
          ? form.subtasks_raw.split('\n').map(s => s.trim()).filter(Boolean).map(t => ({ title: t, done: false }))
          : [],
      }
      await createTask(payload)
      toast.success('Задача создана!')
      onCreated?.()
      onClose?.()
    } catch {
      toast.error('Ошибка создания задачи')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold">Новая задача</h2>
          <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)] cursor-pointer">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <Input
            label="Название *"
            placeholder="Что нужно сделать?"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            autoFocus
          />

          <Textarea
            label="Описание"
            placeholder="Детали задачи..."
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Категория" options={CAT_OPTIONS} value={form.category} onChange={e => set('category', e.target.value)} />
            <Select label="Приоритет" options={PRIO_OPTIONS} value={form.priority} onChange={e => set('priority', e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Длительность (мин)" type="number" placeholder="60" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} />
            <Input label="Начало" type="datetime-local" value={form.start_datetime} onChange={e => set('start_datetime', e.target.value)} />
            <Input label="Дедлайн" type="datetime-local" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
          </div>

          <Textarea
            label="Подзадачи (каждая с новой строки)"
            placeholder={"Шаг 1\nШаг 2\nШаг 3"}
            value={form.subtasks_raw}
            onChange={e => set('subtasks_raw', e.target.value)}
            rows={3}
          />

          <div className="flex gap-2 justify-end pt-1 border-t border-[var(--border)]">
            <Btn variant="ghost" onClick={onClose} type="button">Отмена</Btn>
            <Btn variant="primary" type="submit" disabled={loading}>
              {loading ? 'Создание...' : 'Создать задачу'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── UNSORTED PANEL ─────────────────────────────────────────────────────────
export function UnsortedPanel({ tasks }) {
  if (!tasks?.length) return null
  return (
    <div className="card p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-[var(--text3)] uppercase tracking-wider">Без сортировки</span>
        <span className="text-[10px] bg-[var(--surface3)] text-[var(--text3)] px-1.5 py-0.5 rounded font-mono">{tasks.length}</span>
      </div>
      {tasks.map(t => (
        <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
          <span className="text-[10px] font-mono text-amber-400">?</span>
          <span className="text-xs text-[var(--text2)] flex-1 truncate">{t.title}</span>
        </div>
      ))}
    </div>
  )
}
