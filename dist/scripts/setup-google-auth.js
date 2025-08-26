"use strict";
// scripts/setup-google-auth.ts - Execute uma vez para obter refresh token
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
const google_calendar_1 = require("../config/google_calendar");
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout,
});
async function setupGoogleAuth() {
    console.log('🔐 Configuração de Autenticação Google Calendar\n');
    // Passo 1: Gerar URL de autorização
    const authUrl = (0, google_calendar_1.getAuthUrl)();
    console.log('1️⃣ Acesse esta URL no navegador:');
    console.log(`\n${authUrl}\n`);
    console.log('2️⃣ Autorize o aplicativo e copie o código da URL de retorno\n');
    // Passo 2: Obter código do usuário
    rl.question('3️⃣ Cole o código aqui: ', async (code) => {
        try {
            const tokens = await (0, google_calendar_1.getTokens)(code);
            console.log('\n✅ Tokens obtidos com sucesso!');
            console.log('\n📝 Adicione estas variáveis ao seu .env:');
            console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
            if (tokens.access_token) {
                console.log(`GOOGLE_ACCESS_TOKEN=${tokens.access_token}`);
            }
            console.log('\n🎉 Configuração concluída! Reinicie o servidor.');
        }
        catch (error) {
            console.error('❌ Erro ao obter tokens:', error);
        }
        rl.close();
    });
}
setupGoogleAuth().catch(console.error);
