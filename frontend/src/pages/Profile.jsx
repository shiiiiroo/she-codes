import React, { useEffect, useState } from 'react'
import { getProfile, updateProfile, getMemories, deleteMemory } from '../api'
import { Input, Select, Textarea, Btn, StatCard } from '../components/UI'
import toast from 'react-hot-toast'

const WORK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS = { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' }

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    Promise.all([getProfile(), getMemories()])
      .then(([pr, mr]) => {
        setProfile(pr.data)
        setForm({
          name: pr.data.name || '',
          email: pr.data.email || '',
          occupation: pr.data.occupation || '',
          workplace: pr.data.workplace || '',
          max_daily_hours: pr.data.max_daily_hours || 8,
          health_notes: pr.data.health_notes || '',
          wake_time: pr.data.wake_time || '08:00',
          sleep_time: pr.data.sleep_time || '23:00',
          work_schedule: pr.data.work_schedule || {},
          study_schedule: pr.data.study_schedule || {},
        })
        setMemories(mr.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const setScheduleTime = (type, day, value) => {
    const key = type + '_schedule'
    setForm(f => ({
      ...f,
      [key]: { ...f[key], [day]: value },
    }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile(form)
      toast.success('Профиль сохранён')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const removeMemory = async (id) => {
    await deleteMemory(id)
    setMemories(m => m.filter(x => x.id !== id))
    toast.success('Удалено из памяти ИИ')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-[var(--text3)]">Загрузка...</div>
    </div>
  )

  return (
    <div className="overflow-y-auto h-full p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Профиль</h1>
        <p className="text-sm text-[var(--text3)] mt-1">Информация о вас, которую ИИ использует для персонализации</p>
      </div>

      {/* Basic info */}
      <section className="card p-6 mb-5">
        <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider mb-4">Основная информация</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Имя" value={form.name} onChange={e => set('name', e.target.value)} />
          <Input label="Email" value={form.email} onChange={e => set('email', e.target.value)} />
          <Input label="Профессия / сфера" placeholder="Разработчик, студент..." value={form.occupation} onChange={e => set('occupation', e.target.value)} />
          <Input label="Место работы / учёбы" placeholder="Компания, университет..." value={form.workplace} onChange={e => set('workplace', e.target.value)} />
        </div>
      </section>

      {/* Work schedule */}
      <section className="card p-6 mb-5">
        <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider mb-4">График работы</h2>
        <p className="text-xs text-[var(--text3)] mb-4">Укажите рабочие часы по дням. Оставьте пустым — выходной.</p>
        <div className="grid grid-cols-7 gap-2">
          {WORK_DAYS.map(day => (
            <div key={day} className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-[var(--text3)] text-center uppercase">{DAY_LABELS[day]}</label>
              <input
                type="text"
                placeholder="09-18"
                value={form.work_schedule?.[day] || ''}
                onChange={e => setScheduleTime('work', day, e.target.value)}
                className="bg-[var(--surface2)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-center text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Study schedule */}
      <section className="card p-6 mb-5">
        <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider mb-4">График учёбы</h2>
        <div className="grid grid-cols-7 gap-2">
          {WORK_DAYS.map(day => (
            <div key={day} className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-[var(--text3)] text-center uppercase">{DAY_LABELS[day]}</label>
              <input
                type="text"
                placeholder="10-16"
                value={form.study_schedule?.[day] || ''}
                onChange={e => setScheduleTime('study', day, e.target.value)}
                className="bg-[var(--surface2)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-center text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Health & Load */}
      <section className="card p-6 mb-5">
        <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider mb-4">Здоровье и нагрузка</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Input label="Макс. часов в день" type="number" min="1" max="18" step="0.5" value={form.max_daily_hours} onChange={e => set('max_daily_hours', parseFloat(e.target.value))} />
          <Input label="Время подъёма" type="time" value={form.wake_time} onChange={e => set('wake_time', e.target.value)} />
          <Input label="Время сна" type="time" value={form.sleep_time} onChange={e => set('sleep_time', e.target.value)} />
        </div>
        <Textarea
          label="Заметки о здоровье (для ИИ)"
          placeholder="Например: боль в спине — нужны перерывы каждый час, не планировать физические задачи после 20:00..."
          value={form.health_notes}
          onChange={e => set('health_notes', e.target.value)}
          rows={3}
        />
      </section>

      <div className="flex justify-end mb-8">
        <Btn variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить профиль'}
        </Btn>
      </div>

      {/* AI Memory */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text2)] uppercase tracking-wider">Память ИИ</h2>
          <span className="text-[10px] font-mono text-[var(--text3)] bg-[var(--surface2)] px-2 py-0.5 rounded">{memories.length} записей</span>
        </div>
        <p className="text-xs text-[var(--text3)] mb-4">Факты, которые ИИ узнал о вас из разговоров. Вы можете удалить любой.</p>
        {memories.length === 0 ? (
          <div className="text-center py-8 text-[var(--text3)] text-sm">
            ИИ ещё не накопил воспоминаний. Пообщайтесь с ним!
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {memories.map(m => (
              <div key={m.id} className="flex items-start gap-3 p-3 bg-[var(--surface2)] rounded-lg">
                <span className="text-[10px] font-mono text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">{m.type}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[var(--text3)] font-mono mb-0.5">{m.key}</div>
                  <div className="text-xs text-[var(--text2)]">{m.value}</div>
                </div>
                <button
                  onClick={() => removeMemory(m.id)}
                  className="text-[var(--text3)] hover:text-red-400 cursor-pointer text-xs p-1 flex-shrink-0"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
