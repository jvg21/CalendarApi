"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/scripts/test-specific-calendar.ts
const availability_1 = require("../service/availability");
const supabase_1 = require("../config/supabase");
const google_calendar_1 = require("../config/google_calendar");
const luxon_1 = require("luxon");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function debugSpecificCalendar() {
    console.log('🔍 Starting specific calendar debug...\n');
    const TEST_CALENDAR_ID = 'd889bafb-4246-4560-abd3-2e835678d641'; // UUID do banco
    const TEST_SERVICE_ID = 'b026ba31-c665-4323-96e4-1e1da208c05b'; // UUID do serviço
    const TEST_DATETIME = '2025-08-01T09:00:00.000-03:00'; // Horário problemático
    try {
        // 1. VERIFICAR DADOS DO CALENDÁRIO
        console.log('📋 1. Verificando dados do calendário...');
        const { data: calendarData, error: calendarError } = await supabase_1.supabase
            .from('calendars')
            .select(`
        id,
        name,
        google_calendar_id,
        instance_id,
        is_active,
        priority
      `)
            .eq('id', TEST_CALENDAR_ID)
            .single();
        if (calendarError) {
            console.error('❌ Erro ao buscar calendário:', calendarError);
            return;
        }
        console.log('✅ Dados do calendário:', {
            id: calendarData.id,
            name: calendarData.name,
            google_calendar_id: calendarData.google_calendar_id,
            is_active: calendarData.is_active,
            priority: calendarData.priority,
            instance_id: calendarData.instance_id
        });
        // Buscar dados da instância separadamente
        const { data: instanceData, error: instanceError } = await supabase_1.supabase
            .from('instances')
            .select('name, business_hours, timezone')
            .eq('id', calendarData.instance_id)
            .single();
        if (instanceError) {
            console.error('❌ Erro ao buscar instância:', instanceError);
            return;
        }
        console.log('✅ Dados da instância:', {
            name: instanceData.name,
            timezone: instanceData.timezone,
            business_hours: instanceData.business_hours
        });
        // 2. VERIFICAR DADOS DO SERVIÇO
        console.log('\n📋 2. Verificando dados do serviço...');
        const { data: serviceData, error: serviceError } = await supabase_1.supabase
            .from('services')
            .select('*')
            .eq('id', TEST_SERVICE_ID)
            .single();
        if (serviceError) {
            console.error('❌ Erro ao buscar serviço:', serviceError);
            return;
        }
        console.log('✅ Dados do serviço:', {
            id: serviceData.id,
            name: serviceData.name,
            duration: serviceData.duration,
            buffer_before: serviceData.buffer_before,
            buffer_after: serviceData.buffer_after,
            is_active: serviceData.is_active
        });
        // CORREÇÃO: Garantir que buffers não sejam null/undefined
        serviceData.buffer_before = serviceData.buffer_before || 0;
        serviceData.buffer_after = serviceData.buffer_after || 0;
        console.log('🔧 Buffers corrigidos:', {
            buffer_before: serviceData.buffer_before,
            buffer_after: serviceData.buffer_after
        });
        // 3. TESTAR PARSING DE DATETIME
        console.log('\n📋 3. Testando parsing de datetime...');
        const startTime = luxon_1.DateTime.fromISO(TEST_DATETIME, { setZone: true });
        const endTime = startTime.plus({ minutes: serviceData.duration });
        const totalStartTime = startTime.minus({ minutes: serviceData.buffer_before || 0 });
        const totalEndTime = endTime.plus({ minutes: serviceData.buffer_after || 0 });
        console.log('✅ Parsing de horários:', {
            original: TEST_DATETIME,
            parsed_start: startTime.toString(),
            parsed_end: endTime.toString(),
            with_buffer_start: totalStartTime.toString(),
            with_buffer_end: totalEndTime.toString(),
            timezone: startTime.zoneName,
            offset: startTime.offset
        });
        // 4. VERIFICAR BUSINESS HOURS
        console.log('\n📋 4. Verificando business hours...');
        const dayName = startTime.toFormat('cccc').toLowerCase();
        const businessHours = instanceData.business_hours;
        const daySchedule = businessHours[dayName];
        console.log('✅ Business hours check:', {
            day_name: dayName,
            day_schedule: daySchedule,
            start_time_str: startTime.toFormat('HH:mm'),
            end_time_str: endTime.toFormat('HH:mm'),
            is_day_enabled: daySchedule?.enabled,
            business_start: daySchedule?.start_time,
            business_end: daySchedule?.end_time,
            break_start: daySchedule?.break_start,
            break_end: daySchedule?.break_end
        });
        // Verificar se está dentro do horário comercial
        let isWithinHours = false;
        if (daySchedule && daySchedule.enabled) {
            const startTimeStr = startTime.toFormat('HH:mm');
            const endTimeStr = endTime.toFormat('HH:mm');
            isWithinHours = startTimeStr >= daySchedule.start_time && endTimeStr <= daySchedule.end_time;
            // Verificar pausa
            if (isWithinHours && daySchedule.break_start && daySchedule.break_end) {
                const isInBreak = !(endTimeStr <= daySchedule.break_start || startTimeStr >= daySchedule.break_end);
                if (isInBreak) {
                    isWithinHours = false;
                    console.log('⚠️ Horário está na pausa!');
                }
            }
        }
        console.log('📊 Within business hours:', isWithinHours);
        // 5. TESTAR GOOGLE CALENDAR DIRETAMENTE
        console.log('\n📋 5. Testando Google Calendar diretamente...');
        try {
            const response = await google_calendar_1.calendar.events.list({
                calendarId: calendarData.google_calendar_id,
                timeMin: totalStartTime.toJSDate().toISOString(),
                timeMax: totalEndTime.toJSDate().toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                showDeleted: false
            });
            const events = response.data.items || [];
            console.log('✅ Google Calendar response:', {
                query_calendar_id: calendarData.google_calendar_id,
                query_timeMin: totalStartTime.toJSDate().toISOString(),
                query_timeMax: totalEndTime.toJSDate().toISOString(),
                events_count: events.length,
                events: events.map(event => ({
                    id: event.id,
                    summary: event.summary,
                    start: event.start?.dateTime || event.start?.date,
                    end: event.end?.dateTime || event.end?.date,
                    status: event.status,
                    created: event.created,
                    updated: event.updated,
                    transparency: event.transparency
                }))
            });
            const isAvailable = events.length === 0;
            console.log('📊 Google Calendar availability:', isAvailable);
            // Verificar se há eventos próximos (mesmo que não conflitantes)
            const nearbyResponse = await google_calendar_1.calendar.events.list({
                calendarId: calendarData.google_calendar_id,
                timeMin: startTime.minus({ hours: 2 }).toJSDate().toISOString(),
                timeMax: endTime.plus({ hours: 2 }).toJSDate().toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                showDeleted: false,
                maxResults: 10
            });
            console.log('🔍 Eventos próximos (±2h):', {
                count: nearbyResponse.data.items?.length || 0,
                events: (nearbyResponse.data.items || []).map(event => ({
                    summary: event.summary,
                    start: event.start?.dateTime || event.start?.date,
                    end: event.end?.dateTime || event.end?.date,
                    status: event.status
                }))
            });
        }
        catch (googleError) {
            console.error('❌ Erro no Google Calendar:', googleError);
        }
        // 6. TESTAR A API DE AVAILABILITY
        console.log('\n📋 6. Testando API de availability...');
        const availabilityService = new availability_1.AvailabilityService();
        const result = await availabilityService.checkAvailability(TEST_DATETIME, TEST_SERVICE_ID, TEST_CALENDAR_ID);
        console.log('✅ API Result:', result);
        // 7. VERIFICAR AGENDAMENTOS EXISTENTES
        console.log('\n📋 7. Verificando agendamentos existentes...');
        const testDate = startTime.toFormat('yyyy-MM-dd');
        const { data: appointments, error: appointmentsError } = await supabase_1.supabase
            .from('appointments')
            .select(`
        id,
        title,
        start_datetime,
        end_datetime,
        status,
        google_event_id,
        service_id
      `)
            .eq('calendar_id', TEST_CALENDAR_ID)
            .gte('start_datetime', `${testDate} 00:00:00`)
            .lte('start_datetime', `${testDate} 23:59:59`)
            .order('start_datetime');
        if (!appointmentsError && appointments) {
            console.log('✅ Agendamentos do dia:', {
                count: appointments.length,
                appointments: appointments.map(apt => ({
                    id: apt.id,
                    title: apt.title,
                    start: apt.start_datetime,
                    end: apt.end_datetime,
                    status: apt.status,
                    google_event_id: apt.google_event_id,
                    service_id: apt.service_id
                }))
            });
        }
        // 8. COMPARAÇÃO FINAL
        console.log('\n📊 RESUMO FINAL:');
        console.log('================');
        console.log(`Calendar found: ${!!calendarData}`);
        console.log(`Service found: ${!!serviceData}`);
        console.log(`Within business hours: ${isWithinHours}`);
        console.log(`Google Calendar available: verificar logs acima`);
        console.log(`API says available: ${result.available}`);
        if (!result.available) {
            console.log(`Conflict reason: ${result.conflict_reason}`);
        }
    }
    catch (error) {
        console.error('❌ Erro geral:', error);
    }
}
// Para executar: npm run test:specific-calendar
debugSpecificCalendar().catch(console.error);
