import { CronExpressionParser } from 'cron-parser'

const MS = { daily: 86400000, weekly: 604800000, monthly: 2592000000 }

export class Recurrence {
  constructor(unit = 'weekly', interval = 1, customCron = '') {
    this.unit = unit; this.interval = Number(interval); this.customCron = String(customCron || '').trim()
    if (unit === 'custom') {
      if (this.customCron.split(/\s+/).length !== 5) throw new Error('Choose a valid five-field cron expression.')
      try { CronExpressionParser.parse(this.customCron) } catch { throw new Error('Choose a valid five-field cron expression.') }
      return
    }
    if (!MS[unit] || !Number.isInteger(this.interval) || this.interval < 1) throw new Error('Choose a valid recurrence')
  }
  nextDue(completedAt) {
    if (this.unit === 'custom') return CronExpressionParser.parse(this.customCron, { currentDate: completedAt, tz: 'UTC' }).next().toISOString()
    return new Date(new Date(completedAt).getTime() + MS[this.unit] * this.interval).toISOString()
  }
  label() { return this.unit === 'custom' ? this.customCron : `Every ${this.interval === 1 ? '' : `${this.interval} `}${this.unit.replace(/ly$/, '')}${this.interval === 1 ? 'y' : 's'}` }
  static nextStreak({ streak = 0, dueAt, completedAt }) { return new Date(completedAt).getTime() <= new Date(dueAt).getTime() + 86400000 ? streak + 1 : 1 }
}
const validTimezone = (timezone) => {
  try { Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return timezone } catch { throw new Error('Choose a valid household timezone.') }
}
const zonedToUtc = (local, timezone) => {
  const [date, time = '09:00'] = local.split('T'), [year, month, day] = date.split('-').map(Number), [hour, minute] = time.split(':').map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  let instant = wall
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(instant)).reduce((out, part) => ({ ...out, [part.type]: part.value }), {})
    instant += wall - Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
  }
  return new Date(instant).toISOString()
}
export const taskInput = (body) => {
  const title = String(body.title || '').trim().slice(0, 100)
  if (!title) throw new Error('A task name makes it real.')
  const recurrence = new Recurrence(body.unit, Number(body.interval || 1), body.customCron)
  const allDay = body.allDay !== false, timezone = validTimezone(String(body.timezone || 'UTC'))
  const dueAt = body.dueAt ? (allDay && /^\d{4}-\d{2}-\d{2}$/.test(body.dueAt) ? zonedToUtc(`${body.dueAt}T09:00`, timezone) : new Date(body.dueAt).toISOString()) : new Date().toISOString()
  return { title, emoji: String(body.emoji || '✨').slice(0, 8), color: String(body.color || 'violet').slice(0, 20), notes: String(body.notes || '').slice(0, 500), recurrence, dueAt, allDay, timezone, channels: body.channels || { inApp: true, browser: false, gotify: false, email: false, sms: false } }
}
