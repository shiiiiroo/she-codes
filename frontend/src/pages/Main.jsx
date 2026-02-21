import React, { useState, useEffect, useCallback } from 'react'
import Calendar from '../components/Calendar'
import ChatBox from '../components/ChatBox'
import { TipsBar, AddTaskForm } from '../components/Widgets'
import { useStore } from '../store'
import { getUndated, getOverdue, getTips } from '../api'

export default function MainPage() {
  const [showAddForm, setShowAddForm] = useState(false)
  const { setUndatedTasks, setOverdueTasks, setTips, setLoadInfo } = useStore()
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
    Promise.all([
      getUndated().then(r => setUndatedTasks(r.data)),
      getOverdue().then(r => setOverdueTasks(r.data)),
      getTips().then(r => { setTips(r.data.tips); setLoadInfo(r.data.load) }),
    ]).catch(console.error)
  }, [])

  useEffect(() => { refresh() }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TipsBar />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--border)]">
          <Calendar key={refreshKey} onAddTask={() => setShowAddForm(true)} onRefresh={refresh} />
        </div>
        <div className="w-[380px] flex-shrink-0 flex flex-col">
          <ChatBox onTasksUpdated={refresh} />
        </div>
      </div>
      {showAddForm && (
        <AddTaskForm
          onClose={() => setShowAddForm(false)}
          onCreated={() => { setShowAddForm(false); refresh() }}
        />
      )}
    </div>
  )
}
