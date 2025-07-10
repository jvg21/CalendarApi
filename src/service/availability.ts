// src/service/availability.ts - Adaptado para calendários compartilhados

import { addMinutes, format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '../config/supabase';
import { calendar } from '../config/google_calendar';
import { AvailabilityRequest, TimeSlot, BusinessHours, SlotCheckRequest, SlotCheckResponse } from '../types';



export class AvailabilityService {
  
  async getAvailableSlots(request: AvailabilityRequest): Promise<TimeSlot[]> {
    const { instance_id, service_id, start_date, end_date, calendar_ids } = request;

    // Get service details
    const { data: service } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();

    if (!service) {
      throw new Error('Service not found');
    }

    // Get instance business hours
    const { data: instance } = await supabase
      .from('instances')
      .select('business_hours, timezone')
      .eq('id', instance_id)
      .single();

    if (!instance) {
      throw new Error('Instance not found');
    }

    // Get available calendars
    let calendarsQuery = supabase
      .from('calendars')
      .select('*')
      .eq('instance_id', instance_id)
      .eq('is_active', true);

    if (calendar_ids && calendar_ids.length > 0) {
      calendarsQuery = calendarsQuery.in('id', calendar_ids);
    }

    const { data: calendars } = await calendarsQuery.order('priority');

    if (!calendars || calendars.length === 0) {
      return [];
    }

    const slots: TimeSlot[] = [];
    const currentDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Generate slots for each day
    while (currentDate <= endDate) {
      const daySlots = await this.generateDaySlots(
        currentDate,
        instance.business_hours,
        calendars,
        service.duration,
        service.buffer_before,
        service.buffer_after
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
    duration: number,
    bufferBefore: number = 0,
    bufferAfter: number = 0
  ): Promise<TimeSlot[]> {
    const dayName = format(date, 'EEEE').toLowerCase() as keyof BusinessHours;
    const daySchedule = businessHours[dayName];

    if (!daySchedule.enabled) return [];

    const slots: TimeSlot[] = [];
    
    // Check each calendar for availability
    for (const cal of calendars) {
      const calendarSlots = await this.getCalendarDaySlots(
        date, 
        daySchedule, 
        cal, 
        duration,
        bufferBefore,
        bufferAfter
      );
      slots.push(...calendarSlots);
    }

    return slots;
  }

  private async getCalendarDaySlots(
    date: Date,
    daySchedule: any,
    calendar: any,
    duration: number,
    bufferBefore: number,
    bufferAfter: number
  ): Promise<TimeSlot[]> {
    const startTime = new Date(date);
    const [startHour, startMin] = daySchedule.start_time.split(':').map(Number);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(date);
    const [endHour, endMin] = daySchedule.end_time.split(':').map(Number);
    endTime.setHours(endHour, endMin, 0, 0);

    // Get existing events from shared calendar
    const existingEvents = await this.getSharedCalendarEvents(
      calendar.google_calendar_id, 
      startOfDay(date), 
      endOfDay(date)
    );
    
    const slots: TimeSlot[] = [];
    let currentSlot = new Date(startTime);

    // Total time needed including buffers
    const totalTimeNeeded = duration + bufferBefore + bufferAfter;

    while (addMinutes(currentSlot, totalTimeNeeded) <= endTime) {
      const slotStart = addMinutes(currentSlot, bufferBefore);
      const slotEnd = addMinutes(slotStart, duration);
      const slotEndWithBuffer = addMinutes(slotEnd, bufferAfter);
      
      // Check if slot conflicts with existing events, breaks, or current time
      if (!this.hasConflict(currentSlot, slotEndWithBuffer, existingEvents, daySchedule) &&
          this.isInFuture(slotStart)) {
        slots.push({
          start_datetime: slotStart.toISOString(),
          end_datetime: slotEnd.toISOString(),
          calendar_id: calendar.id,
          calendar_name: calendar.name,
          priority: calendar.priority
        });
      }
      
      // Move to next 15-minute slot
      currentSlot = addMinutes(currentSlot, 15);
    }

    return slots;
  }

  private async getSharedCalendarEvents(calendarId: string, startDate: Date, endDate: Date) {
    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250
      });

      return response.data.items || [];
    } catch (error) {
      console.error(`Error fetching events from shared calendar ${calendarId}:`, error);
      return [];
    }
  }

  private hasConflict(
    slotStart: Date, 
    slotEnd: Date, 
    existingEvents: any[], 
    daySchedule: any
  ): boolean {
    // Check break time conflict
    if (daySchedule.break_start && daySchedule.break_end) {
      const [breakStartHour, breakStartMin] = daySchedule.break_start.split(':').map(Number);
      const [breakEndHour, breakEndMin] = daySchedule.break_end.split(':').map(Number);
      
      const breakStart = new Date(slotStart);
      breakStart.setHours(breakStartHour, breakStartMin, 0, 0);
      
      const breakEnd = new Date(slotStart);
      breakEnd.setHours(breakEndHour, breakEndMin, 0, 0);
      
      if (this.timeRangesOverlap(slotStart, slotEnd, breakStart, breakEnd)) {
        return true;
      }
    }

    // Check existing events conflict
    for (const event of existingEvents) {
      if (!event.start || !event.end) continue;
      
      // Verificar se temos dados válidos de data/hora
      const startDateTimeValue = event.start.dateTime || event.start.date;
      const endDateTimeValue = event.end.dateTime || event.end.date;
      
      if (!startDateTimeValue || !endDateTimeValue) continue;
      
      const eventStart = new Date(startDateTimeValue);
      const eventEnd = new Date(endDateTimeValue);
      
      if (this.timeRangesOverlap(slotStart, slotEnd, eventStart, eventEnd)) {
        return true;
      }
    }

    return false;
  }

  private timeRangesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1;
  }

  private isInFuture(date: Date): boolean {
    return date > new Date();
  }

  // Suggest best slots based on preferences
  suggestBestSlots(slots: TimeSlot[], preferences: any = {}): TimeSlot[] {
    const { strategy = 'earliest', max_suggestions = 5 } = preferences;
    
    let sortedSlots = [...slots];

    switch (strategy) {
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
        // Group by calendar and prefer calendars with more consecutive slots
        sortedSlots = this.sortByLeastFragmented(sortedSlots);
        break;
    }

    return sortedSlots.slice(0, max_suggestions);
  }

  private sortByLeastFragmented(slots: TimeSlot[]): TimeSlot[] {
    // Group slots by calendar
    const calendarGroups = new Map<string, TimeSlot[]>();
    
    slots.forEach(slot => {
      if (!calendarGroups.has(slot.calendar_id)) {
        calendarGroups.set(slot.calendar_id, []);
      }
      calendarGroups.get(slot.calendar_id)!.push(slot);
    });

    // Calculate fragmentation score for each calendar
    const calendarScores = new Map<string, number>();
    
    calendarGroups.forEach((calSlots, calendarId) => {
      calSlots.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
      
      let consecutiveBlocks = 1;
      for (let i = 1; i < calSlots.length; i++) {
        const prevEnd = new Date(calSlots[i-1].end_datetime);
        const currentStart = new Date(calSlots[i].start_datetime);
        const diffMinutes = (currentStart.getTime() - prevEnd.getTime()) / (1000 * 60);
        
        if (diffMinutes > 30) { // More than 30min gap = new block
          consecutiveBlocks++;
        }
      }
      
      // Lower score = less fragmented
      calendarScores.set(calendarId, consecutiveBlocks / calSlots.length);
    });

    // Sort slots by fragmentation score, then by time
    return slots.sort((a, b) => {
      const scoreA = calendarScores.get(a.calendar_id) || 1;
      const scoreB = calendarScores.get(b.calendar_id) || 1;
      
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      
      return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
    });
  }

  // ============================================================
  // NOVO MÉTODO: Verificação de Slot Específico
  // ============================================================
  
  async checkSpecificSlot(request: SlotCheckRequest): Promise<SlotCheckResponse> {
    const { instance_id, service_id, start_datetime, calendar_ids } = request;

    // Buscar dados do serviço
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('name, duration, buffer_before, buffer_after, instance_id')
      .eq('id', service_id)
      .single();

    if (serviceError || !service) {
      throw new Error('Serviço não encontrado');
    }

    // Verificar se o serviço pertence à instância
    if (service.instance_id !== instance_id) {
      throw new Error('Serviço não pertence à instância informada');
    }

    // Buscar horário comercial da instância
    const { data: instance } = await supabase
      .from('instances')
      .select('business_hours, timezone')
      .eq('id', instance_id)
      .single();

    if (!instance) {
      throw new Error('Instância não encontrada');
    }

    // Buscar calendários disponíveis
    let calendarsQuery = supabase
      .from('calendars')
      .select('id, name, google_calendar_id, instance_id, is_active')
      .eq('instance_id', instance_id)
      .eq('is_active', true);

    if (calendar_ids && calendar_ids.length > 0) {
      calendarsQuery = calendarsQuery.in('id', calendar_ids);
    }

    const { data: calendars } = await calendarsQuery.order('priority');

    if (!calendars || calendars.length === 0) {
      return {
        available: false,
        service_name: service.name,
        start_datetime,
        end_datetime: this.calculateEndTime(start_datetime, service.duration),
        calendar_name: 'Nenhum calendário disponível',
        calendar_id:'',
        conflict_reason: 'Nenhum calendário ativo encontrado'
      };
    }

    const startTime = parseISO(start_datetime);
    const endTime = addMinutes(startTime, service.duration);

    // Verificar se está no futuro
    if (startTime <= new Date()) {
      return {
        available: false,
        service_name: service.name,
        start_datetime,
        end_datetime: endTime.toISOString(),
        calendar_name: calendars[0].name,
          calendar_id:calendars[0].id,
        conflict_reason: 'Horário no passado'
      };
    }

    // Verificar se está dentro do horário comercial
    const businessHoursCheck = this.checkBusinessHours(startTime, endTime, instance.business_hours);
    if (!businessHoursCheck.valid) {
      return {
        available: false,
        service_name: service.name,
        start_datetime,
        end_datetime: endTime.toISOString(),
        calendar_name: calendars[0].name,
          calendar_id:calendars[0].id,
        conflict_reason: businessHoursCheck.reason
      };
    }

    // Verificar disponibilidade em cada calendário
    for (const calendar of calendars) {
      const calendarCheck = await this.checkCalendarAvailability(
        calendar,
        service,
        startTime,
        endTime
      );

      if (calendarCheck.available) {
        return {
          available: true,
          service_name: service.name,
          start_datetime,
          end_datetime: endTime.toISOString(),
          calendar_id:calendar.id,
          calendar_name: calendar.name
        };
      }
    }

    // Se chegou aqui, nenhum calendário está disponível
    // Retornar o motivo do primeiro calendário verificado
    const firstCalendarCheck = await this.checkCalendarAvailability(
      calendars[0],
      service,
      startTime,
      endTime
    );

    return {
      available: false,
      service_name: service.name,
      start_datetime,
      end_datetime: endTime.toISOString(),
      calendar_name: calendars[0].name,
      calendar_id:calendars[0].id,
      conflict_reason: firstCalendarCheck.conflict_reason || 'Horário ocupado'
    };
  }

  // Método auxiliar para verificar disponibilidade de um calendário específico
  private async checkCalendarAvailability(
    calendar: any,
    service: any,
    startTime: Date,
    endTime: Date
  ): Promise<{ available: boolean; conflict_reason?: string }> {
    const endTimeWithBuffer = addMinutes(endTime, service.buffer_after || 0);
    const startTimeWithBuffer = addMinutes(startTime, -(service.buffer_before || 0));

    // Verificar conflitos no Google Calendar
    try {
      const existingEvents = await this.getSharedCalendarEvents(
        calendar.google_calendar_id,
        startOfDay(startTime),
        endOfDay(startTime)
      );

      // Verificar conflitos com eventos existentes
      for (const event of existingEvents) {
        if (!event.start || !event.end) continue;
        
        // Verificar se temos dados válidos de data/hora
        const startDateTimeValue = event.start.dateTime || event.start.date;
        const endDateTimeValue = event.end.dateTime || event.end.date;
        
        if (!startDateTimeValue || !endDateTimeValue) continue;
        
        const eventStart = new Date(startDateTimeValue);
        const eventEnd = new Date(endDateTimeValue);
        
        if (this.timeRangesOverlap(startTimeWithBuffer, endTimeWithBuffer, eventStart, eventEnd)) {
          return {
            available: false,
            conflict_reason: `Conflito com evento: ${event.summary || 'Sem título'}`
          };
        }
      }

      return { available: true };

    } catch (error) {
      console.error('Erro ao verificar calendário:', error);
      return {
        available: false,
        conflict_reason: 'Erro ao acessar calendário'
      };
    }
  }

  // Métodos auxiliares para checkSpecificSlot
  private calculateEndTime(startDateTime: string, duration: number): string {
    const startTime = parseISO(startDateTime);
    const endTime = addMinutes(startTime, duration);
    return endTime.toISOString();
  }

  private checkBusinessHours(startTime: Date, endTime: Date, businessHours: BusinessHours): { valid: boolean; reason?: string } {
    const dayName = format(startTime, 'EEEE').toLowerCase() as keyof BusinessHours;
    const daySchedule = businessHours[dayName];

    if (!daySchedule.enabled) {
      return { valid: false, reason: `${dayName} não é dia útil` };
    }

    // Verificar horário de funcionamento
    const [startHour, startMin] = daySchedule.start_time.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end_time.split(':').map(Number);
    
    const businessStart = new Date(startTime);
    businessStart.setHours(startHour, startMin, 0, 0);
    
    const businessEnd = new Date(startTime);
    businessEnd.setHours(endHour, endMin, 0, 0);

    if (startTime < businessStart || endTime > businessEnd) {
      return { 
        valid: false, 
        reason: `Fora do horário comercial (${daySchedule.start_time} - ${daySchedule.end_time})` 
      };
    }

    // Verificar horário de pausa
    if (daySchedule.break_start && daySchedule.break_end) {
      const [breakStartHour, breakStartMin] = daySchedule.break_start.split(':').map(Number);
      const [breakEndHour, breakEndMin] = daySchedule.break_end.split(':').map(Number);
      
      const breakStart = new Date(startTime);
      breakStart.setHours(breakStartHour, breakStartMin, 0, 0);
      
      const breakEnd = new Date(startTime);
      breakEnd.setHours(breakEndHour, breakEndMin, 0, 0);
      
      if (this.timeRangesOverlap(startTime, endTime, breakStart, breakEnd)) {
        return { 
          valid: false, 
          reason: `Conflito com horário de pausa (${daySchedule.break_start} - ${daySchedule.break_end})` 
        };
      }
    }

    return { valid: true };
  }
}