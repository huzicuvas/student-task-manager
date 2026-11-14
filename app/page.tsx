'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Task = {
  id: string
  title: string
  subject: string | null
  description: string | null
  due_date: string
  priority: 'low' | 'medium' | 'high'
  is_completed: boolean
  created_at: string
}

function getTodayString() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPriorityStyle(priority: string) {
  if (priority === 'high') return 'bg-red-100 text-red-800'
  if (priority === 'medium') return 'bg-yellow-100 text-yellow-800'
  return 'bg-green-100 text-green-800'
}

function getCardStyle(task: Task, today: string) {
  if (task.is_completed) return 'bg-white'
  if (task.due_date < today) return 'bg-red-50 border border-red-300'
  if (task.due_date === today) return 'bg-orange-50 border border-orange-300'
  return 'bg-white'
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [editError, setEditError] = useState('')

  const [subjectFilter, setSubjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')

const [today, setToday] = useState('')

useEffect(() => {
  setToday(getTodayString())
}, [])
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.is_completed).length
  const overdueTasks = tasks.filter((t) => !t.is_completed && t.due_date < today).length

  const subjects = [...new Set(tasks.map((t) => t.subject).filter(Boolean))] as string[]

  const filteredTasks = tasks.filter((task) => {
    if (subjectFilter !== 'all' && task.subject !== subjectFilter) return false
    if (statusFilter === 'pending' && task.is_completed) return false
    if (statusFilter === 'completed' && !task.is_completed) return false
    return true
  })

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    async function fetchTasks() {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true })

      if (error) {
        showToast('Could not load tasks. Please try again.', 'error')
      } else {
        setTasks(data || [])
      }
      setLoading(false)
    }

    fetchTasks()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim() || !dueDate) {
      setFormError('Title and due date are required')
      return
    }

    setFormError('')
    setSubmitting(true)

    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          title: title.trim(),
          subject: subject.trim() || null,
          description: description.trim() || null,
          due_date: dueDate,
          priority: priority,
        },
      ])
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      showToast('Could not add task. Please try again.', 'error')
      return
    }

    if (data) {
      setTasks((prev) =>
        [...prev, data].sort((a, b) => a.due_date.localeCompare(b.due_date))
      )
      showToast('Task added successfully')
    }

    setTitle('')
    setSubject('')
    setDescription('')
    setDueDate('')
    setPriority('medium')
  }

  function startEdit(task: Task) {
    setEditingId(task.id)
    setEditTitle(task.title)
    setEditSubject(task.subject || '')
    setEditDescription(task.description || '')
    setEditDueDate(task.due_date)
    setEditPriority(task.priority)
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function saveEdit(taskId: string) {
    if (!editTitle.trim() || !editDueDate) {
      setEditError('Title and due date are required')
      return
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({
        title: editTitle.trim(),
        subject: editSubject.trim() || null,
        description: editDescription.trim() || null,
        due_date: editDueDate,
        priority: editPriority,
      })
      .eq('id', taskId)
      .select()
      .single()

    if (error) {
      showToast('Could not update task. Please try again.', 'error')
      return
    }

    if (data) {
      setTasks((prev) =>
        prev
          .map((t) => (t.id === taskId ? data : t))
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
      )
      showToast('Task updated successfully')
    }

    setEditingId(null)
  }

  async function toggleComplete(task: Task) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ is_completed: !task.is_completed })
      .eq('id', task.id)
      .select()
      .single()

    if (error) {
      showToast('Could not update task. Please try again.', 'error')
      return
    }

    if (data) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data : t)))
      showToast(data.is_completed ? 'Task marked as completed' : 'Task marked as pending')
    }
  }

  async function handleDelete(taskId: string) {
    const confirmed = window.confirm('Are you sure?')
    if (!confirmed) return

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      showToast('Could not delete task. Please try again.', 'error')
      return
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    showToast('Task deleted successfully')

    if (editingId === taskId) {
      setEditingId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-center">Student Task Manager</h1>
        <p className="text-center mt-10 text-gray-500">Loading tasks...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm sm:text-base ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      <h1 className="text-2xl sm:text-3xl font-bold text-center">Student Task Manager</h1>

      <div className="max-w-3xl mx-auto mt-6 grid grid-cols-3 gap-2 sm:gap-4 text-center">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <p className="text-xl sm:text-2xl font-bold">{totalTasks}</p>
          <p className="text-gray-600 text-sm sm:text-base">Total</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <p className="text-xl sm:text-2xl font-bold text-green-600">{completedTasks}</p>
          <p className="text-gray-600 text-sm sm:text-base">Completed</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <p className="text-xl sm:text-2xl font-bold text-red-600">{overdueTasks}</p>
          <p className="text-gray-600 text-sm sm:text-base">Overdue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto mt-6 sm:mt-8 bg-white p-4 sm:p-5 rounded-lg shadow grid gap-3">
        <h2 className="text-xl font-semibold">Add Task</h2>

        <input type="text" placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} className="border rounded px-3 py-2" />
        <input type="text" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="border rounded px-3 py-2" />
        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="border rounded px-3 py-2" />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border rounded px-3 py-2" />

        <select value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')} className="border rounded px-3 py-2">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

        <button type="submit" disabled={submitting} className="bg-black text-white rounded px-4 py-2 font-medium disabled:opacity-50">
          {submitting ? 'Adding...' : 'Add Task'}
        </button>
      </form>

      <div className="max-w-3xl mx-auto mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
        <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="border rounded px-3 py-2 bg-white">
          <option value="all">All subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <button onClick={() => setStatusFilter('all')} className={`rounded px-4 py-2 font-medium ${statusFilter === 'all' ? 'bg-black text-white' : 'bg-white border'}`}>All</button>
          <button onClick={() => setStatusFilter('pending')} className={`rounded px-4 py-2 font-medium ${statusFilter === 'pending' ? 'bg-black text-white' : 'bg-white border'}`}>Pending</button>
          <button onClick={() => setStatusFilter('completed')} className={`rounded px-4 py-2 font-medium ${statusFilter === 'completed' ? 'bg-black text-white' : 'bg-white border'}`}>Completed</button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <p className="text-center mt-10 text-gray-500">No tasks yet</p>
      ) : (
        <div className="max-w-3xl mx-auto mt-4 grid gap-4">
          {filteredTasks.map((task) => {
            const isOverdue = !task.is_completed && task.due_date < today
            const isDueToday = !task.is_completed && task.due_date === today

            return (
              <div key={task.id} className={`p-4 sm:p-5 rounded-lg shadow ${getCardStyle(task, today)}`}>
                {editingId === task.id ? (
                  <div className="grid gap-3">
                    <h2 className="text-lg font-semibold">Edit Task</h2>
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="border rounded px-3 py-2 bg-white" />
                    <input type="text" placeholder="Subject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="border rounded px-3 py-2 bg-white" />
                    <textarea placeholder="Description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="border rounded px-3 py-2 bg-white" />
                    <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="border rounded px-3 py-2 bg-white" />
                    <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high')} className="border rounded px-3 py-2 bg-white">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    {editError && <p className="text-red-600 text-sm">{editError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(task.id)} className="bg-black text-white rounded px-4 py-2 font-medium">Save</button>
                      <button onClick={cancelEdit} className="bg-gray-200 rounded px-4 py-2 font-medium">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={task.is_completed} onChange={() => toggleComplete(task)} className="mt-1.5 h-5 w-5 shrink-0" />
                        <h2 className={`text-lg sm:text-xl font-semibold break-words ${task.is_completed ? 'line-through text-gray-400' : ''}`}>{task.title}</h2>
                      </div>
                      <span className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium ${getPriorityStyle(task.priority)}`}>{task.priority}</span>
                    </div>

                    {task.subject && <p className="text-gray-600 mt-1">Subject: {task.subject}</p>}
                    {task.description && <p className="text-gray-600 mt-1 break-words">{task.description}</p>}

                    <p className={`mt-1 ${isOverdue ? 'text-red-600 font-medium' : isDueToday ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                      Due date: {new Date(task.due_date).toLocaleDateString()}
                      {isOverdue ? ' — Overdue' : isDueToday ? ' — Due today' : ''}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => startEdit(task)} className="bg-gray-200 rounded px-4 py-2 font-medium">Edit</button>
                      <button onClick={() => handleDelete(task.id)} className="bg-red-600 text-white rounded px-4 py-2 font-medium">Delete</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
