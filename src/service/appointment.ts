// src/service/appointment.ts - Adaptado para calendário principal compartilhado

import { addMinutes, parseISO } from 'date-fns';
import { supabase } from '../config/supabase';
import { CreateAppointmentRequest, Appointment } from '../types';
import { calendar } from '../config/google_calendar';

export class AppointmentService {

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

    const startTime = parseISO(start_datetime);
    const endTime = end_datetime
      ? parseISO(end_datetime)
      : addMinutes(startTime, service.duration);

    // Validate times
    if (endTime <= startTime) {
      throw new Error('End time must be after start time');
    }

    try {
      // Create event in client's shared calendar using your main calendar credentials
      const googleEvent = await this.createEventInSharedCalendar({
        targetCalendarId: targetCalendar.google_calendar_id, // Cliente's calendar ID
        summary: `${service.name} - ${client_name}`,
        description: this.buildEventDescription(service, client_name, description),
        start: startTime,
        end: endTime,
        attendees: client_email ? [{ email: client_email }] : []
      });

      // Save to database
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          instance_id,
          calendar_id: targetCalendar.id,
          service_id,
          google_event_id: googleEvent.id,
          title: `${service.name} - ${client_name}`,
          description,
          start_datetime: startTime.toISOString(),
          end_datetime: endTime.toISOString(),
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

      return appointment;

    } catch (error) {
      console.error('Error creating appointment:', error);
      throw new Error(`Failed to create appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

    let endTime = updates.end_datetime;

    // Recalculate end time if start changed but end not provided
    if (updates.start_datetime && !updates.end_datetime) {
      const startTime = parseISO(updates.start_datetime);
      endTime = addMinutes(startTime, appointment.services.duration).toISOString();
    }

    // Update Google Calendar event if time/title changed
    if (updates.start_datetime || updates.end_datetime || updates.title) {
      await this.updateEventInSharedCalendar(
        appointment.calendars.google_calendar_id,
        appointment.google_event_id,
        {
          start: updates.start_datetime ? parseISO(updates.start_datetime) : parseISO(appointment.start_datetime),
          end: endTime ? parseISO(endTime) : parseISO(appointment.end_datetime),
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

    return updatedAppointment;
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
  }

  // src/service/appointment.ts - Substituir método createEventInSharedCalendar

private async createEventInSharedCalendar(eventData: any) {
  // Função para converter Date para string local São Paulo sem timezone
  const toLocalDateTime = (date: Date) => {
    // Assumir que a data recebida já está no timezone correto
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const event = {
    summary: eventData.summary,
    description: eventData.description,
    start: {
      dateTime: toLocalDateTime(eventData.start),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: toLocalDateTime(eventData.end),
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

  const response = await calendar.events.insert({
    calendarId: eventData.targetCalendarId,
    requestBody: event,
    conferenceDataVersion: 1,
    sendUpdates: 'all'
  });

  return response.data;
}


  private async updateEventInSharedCalendar(calendarId: string, eventId: string, updates: any) {
    const event = {
      summary: updates.summary,
      description: updates.description,
      start: {
        dateTime: updates.start.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: updates.end.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
    };

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

  // Método para listar eventos de um calendário compartilhado
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
}