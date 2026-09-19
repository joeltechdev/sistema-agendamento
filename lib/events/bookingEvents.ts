import { EventEmitter } from 'events'

// Global singleton across hot-reloads in Next.js development
declare global {
  // eslint-disable-next-line no-var
  var __bookingEventEmitter: EventEmitter | undefined
}

export const bookingEventEmitter: EventEmitter =
  global.__bookingEventEmitter || (global.__bookingEventEmitter = new EventEmitter())

bookingEventEmitter.setMaxListeners(50)
