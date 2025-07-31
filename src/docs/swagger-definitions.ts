/**
 * Calendar Management API - Complete Swagger Documentation
 * 
 * Este arquivo contém toda a documentação Swagger para os 27 endpoints da API
 * Substitua completamente o conteúdo do arquivo src/docs/swagger-definitions.ts
 */

/**
 * @swagger
 * tags:
 *   - name: Health
 *     description: Health check endpoints
 *   - name: Authentication
 *     description: User authentication and session management
 *   - name: Instances
 *     description: Organization/clinic instance management
 *   - name: Calendars
 *     description: Calendar management and configuration
 *   - name: Services
 *     description: Service offerings management
 *   - name: Appointments
 *     description: Appointment scheduling and management
 *   - name: Availability
 *     description: Time slot availability checking and suggestions
 */

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: API health check
 *     description: Returns the current status and version of the API
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *             example:
 *               status: "OK"
 *               timestamp: "2024-03-15T10:00:00.000Z"
 *               version: "1.0.0"
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user with email and password
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
 *                 description: User email address
 *                 example: "admin@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *                 example: "securePassword123"
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
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
 *     summary: User logout
 *     description: Logout the current user and invalidate session
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
 *     summary: List all instances
 *     description: Retrieve all organization/clinic instances
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
 *     description: Create a new organization/clinic instance
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
 *                 description: Instance name
 *                 example: "Clínica Médica São Paulo"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Contact email
 *                 example: "contato@clinica.com"
 *               phone:
 *                 type: string
 *                 description: Contact phone
 *                 example: "+55 11 99999-9999"
 *               business_hours:
 *                 $ref: '#/components/schemas/BusinessHours'
 *               timezone:
 *                 type: string
 *                 default: "America/Sao_Paulo"
 *                 description: Instance timezone
 *     responses:
 *       200:
 *         description: Instance created successfully
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
 *     description: Update an existing instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               business_hours:
 *                 $ref: '#/components/schemas/BusinessHours'
 *               timezone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Instance updated successfully
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
 *     description: Delete an instance (only if no active appointments)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID
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
 *         description: Cannot delete instance with active appointments
 *       404:
 *         description: Instance not found
 */

/**
 * @swagger
 * /api/instances/{instanceId}/calendars:
 *   get:
 *     tags: [Calendars]
 *     summary: List instance calendars
 *     description: Get all calendars for a specific instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID
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
 *     description: Create a new calendar for the specified instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID
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
 *                 description: Google Calendar ID
 *                 example: "primary"
 *               name:
 *                 type: string
 *                 description: Calendar name
 *                 example: "Dr. Silva - Consultório A"
 *               description:
 *                 type: string
 *                 description: Calendar description
 *               priority:
 *                 type: integer
 *                 minimum: 1
 *                 description: Calendar priority (1 = highest)
 *                 example: 1
 *               color:
 *                 type: string
 *                 description: Calendar color (hex format)
 *                 example: "#4285f4"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Calendar created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Calendar'
 *       400:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/instances/{instanceId}/services:
 *   get:
 *     tags: [Services]
 *     summary: List instance services
 *     description: Get all active services for a specific instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID
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
 *     description: Create a new service for the specified instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID
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
 *                 description: Service name
 *                 example: "Consulta Médica"
 *               description:
 *                 type: string
 *                 description: Service description
 *               duration:
 *                 type: integer
 *                 minimum: 1
 *                 description: Duration in minutes
 *                 example: 60
 *               buffer_before:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 description: Buffer time before service (minutes)
 *               buffer_after:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 description: Buffer time after service (minutes)
 *               price:
 *                 type: number
 *                 format: decimal
 *                 description: Service price
 *                 example: 150.00
 *               category:
 *                 type: string
 *                 description: Service category
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Service created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/calendars:
 *   get:
 *     tags: [Calendars]
 *     summary: List all calendars
 *     description: Get all calendars with optional filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by instance ID
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of calendars with instance info
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
 *                             format: uuid
 *                           name:
 *                             type: string
 */

/**
 * @swagger
 * /api/calendars/{id}:
 *   get:
 *     tags: [Calendars]
 *     summary: Get calendar by ID
 *     description: Retrieve a specific calendar with instance information
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Calendar ID
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
 *                           format: uuid
 *                         name:
 *                           type: string
 *       404:
 *         description: Calendar not found
 *   put:
 *     tags: [Calendars]
 *     summary: Update calendar
 *     description: Update an existing calendar
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Calendar ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               google_calendar_id:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: integer
 *                 minimum: 1
 *               color:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Calendar updated successfully
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
 *     description: Delete a calendar
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Calendar ID
 *     responses:
 *       200:
 *         description: Calendar deleted successfully
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
 *     summary: List all services
 *     description: Get all services with optional filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by instance ID
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of services with instance info
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
 *                             format: uuid
 *                           name:
 *                             type: string
 */

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     tags: [Services]
 *     summary: Get service by ID
 *     description: Retrieve a specific service with instance information
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
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
 *                           format: uuid
 *                         name:
 *                           type: string
 *       404:
 *         description: Service not found
 *   put:
 *     tags: [Services]
 *     summary: Update service
 *     description: Update an existing service
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               duration:
 *                 type: integer
 *                 minimum: 1
 *               buffer_before:
 *                 type: integer
 *                 minimum: 0
 *               buffer_after:
 *                 type: integer
 *                 minimum: 0
 *               price:
 *                 type: number
 *                 format: decimal
 *               category:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Service updated successfully
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
 *     description: Delete a service
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     responses:
 *       200:
 *         description: Service deleted successfully
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
 *     description: Retrieve all unique service categories
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of unique categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Consulta", "Exame", "Procedimento", "Cirurgia"]
 */

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: List appointments
 *     description: Retrieve appointments with optional filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by instance ID
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter appointments from this date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter appointments until this date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, confirmed, cancelled, completed]
 *         description: Filter by appointment status
 *       - in: query
 *         name: flow_id
 *         schema:
 *           type: integer
 *         description: Filter by flow ID (external integration)
 *       - in: query
 *         name: agent_id
 *         schema:
 *           type: integer
 *         description: Filter by agent ID (external integration)
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by user ID (external integration)
 *     responses:
 *       200:
 *         description: List of appointments with related data
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
 *   post:
 *     tags: [Appointments]
 *     summary: Create appointment
 *     description: Create a new appointment with automatic availability checking
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
 *                 description: Instance ID
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 description: Service ID
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Appointment start date and time
 *                 example: "2024-03-15T14:00:00-03:00"
 *               end_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Appointment end date and time (optional, calculated from service duration if not provided)
 *               client_name:
 *                 type: string
 *                 description: Client name
 *                 example: "João Silva"
 *               client_email:
 *                 type: string
 *                 format: email
 *                 description: Client email
 *               client_phone:
 *                 type: string
 *                 description: Client phone
 *               description:
 *                 type: string
 *                 description: Appointment notes/description
 *               calendar_id:
 *                 type: string
 *                 format: uuid
 *                 description: Specific calendar ID (optional, uses highest priority if not provided)
 *               flow_id:
 *                 type: integer
 *                 description: Flow ID for external integrations
 *               agent_id:
 *                 type: integer
 *                 description: Agent ID for external integrations
 *               user_id:
 *                 type: integer
 *                 description: User ID for external integrations
 *     responses:
 *       200:
 *         description: Appointment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Validation error or time slot not available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               time_not_available:
 *                 summary: Time slot not available
 *                 value:
 *                   error: "Time slot not available: Time slot already booked"
 *               validation_error:
 *                 summary: Validation error
 *                 value:
 *                   error: "Service not found"
 */

/**
 * @swagger
 * /api/appointments/{id}:
 *   put:
 *     tags: [Appointments]
 *     summary: Update appointment
 *     description: Update an existing appointment with automatic availability checking
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: New start date and time
 *               end_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: New end date and time
 *               title:
 *                 type: string
 *                 description: Appointment title
 *               description:
 *                 type: string
 *                 description: Appointment description
 *               client_name:
 *                 type: string
 *                 description: Client name
 *               client_email:
 *                 type: string
 *                 format: email
 *                 description: Client email
 *               client_phone:
 *                 type: string
 *                 description: Client phone
 *               status:
 *                 type: string
 *                 enum: [scheduled, confirmed, cancelled, completed]
 *                 description: Appointment status
 *     responses:
 *       200:
 *         description: Appointment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Validation error or time slot not available
 *       404:
 *         description: Appointment not found
 *   delete:
 *     tags: [Appointments]
 *     summary: Cancel appointment
 *     description: Cancel an appointment (soft delete - changes status to cancelled)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Appointment ID
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
 *     description: Permanently delete an appointment from database and Google Calendar
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Appointment ID
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
 */

/**
 * @swagger
 * /api/availability/check:
 *   post:
 *     tags: [Availability]
 *     summary: Check specific time slot availability across multiple calendars
 *     description: Verifica se um horário específico está disponível em múltiplos calendários para agendamento
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start_datetime, service_id, calendar_ids]
 *             properties:
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Data/hora de início desejada (ISO 8601)
 *                 example: "2024-03-15T14:00:00-03:00"
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do serviço
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               calendar_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 description: Array de IDs dos calendários para verificar
 *                 example: ["456e7890-e89b-12d3-a456-426614174001", "789e0123-e89b-12d3-a456-426614174002"]
 *           examples:
 *             single_calendar:
 *               summary: Verificar em um calendário
 *               value:
 *                 start_datetime: "2024-03-15T14:00:00-03:00"
 *                 service_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 calendar_ids: ["456e7890-e89b-12d3-a456-426614174001"]
 *             multiple_calendars:
 *               summary: Verificar em múltiplos calendários
 *               value:
 *                 start_datetime: "2024-03-15T14:00:00-03:00"
 *                 service_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 calendar_ids: [
 *                   "456e7890-e89b-12d3-a456-426614174001",
 *                   "789e0123-e89b-12d3-a456-426614174002",
 *                   "abc1234d-e89b-12d3-a456-426614174003"
 *                 ]
 *     responses:
 *       200:
 *         description: Resultado detalhado da verificação de disponibilidade
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SlotCheckResponse'
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_parameters:
 *                 summary: Parâmetros obrigatórios ausentes
 *                 value:
 *                   error: "start_datetime, service_id, and calendar_ids are required"
 *               invalid_calendar_ids:
 *                 summary: calendar_ids inválido
 *                 value:
 *                   error: "calendar_ids must be a non-empty array"
 */

/**
 * @swagger
 * /api/availability/suggest:
 *   post:
 *     tags: [Availability]
 *     summary: Get availability suggestions with advanced strategies
 *     description: Sugere horários disponíveis usando diferentes estratégias de agendamento
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
 *                 description: Data/hora de início da busca (ISO 8601)
 *                 example: "2024-03-15T08:00:00-03:00"
 *               end_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Data/hora de fim da busca (ISO 8601)
 *                 example: "2024-03-20T18:00:00-03:00"
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do serviço
 *               calendar_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: IDs dos calendários para verificar
 *               max_results:
 *                 type: integer
 *                 default: 10
 *                 minimum: 1
 *                 maximum: 50
 *                 description: Número máximo de sugestões
 *               expand_timeframe:
 *                 type: boolean
 *                 default: false
 *                 description: Se deve expandir o período de busca para encontrar mais horários
 *               interval_minutes:
 *                 type: integer
 *                 default: 30
 *                 minimum: 15
 *                 maximum: 120
 *                 description: Intervalo em minutos entre slots sugeridos
 *               strategy:
 *                 type: string
 *                 enum: [equality, earliest, nearest, time_blocks, balanced_distribution]
 *                 default: earliest
 *                 description: |
 *                   Estratégia de sugestão:
 *                   - equality: Distribui igualmente entre calendários
 *                   - earliest: Primeiros horários disponíveis
 *                   - nearest: Horários mais próximos ao momento atual
 *                   - time_blocks: Distribui por períodos (manhã, tarde, noite)
 *                   - balanced_distribution: Distribui uniformemente ao longo dos dias
 *     responses:
 *       200:
 *         description: Lista de horários disponíveis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AvailabilitySlot'
 *                 total_found:
 *                   type: integer
 *                   description: Total de horários encontrados
 *                 search_params:
 *                   type: object
 *                   description: Parâmetros utilizados na busca
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */