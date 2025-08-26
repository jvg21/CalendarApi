"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/scripts/debug-availability-issue.ts
const availability_1 = require("../service/availability");
const supabase_1 = require("../config/supabase");
const google_calendar_1 = require("../config/google_calendar");
const luxon_1 = require("luxon");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function debugAvailabilityIssue() {
    console.log('🔍 Starting availability suggestions debug...\n');
    // Usar os mesmos parâmetros da sua requisição
    const testParams = {
        service_id: "8e5fa7fc-7095-4b10-b99b-965fd1a81ecc",
        start_datetime: "2025-08-26T14:00:00.000-03:00",
        end_datetime: "2025-08-26T15:00:00.000-03:00",
        calendar_ids: [
            "c0170c60-6640-4d70-936b-486a148cc375",
            "c0ec4dd5-e2b6-4f64-8e13-3fe55aab6f5e"
        ],
        max_results: 15,
        expand_timeframe: true,
        interval_minutes: 30,
        strategy: "earliest"
    };
    try {
        // 1. VERIFICAR DADOS BÁSICOS
        console.log('📋 1. Verificando dados básicos...');
        const { data: service, error: serviceError } = await supabase_1.supabase
            .from('services')
            .select('*')
            .eq('id', testParams.service_id)
            .single();
        if (serviceError || !service) {
            console.error('❌ Erro ao buscar serviço:', serviceError);
            return;
        }
        console.log('✅ Dados do serviço:', {
            id: service.id,
            name: service.name,
            duration: service.duration,
            buffer_before: service.buffer_before || 0,
            buffer_after: service.buffer_after || 0,
            is_active: service.is_active
        });
        // 2. VERIFICAR CALENDÁRIOS
        console.log('\n📋 2. Verificando calendários...');
        const { data: calendars, error: calendarsError } = await supabase_1.supabase
            .from('calendars')
            .select('id, name, google_calendar_id, priority, instance_id, is_active')
            .in('id', testParams.calendar_ids)
            .eq('is_active', true)
            .order('priority');
        if (calendarsError || !calendars || calendars.length === 0) {
            console.error('❌ Erro ao buscar calendários:', calendarsError);
            return;
        }
        console.log('✅ Calendários encontrados:', calendars.map(cal => ({
            id: cal.id,
            name: cal.name,
            google_calendar_id: cal.google_calendar_id,
            priority: cal.priority,
            is_active: cal.is_active
        })));
        // 3. VERIFICAR EVENTOS EXISTENTES EM CADA CALENDÁRIO NO PERÍODO
        console.log('\n📋 3. Verificando eventos existentes no período...');
        const searchStart = luxon_1.DateTime.fromISO(testParams.start_datetime);
        const searchEnd = luxon_1.DateTime.fromISO(testParams.end_datetime);
        for (const cal of calendars) {
            console.log(`\n🔍 Verificando calendário: ${cal.name}`);
            try {
                const response = await google_calendar_1.calendar.events.list({
                    calendarId: cal.google_calendar_id,
                    timeMin: searchStart.toJSDate().toISOString(),
                    timeMax: searchEnd.plus({ days: 1 }).toJSDate().toISOString(), // +1 dia para ver mais eventos
                    singleEvents: true,
                    orderBy: 'startTime',
                    maxResults: 50
                });
                const events = response.data.items || [];
                console.log(`📊 Eventos encontrados: ${events.length}`);
                events.forEach((event, index) => {
                    const eventStart = event.start?.dateTime || event.start?.date;
                    const eventEnd = event.end?.dateTime || event.end?.date;
                    console.log(`  ${index + 1}. ${event.summary || 'Sem título'}`);
                    console.log(`     Início: ${eventStart}`);
                    console.log(`     Fim: ${eventEnd}`);
                    console.log(`     Status: ${event.status}`);
                    console.log(`     Transparency: ${event.transparency || 'opaque'}`);
                    console.log(`     ID: ${event.id}`);
                    // Verificar se este evento estaria em conflito com um slot às 14:00
                    if (eventStart && eventEnd) {
                        const eStart = new Date(eventStart);
                        const eEnd = new Date(eventEnd);
                        const testSlotStart = searchStart.toJSDate();
                        const testSlotEnd = searchStart.plus({ minutes: service.duration }).toJSDate();
                        const hasOverlap = (eStart < testSlotEnd) && (eEnd > testSlotStart);
                        const wouldBlock = hasOverlap && event.transparency !== 'transparent' && event.status !== 'cancelled';
                        console.log(`     Conflita com 14:00: ${hasOverlap ? '🔴 SIM' : '🟢 NÃO'}`);
                        console.log(`     Bloquearia: ${wouldBlock ? '🔴 SIM' : '🟢 NÃO'}`);
                    }
                    console.log('');
                });
            }
            catch (error) {
                console.error(`❌ Erro ao verificar calendário ${cal.name}:`, error);
            }
        }
        // 4. TESTAR A API DE SUGESTÕES DIRETAMENTE
        console.log('\n📋 4. Testando API de sugestões...');
        const availabilityService = new availability_1.AvailabilityService();
        console.log('Parâmetros da requisição:', testParams);
        const suggestions = await availabilityService.suggestAvailability(testParams.start_datetime, testParams.end_datetime, testParams.service_id, testParams.calendar_ids, testParams.max_results, testParams.expand_timeframe, testParams.interval_minutes, testParams.strategy);
        console.log('\n📊 RESULTADOS DA API:');
        console.log(`Total de sugestões: ${suggestions.length}`);
        suggestions.forEach((suggestion, index) => {
            console.log(`\n${index + 1}. Horário sugerido:`);
            console.log(`   Início: ${suggestion.start_datetime}`);
            console.log(`   Fim: ${suggestion.end_datetime}`);
            console.log(`   Calendário: ${suggestion.calendar_name}`);
            console.log(`   Prioridade: ${suggestion.priority}`);
            // Para cada sugestão, verificar manualmente se há conflitos
            const suggestionStart = luxon_1.DateTime.fromISO(suggestion.start_datetime);
            const suggestionEnd = luxon_1.DateTime.fromISO(suggestion.end_datetime);
            console.log(`   🔍 Verificação manual do slot...`);
        });
        // 5. VERIFICAÇÃO MANUAL DE UM HORÁRIO ESPECÍFICO
        console.log('\n📋 5. Verificação manual do horário 14:00...');
        for (const cal of calendars) {
            console.log(`\n🔍 Verificando manualmente ${cal.name} às 14:00:`);
            const checkResult = await availabilityService.checkAvailability("2025-08-26T14:00:00.000-03:00", testParams.service_id, cal.id);
            console.log('📊 Resultado da verificação manual:', {
                available: checkResult.available,
                conflict_reason: checkResult.conflict_reason,
                calendar_name: checkResult.calendar_name
            });
            // Verificação direta no Google Calendar
            const startTime = luxon_1.DateTime.fromISO("2025-08-26T14:00:00.000-03:00");
            const endTime = startTime.plus({ minutes: service.duration });
            const totalStart = startTime.minus({ minutes: service.buffer_before || 0 });
            const totalEnd = endTime.plus({ minutes: service.buffer_after || 0 });
            try {
                const directResponse = await google_calendar_1.calendar.events.list({
                    calendarId: cal.google_calendar_id,
                    timeMin: totalStart.toJSDate().toISOString(),
                    timeMax: totalEnd.toJSDate().toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime'
                });
                const directEvents = directResponse.data.items || [];
                console.log(`📊 Verificação direta no Google: ${directEvents.length} eventos encontrados`);
                directEvents.forEach(event => {
                    const eventStart = event.start?.dateTime || event.start?.date;
                    const eventEnd = event.end?.dateTime || event.end?.date;
                    console.log(`  - ${event.summary || 'Sem título'}`);
                    console.log(`    ${eventStart} até ${eventEnd}`);
                    console.log(`    Status: ${event.status}, Transparency: ${event.transparency || 'opaque'}`);
                });
            }
            catch (error) {
                console.error(`❌ Erro na verificação direta:`, error);
            }
        }
        // 6. VERIFICAR AGENDAMENTOS NO BANCO DE DADOS
        console.log('\n📋 6. Verificando agendamentos no banco de dados...');
        const { data: dbAppointments, error: appointmentsError } = await supabase_1.supabase
            .from('appointments')
            .select(`
        id,
        title,
        start_datetime,
        end_datetime,
        status,
        google_event_id,
        calendar_id,
        calendars(name, google_calendar_id)
      `)
            .in('calendar_id', testParams.calendar_ids)
            .gte('start_datetime', '2025-08-26 00:00:00')
            .lte('start_datetime', '2025-08-26 23:59:59')
            .order('start_datetime');
        if (!appointmentsError && dbAppointments) {
            console.log(`📊 Agendamentos no banco: ${dbAppointments.length}`);
            dbAppointments.forEach(apt => {
                console.log(`  - ${apt.title}`);
                console.log(`    ${apt.start_datetime} até ${apt.end_datetime}`);
                console.log(`    Status: ${apt.status}`);
                const calInfo = Array.isArray(apt.calendars) ? apt.calendars[0] : apt.calendars;
                console.log(`    Calendar: ${calInfo?.name}`);
                console.log(`    Google Event ID: ${apt.google_event_id}`);
            });
        }
        // 7. ANÁLISE FINAL
        console.log('\n📊 ANÁLISE FINAL:');
        console.log('================');
        console.log(`API sugere ${suggestions.length} horários`);
        // Verificar se alguma sugestão conflita com eventos existentes
        const conflictingSuggestions = [];
        for (const suggestion of suggestions) {
            const suggestionStart = luxon_1.DateTime.fromISO(suggestion.start_datetime);
            const calendarData = calendars.find(c => c.id === suggestion.calendar_id);
            if (!calendarData)
                continue;
            try {
                const response = await google_calendar_1.calendar.events.list({
                    calendarId: calendarData.google_calendar_id,
                    timeMin: suggestionStart.toJSDate().toISOString(),
                    timeMax: suggestionStart.plus({ minutes: service.duration }).toJSDate().toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime'
                });
                const conflictingEvents = (response.data.items || []).filter(event => {
                    if (event.transparency === 'transparent' || event.status === 'cancelled') {
                        return false;
                    }
                    const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
                    const eventEnd = new Date(event.end?.dateTime || event.end?.date || '');
                    const slotStart = suggestionStart.toJSDate();
                    const slotEnd = suggestionStart.plus({ minutes: service.duration }).toJSDate();
                    return (eventStart < slotEnd) && (eventEnd > slotStart);
                });
                if (conflictingEvents.length > 0) {
                    conflictingSuggestions.push({
                        suggestion,
                        conflicts: conflictingEvents
                    });
                }
            }
            catch (error) {
                console.error(`Erro verificando sugestão ${suggestion.start_datetime}:`, error);
            }
        }
        console.log(`🔴 Sugestões com conflito: ${conflictingSuggestions.length}`);
        conflictingSuggestions.forEach((conflict, index) => {
            console.log(`\n${index + 1}. Conflito detectado:`);
            console.log(`   Sugestão: ${conflict.suggestion.start_datetime} (${conflict.suggestion.calendar_name})`);
            console.log(`   Conflitos:`);
            conflict.conflicts.forEach((event) => {
                console.log(`     - ${event.summary || 'Sem título'}`);
                console.log(`       ${event.start?.dateTime || event.start?.date} até ${event.end?.dateTime || event.end?.date}`);
            });
        });
        if (conflictingSuggestions.length === 0) {
            console.log('✅ Nenhum conflito detectado na verificação manual');
        }
        else {
            console.log(`\n💡 PROBLEMA IDENTIFICADO: A API está sugerindo ${conflictingSuggestions.length} horários que têm conflitos!`);
            console.log('\n🔧 POSSÍVEIS CAUSAS:');
            console.log('1. Bug na lógica de sobreposição de eventos');
            console.log('2. Problema com timezone/conversão de datas');
            console.log('3. Cache de eventos antigo no Google Calendar');
            console.log('4. Filtros de transparency/cancelled não funcionando');
        }
    }
    catch (error) {
        console.error('❌ Erro geral no debug:', error);
    }
}
// Função adicional para testar um horário específico step-by-step
async function debugSpecificSlot() {
    console.log('\n🔧 DEBUG ESPECÍFICO DO HORÁRIO 14:00...\n');
    const TEST_TIME = "2025-08-26T14:00:00.000-03:00";
    const SERVICE_ID = "8e5fa7fc-7095-4b10-b99b-965fd1a81ecc";
    const CALENDAR_ID = "c0170c60-6640-4d70-936b-486a148cc375";
    try {
        // 1. Buscar dados do calendário
        const { data: calendarData } = await supabase_1.supabase
            .from('calendars')
            .select('google_calendar_id, name')
            .eq('id', CALENDAR_ID)
            .single();
        if (!calendarData) {
            console.error('❌ Calendário não encontrado');
            return;
        }
        // 2. Buscar dados do serviço
        const { data: service } = await supabase_1.supabase
            .from('services')
            .select('duration, buffer_before, buffer_after')
            .eq('id', SERVICE_ID)
            .single();
        if (!service) {
            console.error('❌ Serviço não encontrado');
            return;
        }
        // 3. Calcular horários com timezone correto
        const startTime = luxon_1.DateTime.fromISO(TEST_TIME, { setZone: true });
        const endTime = startTime.plus({ minutes: service.duration });
        const totalStart = startTime.minus({ minutes: service.buffer_before || 0 });
        const totalEnd = endTime.plus({ minutes: service.buffer_after || 0 });
        console.log('⏰ Horários calculados:');
        console.log(`   Solicitado: ${TEST_TIME}`);
        console.log(`   Início real: ${startTime.toString()}`);
        console.log(`   Fim real: ${endTime.toString()}`);
        console.log(`   Com buffer início: ${totalStart.toString()}`);
        console.log(`   Com buffer fim: ${totalEnd.toString()}`);
        console.log(`   Timezone: ${startTime.zoneName}`);
        console.log(`   Offset: ${startTime.offset} minutos`);
        // 4. Buscar eventos no período exato
        console.log('\n🔍 Buscando eventos no Google Calendar...');
        const response = await google_calendar_1.calendar.events.list({
            calendarId: calendarData.google_calendar_id,
            timeMin: totalStart.toJSDate().toISOString(),
            timeMax: totalEnd.toJSDate().toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });
        const events = response.data.items || [];
        console.log(`📊 Query Google Calendar:`);
        console.log(`   Calendar ID: ${calendarData.google_calendar_id}`);
        console.log(`   Time Min: ${totalStart.toJSDate().toISOString()}`);
        console.log(`   Time Max: ${totalEnd.toJSDate().toISOString()}`);
        console.log(`   Eventos retornados: ${events.length}`);
        if (events.length > 0) {
            console.log('\n📋 Eventos que podem causar conflito:');
            events.forEach((event, index) => {
                const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
                const eventEnd = new Date(event.end?.dateTime || event.end?.date || '');
                // Verificar sobreposição exata
                const hasOverlap = (eventStart < totalEnd.toJSDate()) && (eventEnd > totalStart.toJSDate());
                const isTransparent = event.transparency === 'transparent';
                const isCancelled = event.status === 'cancelled';
                const wouldBlock = hasOverlap && !isTransparent && !isCancelled;
                console.log(`\n  ${index + 1}. ${event.summary || 'Sem título'}`);
                console.log(`     Início do evento: ${event.start?.dateTime || event.start?.date}`);
                console.log(`     Fim do evento: ${event.end?.dateTime || event.end?.date}`);
                console.log(`     Status: ${event.status}`);
                console.log(`     Transparency: ${event.transparency || 'opaque'}`);
                console.log(`     Tem sobreposição: ${hasOverlap ? '🔴 SIM' : '🟢 NÃO'}`);
                console.log(`     É transparente: ${isTransparent ? '🟢 SIM' : '🔴 NÃO'}`);
                console.log(`     É cancelado: ${isCancelled ? '🟢 SIM' : '🔴 NÃO'}`);
                console.log(`     🎯 BLOQUEIA: ${wouldBlock ? '🔴 SIM' : '🟢 NÃO'}`);
            });
        }
        else {
            console.log('✅ Nenhum evento encontrado no período - horário deveria estar disponível');
        }
        // 5. Testar o método checkAvailability
        console.log('\n📋 5. Testando método checkAvailability...');
        const availabilityService = new availability_1.AvailabilityService();
        const checkResult = await availabilityService.checkAvailability(TEST_TIME, SERVICE_ID, CALENDAR_ID);
        console.log('📊 Resultado checkAvailability:', checkResult);
    }
    catch (error) {
        console.error('❌ Erro no debug específico:', error);
    }
}
async function main() {
    await debugAvailabilityIssue();
    await debugSpecificSlot();
}
// Para executar: npm run debug:availability
main().catch(console.error);
