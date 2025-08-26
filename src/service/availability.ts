// src/service/availability.ts - VERSÃO COMPLETA CORRIGIDA

import { addMinutes, parseISO, format, addDays, isAfter, isBefore, isWithinInterval } from 'date-fns';
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
   * 🔧 MÉTODO CORRIGIDO: Verifica se um horário específico está disponível
   */
  async checkAvailability(
    startDatetime: string,
    service_id: string,
    calendarId: string
  ): Promise<AvailabilityCheckResult> {
    try {
      console.log(`🔍 Checking availability: ${startDatetime} for service ${service_id} in calendar ${calendarId}`);

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

      // 🔧 CORREÇÃO DE TIMEZONE: Parsing correto preservando timezone original
      console.log(`📅 Parsing timezone: Input = ${startDatetime}`);
      
      const startTime = DateTime.fromISO(startDatetime, { setZone: true });
      const endTime = startTime.plus({ minutes: service.duration });
      
      // Calcular horário total com buffers
      const totalStartTime = startTime.minus({ minutes: service.buffer_before || 0 });
      const totalEndTime = endTime.plus({ minutes: service.buffer_after || 0 });

      console.log(`📊 Timezone conversion check:`, {
        input: startDatetime,
        parsed_local: startTime.toString(),
        parsed_utc: startTime.toUTC().toString(),
        total_start_local: totalStartTime.toString(),
        total_start_utc: totalStartTime.toUTC().toString(),
        timezone: startTime.zoneName,
        offset_hours: startTime.offset / 60
      });

      // Objeto base de resposta
      const baseResponse = {
        calendar_name: calendarData.name,
        start_datetime: startTime.toString(),
        end_datetime: endTime.toString(),
        service_name: service.name,
        service_duration: service.duration
      };

      // 4. Verificar se está dentro do horário comercial (usar horário LOCAL)
      if (!this.isWithinBusinessHours(startTime.toJSDate(), endTime.toJSDate(), instance.business_hours)) {
        return {
          ...baseResponse,
          available: false,
          conflict_reason: 'Outside business hours'
        };
      }

      // 5. 🔧 CORREÇÃO PRINCIPAL: Converter para UTC antes do Google Calendar
      console.log(`🌍 Converting to UTC for Google Calendar API...`);
      
      const utcStartTime = totalStartTime.toUTC().toJSDate();
      const utcEndTime = totalEndTime.toUTC().toJSDate();
      
      console.log(`📅 UTC times for Google Calendar:`, {
        utc_start: utcStartTime.toISOString(),
        utc_end: utcEndTime.toISOString()
      });

      const isAvailable = await this.checkGoogleCalendarAvailability(
        calendarData.google_calendar_id,
        utcStartTime,  // ✅ CORRIGIDO: Agora em UTC
        utcEndTime     // ✅ CORRIGIDO: Agora em UTC
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
   * 🔧 MÉTODO CORRIGIDO: Verifica disponibilidade em múltiplos calendários
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

      // 🔧 PARSING CORRETO DE TIMEZONE
      const startTime = DateTime.fromISO(startDatetime, { setZone: true });
      const endTime = startTime.plus({ minutes: service.duration });
      
      console.log(`🌍 Input timezone analysis:`, {
        input: startDatetime,
        parsed_local: startTime.toString(),
        parsed_utc: startTime.toUTC().toString(),
        timezone: startTime.zoneName,
        offset: startTime.offset
      });

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

      for (const calendarData of calendars) {
        console.log(`\n🔍 Checking calendar: ${calendarData.name} (${calendarData.id})`);

        try {
          // Buscar business hours da instância
          const { data: instance } = await supabase
            .from('instances')
            .select('business_hours')
            .eq('id', calendarData.instance_id)
            .single();

          if (!instance) {
            unavailableCalendars.push({
              calendar_id: calendarData.id,
              calendar_name: calendarData.name,
              priority: calendarData.priority,
              conflict_reason: 'Instance not found'
            });
            continue;
          }

          // Verificar business hours (usar horário LOCAL)
          const isWithinBusinessHours = this.isWithinBusinessHours(
            startTime.toJSDate(),
            endTime.toJSDate(),
            instance.business_hours
          );

          if (!isWithinBusinessHours) {
            unavailableCalendars.push({
              calendar_id: calendarData.id,
              calendar_name: calendarData.name,
              priority: calendarData.priority,
              conflict_reason: 'Outside business hours'
            });
            continue;
          }

          // 🔧 CORREÇÃO: Calcular buffers e converter para UTC
          const totalStartTime = startTime.minus({ minutes: service.buffer_before || 0 });
          const totalEndTime = endTime.plus({ minutes: service.buffer_after || 0 });
          
          console.log(`🌍 Converting ${calendarData.name} times to UTC:`, {
            local_start: totalStartTime.toString(),
            local_end: totalEndTime.toString(),
            utc_start: totalStartTime.toUTC().toJSDate().toISOString(),
            utc_end: totalEndTime.toUTC().toJSDate().toISOString()
          });

          const isGoogleCalendarAvailable = await this.checkGoogleCalendarAvailability(
            calendarData.google_calendar_id,
            totalStartTime.toUTC().toJSDate(),  // ✅ CORRIGIDO
            totalEndTime.toUTC().toJSDate()     // ✅ CORRIGIDO
          );

          if (isGoogleCalendarAvailable) {
            availableCalendars.push({
              calendar_id: calendarData.id,
              calendar_name: calendarData.name,
              priority: calendarData.priority
            });
            console.log(`✅ Calendar ${calendarData.name} is available`);
          } else {
            unavailableCalendars.push({
              calendar_id: calendarData.id,
              calendar_name: calendarData.name,
              priority: calendarData.priority,
              conflict_reason: 'Time slot already booked'
            });
            console.log(`❌ Calendar ${calendarData.name} is not available`);
          }

        } catch (error) {
          console.error(`Error checking calendar ${calendarData.name}:`, error);
          unavailableCalendars.push({
            calendar_id: calendarData.id,
            calendar_name: calendarData.name,
            priority: calendarData.priority,
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
   * 🔧 MÉTODO CORRIGIDO: Sugere horários disponíveis para agendamento
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
      console.log(`🔍 Suggesting availability from ${startDatetime} to ${endDatetime}`);

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

      // 🔧 CORREÇÃO: Usar DateTime para preservar timezone
      let searchStartDate = DateTime.fromISO(startDatetime, { setZone: true });
      let searchEndDate = DateTime.fromISO(endDatetime, { setZone: true });
      let availableSlots: AvailabilitySlot[] = [];
      let attempts = 0;
      const maxAttempts = 30;

      console.log(`🌍 Search timezone info:`, {
        start: searchStartDate.toString(),
        end: searchEndDate.toString(),
        timezone: searchStartDate.zoneName,
        offset: searchStartDate.offset
      });

      do {
        // Gerar slots possíveis no timeframe atual
        const possibleSlots = this.generateTimeSlots(
          searchStartDate,
          searchEndDate,
          service.duration,
          intervalMinutes,
          instance.business_hours,
          calendars,
          searchStartDate.zoneName || 'America/Sao_Paulo'
        );

        console.log(`📋 Generated ${possibleSlots.length} possible slots for attempt ${attempts + 1}`);

        // Verificar disponibilidade de cada slot
        for (const slot of possibleSlots) {
          if (availableSlots.length >= maxResults) break;

          // 🔧 CONVERSÃO CORRETA: Parse do slot preservando timezone
          const slotStartTime = DateTime.fromISO(slot.start_datetime, { setZone: true });
          const slotEndTime = DateTime.fromISO(slot.end_datetime, { setZone: true });
          
          // Aplicar buffers em timezone local
          const totalStartTime = slotStartTime.minus({ minutes: service.buffer_before || 0 });
          const totalEndTime = slotEndTime.plus({ minutes: service.buffer_after || 0 });

          console.log(`🔍 Checking slot: ${slot.start_datetime} (${slot.calendar_name})`);
          console.log(`   Local times: ${totalStartTime.toString()} to ${totalEndTime.toString()}`);
          
          // 🎯 CONVERSÃO CORRETA PARA UTC
          const utcStartTime = totalStartTime.toUTC().toJSDate();
          const utcEndTime = totalEndTime.toUTC().toJSDate();
          
          console.log(`   UTC for Google: ${utcStartTime.toISOString()} to ${utcEndTime.toISOString()}`);

          const isAvailable = await this.checkGoogleCalendarAvailability(
            slot.google_calendar_id,
            utcStartTime,  // ✅ CORRIGIDO: UTC correto
            utcEndTime     // ✅ CORRIGIDO: UTC correto
          );

          if (isAvailable) {
            availableSlots.push({
              start_datetime: slot.start_datetime,
              end_datetime: slot.end_datetime,
              calendar_id: slot.calendar_id,
              calendar_name: slot.calendar_name,
              priority: slot.priority
            });
            console.log(`✅ Slot added: ${slot.start_datetime}`);
          } else {
            console.log(`❌ Slot rejected: ${slot.start_datetime}`);
          }
        }

        console.log(`📊 Available slots so far: ${availableSlots.length}/${maxResults}`);

        // Se não encontrou slots suficientes e deve expandir
        if (availableSlots.length < maxResults && expandTimeframe && attempts < maxAttempts) {
          searchEndDate = searchEndDate.plus({ days: 1 });
          attempts++;
          console.log(`🔄 Expanding timeframe to ${searchEndDate.toFormat('yyyy-MM-dd')}`);
        } else {
          break;
        }

      } while (availableSlots.length < maxResults && expandTimeframe && attempts < maxAttempts);

      // Aplicar estratégia de retorno
      const finalResults = this.applyStrategy(availableSlots, strategy, maxResults, priorityConfig, timeBlocksConfig);
      
      console.log(`🎉 Final suggestion result: ${finalResults.length} slots`);
      return finalResults;

    } catch (error) {
      console.error('Error suggesting availability:', error);
      return [];
    }
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
   * 🔧 MÉTODO CORRIGIDO: Verifica disponibilidade no Google Calendar
   */
  private async checkGoogleCalendarAvailability(
    googleCalendarId: string,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    try {
      console.log(`🔍 Google Calendar query:`, {
        calendar_id: googleCalendarId,
        query_start_utc: startTime.toISOString(),
        query_end_utc: endTime.toISOString(),
        duration_minutes: (endTime.getTime() - startTime.getTime()) / (1000 * 60)
      });

      const response = await calendar.events.list({
        calendarId: googleCalendarId,
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      
      console.log(`📊 Google Calendar response: ${events.length} events found`);

      // 🔧 FILTRAR eventos que não bloqueiam (mesmo filtro de suggest)
      const potentialBlockingEvents = events.filter(event => {
        // Se transparency é 'transparent', NÃO bloqueia
        if (event.transparency === 'transparent') {
          console.log(`🟢 Ignoring transparent event: ${event.summary}`);
          return false;
        }
        
        // Se status é 'cancelled', NÃO bloqueia
        if (event.status === 'cancelled') {
          console.log(`🟢 Ignoring cancelled event: ${event.summary}`);
          return false;
        }
        
        // Todos os outros eventos podem bloquear
        console.log(`🔴 Potential blocking event: ${event.summary || 'No title'} (${event.transparency || 'opaque'})`);
        return true;
      });

      // 🔧 VERIFICAR sobreposição real com o horário solicitado
      const conflictingEvents = potentialBlockingEvents.filter(event => {
        try {
          let eventStart: Date;
          let eventEnd: Date;

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

          // ✅ VERIFICAÇÃO DE SOBREPOSIÇÃO: (eventStart < endTime) E (eventEnd > startTime)
          const hasOverlap = (eventStart < endTime) && (eventEnd > startTime);
          
          if (hasOverlap) {
            console.log(`💥 OVERLAP DETECTED:`, {
              event: event.summary,
              event_start: eventStart.toISOString(),
              event_end: eventEnd.toISOString(),
              slot_start: startTime.toISOString(),
              slot_end: endTime.toISOString(),
              status: event.status,
              transparency: event.transparency
            });
          }
          
          return hasOverlap;

        } catch (error) {
          console.error('Error parsing event dates:', error);
          return false;
        }
      });

      const isAvailable = conflictingEvents.length === 0;
      
      console.log(`📊 Calendar ${googleCalendarId} - Detailed analysis:`, {
        query_period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
        total_events: events.length,
        transparent_events: events.filter(e => e.transparency === 'transparent').length,
        cancelled_events: events.filter(e => e.status === 'cancelled').length,
        potential_blocking: potentialBlockingEvents.length,
        actual_conflicts: conflictingEvents.length,
        available: isAvailable
      });

      return isAvailable;
      
    } catch (error) {
      console.error('Error checking Google Calendar availability:', error);
      return false;
    }
  }

  /**
   * 🔧 MÉTODO CORRIGIDO: Gera slots de tempo preservando timezone
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

    console.log(`🔧 Generating slots in timezone: ${originalTimezone}`);

    while (currentDate <= endDate) {
      const dayName = currentDate.toFormat('cccc').toLowerCase();
      const daySchedule = businessHours[dayName];

      if (daySchedule && daySchedule.enabled) {
        // Período da manhã
        let morningStart = this.parseTimeToDateTime(currentDate, daySchedule.start_time);
        let morningEnd = daySchedule.break_start 
          ? this.parseTimeToDateTime(currentDate, daySchedule.break_start)
          : this.parseTimeToDateTime(currentDate, daySchedule.end_time);

        this.addSlotsForPeriod(morningStart, morningEnd, durationMinutes, intervalMinutes, calendars, slots);

        // Período da tarde (se houver pausa)
        if (daySchedule.break_start && daySchedule.break_end) {
          let afternoonStart = this.parseTimeToDateTime(currentDate, daySchedule.break_end);
          let afternoonEnd = this.parseTimeToDateTime(currentDate, daySchedule.end_time);

          this.addSlotsForPeriod(afternoonStart, afternoonEnd, durationMinutes, intervalMinutes, calendars, slots);
        }
      }

      currentDate = currentDate.plus({ days: 1 });
    }

    console.log(`📊 Total slots generated: ${slots.length}`);
    return slots;
  }

  /**
   * 🔧 MÉTODO CORRIGIDO: Adiciona slots para um período específico
   */
  private addSlotsForPeriod(
    periodStart: DateTime,
    periodEnd: DateTime,
    durationMinutes: number,
    intervalMinutes: number,
    calendars: any[],
    slots: any[]
  ): void {
    let currentTime = periodStart;

    while (currentTime.plus({ minutes: durationMinutes }) <= periodEnd) {
      const endTime = currentTime.plus({ minutes: durationMinutes });

      // 🔧 IMPORTANTE: Preservar timezone original usando toISO()
      calendars.forEach(calendar => {
        slots.push({
          start_datetime: currentTime.toISO(),  // ✅ Preserva timezone
          end_datetime: endTime.toISO(),        // ✅ Preserva timezone
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

    // Aplicar configuração de prioridade se habilitada
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

    // Categorizar slots por período
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

    // Ordenar cada período por horário
    const sortByTime = (a: AvailabilitySlot, b: AvailabilitySlot) => 
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();

    morningSlots.sort(sortByTime);
    afternoonSlots.sort(sortByTime);
    eveningSlots.sort(sortByTime);

    // Selecionar slots de cada período
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
    // Agrupar slots por dia
    const dayGroups = new Map<string, AvailabilitySlot[]>();
    
    slots.forEach(slot => {
      const day = DateTime.fromISO(slot.start_datetime).toFormat('yyyy-MM-dd');
      if (!dayGroups.has(day)) {
        dayGroups.set(day, []);
      }
      dayGroups.get(day)!.push(slot);
    });

    // Ordenar dias cronologicamente
    const sortedDays = Array.from(dayGroups.keys()).sort();
    const totalDays = sortedDays.length;
    
    if (totalDays === 0) return [];

    // Calcular quantos slots por dia
    const slotsPerDay = Math.floor(maxResults / totalDays);
    const remainder = maxResults % totalDays;

    const result: AvailabilitySlot[] = [];

    // Distribuir slots por dia
    sortedDays.forEach((day, index) => {
      const daySlots = dayGroups.get(day)!;
      const slotsToTake = slotsPerDay + (index < remainder ? 1 : 0);
      
      // Ordenar slots do dia por horário
      daySlots.sort((a, b) => 
        new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
      );
      
      // Se tem mais slots que o necessário, distribuir uniformemente
      if (daySlots.length > slotsToTake && slotsToTake > 1) {
        const interval = Math.floor(daySlots.length / slotsToTake);
        for (let i = 0; i < slotsToTake; i++) {
          const index = Math.min(i * interval, daySlots.length - 1);
          result.push(daySlots[index]);
        }
      } else {
        // Pegar os primeiros slots disponíveis
        result.push(...daySlots.slice(0, slotsToTake));
      }
    });

    // Ordenar resultado final por horário
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
      
      // Se prioridades são iguais, manter ordem por horário
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