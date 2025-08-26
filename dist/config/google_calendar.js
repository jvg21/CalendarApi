"use strict";
// src/config/google_calendar.ts - Configuração completa com refresh token
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauth2Client = exports.calendar = void 0;
exports.getAuthUrl = getAuthUrl;
exports.getTokens = getTokens;
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
exports.oauth2Client = oauth2Client;
// Definir credenciais com refresh token
oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});
// Renovar token automaticamente
oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
        console.log('New refresh token:', tokens.refresh_token);
    }
});
exports.calendar = googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
// Função para gerar URL de autorização (usar uma vez para obter código)
function getAuthUrl() {
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
    ];
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent' // Força novo refresh token
    });
}
// Função para trocar código por tokens (usar uma vez)
async function getTokens(code) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}
