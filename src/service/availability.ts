// src/service/availability.ts

import { addMinutes, parseISO, format, addDays, isAfter, isBefore, isWithinInterval } from 'date-fns';
import { supabase } from '../config/supabase';
import { calendar } from '../config/google_calendar';
import { DateTime } from 'luxon';
import { TimeSlot } from '../types';

export interface AvailabilitySlot {
  start_datetime: string;
  end_datetime: string;
  calendar_id: string;
  calendar_name: string;
  priority: number;
}

export interface AvailabilityCheckResult {
  available: boolean;
  calendar_name: string;
  start_datetime: string;
  end_datetime: string;
  service_name: string;
  service_duration: number;
  conflict_reason?: string;
}

export type AvailabilityStrategy = 'priority' | 'equality' | 'earliest' | 'nearest';

export class AvailabilityService {

  /**
   * Verifica se um horário específico está disponível para agendamento
   */
  async checkAvailability(
    startDatetime: string,
    service_id: string,
    calendarId: string
  ): Promise<AvailabilityCheckResult> {
    try {
      // 1. Buscar dados do serviço
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('name, duration, buffer_before, buffer_after')
        .eq('id', service_id)
        .single();

      if (serviceError || !service) {
        throw new Error('Service not found');
      }

      // 2. Buscar dados do calendário
      const { data: calendarData, error: calendarError } = await supabase
        .from('calendars')
        .select('google_calendar_id, instance_id, name')
        .eq('id', calendarId)
        .eq('is_active', true)
        .single();

      if (calendarError || !calendarData) {
        return {
          available: false,
          calendar_name: 'Unknown',
          start_datetime: startDatetime,
          end_datetime: startDatetime,
          service_name: service?.name || 'Unknown',
          service_duration: service?.duration || 0,
          conflict_reason: 'Calendar not found or inactive'
        };
      }

      // 3. Buscar dados da instância
      const { data: instance, error: instanceError } = await supabase
        .from('instances')
        .select('business_hours, timezone')
        .eq('id', calendarData.instance_id)
        .single();

      if (instanceError || !instance) {
        return {
          available: false,
          calendar_name: calendarData.name,
          start_datetime: startDatetime,
          end_datetime: startDatetime,
          service_name: service.name,
          service_duration: service.duration,
          conflict_reason: 'Instance not found'
        };
      }

      const startTime = DateTime.fromISO(startDatetime, { setZone: true }); // preserva o -03:00
      const endTime = startTime.plus({ minutes: service.duration });
      
      // Calcular horário total com buffers
      const totalStartTime = startTime.minus({ minutes: service.buffer_before });
      const totalEndTime = endTime.plus({ minutes: service.buffer_after });


      // Objeto base de resposta
      const baseResponse = {
        calendar_name: calendarData.name,
        start_datetime: startTime.toString(),
        end_datetime: endTime.toString(),
        service_name: service.name,
        service_duration: service.duration
      };

      // 4. Verificar se está dentro do horário comercial
      if (!this.isWithinBusinessHours(startTime.toJSDate(), endTime.toJSDate(), instance.business_hours)) {
        return {
          ...baseResponse,
          available: false,
          conflict_reason: 'Outside business hours'
        };
      }

      // 5. Verificar disponibilidade no Google Calendar
      const isAvailable = await this.checkGoogleCalendarAvailability(
        calendarData.google_calendar_id,
        totalStartTime.toJSDate(),
        totalEndTime.toJSDate()
      );

      if (!isAvailable) {
        return {
          ...baseResponse,
          available: false,
          conflict_reason: 'Time slot already booked'
        };
      }

      return {
        ...baseResponse,
        available: true
      };

    } catch (error) {
      console.error('Error checking availability:', error);
      return {
        available: false,
        calendar_name: 'Unknown',
        start_datetime: startDatetime,
        end_datetime: startDatetime,
        service_name: 'Unknown',
        service_duration: 0,
        conflict_reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Sugere horários disponíveis para agendamento
   */
  async suggestAvailability(
    startDatetime: string,
    endDatetime: string,
    service_id: string,
    calendarIds: string[],
    maxResults: number = 10,
    expandTimeframe: boolean = false,
    intervalMinutes: number = 30,
    strategy: AvailabilityStrategy = 'priority'
  ): Promise<AvailabilitySlot[]> {
    try {
      // 1. Buscar dados do serviço
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('duration, buffer_before, buffer_after')
        .eq('id', service_id)
        .single();

      if (serviceError || !service) {
        throw new Error('Service not found');
      }

      // 2. Buscar dados dos calendários
      const { data: calendars, error: calendarsError } = await supabase
        .from('calendars')
        .select('id, google_calendar_id, instance_id, name, priority')
        .in('id', calendarIds)
        .eq('is_active', true)
        .order('priority');

      if (calendarsError || !calendars || calendars.length === 0) {
        throw new Error('No active calendars found');
      }

      // 3. Buscar dados da instância (usar a primeira para business_hours)
      const { data: instance, error: instanceError } = await supabase
        .from('instances')
        .select('business_hours, timezone')
        .eq('id', calendars[0].instance_id)
        .single();

      if (instanceError || !instance) {
        throw new Error('Instance not found');
      }

      // CORREÇÃO: Usar DateTime para preservar timezone
      const originalTimezone = this.extractTimezone(startDatetime);
      let searchStartDate = DateTime.fromISO(startDatetime, { setZone: true });
      let searchEndDate = DateTime.fromISO(endDatetime, { setZone: true });
      let availableSlots: AvailabilitySlot[] = [];
      let attempts = 0;
      const maxAttempts = 30; // Evitar loop infinito

      do {
        // Gerar slots possíveis no timeframe atual
        const possibleSlots = this.generateTimeSlots(
          searchStartDate,
          searchEndDate,
          service.duration,
          intervalMinutes,
          instance.business_hours,
          calendars,
          originalTimezone // Passar timezone original
        );

        // Verificar disponibilidade de cada slot
        for (const slot of possibleSlots) {
          if (availableSlots.length >= maxResults) break;

          const startTime = DateTime.fromISO(slot.start_datetime, { setZone: true }).toJSDate();
          const endTime = DateTime.fromISO(slot.end_datetime, { setZone: true }).toJSDate();
          const totalStartTime = addMinutes(startTime, -service.buffer_before);
          const totalEndTime = addMinutes(endTime, service.buffer_after);

          const isAvailable = await this.checkGoogleCalendarAvailability(
            slot.google_calendar_id,
            totalStartTime,
            totalEndTime
          );

          if (isAvailable) {
            availableSlots.push({
              start_datetime: slot.start_datetime,
              end_datetime: slot.end_datetime,
              calendar_id: slot.calendar_id,
              calendar_name: slot.calendar_name,
              priority: slot.priority
            });
          }
        }

        // Se não encontrou slots suficientes e deve expandir
        if (availableSlots.length < maxResults && expandTimeframe && attempts < maxAttempts) {
          searchEndDate = searchEndDate.plus({ days: 1 });
          attempts++;
        } else {
          break;
        }

      } while (availableSlots.length < maxResults && expandTimeframe && attempts < maxAttempts);

      // Aplicar estratégia de retorno
      return this.applyStrategy(availableSlots, strategy, maxResults);

    } catch (error) {
      console.error('Error suggesting availability:', error);
      return [];
    }
  }

  /**
   * Extrai timezone da string ISO
   */
  private extractTimezone(isoString: string): string {
    // Detecta timezone da string (ex: -03:00, +05:00, Z)
    const timezoneMatch = isoString.match(/([+-]\d{2}:\d{2}|Z)$/);
    return timezoneMatch ? timezoneMatch[1] : 'Z';
  }

  /**
   * Verifica se o horário está dentro do business hours
   */
  private isWithinBusinessHours(startTime: Date, endTime: Date, businessHours: any): boolean {
    const dayName = format(startTime, 'EEEE').toLowerCase();
    const daySchedule = businessHours[dayName];

    if (!daySchedule || !daySchedule.enabled) {
      return false;
    }

    const startTimeStr = format(startTime, 'HH:mm');
    const endTimeStr = format(endTime, 'HH:mm');

    // Verificar se está dentro do horário de funcionamento
    if (startTimeStr < daySchedule.start_time || endTimeStr > daySchedule.end_time) {
      return false;
    }

    // Verificar se não está no horário de pausa
    if (daySchedule.break_start && daySchedule.break_end) {
      if (!(endTimeStr <= daySchedule.break_start || startTimeStr >= daySchedule.break_end)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verifica disponibilidade no Google Calendar
   */
  private async checkGoogleCalendarAvailability(
    googleCalendarId: string,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    try {
      const response = await calendar.events.list({
        calendarId: googleCalendarId,
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return !response.data.items || response.data.items.length === 0;
    } catch (error) {
      console.error('Error checking Google Calendar availability:', error);
      return false;
    }
  }

  /**
   * Gera slots de tempo possíveis - CORRIGIDO para preservar timezone
   */
  private generateTimeSlots(
    startDate: DateTime,
    endDate: DateTime,
    durationMinutes: number,
    intervalMinutes: number,
    businessHours: any,
    calendars: any[],
    originalTimezone: string
  ): Array<{
    start_datetime: string;
    end_datetime: string;
    calendar_id: string;
    calendar_name: string;
    priority: number;
    google_calendar_id: string;
  }> {
    const slots: any[] = [];
    let currentDate = startDate.startOf('day');

    while (currentDate <= endDate) {
      const dayName = currentDate.toFormat('cccc').toLowerCase();
      const daySchedule = businessHours[dayName];

      if (daySchedule && daySchedule.enabled) {
        // Período da manhã
        let morningStart = this.parseTimeToDateTime(currentDate, daySchedule.start_time);
        let morningEnd = daySchedule.break_start 
          ? this.parseTimeToDateTime(currentDate, daySchedule.break_start)
          : this.parseTimeToDateTime(currentDate, daySchedule.end_time);

        this.addSlotsForPeriod(morningStart, morningEnd, durationMinutes, intervalMinutes, calendars, slots, originalTimezone);

        // Período da tarde (se houver pausa)
        if (daySchedule.break_start && daySchedule.break_end) {
          let afternoonStart = this.parseTimeToDateTime(currentDate, daySchedule.break_end);
          let afternoonEnd = this.parseTimeToDateTime(currentDate, daySchedule.end_time);

          this.addSlotsForPeriod(afternoonStart, afternoonEnd, durationMinutes, intervalMinutes, calendars, slots, originalTimezone);
        }
      }

      currentDate = currentDate.plus({ days: 1 });
    }

    return slots;
  }

  /**
   * Adiciona slots para um período específico - CORRIGIDO para preservar timezone
   */
  private addSlotsForPeriod(
    periodStart: DateTime,
    periodEnd: DateTime,
    durationMinutes: number,
    intervalMinutes: number,
    calendars: any[],
    slots: any[],
    originalTimezone: string
  ): void {
    let currentTime = periodStart;

    while (currentTime.plus({ minutes: durationMinutes }) <= periodEnd) {
      const endTime = currentTime.plus({ minutes: durationMinutes });

      // Adicionar slot para cada calendário
      calendars.forEach(calendar => {
        slots.push({
          start_datetime: currentTime.toString(), // Preserva timezone original
          end_datetime: endTime.toString(), // Preserva timezone original
          calendar_id: calendar.id,
          calendar_name: calendar.name,
          priority: calendar.priority,
          google_calendar_id: calendar.google_calendar_id
        });
      });

      currentTime = currentTime.plus({ minutes: intervalMinutes });
    }
  }

  /**
   * Converte string de tempo para DateTime - NOVO método usando Luxon
   */
  private parseTimeToDateTime(date: DateTime, timeStr: string): DateTime {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return date.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
  }

  /**
   * Aplica estratégia de retorno
   */
  private applyStrategy(
    slots: AvailabilitySlot[],
    strategy: AvailabilityStrategy,
    maxResults: number
  ): AvailabilitySlot[] {
    let result: AvailabilitySlot[] = [];

    switch (strategy) {
      case 'priority':
        // Ordenar por prioridade e horário
        slots.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
        });
        result = slots.slice(0, maxResults);
        break;

      case 'equality':
        result = this.distributeEqually(slots, maxResults);
        break;

      case 'earliest':
        slots.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
        result = slots.slice(0, maxResults);
        break;

      case 'nearest':
        const now = new Date();
        slots.sort((a, b) => {
          const diffA = Math.abs(new Date(a.start_datetime).getTime() - now.getTime());
          const diffB = Math.abs(new Date(b.start_datetime).getTime() - now.getTime());
          return diffA - diffB;
        });
        result = slots.slice(0, maxResults);
        break;

      default:
        result = slots.slice(0, maxResults);
    }

    return result;
  }

  /**
   * Distribui slots igualmente entre calendários
   */
  private distributeEqually(slots: AvailabilitySlot[], maxResults: number): AvailabilitySlot[] {
    const calendarGroups = new Map<string, AvailabilitySlot[]>();
    
    // Agrupar por calendário
    slots.forEach(slot => {
      if (!calendarGroups.has(slot.calendar_id)) {
        calendarGroups.set(slot.calendar_id, []);
      }
      calendarGroups.get(slot.calendar_id)!.push(slot);
    });

    // Ordenar calendários por prioridade
    const sortedCalendars = Array.from(calendarGroups.entries()).sort((a, b) => {
      const priorityA = a[1][0]?.priority || 999;
      const priorityB = b[1][0]?.priority || 999;
      return priorityA - priorityB;
    });

    const result: AvailabilitySlot[] = [];
    const calendarsCount = sortedCalendars.length;
    const slotsPerCalendar = Math.floor(maxResults / calendarsCount);
    const remainder = maxResults % calendarsCount;

    // Distribuir slots
    sortedCalendars.forEach(([calendarId, calendarSlots], index) => {
      const slots = slotsPerCalendar + (index < remainder ? 1 : 0);
      const sortedSlots = calendarSlots.sort((a, b) => 
        new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
      );
      result.push(...sortedSlots.slice(0, slots));
    });

    // Ordenar resultado final por horário
    return result.sort((a, b) => 
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
    );
  }
}