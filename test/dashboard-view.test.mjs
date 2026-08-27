import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('daily surface exposes distinct Past due, Today, and Next task sections', () => {
  for (const label of ['Past due', 'Today', 'Next']) assert.match(source, new RegExp(`>${label}<`))
  assert.match(source, /data\.next/)
})

test('task view toggle persists a list-first preference and list mode has its own compact layout', () => {
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(source, /localStorage\.getItem\('scheduler-task-view'\) \|\| 'list'/)
  assert.match(source, /localStorage\.setItem\('scheduler-task-view', next\)/)
  assert.match(source, /view === 'list' \? 'task-list' : ''/)
  assert.match(styles, /\.now-grid\.task-list\s*\{[^}]*grid-template-columns\s*:\s*1fr/)
})

test('all-day rhythms never expose their internal reminder hour and history deletion refreshes in place', () => {
  assert.match(source, /relativeDue\(item\.dueAt,item\.allDay\)/)
  assert.match(source, /deleteHistory/)
  assert.doesNotMatch(source, /history-delete[\s\S]*window\.location\.reload\(\)/)
  assert.doesNotMatch(source, /A promise worth keeping\./)
})

test('list rows hide the redundant chevron so details and streak controls never collide', () => {
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(styles, /\.task-list \.more\{display:none\}/)
})

test('Coming up uses the selected list view instead of a horizontal rail', () => {
  assert.match(source, /view === 'list' \? <TaskCards items=\{coming\}/)
})

test('creation uses one primary clear-state action, direct row opening, and a custom cron choice', () => {
  assert.doesNotMatch(source, /add-button compact/)
  assert.doesNotMatch(source, />Add one</)
  assert.doesNotMatch(source, />Details</)
  assert.match(source, /<option value="custom">Custom \(cron\)<\/option>/)
  assert.match(source, /aria-label="Custom cron expression"/)
})

test('dashboard provides a compact, data-grounded household review with calendar and weekly digest', () => {
  assert.match(source, /Household pulse/)
  assert.match(source, /insights\.calendar/)
  assert.match(source, /weekly digest/)
})
