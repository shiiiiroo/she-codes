import React, { useState, useRef, useEffect, useCallback } from 'react'
import { sendChat, sendVoice, uploadFile, getChatHistory, clearChatHistory } from '../api'
import { useStore } from '../store'
import { Spinner } from './UI'
import toast from 'react-hot-toast'

const SUGGESTIONS = [
  'Что мне сделать сегодня?',
  'Я перегружен, помоги расставить приоритеты',
  'Запланируй встречу завтра в 15:00',
  'Удали задачу "Название"',
  'Как улучшить мою продуктивность?',
]

const normMsg = (m) => ({ ...m, metadata: m.metadata || m.meta || {} })

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const meta   = msg.metadata || {}
  const tc = meta.tasks_created || []
  const tu = meta.tasks_updated || []
  const td = meta.tasks_deleted || []

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} fade-in`}>
      <div className={`max-w-[88%] ${isUser ? '' : 'w-full'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[10px] text-[var(--accent)]">✦</div>
            <span className="text-[10px] text-[var(--text3)] font-mono">TaskFlow AI</span>
          </div>
        )}
        <div className={`rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[var(--accent)] text-white rounded-br-sm'
            : 'bg-[var(--surface2)] text-[var(--text)] rounded-bl-sm border border-[var(--border)]'
        }`}>{msg.content}</div>

        {tc.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1">
            {tc.slice(0,3).map((t,i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] bg-[var(--accent)]/8 border border-[var(--accent)]/20 rounded-lg px-2.5 py-1.5">
                <span className="text-[var(--accent)]">+</span>
                <span className="text-[var(--text2)] truncate flex-1">{t.title}</span>
                <span className="text-[var(--text3)] font-mono">{t.category}</span>
              </div>
            ))}
          </div>
        )}
        {tu.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1">
            {tu.slice(0,3).map((t,i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] bg-amber-400/8 border border-amber-400/20 rounded-lg px-2.5 py-1.5">
                <span className="text-amber-400">↺</span>
                <span className="text-[var(--text2)] truncate">{t.title}</span>
              </div>
            ))}
          </div>
        )}
        {td.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1">
            {td.slice(0,3).map((title,i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] bg-red-400/8 border border-red-400/20 rounded-lg px-2.5 py-1.5">
                <span className="text-red-400">✕</span>
                <span className="text-[var(--text3)] line-through truncate">{title}</span>
              </div>
            ))}
          </div>
        )}
        {meta.load_warning && (
          <div className="mt-1.5 text-[11px] bg-amber-400/10 border border-amber-400/20 text-amber-300 rounded-lg px-2.5 py-1.5">⚠️ {meta.load_warning}</div>
        )}
        {(meta.tips||[]).map((tip,i) => (
          <div key={i} className="mt-1 text-[11px] bg-emerald-400/8 border border-emerald-400/20 text-emerald-300 rounded-lg px-2.5 py-1.5">💡 {typeof tip === 'string' ? tip : tip.tip || tip.text || ''}</div>
        ))}
        {(meta.clarifying_questions||[]).map((q,i) => (
          <div key={i} className="mt-1 text-[11px] bg-[var(--surface3)] border border-[var(--border)] text-[var(--text2)] rounded-lg px-2.5 py-1.5">❓ {typeof q === 'string' ? q : q.question || q.text || ''}</div>
        ))}
        <div className="text-[9px] text-[var(--text3)] mt-1 font-mono">
          {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 fade-in">
      <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[10px] text-[var(--accent)]">✦</div>
      <div className="flex gap-1 bg-[var(--surface2)] rounded-2xl rounded-bl-sm px-3 py-2.5 border border-[var(--border)]">
        {[0,1,2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--text3)]"
            style={{ animation: 'bounce 1.2s infinite', animationDelay: `${i*0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

export default function ChatBox({ onTasksUpdated }) {
  const { messages, setMessages, addMessage, isAiTyping, setAiTyping } = useStore()
  const [input, setInput]       = useState('')
  const [isRecording, setIsRec] = useState(false)
  const [recTime, setRecTime]   = useState(0)
  const [showClear, setShowClear] = useState(false)
  const bottomRef   = useRef(null)
  const inputRef    = useRef(null)
  const mrRef       = useRef(null)
  const chunksRef   = useRef([])
  const recTimerRef = useRef(null)
  const mountedRef  = useRef(true)

  // Track mounted state to prevent setState on unmounted component
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Cleanup recording timer if active
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current)
      }
      // Stop recording if active
      if (mrRef.current && mrRef.current.state === 'recording') {
        try { mrRef.current.stop() } catch(_) {}
      }
    }
  }, [])

  // Load history on mount
  useEffect(() => {
    let cancelled = false
    getChatHistory()
      .then(res => {
        if (cancelled) return
        const raw = res.data || []
        setMessages(Array.isArray(raw) ? raw.map(normMsg) : [])
      })
      .catch(err => {
        if (cancelled) return
        console.error('[ChatBox] Failed to load history:', err)
        setMessages([])
      })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAiTyping])

  const reloadHistory = useCallback(async () => {
    try {
      const res = await getChatHistory()
      if (!mountedRef.current) return
      const raw = res.data || []
      setMessages(Array.isArray(raw) ? raw.map(normMsg) : [])
    } catch (err) {
      if (!mountedRef.current) return
      console.error('[ChatBox] Failed to reload history:', err)
    }
  }, [setMessages])

  const handleSend = useCallback(async (text = input.trim()) => {
    if (!text || isAiTyping) return
    if (!mountedRef.current) return

    setInput('')

    const tempId = `tmp_${Date.now()}`
    addMessage({
      id: tempId,
      role: 'user',
      content: text,
      message_type: 'text',
      metadata: {},
      created_at: new Date().toISOString()
    })
    setAiTyping(true)

    try {
      const data = await sendChat(text)
      if (!mountedRef.current) return

      await reloadHistory()
      if (!mountedRef.current) return

      const changed = data.tasks_created?.length || data.tasks_updated?.length || data.tasks_deleted?.length
      if (changed) {
        onTasksUpdated?.()
        if (data.tasks_created?.length)  toast.success(`✦ Создано: ${data.tasks_created.length}`)
        if (data.tasks_updated?.length)  toast.success(`↺ Обновлено: ${data.tasks_updated.length}`)
        if (data.tasks_deleted?.length)  toast.success(`✕ Удалено: ${data.tasks_deleted.length}`)
      }
    } catch (e) {
      if (!mountedRef.current) return
      console.error('[ChatBox] Send error:', e)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      addMessage({
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: 'Ошибка соединения. Проверьте подключение к серверу.',
        message_type: 'text',
        metadata: {},
        created_at: new Date().toISOString()
      })
      toast.error('Ошибка связи с ИИ')
    } finally {
      if (mountedRef.current) setAiTyping(false)
    }
  }, [input, isAiTyping, addMessage, setAiTyping, reloadHistory, onTasksUpdated, setMessages])

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mrRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (mountedRef.current) {
          await handleVoiceSend(new Blob(chunksRef.current, { type: 'audio/webm' }))
        }
      }
      mr.start()
      if (mountedRef.current) {
        setIsRec(true)
        setRecTime(0)
        recTimerRef.current = setInterval(() => {
          if (mountedRef.current) setRecTime(t => t+1)
        }, 1000)
      }
    } catch {
      toast.error('Нет доступа к микрофону')
    }
  }

  const stopRec = () => {
    try { mrRef.current?.stop() } catch(_) {}
    if (mountedRef.current) setIsRec(false)
    clearInterval(recTimerRef.current)
  }

  const handleVoiceSend = async (blob) => {
    if (!mountedRef.current) return
    const tempId = `vtmp_${Date.now()}`
    addMessage({
      id: tempId,
      role: 'user',
      content: '🎤 Обрабатываю...',
      message_type: 'voice',
      metadata: {},
      created_at: new Date().toISOString()
    })
    setAiTyping(true)
    try {
      const data = await sendVoice(blob)
      if (!mountedRef.current) return
      await reloadHistory()
      if (!mountedRef.current) return
      if (data.tasks_created?.length || data.tasks_updated?.length || data.tasks_deleted?.length) {
        onTasksUpdated?.()
      }
    } catch {
      if (!mountedRef.current) return
      toast.error('Ошибка голосового ввода')
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      if (mountedRef.current) setAiTyping(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !mountedRef.current) return
    const tempId = `ftmp_${Date.now()}`
    addMessage({
      id: tempId,
      role: 'user',
      content: `📎 ${file.name}`,
      message_type: 'file',
      metadata: {},
      created_at: new Date().toISOString()
    })
    setAiTyping(true)
    try {
      const data = await uploadFile(file)
      if (!mountedRef.current) return
      await reloadHistory()
      if (!mountedRef.current) return
      if (data.tasks_created?.length) {
        onTasksUpdated?.()
        toast.success(`Извлечено: ${data.tasks_created.length}`)
      }
    } catch {
      if (!mountedRef.current) return
      toast.error('Ошибка загрузки файла')
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      if (mountedRef.current) setAiTyping(false)
    }
    e.target.value = ''
  }

  const handleClear = async () => {
    try {
      await clearChatHistory()
    } catch (err) {
      console.error('[ChatBox] Clear error:', err)
    } finally {
      if (mountedRef.current) {
        setMessages([])
        setShowClear(false)
        toast.success('История очищена')
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
        <span className="text-sm font-medium">Armanda manager</span>
        {messages.length > 0 && (
          <button
            onClick={() => setShowClear(true)}
            className="ml-auto text-[10px] text-[var(--text3)] hover:text-red-400 cursor-pointer px-1.5 py-0.5 rounded transition-all"
            title="Очистить историю"
          >🗑</button>
        )}
      </div>

      {showClear && (
        <div className="mx-3 mt-2 p-3 bg-red-400/10 border border-red-400/20 rounded-xl flex items-center gap-2">
          <span className="text-xs text-red-400 flex-1">Очистить историю чата?</span>
          <button
            onClick={handleClear}
            className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded cursor-pointer hover:bg-red-400/10"
          >Да</button>
          <button
            onClick={() => setShowClear(false)}
            className="text-xs text-[var(--text3)] cursor-pointer px-2"
          >Нет</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && !isAiTyping && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-3xl mb-3 opacity-40">✦</div>
            <div className="text-sm text-[var(--text2)] mb-1">Ваш AI-планировщик готов</div>
            <div className="text-xs text-[var(--text3)]">Опишите задачу или попросите изменить / удалить</div>
          </div>
        )}
        {messages.map((msg, i) => <Message key={msg.id || i} msg={msg} />)}
        {isAiTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 0 && !isAiTyping && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          {SUGGESTIONS.map((s,i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              className="text-left text-[11px] px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface2)] hover:border-[var(--accent)]/30 transition-all cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Recording bar */}
      {isRecording && (
        <div className="mx-3 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-xs text-red-400 font-mono">
            REC {String(Math.floor(recTime/60)).padStart(2,'0')}:{String(recTime%60).padStart(2,'0')}
          </span>
          <button onClick={stopRec} className="ml-auto text-xs text-red-400 hover:text-red-300 cursor-pointer">Стоп ■</button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-[var(--border)] flex-shrink-0">
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3 py-2 focus-within:border-[var(--accent)]/50 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Напишите о задаче или попросите изменить / удалить..."
              className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text3)] outline-none resize-none min-h-[20px]"
              rows={1}
              disabled={isAiTyping}
            />
          </div>
          <label className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] cursor-pointer transition-all flex-shrink-0">
            📎<input type="file" className="hidden" accept=".txt,.md,.csv,.pdf" onChange={handleFileUpload} />
          </label>
          <button
            onClick={isRecording ? stopRec : startRec}
            className={`p-2 rounded-xl border transition-all flex-shrink-0 cursor-pointer ${
              isRecording
                ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                : 'border-[var(--border)] hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)]'
            }`}
          >🎤</button>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isAiTyping}
            className="p-2 rounded-xl bg-[var(--accent)] hover:bg-[#7c75ff] text-white transition-all flex-shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isAiTyping ? <Spinner size={16} /> : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}