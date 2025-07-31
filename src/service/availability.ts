// src/service/availability.ts - COMPLETO COM TODAS AS CORREÇÕES DE TIMEZONE

import { addMinutes } from 'date-fns';
import { supabase } from '../config/supabase';
import { calendar } from '../config/google_calendar';
import { DateTime } from 'luxon';
import { TimeSlot, SlotCheckResponse } from '../types';

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

export type AvailabilityStrategy = 'equality' | 'earliest' | 'nearest' | 'time_blocks' | 'balanced_distribution';

export interface PriorityConfig {
  enabled: boolean;
  order: 'asc' | 'desc';
}

export interface TimeBlocksConfig {
  morning_slots?: number;
  afternoon_slots?: number;
  evening_slots?: number;
  morning_start?: string;
  afternoon_start?: string;
  evening_start?: string;
}

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

      const startTime = DateTime.fromISO(startDatetime, { setZone: true });
      const endTime = startTime.plus({ minutes: service.duration });
      
      // Calcular horário total com buffers
      const totalStartTime = startTime.minus({ minutes: service.buffer_before || 0 });
      const totalEndTime = endTime.plus({ minutes: service.buffer_after || 0 });

      // Objeto base de resposta
      const baseResponse = {
        calendar_name: calendarData.name,
        start_datetime: startTime.toString(),
        end_datetime: endTime.toString(),
        service_name: service.name,
        service_duration: service.duration
      };

      // 4. 🔧 CORREÇÃO: Verificar business hours usando timezone da instância
      if (!this.isWithinBusinessHours(startTime, endTime, instance.business_hours, instance.timezone)) {
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
   * Verifica disponibilidade em múltiplos calendários
   */
  async checkCalendarsAvailability(
    startDatetime: string,
    service_id: string,
    calendarIds: string[]
  ): Promise<SlotCheckResponse> {
    try {
      console.log(`🔍 Checking availability for ${calendarIds.length} calendars at ${startDatetime}`);

      // 1. Buscar dados do serviço
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('name, duration, buffer_before, buffer_after')
        .eq('id', service_id)
        .single();

      if (serviceError || !service) {
        throw new Error('Service not found');
      }

      // 2. Buscar dados dos calendários
      const { data: calendars, error: calendarsError } = await supabase
        .from('calendars')
        .select('id, name, google_calendar_id, priority, instance_id')
        .in('id', calendarIds)
        .eq('is_active', true);

      if (calendarsError || !calendars || calendars.length === 0) {
        throw new Error('No active calendars found');
      }

      const startTime = DateTime.fromISO(startDatetime, { setZone: true });
      const endTime = startTime.plus({ minutes: service.duration });
      
      // Calcular horário total com buffers
      const totalStartTime = startTime.minus({ minutes: service.buffer_before || 0 });
      const totalEndTime = endTime.plus({ minutes: service.buffer_after || 0 });

      // 3. Verificar cada calendário
      const availableCalendars: Array<{
        calendar_id: string;
        calendar_name: string;
        priority: number;
      }> = [];

      const unavailableCalendars: Array<{
        calendar_id: string;
        calendar_name: string;
        priority: number;
        conflict_reason: string;
      }> = [];

      for (const calendar of calendars) {
        console.log(`🔍 Checking calendar: ${calendar.name} (${calendar.id})`);

        try {
          // Verificar business hours da instância
          const { data: instance } = await supabase
            .from('instances')
            .select('business_hours, timezone')
            .eq('id', calendar.instance_id)
            .single();

          if (!instance) {
            unavailableCalendars.push({
              calendar_id: calendar.id,
              calendar_name: calendar.name,
              priority: calendar.priority,
              conflict_reason: 'Instance not found'
            });
            continue;
          }

          // 🔧 CORREÇÃO: Verificar business hours usando timezone da instância
          const isWithinBusinessHours = this.isWithinBusinessHours(
            startTime,
            endTime,
            instance.business_hours,
            instance.timezone
          );

          if (!isWithinBusinessHours) {
            unavailableCalendars.push({
              calendar_id: calendar.id,
              calendar_name: calendar.name,
              priority: calendar.priority,
              conflict_reason: 'Outside business hours'
            });
            continue;
          }

          // Verificar Google Calendar
          const isGoogleCalendarAvailable = await this.checkGoogleCalendarAvailability(
            calendar.google_calendar_id,
            totalStartTime.toJSDate(),
            totalEndTime.toJSDate()
          );

          if (isGoogleCalendarAvailable) {
            availableCalendars.push({
              calendar_id: calendar.id,
              calendar_name: calendar.name,
              priority: calendar.priority
            });
            console.log(`✅ Calendar ${calendar.name} is available`);
          } else {
            unavailableCalendars.push({
              calendar_id: calendar.id,
              calendar_name: calendar.name,
              priority: calendar.priority,
              conflict_reason: 'Time slot already booked'
            });
            console.log(`❌ Calendar ${calendar.name} is not available`);
          }

        } catch (error) {
          console.error(`Error checking calendar ${calendar.name}:`, error);
          unavailableCalendars.push({
            calendar_id: calendar.id,
            calendar_name: calendar.name,
            priority: calendar.priority,
            conflict_reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      // Ordenar calendários disponíveis por prioridade
      availableCalendars.sort((a, b) => a.priority - b.priority);

      const result: SlotCheckResponse = {
        available: availableCalendars.length > 0,
        service_name: service.name,
        service_duration: service.duration,
        start_datetime: startTime.toString(),
        end_datetime: endTime.toString(),
        available_calendars: availableCalendars,
        unavailable_calendars: unavailableCalendars,
        total_calendars_checked: calendars.length,
        total_available: availableCalendars.length,
        total_unavailable: unavailableCalendars.length
      };

      console.log(`📊 Final result: ${result.total_available}/${result.total_calendars_checked} calendars available`);
      return result;

    } catch (error) {
      console.error('Error checking calendars availability:', error);
      
      return {
        available: false,
        service_name: 'Unknown',
        service_duration: 0,
        start_datetime: startDatetime,
        end_datetime: startDatetime,
        available_calendars: [],
        unavailable_calendars: [],
        total_calendars_checked: 0,
        total_available: 0,
        total_unavailable: 0
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
    strategy: AvailabilityStrategy = 'earliest',
    priorityConfig: PriorityConfig = { enabled: true, order: 'asc' },
    timeBlocksConfig?: TimeBlocksConfig
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

      // 3. Buscar dados da instância
      const { data: instance, error: instanceError } = await supabase
        .from('instances')
        .select('business_hours, timezone')
        .eq('id', calendars[0].instance_id)
        .single();

      if (instanceError || !instance) {
        throw new Error('Instance not found');
      }

      // Usar DateTime para preservar timezone
      const originalTimezone = this.extractTimezone(startDatetime);
      let searchStartDate = DateTime.fromISO(startDatetime, { setZone: true });
      let searchEndDate = DateTime.fromISO(endDatetime, { setZone: true });
      let availableSlots: AvailabilitySlot[] = [];
      let attempts = 0;
      const maxAttempts = 30;

      do {
        // Gerar slots possíveis no timeframe atual
        const possibleSlots = this.generateTimeSlots(
          searchStartDate,
          searchEndDate,
          service.duration,
          intervalMinutes,
          instance.business_hours,
          instance.timezone, // 🔧 CORREÇÃO: Passar timezone da instância
          calendars,
          originalTimezone
        );

        // Verificar disponibilidade de cada slot
        for (const slot of possibleSlots) {
          if (availableSlots.length >= maxResults) break;

          const startTime = DateTime.fromISO(slot.start_datetime, { setZone: true }).toJSDate();
          const endTime = DateTime.fromISO(slot.end_datetime, { setZone: true }).toJSDate();
          const totalStartTime = addMinutes(startTime, -(service.buffer_before || 0));
          const totalEndTime = addMinutes(endTime, service.buffer_after || 0);

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
      return this.applyStrategy(availableSlots, strategy, maxResults, priorityConfig, timeBlocksConfig);

    } catch (error) {
      console.error('Error suggesting availability:', error);
      return [];
    }
  }

  /**
   * Extrai timezone da string ISO
   */
  private extractTimezone(isoString: string): string {
    const timezoneMatch = isoString.match(/([+-]\d{2}:\d{2}|Z)$/);
    return timezoneMatch ? timezoneMatch[1] : 'Z';
  }

  /**
   * 🔧 CORREÇÃO: Verifica business hours usando timezone da instância
   */
  private isWithinBusinessHours(
    startTime: DateTime, 
    endTime: DateTime, 
    businessHours: any, 
    instanceTimezone: string
  ): boolean {
    // Converter para o timezone da instância para determinar dia e horário local
    const localStartTime = startTime.setZone(instanceTimezone);
    const localEndTime = endTime.setZone(instanceTimezone);
    
    const dayName = localStartTime.toFormat('cccc').toLowerCase();
    const daySchedule = businessHours[dayName];

    console.log(`🕒 Business hours check for ${dayName}:`, {
      original_start: startTime.toString(),
      original_end: endTime.toString(),
      local_start: localStartTime.toString(),
      local_end: localEndTime.toString(),
      instance_timezone: instanceTimezone,
      day_schedule: daySchedule
    });

    if (!daySchedule || !daySchedule.enabled) {
      console.log(`❌ Day ${dayName} is not enabled`);
      return false;
    }

    const startTimeStr = localStartTime.toFormat('HH:mm');
    const endTimeStr = localEndTime.toFormat('HH:mm');

    console.log(`🕒 Checking times: ${startTimeStr} - ${endTimeStr} against ${daySchedule.start_time} - ${daySchedule.end_time}`);

    // Verificar se está dentro do horário de funcionamento
    if (startTimeStr < daySchedule.start_time || endTimeStr > daySchedule.end_time) {
      console.log(`❌ Outside business hours: ${startTimeStr}-${endTimeStr} not within ${daySchedule.start_time}-${daySchedule.end_time}`);
      return false;
    }

    // Verificar se não está no horário de pausa
    if (daySchedule.break_start && daySchedule.break_end) {
      if (!(endTimeStr <= daySchedule.break_start || startTimeStr >= daySchedule.break_end)) {
        console.log(`❌ Conflicts with break time: ${daySchedule.break_start}-${daySchedule.break_end}`);
        return false;
      }
    }

    console.log(`✅ Within business hours`);
    return true;
  }

  /**
   * 🔧 CORREÇÃO FINAL: Verifica disponibilidade no Google Calendar
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

      const events = response.data.items || [];
      
      // Filtrar eventos que não bloqueiam
      const potentialBlockingEvents = events.filter(event => {
        if (event.transparency === 'transparent') return false;
        if (event.status === 'cancelled') return false;
        return true;
      });

      // Verificar sobreposição real
      const conflictingEvents = potentialBlockingEvents.filter(event => {
        let eventStart: Date;
        let eventEnd: Date;

        try {
          if (event.start?.dateTime) {
            eventStart = new Date(event.start.dateTime);
          } else if (event.start?.date) {
            eventStart = new Date(event.start.date + 'T00:00:00');
          } else {
            return false;
          }

          if (event.end?.dateTime) {
            eventEnd = new Date(event.end.dateTime);
          } else if (event.end?.date) {
            eventEnd = new Date(event.end.date + 'T23:59:59');
          } else {
            return false;
          }

          const hasOverlap = (eventStart < endTime) && (eventEnd > startTime);
          return hasOverlap;

        } catch (error) {
          console.error('Error parsing event dates:', error);
          return false;
        }
      });

      console.log(`📊 Calendar ${googleCalendarId} availability:`, {
        query_period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
        total_events: events.length,
        potential_blocking: potentialBlockingEvents.length,
        actual_conflicts: conflictingEvents.length,
        available: conflictingEvents.length === 0
      });

      return conflictingEvents.length === 0;
      
    } catch (error) {
      console.error('Error checking Google Calendar availability:', error);
      return false;
    }
  }

  /**
   * 🔧 CORREÇÃO: Gera slots usando timezone da instância
   */
  private generateTimeSlots(
    startDate: DateTime,
    endDate: DateTime,
    durationMinutes: number,
    intervalMinutes: number,
    businessHours: any,
    instanceTimezone: string,
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
      // 🔧 CORREÇÃO: Converter para timezone da instância
      const localDate = currentDate.setZone(instanceTimezone);
      const dayName = localDate.toFormat('cccc').toLowerCase();
      const daySchedule = businessHours[dayName];

      if (daySchedule && daySchedule.enabled) {
        // Período da manhã
        let morningStart = this.parseTimeToDateTime(localDate, daySchedule.start_time);
        let morningEnd = daySchedule.break_start 
          ? this.parseTimeToDateTime(localDate, daySchedule.break_start)
          : this.parseTimeToDateTime(localDate, daySchedule.end_time);

        this.addSlotsForPeriod(morningStart, morningEnd, durationMinutes, intervalMinutes, calendars, slots, originalTimezone);

        // Período da tarde (se houver pausa)
        if (daySchedule.break_start && daySchedule.break_end) {
          let afternoonStart = this.parseTimeToDateTime(localDate, daySchedule.break_end);
          let afternoonEnd = this.parseTimeToDateTime(localDate, daySchedule.end_time);

          this.addSlotsForPeriod(afternoonStart, afternoonEnd, durationMinutes, intervalMinutes, calendars, slots, originalTimezone);
        }
      }

      currentDate = currentDate.plus({ days: 1 });
    }

    return slots;
  }

  /**
   * Adiciona slots para um período específico
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

      calendars.forEach(calendar => {
        slots.push({
          start_datetime: currentTime.toString(),
          end_datetime: endTime.toString(),
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
   * Converte string de tempo para DateTime
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
    maxResults: number,
    priorityConfig: PriorityConfig,
    timeBlocksConfig?: TimeBlocksConfig
  ): AvailabilitySlot[] {
    let result: AvailabilitySlot[] = [];

    switch (strategy) {
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

      case 'time_blocks':
        result = this.applyTimeBlocksStrategy(slots, maxResults, timeBlocksConfig);
        break;

      case 'balanced_distribution':
        result = this.applyBalancedDistribution(slots, maxResults);
        break;

      default:
        result = slots.slice(0, maxResults);
    }

    if (priorityConfig.enabled) {
      result = this.applyPriorityConfig(result, priorityConfig);
    }

    return result;
  }

  /**
   * Estratégia de blocos de tempo
   */
  private applyTimeBlocksStrategy(
    slots: AvailabilitySlot[],
    maxResults: number,
    config?: TimeBlocksConfig
  ): AvailabilitySlot[] {
    const defaultConfig: TimeBlocksConfig = {
      morning_start: '06:00',
      afternoon_start: '12:00',
      evening_start: '18:00',
      morning_slots: Math.floor(maxResults / 3),
      afternoon_slots: Math.floor(maxResults / 3),
      evening_slots: maxResults - (2 * Math.floor(maxResults / 3))
    };

    const finalConfig = { ...defaultConfig, ...config };

    const morningSlots: AvailabilitySlot[] = [];
    const afternoonSlots: AvailabilitySlot[] = [];
    const eveningSlots: AvailabilitySlot[] = [];

    slots.forEach(slot => {
      const slotTime = DateTime.fromISO(slot.start_datetime);
      const timeStr = slotTime.toFormat('HH:mm');

      if (timeStr >= finalConfig.morning_start! && timeStr < finalConfig.afternoon_start!) {
        morningSlots.push(slot);
      } else if (timeStr >= finalConfig.afternoon_start! && timeStr < finalConfig.evening_start!) {
        afternoonSlots.push(slot);
      } else if (timeStr >= finalConfig.evening_start!) {
        eveningSlots.push(slot);
      }
    });

    const sortByTime = (a: AvailabilitySlot, b: AvailabilitySlot) => 
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();

    morningSlots.sort(sortByTime);
    afternoonSlots.sort(sortByTime);
    eveningSlots.sort(sortByTime);

    const result: AvailabilitySlot[] = [
      ...morningSlots.slice(0, finalConfig.morning_slots),
      ...afternoonSlots.slice(0, finalConfig.afternoon_slots),
      ...eveningSlots.slice(0, finalConfig.evening_slots)
    ];

    return result.sort(sortByTime).slice(0, maxResults);
  }

  /**
   * Estratégia de distribuição balanceada
   */
  private applyBalancedDistribution(
    slots: AvailabilitySlot[],
    maxResults: number
  ): AvailabilitySlot[] {
    const dayGroups = new Map<string, AvailabilitySlot[]>();
    
    slots.forEach(slot => {
      const day = DateTime.fromISO(slot.start_datetime).toFormat('yyyy-MM-dd');
      if (!dayGroups.has(day)) {
        dayGroups.set(day, []);
      }
      dayGroups.get(day)!.push(slot);
    });

    const sortedDays = Array.from(dayGroups.keys()).sort();
    const totalDays = sortedDays.length;
    
    if (totalDays === 0) return [];

    const slotsPerDay = Math.floor(maxResults / totalDays);
    const remainder = maxResults % totalDays;

    const result: AvailabilitySlot[] = [];

    sortedDays.forEach((day, index) => {
      const daySlots = dayGroups.get(day)!;
      const slotsToTake = slotsPerDay + (index < remainder ? 1 : 0);
      
      daySlots.sort((a, b) => 
        new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
      );
      
      if (daySlots.length > slotsToTake && slotsToTake > 1) {
        const interval = Math.floor(daySlots.length / slotsToTake);
        for (let i = 0; i < slotsToTake; i++) {
          const index = Math.min(i * interval, daySlots.length - 1);
          result.push(daySlots[index]);
        }
      } else {
        result.push(...daySlots.slice(0, slotsToTake));
      }
    });

    return result.sort((a, b) => 
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
    );
  }

  /**
   * Aplica configuração de prioridade
   */
  private applyPriorityConfig(
    slots: AvailabilitySlot[],
    config: PriorityConfig
  ): AvailabilitySlot[] {
    return slots.sort((a, b) => {
      const priorityComparison = config.order === 'asc' 
        ? a.priority - b.priority 
        : b.priority - a.priority;
      
      if (priorityComparison === 0) {
        return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
      }
      
      return priorityComparison;
    });
  }

  /**
   * Distribui slots igualmente entre calendários
   */
  private distributeEqually(slots: AvailabilitySlot[], maxResults: number): AvailabilitySlot[] {
    const calendarGroups = new Map<string, AvailabilitySlot[]>();
    
    slots.forEach(slot => {
      if (!calendarGroups.has(slot.calendar_id)) {
        calendarGroups.set(slot.calendar_id, []);
      }
      calendarGroups.get(slot.calendar_id)!.push(slot);
    });

    const sortedCalendars = Array.from(calendarGroups.entries()).sort((a, b) => {
      const priorityA = a[1][0]?.priority || 999;
      const priorityB = b[1][0]?.priority || 999;
      return priorityA - priorityB;
    });

    const result: AvailabilitySlot[] = [];
    const calendarsCount = sortedCalendars.length;
    const slotsPerCalendar = Math.floor(maxResults / calendarsCount);
    const remainder = maxResults % calendarsCount;

    sortedCalendars.forEach(([calendarId, calendarSlots], index) => {
      const slots = slotsPerCalendar + (index < remainder ? 1 : 0);
      const sortedSlots = calendarSlots.sort((a, b) => 
        new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
      );
      result.push(...sortedSlots.slice(0, slots));
    });

    return result.sort((a, b) => 
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
    );
  }
}