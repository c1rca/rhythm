const DAY = 86400000
const isoDay = value => new Date(value).toISOString().slice(0, 10)
const calendarDay = (now, offset) => isoDay(new Date(new Date(now).getTime() + offset * DAY))

export function householdInsights({ now = new Date().toISOString(), tasks = [], history = [] }) {
  const today = new Date(now)
  const active = history.filter(entry => !entry.undone_at)
  const calendar = Array.from({ length: 28 }, (_, index) => {
    const date = calendarDay(today, index - 27)
    const entries = active.filter(entry => isoDay(entry.completed_at) === date)
    return { date, completed: entries.filter(entry => entry.action === 'completed').length, skipped: entries.filter(entry => entry.action === 'skipped').length, deferred: entries.filter(entry => entry.action === 'snoozed').length }
  })
  const week = calendar.slice(-7)
  const digest = {
    completed: week.reduce((total, day) => total + day.completed, 0),
    skipped: week.reduce((total, day) => total + day.skipped, 0),
    deferred: week.reduce((total, day) => total + day.deferred, 0)
  }
  digest.summary = `${digest.completed} completion${digest.completed === 1 ? '' : 's'} this week${digest.skipped ? ` · ${digest.skipped} skipped` : ''}${digest.deferred ? ` · ${digest.deferred} deferred` : ''}`
  const insights = []
  for (const task of tasks) {
    const entries = active.filter(entry => entry.task_id === task.id)
    const recent = entries.filter(entry => new Date(entry.completed_at).getTime() >= today.getTime() - 28 * DAY)
    const completed = recent.filter(entry => entry.action === 'completed').length
    const deferrals = recent.filter(entry => entry.action === 'snoozed' || entry.action === 'skipped').length
    if (completed >= 8 && deferrals <= 1) insights.push(`${task.title}: this cadence is working—keep it as is.`)
    if (deferrals >= 3 && deferrals > completed) {
      const nextInterval = Math.max(2, Number(task.interval || 1) * 2)
      insights.push(`${task.title}: ${deferrals} recent skips or deferrals suggest trying every ${nextInterval} days.`)
    }
  }
  if (!insights.length && active.length) insights.push('No change suggested yet—keep logging what actually happens.')
  return { calendar, digest, insights: insights.slice(0, 3) }
}
