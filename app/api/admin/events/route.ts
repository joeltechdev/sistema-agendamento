import { bookingEventEmitter } from '@/lib/events/bookingEvents'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()

  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connection confirmation
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`))

      // 2. Listener for new booking
      const onNewBooking = (payload: any) => {
        try {
          controller.enqueue(
            encoder.encode(`event: new_booking\ndata: ${JSON.stringify(payload)}\n\n`)
          )
        } catch {
          // Stream closed
        }
      }

      // 3. Listener for booking cancelled
      const onBookingCancelled = (payload: any) => {
        try {
          controller.enqueue(
            encoder.encode(`event: booking_cancelled\ndata: ${JSON.stringify(payload)}\n\n`)
          )
        } catch {
          // Stream closed
        }
      }

      // 4. Listener for appointment status update (e.g. attendance confirmed)
      const onStatusUpdated = (payload: any) => {
        try {
          controller.enqueue(
            encoder.encode(`event: status_updated\ndata: ${JSON.stringify(payload)}\n\n`)
          )
        } catch {
          // Stream closed
        }
      }

      // 5. Listener for global system sync trigger
      const onSystemSync = (payload: any) => {
        try {
          controller.enqueue(
            encoder.encode(`event: system_sync\ndata: ${JSON.stringify(payload)}\n\n`)
          )
        } catch {
          // Stream closed
        }
      }

      bookingEventEmitter.on('new_booking', onNewBooking)
      bookingEventEmitter.on('booking_cancelled', onBookingCancelled)
      bookingEventEmitter.on('status_updated', onStatusUpdated)
      bookingEventEmitter.on('system_sync', onSystemSync)

      // Heartbeat every 15s to keep connection alive
      const intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          clearInterval(intervalId)
        }
      }, 15000)

      cleanup = () => {
        clearInterval(intervalId)
        bookingEventEmitter.off('new_booking', onNewBooking)
        bookingEventEmitter.off('booking_cancelled', onBookingCancelled)
        bookingEventEmitter.off('status_updated', onStatusUpdated)
        bookingEventEmitter.off('system_sync', onSystemSync)
      }
    },
    cancel() {
      if (cleanup) cleanup()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
