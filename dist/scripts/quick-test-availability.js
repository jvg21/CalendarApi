"use strict";
// src/scripts/quick-test-availability.ts
// Script para reproduzir rapidamente o problema relatado
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const availability_1 = require("../service/availability");
const supabase_1 = require("../config/supabase");
const google_calendar_1 = require("../config/google_calendar");
const luxon_1 = require("luxon");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function quickTest() {
    console.log('🧪 TESTE RÁPIDO - Reproduzindo o problema...\n');
    // Parâmetros exatos da sua requisição
    const testData = {
        service_id: "8e5fa7fc-7095-4b10-b99b-965fd1a81ecc",
        start_datetime: "2025-08-26T14:00:00.000-03:00",
        end_datetime: "2025-08-26T15:00:00.000-03:00",
        calendar_ids: [
            "c0170c60-6640-4d70-936b-486a148cc375",
            "c0ec4dd5-e2b6-4f64-8e13-3fe55aab6f5e"
        ]
    };
    try {
        // 1. TESTAR A API ATUAL
        console.log('📋 1. Testando API atual de sugestões...');
        const availabilityService = new availability_1.AvailabilityService();
        const suggestions = await availabilityService.suggestAvailability(testData.start_datetime, testData.end_datetime, testData.service_id, testData.calendar_ids, 15, true, 30, "earliest");
        console.log(`✅ API retornou ${suggestions.length} sugestões`);
        // 2. VERIFICAR CADA SUGESTÃO MANUALMENTE
        console.log('\n📋 2. Verificando cada sugestão manualmente...');
        const problemSlots = [];
        for (let i = 0; i < Math.min(suggestions.length, 5); i++) {
            const suggestion = suggestions[i];
            console.log(`\n🔍 Verificando sugestão ${i + 1}: ${suggestion.start_datetime}`);
            // Buscar dados do calendário
            const { data: calendarData } = await supabase_1.supabase
                .from('calendars')
                .select('google_calendar_id, name')
                .eq('id', suggestion.calendar_id)
                .single();
            if (!calendarData) {
                console.log('❌ Calendar data not found');
                continue;
            }
            // Buscar dados do serviço
            const { data: service } = await supabase_1.supabase
                .from('services')
                .select('duration, buffer_before, buffer_after')
                .eq('id', testData.service_id)
                .single();
            if (!service) {
                console.log('❌ Service data not found');
                continue;
            }
            // Calcular horários do slot
            const slotStart = luxon_1.DateTime.fromISO(suggestion.start_datetime);
            const slotEnd = luxon_1.DateTime.fromISO(suggestion.end_datetime);
            const totalSlotStart = slotStart.minus({ minutes: service.buffer_before || 0 });
            const totalSlotEnd = slotEnd.plus({ minutes: service.buffer_after || 0 });
            console.log(`⏰ Slot times:`, {
                slot_start: slotStart.toString(),
                slot_end: slotEnd.toString(),
                total_start: totalSlotStart.toString(),
                total_end: totalSlotEnd.toString()
            });
            // Verificar eventos no Google Calendar
            const googleResponse = await google_calendar_1.calendar.events.list({
                calendarId: calendarData.google_calendar_id,
                timeMin: totalSlotStart.toJSDate().toISOString(),
                timeMax: totalSlotEnd.toJSDate().toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                showDeleted: false
            });
            const eventsInPeriod = googleResponse.data.items || [];
            console.log(`📅 Found ${eventsInPeriod.length} events in period`);
            // Analisar cada evento
            const conflicts = [];
            eventsInPeriod.forEach(event => {
                const eventStart = new Date(event.start?.dateTime || event.start?.date + 'T00:00:00');
                const eventEnd = new Date(event.end?.dateTime || event.end?.date + 'T23:59:59');
                const hasOverlap = (eventStart < totalSlotEnd.toJSDate()) &&
                    (eventEnd > totalSlotStart.toJSDate());
                const isTransparent = event.transparency === 'transparent';
                const isCancelled = event.status === 'cancelled';
                const wouldBlock = hasOverlap && !isTransparent && !isCancelled;
                console.log(`  📎 Event: ${event.summary || 'No title'}`);
                console.log(`     Time: ${eventStart.toISOString()} to ${eventEnd.toISOString()}`);
                console.log(`     Status: ${event.status || 'confirmed'}, Transparency: ${event.transparency || 'opaque'}`);
                console.log(`     Has overlap: ${hasOverlap}, Would block: ${wouldBlock}`);
                if (wouldBlock) {
                    conflicts.push({
                        summary: event.summary,
                        start: eventStart.toISOString(),
                        end: eventEnd.toISOString(),
                        status: event.status,
                        transparency: event.transparency
                    });
                }
            });
            // Verificar no banco de dados também
            const { data: dbAppointments } = await supabase_1.supabase
                .from('appointments')
                .select('*')
                .eq('calendar_id', suggestion.calendar_id)
                .gte('start_datetime', totalSlotStart.toISO())
                .lte('end_datetime', totalSlotEnd.toISO())
                .neq('status', 'cancelled');
            const dbConflicts = dbAppointments?.length || 0;
            console.log(`📊 Conflicts found: ${conflicts.length} Google + ${dbConflicts} DB`);
            if (conflicts.length > 0 || dbConflicts > 0) {
                problemSlots.push({
                    suggestion,
                    google_conflicts: conflicts,
                    db_conflicts: dbAppointments || []
                });
            }
        }
        // 3. RELATÓRIO FINAL
        console.log('\n📊 RELATÓRIO FINAL:');
        console.log('===================');
        console.log(`Total de sugestões da API: ${suggestions.length}`);
        console.log(`Sugestões com conflitos detectados: ${problemSlots.length}`);
        if (problemSlots.length > 0) {
            console.log('\n🔴 PROBLEMA CONFIRMADO! Detalhes:');
            problemSlots.forEach((problem, index) => {
                console.log(`\n${index + 1}. Horário problemático: ${problem.suggestion.start_datetime}`);
                console.log(`   Calendar: ${problem.suggestion.calendar_name}`);
                console.log(`   Conflitos Google: ${problem.google_conflicts.length}`);
                console.log(`   Conflitos DB: ${problem.db_conflicts.length}`);
                problem.google_conflicts.forEach((conflict) => {
                    console.log(`     - Google: ${conflict.summary} (${conflict.start} to ${conflict.end})`);
                });
                problem.db_conflicts.forEach((conflict) => {
                    console.log(`     - DB: ${conflict.title} (${conflict.start_datetime} to ${conflict.end_datetime})`);
                });
            });
            console.log('\n💡 SOLUÇÕES RECOMENDADAS:');
            console.log('1. Aplicar o patch de correção do método checkGoogleCalendarAvailability');
            console.log('2. Executar teste novamente para verificar');
            console.log('3. Considerar adicionar cache invalidation se necessário');
        }
        else {
            console.log('\n✅ Nenhum conflito detectado na verificação manual');
            console.log('O problema pode estar em outra parte do fluxo');
        }
        // 4. TESTAR MÉTODO INDIVIDUAL
        console.log('\n📋 4. Testando método checkAvailability individual...');
        for (const calendarId of testData.calendar_ids) {
            console.log(`\n🔍 Testing calendar ${calendarId} at 14:00:`);
            const individualResult = await availabilityService.checkAvailability("2025-08-26T14:00:00.000-03:00", testData.service_id, calendarId);
            console.log(`📊 Individual check result:`, {
                available: individualResult.available,
                calendar: individualResult.calendar_name,
                conflict_reason: individualResult.conflict_reason
            });
        }
    }
    catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}
// Para executar: npm run test:quick
quickTest().catch(console.error);
