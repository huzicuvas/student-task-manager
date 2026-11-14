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
  user_id: string | null
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
  if (priority === 'high') return 'bg-red-50 text-red-700 ring-1 ring-red-200'
  if (priority === 'medium') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
  return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
}

function getCardStyle(task: Task, today: string) {
  if (task.is_completed) return 'bg-white ring-1 ring-slate-200 opacity-75'
  if (task.due_date < today) return 'bg-red-50/60 ring-1 ring-red-200'
  if (task.due_date === today) return 'bg-orange-50/60 ring-1 ring-orange-200'
  return 'bg-white ring-1 ring-slate-200'
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Guest user — no signup, Supabase gives each browser its own anonymous user
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

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

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Auto guest login — no signup page, each browser gets its own user
  useEffect(() => {
    async function initAuth() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        setUser(data.session.user)
        setAuthLoading(false)
        return
      }

      const { data: anon, error } = await supabase.auth.signInAnonymously()
      if (error) {
        showToast('Could not start guest session. Please refresh.', 'error')
      } else {
        setUser(anon.user ?? null)
      }
      setAuthLoading(false)
    }

    initAuth()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
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

  // Load tasks only for this guest user
  useEffect(() => {
    if (!user) {
      setTasks([])
      setLoading(false)
      return
    }

    async function fetchTasks() {
      setLoading(true)
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true })

      if (error) {
        showToast('Could not load tasks. Please try again.', 'error')
      } else {
        setTasks(data || [])
      }
      setLoading(false)
    }

    fetchTasks()
  }, [user])

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
          user_id: user.id,
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

  const inputStyle =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition'

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-center">Student Task Manager</h1>
          <p className="text-center mt-10 text-slate-500">Loading tasks...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-center">Student Task Manager</h1>
        <p className="text-center mt-2 text-slate-500">Stay on top of your studies, one task at a time.</p>
        <p className="text-center mt-1 text-xs text-slate-400">Guest mode — no signup needed. Your tasks are saved to this browser only.</p>

        <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm ring-1 ring-slate-200 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-indigo-600">{totalTasks}</p>
            <p className="text-slate-500 text-sm mt-1">Total tasks</p>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm ring-1 ring-slate-200 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{completedTasks}</p>
            <p className="text-slate-500 text-sm mt-1">Completed</p>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm ring-1 ring-slate-200 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-red-600">{overdueTasks}</p>
            <p className="text-slate-500 text-sm mt-1">Overdue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 bg-white rounded-2xl p-5 sm:p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Add a new task</h2>
          <p className="text-sm text-slate-500 mt-1">Fill in the details below. Title and due date are required.</p>

          <div className="grid gap-3 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input type="text" placeholder="e.g. Maths assignment" value={title} onChange={(e) => setTitle(e.target.value)} className={inputStyle} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input type="text" placeholder="e.g. Digital Logic" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputStyle} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea placeholder="What needs to be done?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputStyle} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due date *</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')} className={inputStyle}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          {formError && <p className="text-red-600 text-sm mt-3">{formError}</p>}

          <button type="submit" disabled={submitting} className="mt-4 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-2.5 font-medium transition disabled:opacity-50">
            {submitting ? 'Adding...' : '+ Add Task'}
          </button>
        </form>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
            <option value="all">All subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="flex gap-2 bg-white p-1 rounded-full ring-1 ring-slate-200 w-fit">
            {(['all', 'pending', 'completed'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${statusFilter === s ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="mt-6 bg-white rounded-2xl p-10 shadow-sm ring-1 ring-slate-200 text-center">
            <p className="text-lg font-medium text-slate-900">No tasks yet</p>
            <p className="text-slate-500 mt-1">Add your first task above to get started.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:gap-4">
            {filteredTasks.map((task) => {
              const isOverdue = !task.is_completed && today !== '' && task.due_date < today
              const isDueToday = !task.is_completed && today !== '' && task.due_date === today

              return (
                <div key={task.id} className={`rounded-2xl p-5 shadow-sm hover:shadow-md transition ${getCardStyle(task, today)}`}>
                  {editingId === task.id ? (
                    <div className="grid gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">Edit Task</h2>
                      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputStyle} />
                      <input type="text" placeholder="Subject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className={inputStyle} />
                      <textarea placeholder="Description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className={inputStyle} />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className={inputStyle} />
                        <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high')} className={inputStyle}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                      {editError && <p className="text-red-600 text-sm">{editError}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(task.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2 font-medium">Save changes</button>
                        <button onClick={cancelEdit} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-5 py-2 font-medium">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <input type="checkbox" checked={task.is_completed} onChange={() => toggleComplete(task)} className="mt-1 h-5 w-5 shrink-0 accent-indigo-600" />
                          <div className="min-w-0">
                            <h2 className={`text-lg font-semibold text-slate-900 break-words ${task.is_completed ? 'line-through text-slate-400' : ''}`}>
                              {task.title}
                            </h2>
                            {task.subject && <p className="text-sm text-slate-500 mt-0.5">{task.subject}</p>}
                          </div>
                        </div>
                        <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${getPriorityStyle(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>

                      {task.description && <p className="text-slate-600 mt-2 text-sm leading-relaxed break-words">{task.description}</p>}

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${isOverdue ? 'bg-red-100 text-red-700' : isDueToday ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                          Due {new Date(task.due_date).toLocaleDateString()}
                          {isOverdue ? ' · Overdue' : isDueToday ? ' · Due today' : ''}
                        </span>
                      </div>

                      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                        <button onClick={() => startEdit(task)} className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 text-sm font-medium transition">Edit</button>
                        <button onClick={() => handleDelete(task.id)} className="rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 px-4 py-2 text-sm font-medium transition">Delete</button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
