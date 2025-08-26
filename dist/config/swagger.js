"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.specs = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Calendar Management API',
            version: '1.0.0',
            description: 'API completa para gerenciamento de calendários, agendamentos e verificação de disponibilidade',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            }
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production'
                    ? 'https://calendar.armtexai.org'
                    : 'http://localhost:3010',
                description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtido através do endpoint /api/auth/login'
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID único do usuário'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'Email do usuário'
                        },
                        name: {
                            type: 'string',
                            description: 'Nome do usuário'
                        },
                        role: {
                            type: 'string',
                            enum: ['admin'],
                            description: 'Papel do usuário no sistema'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação do usuário'
                        },
                    },
                    required: ['id', 'email', 'name', 'role']
                },
                BusinessHours: {
                    type: 'object',
                    description: 'Horários de funcionamento para cada dia da semana',
                    properties: {
                        monday: { $ref: '#/components/schemas/DaySchedule' },
                        tuesday: { $ref: '#/components/schemas/DaySchedule' },
                        wednesday: { $ref: '#/components/schemas/DaySchedule' },
                        thursday: { $ref: '#/components/schemas/DaySchedule' },
                        friday: { $ref: '#/components/schemas/DaySchedule' },
                        saturday: { $ref: '#/components/schemas/DaySchedule' },
                        sunday: { $ref: '#/components/schemas/DaySchedule' },
                    },
                    required: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                    example: {
                        monday: { enabled: true, start_time: '08:00', end_time: '18:00', break_start: '12:00', break_end: '13:00' },
                        tuesday: { enabled: true, start_time: '08:00', end_time: '18:00', break_start: '12:00', break_end: '13:00' },
                        wednesday: { enabled: true, start_time: '08:00', end_time: '18:00', break_start: '12:00', break_end: '13:00' },
                        thursday: { enabled: true, start_time: '08:00', end_time: '18:00', break_start: '12:00', break_end: '13:00' },
                        friday: { enabled: true, start_time: '08:00', end_time: '18:00', break_start: '12:00', break_end: '13:00' },
                        saturday: { enabled: false, start_time: '08:00', end_time: '12:00' },
                        sunday: { enabled: false, start_time: '08:00', end_time: '12:00' }
                    }
                },
                DaySchedule: {
                    type: 'object',
                    description: 'Configuração de horário para um dia específico',
                    properties: {
                        enabled: {
                            type: 'boolean',
                            description: 'Se o dia está ativo para agendamentos'
                        },
                        start_time: {
                            type: 'string',
                            pattern: '^\\d{2}:\\d{2}$',
                            example: '09:00',
                            description: 'Horário de início (formato HH:MM)'
                        },
                        end_time: {
                            type: 'string',
                            pattern: '^\\d{2}:\\d{2}$',
                            example: '18:00',
                            description: 'Horário de fim (formato HH:MM)'
                        },
                        break_start: {
                            type: 'string',
                            pattern: '^\\d{2}:\\d{2}$',
                            example: '12:00',
                            description: 'Horário de início do intervalo (opcional)'
                        },
                        break_end: {
                            type: 'string',
                            pattern: '^\\d{2}:\\d{2}$',
                            example: '13:00',
                            description: 'Horário de fim do intervalo (opcional)'
                        },
                    },
                    required: ['enabled', 'start_time', 'end_time'],
                },
                Instance: {
                    type: 'object',
                    description: 'Instância representa uma organização/clínica/empresa',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID único da instância'
                        },
                        name: {
                            type: 'string',
                            description: 'Nome da instância'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'Email de contato da instância'
                        },
                        phone: {
                            type: 'string',
                            description: 'Telefone de contato da instância'
                        },
                        business_hours: {
                            $ref: '#/components/schemas/BusinessHours',
                            description: 'Horários de funcionamento'
                        },
                        timezone: {
                            type: 'string',
                            default: 'America/Sao_Paulo',
                            description: 'Fuso horário da instância'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação'
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data da última atualização'
                        },
                    },
                    required: ['name', 'business_hours'],
                },
                Calendar: {
                    type: 'object',
                    description: 'Calendário vinculado a uma instância',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID único do calendário'
                        },
                        instance_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID da instância proprietária'
                        },
                        google_calendar_id: {
                            type: 'string',
                            description: 'ID do calendário no Google Calendar'
                        },
                        name: {
                            type: 'string',
                            description: 'Nome do calendário'
                        },
                        description: {
                            type: 'string',
                            description: 'Descrição do calendário'
                        },
                        priority: {
                            type: 'integer',
                            minimum: 1,
                            description: 'Prioridade do calendário (1 = maior prioridade)'
                        },
                        color: {
                            type: 'string',
                            description: 'Cor do calendário (formato hexadecimal)'
                        },
                        is_active: {
                            type: 'boolean',
                            default: true,
                            description: 'Se o calendário está ativo'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação'
                        },
                    },
                    required: ['google_calendar_id', 'name', 'priority'],
                },
                Service: {
                    type: 'object',
                    description: 'Serviço oferecido por uma instância',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID único do serviço'
                        },
                        instance_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID da instância proprietária'
                        },
                        name: {
                            type: 'string',
                            description: 'Nome do serviço'
                        },
                        description: {
                            type: 'string',
                            description: 'Descrição do serviço'
                        },
                        duration: {
                            type: 'integer',
                            minimum: 1,
                            description: 'Duração do serviço em minutos'
                        },
                        buffer_before: {
                            type: 'integer',
                            minimum: 0,
                            default: 0,
                            description: 'Buffer antes do serviço em minutos'
                        },
                        buffer_after: {
                            type: 'integer',
                            minimum: 0,
                            default: 0,
                            description: 'Buffer após o serviço em minutos'
                        },
                        price: {
                            type: 'number',
                            format: 'decimal',
                            description: 'Preço do serviço'
                        },
                        category: {
                            type: 'string',
                            description: 'Categoria do serviço'
                        },
                        is_active: {
                            type: 'boolean',
                            default: true,
                            description: 'Se o serviço está ativo'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação'
                        },
                    },
                    required: ['name', 'duration'],
                },
                Appointment: {
                    type: 'object',
                    description: 'Agendamento de um serviço',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID único do agendamento'
                        },
                        instance_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID da instância'
                        },
                        calendar_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID do calendário utilizado'
                        },
                        service_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID do serviço agendado'
                        },
                        google_event_id: {
                            type: 'string',
                            description: 'ID do evento no Google Calendar'
                        },
                        title: {
                            type: 'string',
                            description: 'Título do agendamento'
                        },
                        description: {
                            type: 'string',
                            description: 'Descrição/observações do agendamento'
                        },
                        start_datetime: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data e hora de início'
                        },
                        end_datetime: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data e hora de fim'
                        },
                        client_name: {
                            type: 'string',
                            description: 'Nome do cliente'
                        },
                        client_email: {
                            type: 'string',
                            format: 'email',
                            description: 'Email do cliente'
                        },
                        client_phone: {
                            type: 'string',
                            description: 'Telefone do cliente'
                        },
                        status: {
                            type: 'string',
                            enum: ['scheduled', 'confirmed', 'cancelled', 'completed'],
                            default: 'scheduled',
                            description: 'Status do agendamento'
                        },
                        flow_id: {
                            type: 'integer',
                            description: 'ID do fluxo de agendamento (integração externa)'
                        },
                        agent_id: {
                            type: 'integer',
                            description: 'ID do agente responsável (integração externa)'
                        },
                        user_id: {
                            type: 'integer',
                            description: 'ID do usuário que criou (integração externa)'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação'
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data da última atualização'
                        },
                    },
                    required: ['instance_id', 'service_id', 'start_datetime', 'client_name'],
                },
                Error: {
                    type: 'object',
                    description: 'Resposta de erro padrão',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Mensagem de erro'
                        },
                    },
                    required: ['error'],
                    example: {
                        error: 'Validation error message'
                    }
                },
                HealthCheck: {
                    type: 'object',
                    description: 'Resposta do health check',
                    properties: {
                        status: {
                            type: 'string',
                            example: 'OK',
                            description: 'Status da API'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Timestamp da verificação'
                        },
                        version: {
                            type: 'string',
                            example: '1.0.0',
                            description: 'Versão da API'
                        },
                    },
                    required: ['status', 'timestamp', 'version']
                },
                AvailabilitySlot: {
                    type: 'object',
                    description: 'Slot de tempo disponível para agendamento',
                    properties: {
                        start_datetime: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data e hora de início do slot'
                        },
                        end_datetime: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data e hora de fim do slot'
                        },
                        calendar_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID do calendário'
                        },
                        calendar_name: {
                            type: 'string',
                            description: 'Nome do calendário'
                        },
                        priority: {
                            type: 'integer',
                            description: 'Prioridade do calendário'
                        }
                    },
                    required: ['start_datetime', 'end_datetime', 'calendar_id', 'calendar_name', 'priority']
                },
                AvailabilityCheckResult: {
                    type: 'object',
                    description: 'Resultado da verificação de disponibilidade',
                    properties: {
                        available: {
                            type: 'boolean',
                            description: 'Se o horário está disponível'
                        },
                        calendar_name: {
                            type: 'string',
                            description: 'Nome do calendário verificado'
                        },
                        start_datetime: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data e hora de início solicitada'
                        },
                        end_datetime: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data e hora de fim calculada'
                        },
                        service_name: {
                            type: 'string',
                            description: 'Nome do serviço'
                        },
                        service_duration: {
                            type: 'integer',
                            description: 'Duração do serviço em minutos'
                        },
                        conflict_reason: {
                            type: 'string',
                            description: 'Motivo da indisponibilidade (se available = false)'
                        }
                    },
                    required: ['available', 'calendar_name', 'start_datetime', 'end_datetime', 'service_name', 'service_duration']
                }
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: process.env.NODE_ENV === 'production'
        ? ['./dist/docs/*.js', './dist/routes/*.js', './dist/server.js']
        : ['./src/docs/*.ts', './src/routes/*.ts', './src/server.ts'],
};
exports.specs = (0, swagger_jsdoc_1.default)(options);
