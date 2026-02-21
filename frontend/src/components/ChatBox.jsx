import React, { useState, useRef, useEffect } from 'react'
import { sendChat, sendVoice, uploadFile, getChatHistory } from '../api'
import { useStore } from '../store'
import { Spinner } from './UI'
import toast from 'react-hot-toast'

const SUGGESTIONS = [
  'Что мне сделать сегодня?',
  'Я перегружен, помоги расставить приоритеты',
  'Запланируй встречу завтра в 15:00',
  'Какие задачи просрочены?',
  'Как улучшить мою продуктивность?',
]

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const meta = msg.metadata || {}

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} fade-in`}>
      <div className={`max-w-[85%] ${isUser ? '' : 'w-full'}`}>
        {/* Avatar for AI */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[10px] text-[var(--accent)]">✦</div>
            <span className="text-[10px] text-[var(--text3)] font-mono">TaskFlow AI</span>
          </div>
        )}

        <div className={`rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--accent)] text-white rounded-br-sm'
            : 'bg-[var(--surface2)] text-[var(--text)] rounded-bl-sm border border-[var(--border)]'
        }`}>
          {msg.content}
        </div>

        {/* Tasks created notification */}
        {meta.tasks_to_create?.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {meta.tasks_to_create.slice(0, 3).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] bg-[var(--accent)]/8 border border-[var(--accent)]/20 rounded-lg px-2.5 py-1.5">
                <span className="text-[var(--accent)]">✓</span>
                <span className="text-[var(--text2)] truncate">{t.title}</span>
                <span className="ml-auto text-[var(--text3)] font-mono">{t.category}</span>
              </div>
            ))}
          </div>
        )}

        {/* Load warning */}
        {meta.load_warning && (
          <div className="mt-2 text-[11px] bg-amber-400/10 border border-amber-400/20 text-amber-300 rounded-lg px-2.5 py-1.5">
            ⚠️ {meta.load_warning}
          </div>
        )}

        {/* Tips */}
        {meta.tips?.map((tip, i) => (
          <div key={i} className="mt-1.5 text-[11px] bg-emerald-400/8 border border-emerald-400/20 text-emerald-300 rounded-lg px-2.5 py-1.5">
            💡 {tip}
          </div>
        ))}

        {/* Transcript badge for voice */}
        {msg.message_type === 'voice' && (
          <div className="mt-1 text-[10px] text-[var(--text3)] font-mono flex items-center gap-1">
            🎤 Голосовое сообщение
          </div>
        )}

        <div className="text-[9px] text-[var(--text3)] mt-1 font-mono">
          {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
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
            style={{ animation: `bounce 1.2s infinite`, animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

export default function ChatBox({ onTasksUpdated }) {
  const { messages, setMessages, addMessage, isAiTyping, setAiTyping } = useStore()
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const recordTimerRef = useRef(null)

  // Load history on mount
  // ChatBox.jsx

useEffect(() => {
  const initChat = async () => {
    try {
      // 1. Делаем запрос к API
      const response = await getChatHistory();
      
      // 2. В axios данные приходят в поле .data
      // На бэкенде в get_history ты возвращаешь список: return [msg_to_dict(m) for m in msgs]
      const history = response.data;

      if (Array.isArray(history)) {
        console.log("История загружена:", history.length, "сообщений");
        setMessages(history); // ЗАПИСЫВАЕМ В STORE
      }
    } catch (error) {
      console.error("Ошибка загрузки истории чата:", error);
    }
  };

  initChat();
}, []); // Пустые скобки — сработает только 1 раз при обновлении страницы (F5)
useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAiTyping])

  const handleSend = async (text = input.trim()) => {
  if (!text) return
  const tempId = Date.now()
  setInput('')
  
  const userMsg = {
    id: tempId,
    role: 'user',
    content: text,
    message_type: 'text',
    metadata: {},
    created_at: new Date().toISOString(),
  }
  addMessage(userMsg)
  setAiTyping(true)

  try {
    const res = await sendChat(text)
    const data = res.data || res 

    const aiMsg = {
      id: Date.now() + 1,
      role: 'assistant',
      // ИСПРАВЛЕНИЕ: если ИИ прислал пустое сообщение, пишем системную фразу
      content: data.message || "Задачи обновлены 👍", 
      message_type: 'text',
      metadata: data,
      created_at: new Date().toISOString(),
    }
    
    addMessage(aiMsg)

    if (data.tasks_created?.length > 0 || data.tasks_updated?.length > 0) {
      // Вызываем обновление календаря
      onTasksUpdated?.() 
      
      if (data.tasks_created?.length > 0) toast.success(`Создано: ${data.tasks_created.length}`)
      if (data.tasks_updated?.length > 0) toast.success(`Обновлено: ${data.tasks_updated.length}`)
    }

  } catch (e) {
    toast.error("Ошибка связи с ИИ")
  } finally {
    setAiTyping(false)
  }
}

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await handleVoiceSend(blob)
      }
      mr.start()
      setIsRecording(true)
      setRecordingTime(0)
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      toast.error('Нет доступа к микрофону')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    clearInterval(recordTimerRef.current)
  }

  const handleVoiceSend = async (blob) => {
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: '🎤 Голосовое сообщение...',
      message_type: 'voice',
      metadata: {},
      created_at: new Date().toISOString(),
    }
    addMessage(userMsg)
    setAiTyping(true)

    try {
      const res = await sendVoice(blob)
      const data = res.data || res

      // Update user message with transcript
      userMsg.content = `🎤 ${res.transcript || 'Голосовое сообщение'}`
      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.message,
        message_type: 'text',
        metadata: res,
        created_at: new Date().toISOString(),
      }
      addMessage(aiMsg)

      if (data.tasks_created?.length > 0 || data.tasks_updated?.length > 0) {
        onTasksUpdated?.()
        toast.success(`Задачи обработаны (голос)`)
      }
    } catch {
      toast.error('Ошибка обработки голоса')
    } finally {
      setAiTyping(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: `📎 Загружен файл: ${file.name}`,
      message_type: 'file',
      metadata: {},
      created_at: new Date().toISOString(),
    }
    addMessage(userMsg)
    setAiTyping(true)
    try {
      const res = await uploadFile(file)
      const data = res.data || res

      addMessage({
        id: Date.now() + 1,
        role: 'assistant',
        content: res.message,
        message_type: 'text',
        metadata: res,
        created_at: new Date().toISOString(),
      })
     if (data.tasks_created?.length > 0 || data.tasks_updated?.length > 0) {
        onTasksUpdated?.()
        toast.success(`Файл проанализирован, задачи обновлены`)
      }
    } catch {
      toast.error('Ошибка загрузки файла')
    } finally {
      setAiTyping(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
        <span className="text-sm font-medium">ИИ-помощник</span>
        <span className="ml-auto text-[10px] font-mono text-[var(--text3)] bg-[var(--surface2)] px-2 py-0.5 rounded">Claude</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-3xl mb-3">✦</div>
            <div className="text-sm text-[var(--text2)] mb-1">Ваш AI-планировщик готов</div>
            <div className="text-xs text-[var(--text3)]">Опишите задачи текстом или голосом</div>
          </div>
        )}
        {messages.map(msg => <Message key={msg.id} msg={msg} />)}
        {isAiTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length === 0 && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          {SUGGESTIONS.map((s, i) => (
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

      {/* Recording indicator */}
      {isRecording && (
        <div className="mx-3 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-xs text-red-400 font-mono">REC {String(Math.floor(recordingTime/60)).padStart(2,'0')}:{String(recordingTime%60).padStart(2,'0')}</span>
          <button onClick={stopRecording} className="ml-auto text-xs text-red-400 hover:text-red-300 cursor-pointer">Стоп ■</button>
        </div>
      )}

      {/* Input area */}
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
              placeholder="Напишите о задаче..."
              className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text3)] outline-none resize-none min-h-[20px]"
              rows={1}
              disabled={isAiTyping}
            />
          </div>

          {/* File upload */}
          <label className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] cursor-pointer transition-all flex-shrink-0" title="Прикрепить файл">
            📎
            <input type="file" className="hidden" accept=".txt,.md,.csv,.pdf" onChange={handleFileUpload} />
          </label>

          {/* Voice button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2 rounded-xl border transition-all flex-shrink-0 cursor-pointer ${
              isRecording
                ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                : 'border-[var(--border)] hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)]'
            }`}
            title={isRecording ? 'Остановить запись' : 'Голосовое сообщение'}
          >
            🎤
          </button>

          {/* Send */}
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
