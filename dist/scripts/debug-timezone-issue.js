"use strict";
// src/scripts/debug-timezone-issue.ts
// 🔧 ANÁLISE E CORREÇÃO DO PROBLEMA DE TIMEZONE
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function debugTimezone() {
    console.log('🌍 DEBUGANDO PROBLEMA DE TIMEZONE...\n');
    const TEST_INPUT = "2025-08-26T14:00:00.000-03:00";
    console.log('📅 INPUT ORIGINAL:', TEST_INPUT);
    console.log('🎯 ESPERADO EM UTC: 2025-08-26T17:00:00.000Z (14 + 3 = 17)');
    console.log('❌ ATUAL NOS LOGS: 2025-08-26T12:00:00.000Z');
    console.log('🔍 DIFERENÇA: -5 horas (deveria ser +3)\n');
    // 1. TESTAR DIFERENTES MÉTODOS DE PARSING
    console.log('📋 1. Testando diferentes métodos de parsing...\n');
    // Método 1: DateTime.fromISO com setZone
    const dt1 = luxon_1.DateTime.fromISO(TEST_INPUT, { setZone: true });
    console.log('🔧 DateTime.fromISO({ setZone: true }):');
    console.log(`   Original: ${dt1.toString()}`);
    console.log(`   UTC: ${dt1.toUTC().toString()}`);
    console.log(`   toJSDate().toISOString(): ${dt1.toJSDate().toISOString()}`);
    console.log(`   Timezone: ${dt1.zoneName}, Offset: ${dt1.offset} min\n`);
    // Método 2: DateTime.fromISO sem setZone
    const dt2 = luxon_1.DateTime.fromISO(TEST_INPUT);
    console.log('🔧 DateTime.fromISO() (sem setZone):');
    console.log(`   Original: ${dt2.toString()}`);
    console.log(`   UTC: ${dt2.toUTC().toString()}`);
    console.log(`   toJSDate().toISOString(): ${dt2.toJSDate().toISOString()}`);
    console.log(`   Timezone: ${dt2.zoneName}, Offset: ${dt2.offset} min\n`);
    // Método 3: new Date() direto
    const dt3 = new Date(TEST_INPUT);
    console.log('🔧 new Date() direto:');
    console.log(`   toISOString(): ${dt3.toISOString()}`);
    console.log(`   toString(): ${dt3.toString()}`);
    console.log(`   getTime(): ${dt3.getTime()}\n`);
    // Método 4: parseISO do date-fns
    try {
        const { parseISO } = await Promise.resolve().then(() => __importStar(require('date-fns')));
        const dt4 = parseISO(TEST_INPUT);
        console.log('🔧 parseISO do date-fns:');
        console.log(`   toISOString(): ${dt4.toISOString()}`);
        console.log(`   toString(): ${dt4.toString()}\n`);
    }
    catch (error) {
        console.log('❌ Erro testando date-fns parseISO\n');
    }
    // 2. IDENTIFICAR O MÉTODO CORRETO
    console.log('📋 2. Identificando conversão correta...\n');
    const correctUTC = "2025-08-26T17:00:00.000Z";
    console.log('✅ CONVERSÃO CORRETA:');
    console.log(`14:00 -03:00 → ${correctUTC}`);
    console.log('Explicação: 14:00 - (-03:00) = 14:00 + 03:00 = 17:00 UTC\n');
    // Verificar qual método dá o resultado correto
    const methods = [
        { name: 'DateTime.fromISO({ setZone: true }).toJSDate().toISOString()', result: dt1.toJSDate().toISOString() },
        { name: 'DateTime.fromISO().toJSDate().toISOString()', result: dt2.toJSDate().toISOString() },
        { name: 'new Date().toISOString()', result: dt3.toISOString() }
    ];
    methods.forEach(method => {
        const isCorrect = method.result === correctUTC;
        console.log(`${isCorrect ? '✅' : '❌'} ${method.name}: ${method.result}`);
    });
    // 3. ANALISAR CÓDIGO ATUAL
    console.log('\n📋 3. Analisando onde está o problema no código...\n');
    console.log('🔍 LOCALIZAÇÃO PROVÁVEL DO BUG:');
    console.log('1. src/service/availability.ts - método checkAvailability');
    console.log('2. Linha onde converte para JSDate: startTime.toJSDate()');
    console.log('3. Ou na configuração do Luxon DateTime\n');
    // 4. DEMONSTRAR CORREÇÃO
    console.log('📋 4. Demonstrando correção...\n');
    console.log('❌ CÓDIGO ATUAL (provável):');
    console.log('const startTime = DateTime.fromISO(startDatetime, { setZone: true });');
    console.log('const jsDate = startTime.toJSDate(); // Pode estar incorreto\n');
    console.log('✅ CÓDIGO CORRIGIDO:');
    console.log('const startTime = DateTime.fromISO(startDatetime, { setZone: true });');
    console.log('const utcDate = startTime.toUTC().toJSDate(); // Forçar conversão para UTC');
    console.log('// OU');
    console.log('const jsDate = new Date(startDatetime); // JS nativo já converte corretamente\n');
    // 5. TESTAR CORREÇÕES
    console.log('📋 5. Testando correções propostas...\n');
    console.log('🧪 Teste 1 - toUTC().toJSDate():');
    const corrected1 = dt1.toUTC().toJSDate().toISOString();
    console.log(`   Resultado: ${corrected1}`);
    console.log(`   Correto: ${corrected1 === correctUTC ? '✅ SIM' : '❌ NÃO'}\n`);
    console.log('🧪 Teste 2 - new Date() direto:');
    const corrected2 = new Date(TEST_INPUT).toISOString();
    console.log(`   Resultado: ${corrected2}`);
    console.log(`   Correto: ${corrected2 === correctUTC ? '✅ SIM' : '❌ NÃO'}\n`);
    // 6. VERIFICAR TIMEZONE DO SISTEMA
    console.log('📋 6. Verificando configurações de timezone...\n');
    console.log('🖥️ Sistema:');
    console.log(`   Timezone do Node.js: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log(`   Offset atual: ${new Date().getTimezoneOffset()} minutos`);
    console.log(`   Date.now(): ${new Date().toISOString()}\n`);
    console.log('🌎 Luxon:');
    console.log(`   Local timezone: ${luxon_1.DateTime.local().zoneName}`);
    console.log(`   Now: ${luxon_1.DateTime.now().toString()}`);
    console.log(`   Now UTC: ${luxon_1.DateTime.now().toUTC().toString()}\n`);
    // 7. GERAR PATCH
    console.log('📋 7. Gerando patch para correção...\n');
    console.log('🔧 APLIQUE ESTA CORREÇÃO em src/service/availability.ts:\n');
    console.log(`// ANTES (linha ~45 aprox):
const startTime = DateTime.fromISO(startDatetime, { setZone: true });
const endTime = startTime.plus({ minutes: service.duration });
// ...
const totalStartTime = startTime.minus({ minutes: service.buffer_before || 0 });
const totalEndTime = endTime.plus({ minutes: service.buffer_after || 0 });

// DEPOIS:
const startTime = DateTime.fromISO(startDatetime, { setZone: true });
const endTime = startTime.plus({ minutes: service.duration });
// ...
const totalStartTime = startTime.minus({ minutes: service.buffer_before || 0 });
const totalEndTime = endTime.plus({ minutes: service.buffer_after || 0 });

// 🔧 CORREÇÃO: Converter para UTC antes de passar para Google Calendar
const isAvailable = await this.checkGoogleCalendarAvailability(
  calendarData.google_calendar_id,
  totalStartTime.toUTC().toJSDate(), // ← ADICIONAR .toUTC()
  totalEndTime.toUTC().toJSDate()    // ← ADICIONAR .toUTC()
);`);
    console.log('\n🎯 EXPLICAÇÃO DA CORREÇÃO:');
    console.log('- Google Calendar API espera horários em UTC');
    console.log('- Luxon estava mantendo o timezone local (-03:00)');
    console.log('- Precisamos converter explicitamente para UTC com .toUTC()');
}
debugTimezone().catch(console.error);
