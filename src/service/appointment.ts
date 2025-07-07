import { addMinutes, parseISO } from 'date-fns';
import { supabase } from '../config/supabase';
import { CreateAppointmentRequest, Appointment } from '../types';
import { calendar } from '../config/google_calendar';

export class AppointmentService {
  
  async createAppointment(request: CreateAppointmentRequest): Promise<Appointment> {
    const { instance_id, service_id, start_datetime, client_name, client_email, client_phone, description, calendar_id } = request;

    // Get service details
    const { data: service } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();

    if (!service) {
      throw new Error('Service not found');
    }

    // Determine calendar to use
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
    const endTime = addMinutes(startTime, service.duration);

    // Create Google Calendar event
    const googleEvent = await this.createGoogleEvent({
      calendarId: targetCalendar.google_calendar_id,
      summary: `${service.name} - ${client_name}`,
      description: description || `Service: ${service.name}\nClient: ${client_name}`,
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
        status: 'scheduled'
      })
      .select()
      .single();

    if (error) {
      // Rollback Google Calendar event if DB insert fails
      await this.deleteGoogleEvent(targetCalendar.google_calendar_id, googleEvent.id!);
      throw new Error('Failed to create appointment');
    }

    // Also add to main calendar
    await this.addToMainCalendar(appointment, service, targetCalendar);

    return appointment;
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, calendars(*)')
      .eq('id', id)
      .single();

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Update Google Calendar event if time changed
    if (updates.start_datetime || updates.end_datetime) {
      await this.updateGoogleEvent(
        appointment.calendars.google_calendar_id,
        appointment.google_event_id,
        {
          start: updates.start_datetime ? parseISO(updates.start_datetime) : parseISO(appointment.start_datetime),
          end: updates.end_datetime ? parseISO(updates.end_datetime) : parseISO(appointment.end_datetime),
          summary: updates.title || appointment.title
        }
      );
    }

    const { data: updatedAppointment, error } = await supabase
      .from('appointments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update appointment');
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

    // Delete from Google Calendar
    await this.deleteGoogleEvent(appointment.calendars.google_calendar_id, appointment.google_event_id);
    await this.deleteGoogleEvent(process.env.MAIN_CALENDAR_ID!, appointment.google_event_id);

    // Update status in database
    await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  private async createGoogleEvent(eventData: any) {
    const event = {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.start.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: eventData.end.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      attendees: eventData.attendees,
    };

    const response = await calendar.events.insert({
      calendarId: eventData.calendarId,
      requestBody: event,
    });

    return response.data;
  }

  private async updateGoogleEvent(calendarId: string, eventId: string, updates: any) {
    const event = {
      summary: updates.summary,
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
    });
  }

  private async deleteGoogleEvent(calendarId: string, eventId: string) {
    try {
      await calendar.events.delete({
        calendarId,
        eventId,
      });
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
    }
  }

  private async addToMainCalendar(appointment: any, service: any, calendar: any) {
    const mainCalendarId = process.env.MAIN_CALENDAR_ID!;
    
    await this.createGoogleEvent({
      calendarId: mainCalendarId,
      summary: `[${calendar.name}] ${service.name} - ${appointment.client_name}`,
      description: `Instance: ${calendar.name}\nService: ${service.name}\nClient: ${appointment.client_name}`,
      start: parseISO(appointment.start_datetime),
      end: parseISO(appointment.end_datetime),
      attendees: []
    });
  }
}