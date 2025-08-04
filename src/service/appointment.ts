// src/service/appointment.ts - CORRIGIDO PARA USAR LUXON E PRESERVAR TIMEZONE

import { DateTime } from 'luxon';
import { supabase } from '../config/supabase';
import { CreateAppointmentRequest, Appointment } from '../types';
import { calendar } from '../config/google_calendar';
import { AvailabilityService } from './availability';

export class AppointmentService {
  private availabilityService: AvailabilityService;

  constructor() {
    this.availabilityService = new AvailabilityService();
  }

  async createAppointment(request: CreateAppointmentRequest): Promise<Appointment> {
    const {
      instance_id,
      service_id,
      start_datetime,
      end_datetime,
      client_name,
      client_email,
      client_phone,
      description,
      calendar_id,
      flow_id,
      agent_id,
      user_id
    } = request;

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();

    if (serviceError || !service) {
      throw new Error('Service not found');
    }

    // Determine target calendar
    let targetCalendar;
    if (calendar_id) {
      const { data } = await supabase
        .from('calendars')
        .select('*')
        .eq('id', calendar_id)
        .eq('instance_id', instance_id)
        .single();
      targetCalendar = data;
    } else {
      // Use highest priority calendar
      const { data } = await supabase
        .from('calendars')
        .select('*')
        .eq('instance_id', instance_id)
        .eq('is_active', true)
        .order('priority')
        .limit(1)
        .single();
      targetCalendar = data;
    }

    if (!targetCalendar) {
      throw new Error('No available calendar found');
    }

    // 🔧 CORREÇÃO: Usar luxon para preservar timezone
    const startTime = DateTime.fromISO(start_datetime, { setZone: true });
    const endTime = end_datetime
      ? DateTime.fromISO(end_datetime, { setZone: true })
      : startTime.plus({ minutes: service.duration });

    // Validate times
    if (endTime <= startTime) {
      throw new Error('End time must be after start time');
    }
    

    // Verificar disponibilidade antes de criar agendamento
    console.log('🔍 Checking availability before creating appointment...');
    const availabilityCheck = await this.availabilityService.checkAvailability(
      start_datetime,
      service_id,
      targetCalendar.id
    );

    if (!availabilityCheck.available) {
      throw new Error(`Time slot not available: ${availabilityCheck.conflict_reason}`);
    }

    console.log('✅ Time slot confirmed as available');

    try {
      // Create event in client's shared calendar using your main calendar credentials
      const googleEvent = await this.createEventInSharedCalendar({
        targetCalendarId: targetCalendar.google_calendar_id,
        summary: `${service.name} - ${client_name}`,
        description: this.buildEventDescription(service, client_name, description),
        start: startTime,
        end: endTime,
        attendees: client_email ? [{ email: client_email }] : []
      });

      // Save to database - usar formato ISO preservando timezone
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          instance_id,
          calendar_id: targetCalendar.id,
          service_id,
          google_event_id: googleEvent.id,
          title: `${service.name} - ${client_name}`,
          description,
          start_datetime: startTime.toString(), // 🔧 Preserva timezone original
          end_datetime: endTime.toString(),     // 🔧 Preserva timezone original
          client_name,
          client_email,
          client_phone,
          status: 'scheduled',
          flow_id,
          agent_id,
          user_id
        })
        .select()
        .single();

      if (error) {
        // Rollback: delete the created event
        await this.deleteEventFromSharedCalendar(
          targetCalendar.google_calendar_id,
          googleEvent.id!
        );
        throw new Error(`Failed to create appointment: ${error.message}`);
      }

      console.log('✅ Appointment created successfully');
      return appointment;

    } catch (error) {
      console.error('❌ Error creating appointment:', error);
      throw new Error(`Failed to create appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, calendars(*), services(*)')
      .eq('id', id)
      .single();

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    let endTime: string | undefined = updates.end_datetime;

    // 🔧 CORREÇÃO: Recalcular end time usando luxon
    if (updates.start_datetime && !updates.end_datetime) {
      const startTime = DateTime.fromISO(updates.start_datetime, { setZone: true });
      endTime = startTime.plus({ minutes: appointment.services.duration }).toString();
    }

    // Verificar disponibilidade se horário mudou
    if (updates.start_datetime || updates.end_datetime) {
      console.log('🔍 Checking availability for updated time...');
      
      const newStartTime = updates.start_datetime || appointment.start_datetime;
      
      const availabilityCheck = await this.availabilityService.checkAvailability(
        newStartTime,
        appointment.service_id,
        appointment.calendar_id
      );

      if (!availabilityCheck.available) {
        throw new Error(`Updated time slot not available: ${availabilityCheck.conflict_reason}`);
      }

      console.log('✅ Updated time slot confirmed as available');
    }

    // Update Google Calendar event if time/title changed
    if (updates.start_datetime || updates.end_datetime || updates.title) {
      // 🔧 CORREÇÃO: Usar luxon para parsing
      const eventStartTime = updates.start_datetime 
        ? DateTime.fromISO(updates.start_datetime, { setZone: true })
        : DateTime.fromISO(appointment.start_datetime, { setZone: true });
      
      const eventEndTime = endTime 
        ? DateTime.fromISO(endTime, { setZone: true })
        : DateTime.fromISO(appointment.end_datetime, { setZone: true });

      await this.updateEventInSharedCalendar(
        appointment.calendars.google_calendar_id,
        appointment.google_event_id,
        {
          start: eventStartTime,
          end: eventEndTime,
          summary: updates.title || appointment.title,
          description: updates.description || appointment.description
        }
      );
    }

    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (endTime) {
      updateData.end_datetime = endTime;
    }

    const { data: updatedAppointment, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update appointment: ${error.message}`);
    }

    console.log('✅ Appointment updated successfully');
    return updatedAppointment;
  }

  async deleteAppointment(id: string): Promise<void> {
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, calendars(*)')
      .eq('id', id)
      .single();

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Delete from Google Calendar if exists
    if (appointment.google_event_id && appointment.calendars?.google_calendar_id) {
      await this.deleteEventFromSharedCalendar(
        appointment.calendars.google_calendar_id,
        appointment.google_event_id
      );
    }

    // Delete permanently from database
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete appointment: ${error.message}`);
    }

    console.log('✅ Appointment deleted successfully');
  }

  async cancelAppointment(id: string): Promise<void> {
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, calendars(*)')
      .eq('id', id)
      .single();

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Delete from client's shared calendar
    await this.deleteEventFromSharedCalendar(
      appointment.calendars.google_calendar_id,
      appointment.google_event_id
    );

    // Update status in database
    await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);

    console.log('✅ Appointment cancelled successfully');
  }

  async validateExistingAppointment(appointmentId: string): Promise<boolean> {
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, calendars(*)')
      .eq('id', appointmentId)
      .single();

    if (!appointment) {
      return false;
    }

    const availabilityCheck = await this.availabilityService.checkAvailability(
      appointment.start_datetime,
      appointment.service_id,
      appointment.calendar_id
    );

    return availabilityCheck.available;
  }

  // 🔧 CORREÇÃO: Função reformulada para trabalhar com DateTime
  private async createEventInSharedCalendar(eventData: {
    targetCalendarId: string;
    summary: string;
    description: string;
    start: DateTime;
    end: DateTime;
    attendees: Array<{ email: string }>;
  }) {
    const event = {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        // 🔧 CORREÇÃO: Usar dateTime com timezone preservado
        dateTime: eventData.start.toISO(), // Mantém timezone original (-03:00)
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        // 🔧 CORREÇÃO: Usar dateTime com timezone preservado
        dateTime: eventData.end.toISO(), // Mantém timezone original (-03:00)
        timeZone: 'America/Sao_Paulo',
      },
      attendees: eventData.attendees,
      // Google Meet automático
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      },
      // Configurações de acesso
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: true,
    };

    console.log('🗓️ Creating Google Calendar event:', {
      calendarId: eventData.targetCalendarId,
      summary: event.summary,
      start_datetime: event.start.dateTime,
      end_datetime: event.end.dateTime,
      timezone: event.start.timeZone
    });

    const response = await calendar.events.insert({
      calendarId: eventData.targetCalendarId,
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    return response.data;
  }

  // 🔧 CORREÇÃO: Função reformulada para trabalhar com DateTime
  private async updateEventInSharedCalendar(
    calendarId: string, 
    eventId: string, 
    updates: {
      start: DateTime;
      end: DateTime;
      summary: string;
      description?: string;
    }
  ) {
    const event = {
      summary: updates.summary,
      description: updates.description,
      start: {
        // 🔧 CORREÇÃO: Usar dateTime com timezone preservado
        dateTime: updates.start.toISO(), // Mantém timezone original
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        // 🔧 CORREÇÃO: Usar dateTime com timezone preservado
        dateTime: updates.end.toISO(), // Mantém timezone original
        timeZone: 'America/Sao_Paulo',
      },
    };

    console.log('🔄 Updating Google Calendar event:', {
      calendarId,
      eventId,
      start_datetime: event.start.dateTime,
      end_datetime: event.end.dateTime,
      timezone: event.start.timeZone
    });

    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: event,
      conferenceDataVersion: 1, // Mantém link do Meet
      sendUpdates: 'all'
    });
  }

  private async deleteEventFromSharedCalendar(calendarId: string, eventId: string) {
    try {
      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all' // Notifica sobre cancelamento
      });
    } catch (error) {
      console.error('Error deleting event from shared calendar:', error);
      // Não throw error para não quebrar o fluxo de cancelamento
    }
  }

  private buildEventDescription(service: any, clientName: string, description?: string): string {
    let eventDescription = `Serviço: ${service.name}\n`;
    eventDescription += `Cliente: ${clientName}\n`;
    eventDescription += `Duração: ${service.duration} minutos\n`;

    if (service.price) {
      eventDescription += `Valor: R$ ${service.price.toFixed(2)}\n`;
    }

    eventDescription += `\n📞 Link do Google Meet será gerado automaticamente\n`;
    eventDescription += `📧 Todos os participantes receberão convite por email\n`;

    if (description) {
      eventDescription += `\nObservações: ${description}`;
    }

    return eventDescription;
  }

  // Método para verificar disponibilidade em calendários compartilhados
  async checkSharedCalendarAvailability(calendarId: string, startTime: Date, endTime: Date): Promise<boolean> {
    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      // Se há eventos no período, não está disponível
      return !response.data.items || response.data.items.length === 0;
    } catch (error) {
      console.error('Error checking calendar availability:', error);
      return false; // Assume não disponível em caso de erro
    }
  }

  // 🔧 CORREÇÃO: Método reformulado para usar luxon
  async getSharedCalendarEvents(calendarId: string, startDate: Date, endDate: Date) {
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
      console.error('Error fetching shared calendar events:', error);
      return [];
    }
  }
  // Adicionar este método na classe AppointmentService em src/service/appointment.ts

/**
 * Atualiza automaticamente o status de agendamentos que passaram do horário
 */
async updateExpiredAppointments(filters?: {
  flow_id?: number;
  user_id?: number;
  agent_id?: number;
  instance_id?: string;
}): Promise<{
  updated_count: number;
  updated_appointments: Array<{
    id: string;
    title: string;
    end_datetime: string;
    old_status: string;
    new_status: string;
  }>;
}> {
  try {
    console.log('🔍 Checking for expired appointments...');

    // Construir query base
    let query = supabase
      .from('appointments')
      .select('id, title, end_datetime, status, flow_id, user_id, agent_id')
      .in('status', ['scheduled', 'confirmed']) // Apenas agendamentos ativos
      .lt('end_datetime', new Date().toISOString()); // Que já passaram do horário

    // Aplicar filtros opcionais
    if (filters?.flow_id) {
      query = query.eq('flow_id', filters.flow_id);
    }
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.agent_id) {
      query = query.eq('agent_id', filters.agent_id);
    }
    if (filters?.instance_id) {
      query = query.eq('instance_id', filters.instance_id);
    }

    // Buscar agendamentos expirados
    const { data: expiredAppointments, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Error fetching expired appointments: ${fetchError.message}`);
    }

    if (!expiredAppointments || expiredAppointments.length === 0) {
      console.log('✅ No expired appointments found');
      return {
        updated_count: 0,
        updated_appointments: []
      };
    }

    console.log(`📋 Found ${expiredAppointments.length} expired appointments`);

    // Atualizar status para 'completed'
    const appointmentIds = expiredAppointments.map(apt => apt.id);
    
    const { data: updatedAppointments, error: updateError } = await supabase
      .from('appointments')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .in('id', appointmentIds)
      .select('id, title, end_datetime, status');

    if (updateError) {
      throw new Error(`Error updating expired appointments: ${updateError.message}`);
    }

    // Preparar resultado
    const result = expiredAppointments.map(apt => ({
      id: apt.id,
      title: apt.title,
      end_datetime: apt.end_datetime,
      old_status: apt.status,
      new_status: 'completed'
    }));

    console.log(`✅ Successfully updated ${result.length} expired appointments to 'completed' status`);

    return {
      updated_count: result.length,
      updated_appointments: result
    };

  } catch (error) {
    console.error('❌ Error updating expired appointments:', error);
    throw new Error(`Failed to update expired appointments: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
}