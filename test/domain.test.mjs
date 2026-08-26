import test from 'node:test'
import assert from 'node:assert/strict'
import { Recurrence, taskInput } from '../server/domain.js'

test('weekly recurrence preserves the completion clock and finds the next due time', () => {
  const recurrence = new Recurrence('weekly', 1)
  assert.equal(recurrence.nextDue('2026-08-20T14:30:00.000Z'), '2026-08-27T14:30:00.000Z')
})

test('streak grows only when completion lands within its due window', () => {
  assert.equal(Recurrence.nextStreak({ streak: 3, dueAt: '2026-08-20T10:00:00.000Z', completedAt: '2026-08-20T09:00:00.000Z' }), 4)
  assert.equal(Recurrence.nextStreak({ streak: 3, dueAt: '2026-08-20T10:00:00.000Z', completedAt: '2026-08-22T10:00:00.000Z' }), 1)
})

test('task input defaults to an all-day rhythm while preserving timed opt-in', () => {
  const allDay = taskInput({ title: 'Change sheets', unit: 'weekly', dueAt: '2026-09-04' })
  const timed = taskInput({ title: 'Medication', unit: 'daily', dueAt: '2026-09-04T18:30:00.000Z', allDay: false })
  assert.equal(allDay.allDay, true)
  assert.equal(allDay.dueAt, '2026-09-04T09:00:00.000Z')
  assert.equal(timed.allDay, false)
  assert.equal(timed.dueAt, '2026-09-04T18:30:00.000Z')
})

test('custom recurrence accepts five-field crontab notation and calculates its next due time', () => {
  const task = taskInput({ title: 'Water plants', unit: 'custom', customCron: '0 9 * * 1', dueAt: '2026-08-24T09:00:00.000Z', allDay: false })
  assert.equal(task.recurrence.customCron, '0 9 * * 1')
  assert.equal(task.recurrence.nextDue('2026-08-24T09:00:00.000Z'), '2026-08-31T09:00:00.000Z')
  assert.throws(() => taskInput({ title: 'Nope', unit: 'custom', customCron: 'not cron' }), /valid five-field cron/)
})
