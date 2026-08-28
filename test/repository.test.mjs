import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SchedulerRepository } from '../server/repository.js'
import { taskInput } from '../server/domain.js'

const dbPath = '/tmp/scheduler-preferences-test.db'
const sampleTask = { title: 'Delete me', emoji: '🗑️', color: 'violet', notes: '', recurrence: { unit: 'weekly', interval: 1 }, dueAt: '2026-08-26T12:00:00.000Z', channels: { inApp: true } }

test('saved notification destinations override deployment defaults', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  assert.equal(repo.preference('emailTo', 'default@example.com'), 'default@example.com')
  repo.setPreference('emailTo', 'family@example.com')
  assert.equal(repo.preference('emailTo', 'default@example.com'), 'family@example.com')
  fs.rmSync(dbPath, { force: true })
})

test('completing a daily rhythm twice on the same day is idempotent for its streak', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  const task = repo.create({ ...sampleTask, unit: 'daily', recurrence: { unit: 'daily', interval: 1 }, dueAt: '2026-08-26T09:00:00.000Z' })
  repo.complete(task.id, '2026-08-26T12:00:00.000Z', '2026-08-27T12:00:00.000Z', 1)
  const repeat = repo.complete(task.id, '2026-08-26T18:00:00.000Z', '2026-08-27T18:00:00.000Z', 2)
  assert.equal(repeat.streak, 1)
  assert.equal(repo.history(task.id).length, 1)
  fs.rmSync(dbPath, { force: true })
})

test('completion history preserves skip and snooze actions without advancing a streak', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  const task = repo.create(sampleTask)
  repo.recordAction(task.id, 'skipped', '2026-08-26T12:00:00.000Z', 'Not home')
  repo.recordAction(task.id, 'snoozed', '2026-08-26T13:00:00.000Z', 'Tonight')
  assert.deepEqual(repo.history(task.id).map(x => x.action), ['snoozed', 'skipped'])
  assert.equal(repo.get(task.id).streak, 0)
  fs.rmSync(dbPath, { force: true })
})

test('undoing the newest action restores the prior due time and keeps an audit record', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  const task = repo.create(sampleTask)
  const action = repo.applyAction(task.id, 'snoozed', { dueAt: '2026-08-27T12:00:00.000Z' })
  const restored = repo.undoAction(task.id, action.id)
  assert.equal(restored.dueAt, task.dueAt)
  assert.ok(repo.history(task.id)[0].undone_at)
  fs.rmSync(dbPath, { force: true })
})

test('skipping is durable and undo restores the exact scheduled instant', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  const task = repo.create(sampleTask)
  const action = repo.applyAction(task.id, 'skipped', { dueAt: '2026-09-02T12:00:00.000Z' })
  assert.equal(repo.get(task.id).dueAt, '2026-09-02T12:00:00.000Z')
  const restored = repo.undoAction(task.id, action.id)
  assert.equal(restored.dueAt, task.dueAt)
  assert.equal(repo.history(task.id)[0].action, 'skipped')
  fs.rmSync(dbPath, { force: true })
})


test('custom cron recurrence persists with the rhythm', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  const task = repo.create(taskInput({ title: 'Cron', unit: 'custom', customCron: '0 9 * * 1', dueAt: '2026-08-26' }))
  assert.equal(repo.get(task.id).customCron, '0 9 * * 1')
  fs.rmSync(dbPath, { force: true })
})

test('deleting one history entry preserves the rhythm and other history', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  const task = repo.create(sampleTask)
  repo.recordAction(task.id, 'skipped')
  repo.recordAction(task.id, 'snoozed')
  const [newest] = repo.history(task.id)
  assert.equal(repo.deleteHistory(task.id, newest.id), true)
  assert.equal(repo.get(task.id).id, task.id)
  assert.equal(repo.history(task.id).length, 1)
  fs.rmSync(dbPath, { force: true })
})


test('deleting a completed history entry refreshes the stored streak', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  const task = repo.create(sampleTask)
  repo.complete(task.id, '2026-08-26T12:00:00.000Z', '2026-09-02T12:00:00.000Z', 2)
  const [completion] = repo.history(task.id)
  repo.deleteHistory(task.id, completion.id)
  assert.equal(repo.get(task.id).streak, 1)
  fs.rmSync(dbPath, { force: true })
})

test('deleting a task removes its history and notification records atomically', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  const task = repo.create(sampleTask)
  repo.complete(task.id, '2026-08-26T12:00:00.000Z', '2026-09-02T12:00:00.000Z', 1)
  repo.markSent(task.id, 'gotify', task.dueAt)
  assert.equal(repo.delete(task.id), true)
  assert.equal(repo.get(task.id), undefined)
  assert.deepEqual(repo.history(task.id), [])
  assert.equal(repo.db.prepare('SELECT count(*) AS count FROM sent_notifications WHERE task_id=?').get(task.id).count, 0)
  fs.rmSync(dbPath, { force: true })
})

test('all-day scheduling is anchored to the household timezone rather than UTC midnight', () => {
  const task = taskInput({ ...sampleTask, allDay: true, dueAt: '2026-08-26', timezone: 'America/Los_Angeles' })
  assert.equal(task.dueAt, '2026-08-26T16:00:00.000Z')
  assert.equal(task.timezone, 'America/Los_Angeles')
})

test('timed scheduling retains its explicit instant and validates the household timezone', () => {
  const task = taskInput({ ...sampleTask, allDay: false, dueAt: '2026-08-26T09:30:00-07:00', timezone: 'America/Los_Angeles' })
  assert.equal(task.dueAt, '2026-08-26T16:30:00.000Z')
  assert.throws(() => taskInput({ ...sampleTask, timezone: 'Nope/Nowhere' }), /valid household timezone/)
})

test('dashboard treats a New York evening due time as today', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath, 'America/New_York')
  repo.create({ ...sampleTask, title: 'Numbers', dueAt: '2026-08-29T00:59:10.716Z' })
  assert.deepEqual(repo.dashboard('2026-08-28T15:48:39.000Z').today.map(task => task.title), ['Numbers'])
  fs.rmSync(dbPath, { force: true })
})

test('dashboard separates past due, today, and next using the household calendar day', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  repo.setPreference('timezone', 'America/Los_Angeles')
  repo.create({ ...sampleTask, title: 'Yesterday', dueAt: '2026-08-25T16:00:00.000Z' })
  repo.create({ ...sampleTask, title: 'Today', dueAt: '2026-08-26T16:00:00.000Z' })
  repo.create({ ...sampleTask, title: 'Tomorrow', dueAt: '2026-08-27T16:00:00.000Z' })
  const dashboard = repo.dashboard('2026-08-26T19:00:00.000Z')
  assert.deepEqual(dashboard.overdue.map(task => task.title), ['Yesterday'])
  assert.deepEqual(dashboard.today.map(task => task.title), ['Today'])
  assert.deepEqual(dashboard.next.map(task => task.title), ['Tomorrow'])
  fs.rmSync(dbPath, { force: true })
})

test('dashboard exposes household insights from durable action history', () => {
  fs.rmSync(dbPath, { force: true })
  const repo = new SchedulerRepository(dbPath)
  const task = repo.create({ ...sampleTask, unit: 'daily', recurrence: { unit: 'daily', interval: 1 } })
  repo.recordAction(task.id, 'skipped', '2026-08-25T12:00:00.000Z')
  const dashboard = repo.dashboard('2026-08-26T12:00:00.000Z')
  assert.equal(dashboard.insights.calendar.length, 28)
  assert.equal(dashboard.insights.digest.skipped, 1)
  fs.rmSync(dbPath, { force: true })
})
