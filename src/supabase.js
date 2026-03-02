import { createClient } from '@supabase/supabase-js'

// ─── Supabase client ──────────────────────────────────────────────────────────
// Values come from .env.local (or Vercel environment variables in production)
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null

// Helper — true when Supabase is configured
export const dbReady = () => !!supabase

// ─── USERS ───────────────────────────────────────────────────────────────────
export async function dbGetUsers() {
  if (!supabase) return null
  const { data, error } = await supabase.from('users').select('*').order('id')
  if (error) { console.error('dbGetUsers:', error); return null }
  return data.map(dbToUser)
}

export async function dbUpdateUser(id, fields) {
  if (!supabase) return
  const row = userToDb(fields)
  const { error } = await supabase.from('users').update(row).eq('id', id)
  if (error) console.error('dbUpdateUser:', error)
}

export async function dbInsertUser(user) {
  if (!supabase) return null
  const row = userToDb(user)
  const { data, error } = await supabase.from('users').insert([row]).select().single()
  if (error) { console.error('dbInsertUser:', error); return null }
  return dbToUser(data)
}

export async function dbDeleteUser(id) {
  if (!supabase) return
  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) console.error('dbDeleteUser:', error)
}

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
export async function dbGetClients() {
  if (!supabase) return null
  const { data, error } = await supabase.from('clients').select('*').order('id')
  if (error) { console.error('dbGetClients:', error); return null }
  return data.map(dbToClient)
}

export async function dbUpsertClient(client) {
  if (!supabase) return null
  const row = clientToDb(client)
  const { data, error } = await supabase
    .from('clients').upsert([row], { onConflict: 'id' }).select().single()
  if (error) { console.error('dbUpsertClient:', error); return null }
  return dbToClient(data)
}

export async function dbDeleteClient(id) {
  if (!supabase) return
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) console.error('dbDeleteClient:', error)
}

// ─── CONTENT ─────────────────────────────────────────────────────────────────
export async function dbGetContent() {
  if (!supabase) return null
  const { data, error } = await supabase.from('content').select('*').order('id')
  if (error) { console.error('dbGetContent:', error); return null }
  return data.map(dbToContent)
}

export async function dbUpsertContent(item) {
  if (!supabase) return null
  const row = contentToDb(item)
  const { data, error } = await supabase
    .from('content').upsert([row], { onConflict: 'id' }).select().single()
  if (error) { console.error('dbUpsertContent:', error); return null }
  return dbToContent(data)
}

export async function dbDeleteContent(id) {
  if (!supabase) return
  const { error } = await supabase.from('content').delete().eq('id', id)
  if (error) console.error('dbDeleteContent:', error)
}

// ─── CALENDAR ────────────────────────────────────────────────────────────────
export async function dbGetCalendar() {
  if (!supabase) return null
  const { data, error } = await supabase.from('calendar').select('*').order('id')
  if (error) { console.error('dbGetCalendar:', error); return null }
  return data.map(dbToCalendar)
}

export async function dbUpsertCalendar(cal) {
  if (!supabase) return null
  const row = calendarToDb(cal)
  const { data, error } = await supabase
    .from('calendar').upsert([row], { onConflict: 'id' }).select().single()
  if (error) { console.error('dbUpsertCalendar:', error); return null }
  return dbToCalendar(data)
}

// ─── LEAVES ──────────────────────────────────────────────────────────────────
export async function dbGetLeaves() {
  if (!supabase) return null
  const { data, error } = await supabase.from('leaves').select('*').order('id')
  if (error) { console.error('dbGetLeaves:', error); return null }
  return data.map(dbToLeave)
}

export async function dbUpsertLeave(leave) {
  if (!supabase) return null
  const row = leaveToDb(leave)
  const { data, error } = await supabase
    .from('leaves').upsert([row], { onConflict: 'id' }).select().single()
  if (error) { console.error('dbUpsertLeave:', error); return null }
  return dbToLeave(data)
}

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
export async function dbGetAttendance() {
  if (!supabase) return null
  const { data, error } = await supabase.from('attendance').select('*').order('date')
  if (error) { console.error('dbGetAttendance:', error); return null }
  return data.map(dbToAttendance)
}

export async function dbUpsertAttendance(rec) {
  if (!supabase) return null
  const row = attendanceToDb(rec)
  const { data, error } = await supabase
    .from('attendance').upsert([row], { onConflict: 'user_id,date' }).select().single()
  if (error) { console.error('dbUpsertAttendance:', error); return null }
  return dbToAttendance(data)
}

// ─── MESSAGES ─────────────────────────────────────────────────────────────────
export async function dbGetMessages() {
  if (!supabase) return null
  const { data, error } = await supabase.from('messages').select('*').order('id')
  if (error) { console.error('dbGetMessages:', error); return null }
  return data.map(dbToMessage)
}

export async function dbInsertMessage(msg) {
  if (!supabase) return null
  const row = messageToDb(msg)
  const { data, error } = await supabase.from('messages').insert([row]).select().single()
  if (error) { console.error('dbInsertMessage:', error); return null }
  return dbToMessage(data)
}

// ─── PLANNER EVENTS ──────────────────────────────────────────────────────────
export async function dbGetPlannerEvents(userId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('planner_events').select('*').eq('user_id', userId).order('date')
  if (error) { console.error('dbGetPlannerEvents:', error); return null }
  return data.map(dbToPlannerEvent)
}

export async function dbUpsertPlannerEvent(ev) {
  if (!supabase) return null
  const row = plannerEventToDb(ev)
  const { data, error } = await supabase
    .from('planner_events').upsert([row], { onConflict: 'id' }).select().single()
  if (error) { console.error('dbUpsertPlannerEvent:', error); return null }
  return dbToPlannerEvent(data)
}

export async function dbDeletePlannerEvent(id) {
  if (!supabase) return
  const { error } = await supabase.from('planner_events').delete().eq('id', id)
  if (error) console.error('dbDeletePlannerEvent:', error)
}

// ─── REALTIME ────────────────────────────────────────────────────────────────
// Subscribe to new messages in real-time
export function subscribeToMessages(callback) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('messages-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
      payload => callback(dbToMessage(payload.new))
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ─── Field mappers: DB snake_case ↔ App camelCase ─────────────────────────────

function dbToUser(r) {
  return {
    id: r.id, name: r.name, username: r.username, displayName: r.display_name,
    password: r.password, role: r.role, avatar: r.avatar, email: r.email || ''
  }
}
function userToDb(u) {
  const row = {}
  if (u.id)          row.id           = u.id
  if (u.name)        row.name         = u.name
  if (u.username)    row.username     = u.username
  if (u.displayName !== undefined) row.display_name = u.displayName
  if (u.password)    row.password     = u.password
  if (u.role)        row.role         = u.role
  if (u.avatar)      row.avatar       = u.avatar
  if (u.email !== undefined) row.email = u.email
  return row
}

function dbToClient(r) {
  return {
    id: r.id, name: r.name, contact: r.contact, email: r.email, phone: r.phone,
    services: r.services || [], status: r.status, onboarded: r.onboarded,
    socialAccess: r.social_access || {}, enquiryDate: r.enquiry_date,
    dealDate: r.deal_date
  }
}
function clientToDb(c) {
  return {
    id: c.id, name: c.name, contact: c.contact, email: c.email, phone: c.phone,
    services: c.services, status: c.status, onboarded: c.onboarded,
    social_access: c.socialAccess, enquiry_date: c.enquiryDate, deal_date: c.dealDate
  }
}

function dbToContent(r) {
  return {
    id: r.id, clientId: r.client_id, title: r.title, execCaption: r.exec_caption,
    adminCaption: r.admin_caption, adminComment: r.admin_comment, status: r.status,
    scheduledDate: r.scheduled_date, scheduledTime: r.scheduled_time,
    execId: r.exec_id, mediaType: r.media_type, mediaName: r.media_name,
    mediaDataUrl: r.media_data_url, createdAt: r.created_at, postedAt: r.posted_at
  }
}
function contentToDb(c) {
  return {
    id: c.id, client_id: c.clientId, title: c.title, exec_caption: c.execCaption,
    admin_caption: c.adminCaption, admin_comment: c.adminComment, status: c.status,
    scheduled_date: c.scheduledDate, scheduled_time: c.scheduledTime,
    exec_id: c.execId, media_type: c.mediaType, media_name: c.mediaName,
    media_data_url: c.mediaDataUrl, created_at: c.createdAt, posted_at: c.postedAt
  }
}

function dbToCalendar(r) {
  return {
    id: r.id, clientId: r.client_id, month: r.month, posts: r.posts || [],
    dates: r.dates || [], status: r.status, createdBy: r.created_by,
    approvedBy: r.approved_by
  }
}
function calendarToDb(c) {
  return {
    id: c.id, client_id: c.clientId, month: c.month, posts: c.posts,
    dates: c.dates || [], status: c.status, created_by: c.createdBy,
    approved_by: c.approvedBy
  }
}

function dbToLeave(r) {
  return {
    id: r.id, userId: r.user_id, reason: r.reason, from: r.from_date,
    to: r.to_date, status: r.status, appliedOn: r.applied_on
  }
}
function leaveToDb(l) {
  return {
    id: l.id, user_id: l.userId, reason: l.reason, from_date: l.from,
    to_date: l.to, status: l.status, applied_on: l.appliedOn
  }
}

function dbToAttendance(r) {
  return { userId: r.user_id, date: r.date, login: r.login_time, logout: r.logout_time }
}
function attendanceToDb(a) {
  return { user_id: a.userId, date: a.date, login_time: a.login, logout_time: a.logout }
}

function dbToMessage(r) {
  return { id: r.id, fromId: r.from_id, toId: r.to_id, text: r.text, time: r.time, date: r.date }
}
function messageToDb(m) {
  const row = { from_id: m.fromId, to_id: String(m.toId), text: m.text, time: m.time, date: m.date }
  if (m.id && typeof m.id === 'number' && m.id < 1e12) row.id = m.id
  return row
}

function dbToPlannerEvent(r) {
  return { id: r.id, userId: r.user_id, title: r.title, date: r.date, startHour: r.start_hour, endHour: r.end_hour, color: r.color }
}
function plannerEventToDb(e) {
  const row = { user_id: e.userId, title: e.title, date: e.date, start_hour: e.startHour, end_hour: e.endHour, color: e.color }
  if (e.id && typeof e.id === 'number' && e.id < 1e12) row.id = e.id
  return row
}
