// src/docs/swagger-definitions.ts
// Definições do Swagger completas e atualizadas

/**
 * @swagger
 * tags:
 *   - name: Health
 *     description: Health check
 *   - name: Authentication
 *     description: Autenticação e autorização
 *   - name: Instances
 *     description: Gerenciamento de instâncias
 *   - name: Calendars
 *     description: Gerenciamento de calendários
 *   - name: Services
 *     description: Gerenciamento de serviços
 *   - name: Appointments
 *     description: Gerenciamento de agendamentos
 *   - name: Availability
 *     description: Verificação de disponibilidade
 */

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: Verifica se a API está funcionando corretamente
 *     responses:
 *       200:
 *         description: API funcionando
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Admin login
 *     description: Autentica um usuário administrador
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT access token
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout
 *     description: Realiza logout do usuário atual
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 */

/**
 * @swagger
 * /api/instances:
 *   get:
 *     tags: [Instances]
 *     summary: Get all instances
 *     description: Lista todas as instâncias ordenadas por nome
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of instances
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Instance'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Instances]
 *     summary: Create new instance
 *     description: Cria uma nova instância
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, business_hours]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Clínica Dr. João"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contato@clinicajoao.com"
 *               phone:
 *                 type: string
 *                 example: "+55 11 99999-9999"
 *               business_hours:
 *                 $ref: '#/components/schemas/BusinessHours'
 *               timezone:
 *                 type: string
 *                 default: "America/Sao_Paulo"
 *                 example: "America/Sao_Paulo"
 *     responses:
 *       200:
 *         description: Instance created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Instance'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/instances/{id}:
 *   put:
 *     tags: [Instances]
 *     summary: Update instance
 *     description: Atualiza uma instância existente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da instância
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Instance'
 *     responses:
 *       200:
 *         description: Instance updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Instance'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Instance not found
 *   delete:
 *     tags: [Instances]
 *     summary: Delete instance
 *     description: Deleta uma instância (apenas se não tiver agendamentos ativos)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Instance deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Instance deleted successfully"
 *       400:
 *         description: Cannot delete instance with existing appointments
 *       404:
 *         description: Instance not found
 */

/**
 * @swagger
 * /api/instances/{instanceId}/calendars:
 *   get:
 *     tags: [Calendars]
 *     summary: Get instance calendars
 *     description: Lista calendários de uma instância específica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of calendars
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Calendar'
 *   post:
 *     tags: [Calendars]
 *     summary: Create calendar for instance
 *     description: Cria um novo calendário para uma instância
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [google_calendar_id, name, priority]
 *             properties:
 *               google_calendar_id:
 *                 type: string
 *                 example: "primary"
 *               name:
 *                 type: string
 *                 example: "Calendário Principal"
 *               description:
 *                 type: string
 *                 example: "Calendário para consultas gerais"
 *               priority:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *               color:
 *                 type: string
 *                 example: "#4285f4"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Calendar created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Calendar'
 */

/**
 * @swagger
 * /api/instances/{instanceId}/services:
 *   get:
 *     tags: [Services]
 *     summary: Get instance services
 *     description: Lista serviços ativos de uma instância específica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *   post:
 *     tags: [Services]
 *     summary: Create service for instance
 *     description: Cria um novo serviço para uma instância
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, duration]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Consulta Médica"
 *               description:
 *                 type: string
 *                 example: "Consulta médica de rotina"
 *               duration:
 *                 type: integer
 *                 minimum: 1
 *                 example: 60
 *                 description: "Duração em minutos"
 *               buffer_before:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 example: 15
 *               buffer_after:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 example: 15
 *               price:
 *                 type: number
 *                 format: decimal
 *                 example: 150.00
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Service created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 */

/**
 * @swagger
 * /api/calendars:
 *   get:
 *     tags: [Calendars]
 *     summary: Get all calendars
 *     description: Lista todos os calendários com filtros opcionais
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID da instância
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo
 *     responses:
 *       200:
 *         description: List of all calendars
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Calendar'
 *                   - type: object
 *                     properties:
 *                       instances:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 */

/**
 * @swagger
 * /api/calendars/{id}:
 *   get:
 *     tags: [Calendars]
 *     summary: Get calendar by ID
 *     description: Obtém detalhes de um calendário específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Calendar details
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Calendar'
 *                 - type: object
 *                   properties:
 *                     instances:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *       404:
 *         description: Calendar not found
 *   put:
 *     tags: [Calendars]
 *     summary: Update calendar
 *     description: Atualiza um calendário
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Calendar'
 *     responses:
 *       200:
 *         description: Calendar updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Calendar'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Calendar not found
 *   delete:
 *     tags: [Calendars]
 *     summary: Delete calendar
 *     description: Deleta um calendário
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Calendar deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Calendar deleted successfully"
 *       404:
 *         description: Calendar not found
 */

/**
 * @swagger
 * /api/services:
 *   get:
 *     tags: [Services]
 *     summary: Get all services
 *     description: Lista todos os serviços com filtros opcionais
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID da instância
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoria
 *     responses:
 *       200:
 *         description: List of all services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Service'
 *                   - type: object
 *                     properties:
 *                       instances:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 */

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     tags: [Services]
 *     summary: Get service by ID
 *     description: Obtém detalhes de um serviço específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Service details
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Service'
 *                 - type: object
 *                   properties:
 *                     instances:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *       404:
 *         description: Service not found
 *   put:
 *     tags: [Services]
 *     summary: Update service
 *     description: Atualiza um serviço
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Service'
 *     responses:
 *       200:
 *         description: Service updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Service not found
 *   delete:
 *     tags: [Services]
 *     summary: Delete service
 *     description: Deleta um serviço
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Service deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Service deleted successfully"
 *       404:
 *         description: Service not found
 */

/**
 * @swagger
 * /api/services/categories:
 *   get:
 *     tags: [Services]
 *     summary: Get service categories
 *     description: Lista todas as categorias únicas de serviços
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of service categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Consulta", "Exame", "Cirurgia"]
 */

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     tags: [Appointments]
 *     summary: Create appointment
 *     description: Cria um novo agendamento com verificação automática de disponibilidade
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [instance_id, service_id, start_datetime, client_name]
 *             properties:
 *               instance_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T09:00:00-03:00"
 *               end_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: "Opcional - será calculado baseado na duração do serviço se não fornecido"
 *                 example: "2024-01-15T10:00:00-03:00"
 *               client_name:
 *                 type: string
 *                 example: "João Silva"
 *               client_email:
 *                 type: string
 *                 format: email
 *                 example: "joao.silva@email.com"
 *               client_phone:
 *                 type: string
 *                 example: "+55 11 99999-9999"
 *               description:
 *                 type: string
 *                 example: "Consulta de rotina"
 *               calendar_id:
 *                 type: string
 *                 format: uuid
 *                 description: "Opcional - usará o calendário de maior prioridade se não fornecido"
 *                 example: "550e8400-e29b-41d4-a716-446655440002"
 *               flow_id:
 *                 type: integer
 *                 description: "ID do fluxo de agendamento"
 *                 example: 1
 *               agent_id:
 *                 type: integer
 *                 description: "ID do agente responsável"
 *                 example: 1
 *               user_id:
 *                 type: integer
 *                 description: "ID do usuário que criou o agendamento"
 *                 example: 1
 *     responses:
 *       200:
 *         description: Appointment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Bad request - validation error or time slot not available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Service or calendar not found
 *   get:
 *     tags: [Appointments]
 *     summary: Get appointments with filters
 *     description: Lista agendamentos com filtros opcionais
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID da instância
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filtrar agendamentos a partir desta data
 *         example: "2024-01-01T00:00:00-03:00"
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filtrar agendamentos até esta data
 *         example: "2024-01-31T23:59:59-03:00"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, confirmed, cancelled, completed]
 *         description: Filtrar por status do agendamento
 *       - in: query
 *         name: flow_id
 *         schema:
 *           type: integer
 *         description: Filtrar por ID do fluxo
 *       - in: query
 *         name: agent_id
 *         schema:
 *           type: integer
 *         description: Filtrar por ID do agente
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filtrar por ID do usuário
 *     responses:
 *       200:
 *         description: List of appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Appointment'
 *                   - type: object
 *                     properties:
 *                       instances:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                       calendars:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                       services:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           duration:
 *                             type: integer
 */

/**
 * @swagger
 * /api/appointments/{id}:
 *   put:
 *     tags: [Appointments]
 *     summary: Update appointment
 *     description: Atualiza um agendamento com verificação automática de disponibilidade
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Appointment'
 *     responses:
 *       200:
 *         description: Appointment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Bad request - validation error or time slot not available
 *       404:
 *         description: Appointment not found
 *   delete:
 *     tags: [Appointments]
 *     summary: Cancel appointment
 *     description: Cancela um agendamento (altera status para 'cancelled' e remove do Google Calendar)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Appointment cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Appointment cancelled successfully"
 *       404:
 *         description: Appointment not found
 */

/**
 * @swagger
 * /api/appointments/{id}/delete:
 *   delete:
 *     tags: [Appointments]
 *     summary: Delete appointment permanently
 *     description: Remove um agendamento permanentemente do banco de dados e do Google Calendar
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Appointment deleted permanently
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Appointment deleted permanently"
 *       404:
 *         description: Appointment not found
 *       400:
 *         description: Bad request
 */

/**
 * @swagger
 * /api/availability/check:
 *   post:
 *     tags: [Availability]
 *     summary: Check specific time slot availability
 *     description: Verifica se um horário específico está disponível para agendamento
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start_datetime, service_id, calendar_id]
 *             properties:
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T09:00:00-03:00"
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *               calendar_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440002"
 *     responses:
 *       200:
 *         description: Availability check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   example: true
 *                 start_datetime:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T09:00:00-03:00"
 *                 service_id:
 *                   type: string
 *                   format: uuid
 *                 calendar_id:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Bad request - missing required parameters
 */

/**
 * @swagger
 * /api/availability/suggest:
 *   post:
 *     tags: [Availability]
 *     summary: Suggest available time slots
 *     description: Sugere horários disponíveis para agendamento dentro de um período
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start_datetime, end_datetime, service_id, calendar_ids]
 *             properties:
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T08:00:00-03:00"
 *               end_datetime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T18:00:00-03:00"
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *               calendar_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["550e8400-e29b-41d4-a716-446655440002"]
 *               max_results:
 *                 type: integer
 *                 default: 10
 *                 minimum: 1
 *                 maximum: 50
 *                 example: 10
 *               expand_timeframe:
 *                 type: boolean
 *                 default: false
 *                 description: "Se verdadeiro, expande a busca para dias seguintes se não encontrar slots suficientes"
 *               interval_minutes:
 *                 type: integer
 *                 default: 30
 *                 minimum: 5
 *                 maximum: 120
 *                 description: "Intervalo entre slots sugeridos em minutos"
 *               strategy:
 *                 type: string
 *                 enum: [priority, equality, earliest, nearest]
 *                 default: priority
 *                 description: "Estratégia para ordenar/filtrar os resultados"
 *     responses:
 *       200:
 *         description: Available time slots
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       start_datetime:
 *                         type: string
 *                         format: date-time
 *                       end_datetime:
 *                         type: string
 *                         format: date-time
 *                       calendar_id:
 *                         type: string
 *                         format: uuid
 *                       calendar_name:
 *                         type: string
 *                       priority:
 *                         type: integer
 *                 total_found:
 *                   type: integer
 *                   example: 5
 *                 search_params:
 *                   type: object
 *                   description: "Parâmetros usados na busca"
 *       400:
 *         description: Bad request - missing required parameters or invalid calendar_ids
 */