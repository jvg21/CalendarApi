"use strict";
// scripts/test-google-auth.ts - Teste para verificar autenticação
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const google_calendar_1 = require("../config/google_calendar");
dotenv_1.default.config();
async function testGoogleAuth() {
    console.log('🔍 Testando autenticação Google Calendar...\n');
    // Verificar variáveis de ambiente
    console.log('📋 Variáveis de ambiente:');
    console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✅ Definido' : '❌ Não definido'}`);
    console.log(`GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✅ Definido' : '❌ Não definido'}`);
    console.log(`GOOGLE_REFRESH_TOKEN: ${process.env.GOOGLE_REFRESH_TOKEN ? '✅ Definido' : '❌ Não definido'}\n`);
    try {
        // Testar refresh de token
        console.log('🔄 Tentando refresh do access token...');
        const { credentials } = await google_calendar_1.oauth2Client.refreshAccessToken();
        console.log('✅ Access token obtido com sucesso');
        console.log(`Token expira em: ${new Date(credentials.expiry_date || 0).toLocaleString()}\n`);
        // Testar listagem de calendários
        console.log('📅 Testando acesso aos calendários...');
        const calendarList = await google_calendar_1.calendar.calendarList.list();
        console.log(`✅ ${calendarList.data.items?.length || 0} calendários encontrados`);
        calendarList.data.items?.forEach((cal, index) => {
            console.log(`${index + 1}. ${cal.summary} (${cal.id})`);
        });
        console.log('\n🎉 Autenticação funcionando corretamente!');
    }
    catch (error) {
        console.error('❌ Erro na autenticação:', error);
        if (error instanceof Error) {
            if (error.message.includes('invalid_grant')) {
                console.log('\n💡 Solução: O refresh token expirou. Execute novamente:');
                console.log('npm run setup:google');
            }
            else if (error.message.includes('invalid_client')) {
                console.log('\n💡 Solução: Verifique GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET');
            }
        }
    }
}
testGoogleAuth().catch(console.error);
