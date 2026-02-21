import React from 'react'

// ─── PRIORITY BADGE ────────────────────────────────────────────────────────
export const PriorityBadge = ({ priority }) => {
  const map = {
    critical: { label: 'КРИТИЧНО', color: 'text-red-400 border-red-400/30 bg-red-400/10' },
    high:     { label: 'ВЫСОКИЙ', color: 'text-amber-400 border-amber-400/30 bg-amber-400/10' },
    medium:   { label: 'СРЕДНИЙ', color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' },
    low:      { label: 'НИЗКИЙ',  color: 'text-gray-500 border-gray-500/30 bg-gray-500/10' },
  }
  const cfg = map[priority] || map.medium
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ─── CATEGORY CHIP ─────────────────────────────────────────────────────────
const CAT_MAP = {
  work:     { label: 'Работа',   cls: 'cat-work' },
  study:    { label: 'Учёба',    cls: 'cat-study' },
  health:   { label: 'Здоровье', cls: 'cat-health' },
  personal: { label: 'Личное',   cls: 'cat-personal' },
  finance:  { label: 'Финансы',  cls: 'cat-finance' },
  social:   { label: 'Социальное', cls: 'cat-social' },
  unsorted: { label: 'Без сортировки', cls: 'cat-unsorted' },
}

export const CategoryChip = ({ category }) => {
  const cfg = CAT_MAP[category] || CAT_MAP.unsorted
  return <span className={`cat-chip ${cfg.cls}`}>{cfg.label}</span>
}

// ─── DURATION LABEL ────────────────────────────────────────────────────────
export const DurationLabel = ({ minutes }) => {
  if (!minutes) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const label = h > 0 ? `${h}ч ${m > 0 ? m + 'м' : ''}` : `${m}м`
  return <span className="text-[11px] text-[var(--text3)] font-mono">⏱ {label}</span>
}

// ─── BUTTON ────────────────────────────────────────────────────────────────
export const Btn = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false, type = 'button' }) => {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' }
  const variants = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[#7c75ff] disabled:opacity-40',
    outline: 'border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]',
    ghost:   'text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]',
    danger:  'border border-red-400/20 text-red-400 hover:bg-red-400/10',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-500/30',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-all cursor-pointer ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

// ─── INPUT ─────────────────────────────────────────────────────────────────
export const Input = ({ label, className = '', ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-mono">{label}</label>}
    <input
      className={`bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text3)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all ${className}`}
      {...props}
    />
  </div>
)

// ─── SELECT ────────────────────────────────────────────────────────────────
export const Select = ({ label, options, className = '', ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-mono">{label}</label>}
    <select
      className={`bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all cursor-pointer ${className}`}
      {...props}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background: '#1a1a28' }}>{o.label}</option>
      ))}
    </select>
  </div>
)

// ─── TEXTAREA ──────────────────────────────────────────────────────────────
export const Textarea = ({ label, className = '', ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-mono">{label}</label>}
    <textarea
      className={`bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text3)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all resize-none ${className}`}
      {...props}
    />
  </div>
)

// ─── SPINNER ────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

// ─── TASK CARD ─────────────────────────────────────────────────────────────
export const TaskCard = ({ task, onComplete, onDelete, onPostpone, compact = false }) => {
  const isOverdue = task.status !== 'completed' && task.deadline && new Date(task.deadline) < new Date()
  const isDone = task.status === 'completed'

  return (
    <div className={`card card-hover p-3 transition-all fade-in ${isDone ? 'task-done opacity-60' : ''} ${isOverdue ? 'border-l-2 border-red-500/50' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => !isDone && onComplete?.(task.id)}
          className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all cursor-pointer ${
            isDone ? 'bg-emerald-500/20 border-emerald-500/40' : 'border-[var(--border)] hover:border-[var(--accent)]'
          }`}
        >
          {isDone && <span className="text-emerald-400 text-[10px]">✓</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium task-title-el ${isOverdue && !isDone ? 'text-red-400' : ''}`}>
            {task.title}
          </div>
          {!compact && task.description && (
            <div className="text-xs text-[var(--text3)] mt-0.5 line-clamp-1">{task.description}</div>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <CategoryChip category={task.category} />
            <PriorityBadge priority={task.priority} />
            {task.duration_minutes && <DurationLabel minutes={task.duration_minutes} />}
            {isOverdue && !isDone && (
              <span className="text-[10px] text-red-400 font-mono">ПРОСРОЧЕНО</span>
            )}
          </div>
          {/* Subtasks progress */}
          {!compact && task.subtasks?.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1 bg-[var(--surface3)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all"
                    style={{ width: `${(task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[var(--text3)]">
                  {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isOverdue && onPostpone && (
            <button onClick={() => onPostpone(task)} className="p-1 rounded hover:bg-amber-400/10 text-amber-400 cursor-pointer" title="Перенести">
              ↷
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(task.id)} className="p-1 rounded hover:bg-red-400/10 text-[var(--text3)] hover:text-red-400 cursor-pointer" title="Удалить">
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── STAT CARD ─────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, sub, color = 'accent', icon }) => {
  const colorMap = {
    accent: 'text-[var(--accent)]',
    green: 'text-emerald-400',
    red: 'text-red-400',
    gold: 'text-amber-400',
    blue: 'text-blue-400',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-3xl font-bold tracking-tight ${colorMap[color]}`}>{value}</div>
          <div className="text-sm text-[var(--text2)] mt-1">{label}</div>
          {sub && <div className="text-xs text-[var(--text3)] mt-0.5">{sub}</div>}
        </div>
        {icon && <div className="text-2xl opacity-30">{icon}</div>}
      </div>
    </div>
  )
}
