'use server'

import { getAvailableSlotsForDate } from '@/services/availabilityService'

export async function fetchAvailableSlots(dateStr: string, serviceDuration: number): Promise<string[]> {
  try {
    return await getAvailableSlotsForDate(dateStr, serviceDuration)
  } catch (err) {
    console.error('Failed to fetch available slots', err)
    return []
  }
}

export async function findNextAvailableDate(fromDateStr: string, serviceDuration: number): Promise<string | null> {
  try {
    const parts = fromDateStr.split('-').map(Number)
    const baseDate = new Date(parts[0], parts[1] - 1, parts[2])
    
    // Check up to 30 days ahead
    for (let i = 1; i <= 30; i++) {
      const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i)
      const dayOfWeek = nextDate.getDay()
      if (dayOfWeek === 0 || dayOfWeek === 6) continue // skip weekends
      
      const y = nextDate.getFullYear()
      const m = String(nextDate.getMonth() + 1).padStart(2, '0')
      const d = String(nextDate.getDate()).padStart(2, '0')
      const nextDateStr = `${y}-${m}-${d}`
      
      const slots = await getAvailableSlotsForDate(nextDateStr, serviceDuration)
      if (slots.length > 0) {
        return nextDateStr
      }
    }
    return null
  } catch (err) {
    console.error('Error finding next available date:', err)
    return null
  }
}

