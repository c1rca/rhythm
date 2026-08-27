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

test('Twilio SMS targets retain Google Fi-compatible phone numbers instead of carrier-gateway emails', () => {
  const repo = { preference: key => key === 'smsProvider' ? 'twilio' : '(862) 214-4601, text@example.invalid' }
  const notifier = new Notifier({}, repo)
  assert.deepEqual(notifier.smsTargets(), ['+18622144601'])
})

test('notification content includes the configured Scheduler page link', () => {
  const repo = { preference: key => key === 'publicUrl' ? 'https://rhythm.example.com/' : '' }
  const notifier = new Notifier({}, repo)
  assert.match(notifier.message({ id: 7, title: 'Numbers', streak: 1 }), /https:\/\/rhythm\.example\.com\/\?task=7/)
})

test('Twilio failure falls back to carrier-email SMS when enabled', async () => {
  const repo = { preference: key => ({ smsProvider: 'twilio', smsFallback: 'gateway', smsTo: '(862) 214-4601' })[key] || '' }
  const notifier = new Notifier({ TWILIO_ACCOUNT_SID: 'sid', TWILIO_AUTH_TOKEN: 'token', TWILIO_FROM: '+15555555555', SMS_GATEWAY_DOMAIN: 'vtext.com' }, repo)
  const originalFetch = globalThis.fetch, delivered = []
  globalThis.fetch = async () => { throw new Error('Twilio unavailable') }
  notifier.mail = { sendMail: async mail => delivered.push(mail) }
  try { await notifier.sendSms('Reminder'); assert.deepEqual(delivered.map(mail => mail.to), [['8622144601@vtext.com']]) } finally { globalThis.fetch = originalFetch }
})
