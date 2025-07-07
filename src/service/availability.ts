import { addDays, addMinutes, format, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import { supabase } from '../config/supabase';
import { AvailabilityRequest, TimeSlot, PreferenceOptions, BusinessHours } from '../types';
import { calendar } from '../config/google_calendar';

export class AvailabilityService {
  
  async getAvailableSlots(request: AvailabilityRequest): Promise<TimeSlot[]> {
    const { instance_id, service_id, start_date, end_date, calendar_ids } = request;

    // Get instance business hours
    const { data: instance } = await supabase
      .from('instances')
      .select('business_hours, timezone')
      .eq('id', instance_id)
      .single();

    // Get service details
    const { data: service } = await supabase
      .from('services')
      .select('duration, buffer_before, buffer_after')
      .eq('id', service_id)
      .single();

    // Get calendars
    const { data: calendars } = await supabase
      .from('calendars')
      .select('*')
      .eq('instance_id', instance_id)
      .eq('is_active', true)
      .in('id', calendar_ids || [])
      .order('priority');

    if (!instance || !service || !calendars?.length) {
      throw new Error('Invalid request data');
    }

    const slots: TimeSlot[] = [];
    const totalDuration = service.duration + service.buffer_before + service.buffer_after;

    // Generate time slots for each day
    const currentDate = parseISO(start_date);
    const endDate = parseISO(end_date);

    while (currentDate <= endDate) {
      const daySlots = await this.generateDaySlots(
        currentDate,
        instance.business_hours,
        calendars,
        totalDuration
      );
      slots.push(...daySlots);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return slots;
  }

  private async generateDaySlots(
    date: Date,
    businessHours: BusinessHours,
    calendars: any[],
    duration: number
  ): Promise<TimeSlot[]> {
    const dayName = format(date, 'EEEE').toLowerCase() as keyof BusinessHours;
    const daySchedule = businessHours[dayName];

    if (!daySchedule.enabled) return [];

    const slots: TimeSlot[] = [];
    
    for (const cal of calendars) {
      const daySlots = await this.getCalendarDaySlots(date, daySchedule, cal, duration);
      slots.push(...daySlots);
    }

    return slots;
  }

  private async getCalendarDaySlots(
    date: Date,
    daySchedule: any,
    calendar: any,
    duration: number
  ): Promise<TimeSlot[]> {
    const startTime = new Date(date);
    const [startHour, startMin] = daySchedule.start_time.split(':').map(Number);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(date);
    const [endHour, endMin] = daySchedule.end_time.split(':').map(Number);
    endTime.setHours(endHour, endMin, 0, 0);

    // Get existing events from Google Calendar
    const existingEvents = await this.getCalendarEvents(calendar.google_calendar_id, date);
    
    const slots: TimeSlot[] = [];
    let currentSlot = new Date(startTime);

    while (addMinutes(currentSlot, duration) <= endTime) {
      const slotEnd = addMinutes(currentSlot, duration);
      
      // Check if slot conflicts with existing events or breaks
      if (!this.hasConflict(currentSlot, slotEnd, existingEvents, daySchedule)) {
        slots.push({
          start_datetime: currentSlot.toISOString(),
          end_datetime: slotEnd.toISOString(),
          calendar_id: calendar.id,
          calendar_name: calendar.name,
          priority: calendar.priority
        });
      }
      
      currentSlot = addMinutes(currentSlot, 30); // 30min intervals
    }

    return slots;
  }

  private async getCalendarEvents(calendarId: string, date: Date) {
    const timeMin = startOfDay(date).toISOString();
    const timeMax = addDays(startOfDay(date), 1).toISOString();

    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  private hasConflict(slotStart: Date, slotEnd: Date, events: any[], daySchedule: any): boolean {
    // Check break time conflict
    if (daySchedule.break_start && daySchedule.break_end) {
      const breakStart = new Date(slotStart);
      const [breakStartHour, breakStartMin] = daySchedule.break_start.split(':').map(Number);
      breakStart.setHours(breakStartHour, breakStartMin, 0, 0);

      const breakEnd = new Date(slotStart);
      const [breakEndHour, breakEndMin] = daySchedule.break_end.split(':').map(Number);
      breakEnd.setHours(breakEndHour, breakEndMin, 0, 0);

      if (isWithinInterval(slotStart, { start: breakStart, end: breakEnd }) ||
          isWithinInterval(slotEnd, { start: breakStart, end: breakEnd })) {
        return true;
      }
    }

    // Check event conflicts
    return events.some(event => {
      if (!event.start?.dateTime || !event.end?.dateTime) return false;
      
      const eventStart = parseISO(event.start.dateTime);
      const eventEnd = parseISO(event.end.dateTime);
      
      return slotStart < eventEnd && slotEnd > eventStart;
    });
  }

  suggestBestSlots(slots: TimeSlot[], preferences: PreferenceOptions): TimeSlot[] {
    let sortedSlots = [...slots];

    switch (preferences.strategy) {
      case 'earliest':
        sortedSlots.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
        break;
      
      case 'latest':
        sortedSlots.sort((a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime());
        break;
        
      case 'priority_calendar':
        sortedSlots.sort((a, b) => a.priority - b.priority);
        break;
        
      case 'least_fragmented':
        // Complex logic to minimize gaps - simplified version
        sortedSlots.sort((a, b) => a.priority - b.priority);
        break;
    }

    // Apply preferred times filter
    if (preferences.preferred_times?.length) {
      sortedSlots = sortedSlots.filter(slot => {
        const slotTime = format(parseISO(slot.start_datetime), 'HH:mm');
        return preferences.preferred_times!.includes(slotTime);
      });
    }

    // Apply avoid times filter
    if (preferences.avoid_times?.length) {
      sortedSlots = sortedSlots.filter(slot => {
        const slotTime = format(parseISO(slot.start_datetime), 'HH:mm');
        return !preferences.avoid_times!.includes(slotTime);
      });
    }

    return sortedSlots.slice(0, preferences.max_suggestions || 10);
  }
}