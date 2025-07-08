// src/config/google_calendar.ts - Configuração completa com refresh token

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

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

export const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
export { oauth2Client };

// Função para gerar URL de autorização (usar uma vez para obter código)
export function getAuthUrl() {
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
export async function getTokens(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}