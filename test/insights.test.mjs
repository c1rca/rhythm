import test from 'node:test'
import assert from 'node:assert/strict'
import { householdInsights } from '../server/insights.js'

const day = (date, action = 'completed', task = 'Kitchen reset', taskId = 1) => ({ completed_at: `${date}T10:00:00.000Z`, action, title: task, task_id: taskId })

test('household insights builds a 28-day completion calendar and concise weekly digest from recorded actions', () => {
  const result = householdInsights({
    now: '2026-08-26T12:00:00.000Z',
    tasks: [{ id: 1, title: 'Kitchen reset', unit: 'daily', interval: 1, dueAt: '2026-08-26T09:00:00.000Z' }],
    history: [day('2026-08-26'), day('2026-08-25'), day('2026-08-24'), day('2026-08-23'), day('2026-08-22'), day('2026-08-21'), day('2026-08-20'), day('2026-08-19'), day('2026-08-18'), day('2026-08-17'), day('2026-08-16'), day('2026-08-15'), day('2026-08-14'), day('2026-08-13'), day('2026-08-12'), day('2026-08-11'), day('2026-08-10'), day('2026-08-09'), day('2026-08-08'), day('2026-08-07'), day('2026-08-06'), day('2026-08-05'), day('2026-08-04'), day('2026-08-03'), day('2026-08-02'), day('2026-08-01'), day('2026-07-31'), day('2026-07-30'), day('2026-08-24', 'skipped')]
  })
  assert.equal(result.calendar.length, 28)
  assert.equal(result.calendar.at(-1).completed, 1)
  assert.equal(result.digest.completed, 7)
  assert.equal(result.digest.skipped, 1)
  assert.match(result.digest.summary, /7 completions/)
  assert.equal(result.insights.some(x => /cadence is working/i.test(x)), true)
})

test('household insights flags repeated deferrals and suggests a less demanding cadence only with enough evidence', () => {
  const result = householdInsights({
    now: '2026-08-26T12:00:00.000Z',
    tasks: [{ id: 2, title: 'Water plants', unit: 'daily', interval: 1, dueAt: '2026-08-26T09:00:00.000Z' }],
    history: [day('2026-08-25', 'snoozed', 'Water plants', 2), day('2026-08-24', 'snoozed', 'Water plants', 2), day('2026-08-23', 'skipped', 'Water plants', 2), day('2026-08-22', 'skipped', 'Water plants', 2)]
  })
  assert.equal(result.insights.some(x => /Water plants.*every 2 days/i.test(x)), true)
})
