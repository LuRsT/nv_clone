import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { AutosaveController } from '../src/renderer/controllers/autosave-controller'
import type { NoteRepository } from '../src/renderer/ports'
import type { ToastController } from '../src/renderer/controllers/toast-controller'

// Stub NoteRepository that records write calls
function createStubNotes(): NoteRepository & { writes: Array<{ title: string; body: string }> } {
  const writes: Array<{ title: string; body: string }> = []
  return {
    writes,
    async list() { return [] },
    async read() { return '' },
    async write(title: string, body: string) { writes.push({ title, body }) },
    async delete() {},
    async rename() {},
    onChanged() {},
  }
}

function createStubToast(): ToastController {
  return { show() {} } as unknown as ToastController
}

const AUTOSAVE_DELAY_MS = 500

test('schedule() saves the body value passed at call time, not a later value', async () => {
  const notes = createStubNotes()
  const autosave = new AutosaveController(notes, createStubToast())

  autosave.schedule('note-1', 'original content')

  // Wait for the timer to fire
  await delay(AUTOSAVE_DELAY_MS + 50)

  assert.equal(notes.writes.length, 1)
  assert.equal(notes.writes[0].title, 'note-1')
  assert.equal(notes.writes[0].body, 'original content')
})

test('cancel() prevents a scheduled save from firing', async () => {
  const notes = createStubNotes()
  const autosave = new AutosaveController(notes, createStubToast())

  autosave.schedule('note-1', 'some content')
  autosave.cancel()

  await delay(AUTOSAVE_DELAY_MS + 50)

  assert.equal(notes.writes.length, 0)
})

test('cancelAndFlush() saves immediately and cancels any pending timer', async () => {
  const notes = createStubNotes()
  const autosave = new AutosaveController(notes, createStubToast())

  // Schedule a save that would fire later
  autosave.schedule('note-1', 'scheduled content')

  // Flush with different content
  await autosave.cancelAndFlush('note-1', 'flushed content')

  assert.equal(notes.writes.length, 1)
  assert.equal(notes.writes[0].body, 'flushed content')

  // Wait to confirm the scheduled save was cancelled
  await delay(AUTOSAVE_DELAY_MS + 50)

  assert.equal(notes.writes.length, 1)
})

test('schedule() captures body eagerly, not lazily', async () => {
  const notes = createStubNotes()
  const autosave = new AutosaveController(notes, createStubToast())

  // This test verifies the fix: body is a string value captured at call time.
  // With the old closure-based API, a mutable reference could change between
  // schedule and fire. With the string API, the value is frozen at call time.
  let mutableBody = 'version-1'
  autosave.schedule('note-1', mutableBody)

  // Mutating the variable after scheduling should not affect the saved value
  mutableBody = 'version-2'

  await delay(AUTOSAVE_DELAY_MS + 50)

  assert.equal(notes.writes.length, 1)
  assert.equal(notes.writes[0].body, 'version-1')
})
