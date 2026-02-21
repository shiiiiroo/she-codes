import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Tasks
export const getTasks = (view, date, category, status) =>
  api.get('/tasks/', { params: { view, date_str: date, category, status } })

export const getUnsorted = () => api.get('/tasks/unsorted')
export const getOverdue = () => api.get('/tasks/overdue')
export const getTips = () => api.get('/tasks/tips')
export const getLoad = (date) => api.get(`/tasks/load/${date}`)

export const createTask = (data) => api.post('/tasks/', data)
export const updateTask = (id, data) => api.patch(`/tasks/${id}`, data)
export const completeTask = (id) => api.post(`/tasks/${id}/complete`)
export const postponeTask = (id, newDate) => api.post(`/tasks/${id}/postpone`, null, { params: { new_date: newDate } })
export const toggleSubtask = (id, idx) => api.patch(`/tasks/${id}/subtasks/${idx}`)
export const deleteTask = (id) => api.delete(`/tasks/${id}`)

// AI
export const getChatHistory = () => api.get('/ai/history')

export const sendChat = async (message) => {
  const form = new FormData()
  form.append('message', message)
  const res = await api.post('/ai/chat', form)
  return res.data
}

export const sendVoice = async (audioBlob) => {
  const form = new FormData()
  form.append('audio', audioBlob, 'audio.webm')
  const res = await api.post('/ai/voice', form)
  return res.data
}

export const uploadFile = async (file) => {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/ai/upload-file', form)
  return res.data
}

// Profile
export const getProfile = () => api.get('/profile/')
export const updateProfile = (data) => api.patch('/profile/', data)
export const getMemories = () => api.get('/profile/memories')
export const deleteMemory = (id) => api.delete(`/profile/memories/${id}`)

// Stats
export const getStatsOverview = () => api.get('/stats/overview')
export const getDailyStats = (days) => api.get('/stats/daily', { params: { days } })
export const getHeatmap = (year) => api.get('/stats/heatmap', { params: { year } })
