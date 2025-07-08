import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Calendar Management API',
            version: '1.0.0',
            description: 'API for managing calendar appointments and availability',
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
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        name: { type: 'string' },
                        role: { type: 'string', enum: ['admin'] },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Instance: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        phone: { type: 'string' },
                        business_hours: {
                            type: 'object',
                            properties: {
                                monday: { $ref: '#/components/schemas/DaySchedule' },
                                tuesday: { $ref: '#/components/schemas/DaySchedule' },
                                wednesday: { $ref: '#/components/schemas/DaySchedule' },
                                thursday: { $ref: '#/components/schemas/DaySchedule' },
                                friday: { $ref: '#/components/schemas/DaySchedule' },
                                saturday: { $ref: '#/components/schemas/DaySchedule' },
                                sunday: { $ref: '#/components/schemas/DaySchedule' },
                            },
                        },
                        timezone: { type: 'string', default: 'America/Sao_Paulo' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                    },
                    required: ['name', 'business_hours'],
                },
                DaySchedule: {
                    type: 'object',
                    properties: {
                        enabled: { type: 'boolean' },
                        start_time: { type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '09:00' },
                        end_time: { type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '18:00' },
                        break_start: { type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '12:00' },
                        break_end: { type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '13:00' },
                    },
                    required: ['enabled', 'start_time', 'end_time'],
                },
                Calendar: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        instance_id: { type: 'string', format: 'uuid' },
                        google_calendar_id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        priority: { type: 'integer', minimum: 1 },
                        color: { type: 'string' },
                        is_active: { type: 'boolean', default: true },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                    required: ['google_calendar_id', 'name', 'priority'],
                },
                Service: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        instance_id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        duration: { type: 'integer', minimum: 1, description: 'Duration in minutes' },
                        buffer_before: { type: 'integer', minimum: 0, default: 0 },
                        buffer_after: { type: 'integer', minimum: 0, default: 0 },
                        price: { type: 'number', format: 'decimal' },
                        is_active: { type: 'boolean', default: true },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                    required: ['name', 'duration'],
                },
                Appointment: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        instance_id: { type: 'string', format: 'uuid' },
                        calendar_id: { type: 'string', format: 'uuid' },
                        service_id: { type: 'string', format: 'uuid' },
                        google_event_id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        start_datetime: { type: 'string', format: 'date-time' },
                        end_datetime: { type: 'string', format: 'date-time' },
                        client_name: { type: 'string' },
                        client_email: { type: 'string', format: 'email' },
                        client_phone: { type: 'string' },
                        status: {
                            type: 'string',
                            enum: ['scheduled', 'confirmed', 'cancelled', 'completed'],
                            default: 'scheduled'
                        },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                    },
                    required: ['instance_id', 'service_id', 'start_datetime', 'client_name'],
                },
                TimeSlot: {
                    type: 'object',
                    properties: {
                        start_datetime: { type: 'string', format: 'date-time' },
                        end_datetime: { type: 'string', format: 'date-time' },
                        calendar_id: { type: 'string', format: 'uuid' },
                        calendar_name: { type: 'string' },
                        priority: { type: 'integer' },
                    },
                },
                AvailabilityRequest: {
                    type: 'object',
                    properties: {
                        instance_id: { type: 'string', format: 'uuid' },
                        service_id: { type: 'string', format: 'uuid' },
                        start_date: { type: 'string', format: 'date' },
                        end_date: { type: 'string', format: 'date' },
                        calendar_ids: {
                            type: 'array',
                            items: { type: 'string', format: 'uuid' }
                        },
                    },
                    required: ['instance_id', 'service_id', 'start_date', 'end_date'],
                },
                PreferenceOptions: {
                    type: 'object',
                    properties: {
                        strategy: {
                            type: 'string',
                            enum: ['earliest', 'latest', 'least_fragmented', 'priority_calendar']
                        },
                        preferred_times: {
                            type: 'array',
                            items: { type: 'string', pattern: '^\\d{2}:\\d{2}$' }
                        },
                        avoid_times: {
                            type: 'array',
                            items: { type: 'string', pattern: '^\\d{2}:\\d{2}$' }
                        },
                        max_suggestions: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
                    },
                    required: ['strategy'],
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
                HealthCheck: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'OK' },
                        timestamp: { type: 'string', format: 'date-time' },
                        version: { type: 'string', example: '1.0.0' },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: process.env.NODE_ENV === 'production' 
  ? ['./dist/routes/*.js', './dist/server.js']
  : ['./src/routes/*.ts', './src/server.ts'],
};

export const specs = swaggerJsdoc(options);