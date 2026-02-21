import React, { useState, useEffect, useCallback } from 'react'
import Calendar from '../components/Calendar'
import ChatBox from '../components/ChatBox'
import { TipsBar, AddTaskForm, UnsortedPanel } from '../components/Widgets'
import { useStore } from '../store'
import { getUnsorted, getOverdue, getTips } from '../api'

export default function MainPage() {
  const [showAddForm, setShowAddForm] = useState(false)
  const { setUnsortedTasks, setOverdueTasks, setTips, setLoadInfo } = useStore()
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
    Promise.all([
      getUnsorted().then(r => setUnsortedTasks(r.data)),
      getOverdue().then(r => setOverdueTasks(r.data)),
      getTips().then(r => { setTips(r.data.tips); setLoadInfo(r.data.load) }),
    ]).catch(console.error)
  }, [])

  useEffect(() => { refresh() }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Tips bar */}
      <TipsBar onRefresh={refresh} />

      {/* Main content: Calendar + Chat */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar (left, 60%) */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--border)]">
          <Calendar
            key={refreshKey}
            onAddTask={() => setShowAddForm(true)}
          />
        </div>

        {/* Chat (right, 40%) */}
        <div className="w-[380px] flex-shrink-0 flex flex-col">
          <ChatBox onTasksUpdated={refresh} />
        </div>
      </div>

      {/* Add task modal */}
      {showAddForm && (
        <AddTaskForm
          onClose={() => setShowAddForm(false)}
          onCreated={() => { setShowAddForm(false); refresh() }}
        />
      )}
    </div>
  )
}
