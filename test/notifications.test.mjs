import test from 'node:test'
import assert from 'node:assert/strict'
import { Notifier } from '../server/notifications.js'

test('notification destinations accept comma and newline separated recipients without duplicates', () => {
  const repo = { preference: () => 'member-one@example.invalid, member-two@example.invalid\nmember-one@example.invalid' }
  const notifier = new Notifier({}, repo)
  assert.deepEqual(notifier.destinations('email'), ['member-one@example.invalid', 'member-two@example.invalid'])
})

test('SMS destinations normalize plain numbers through the configured gateway domain', () => {
  const number = Array.from({ length: 10 }, () => '0').join('')
  const address = `${number}@vtext.com`
  const repo = { preference: () => `${number}, text@example.invalid` }
  const notifier = new Notifier({ SMS_GATEWAY_DOMAIN: 'vtext.com' }, repo)
  assert.deepEqual(notifier.destinations('sms'), [address, 'text@example.invalid'])
})
