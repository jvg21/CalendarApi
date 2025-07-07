import express from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { AvailabilityService } from '../service/availability';
import { AppointmentService } from '../service/appointment';

const router = express.Router();
const availabilityService = new AvailabilityService();
const appointmentService = new AppointmentService();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Admin login
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
 *               password:
 *                 type: string
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
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ user: data.user, token: data.session?.access_token });
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/auth/logout', authenticateToken, async (req, res) => {
  await supabase.auth.signOut();
  res.json({ message: 'Logged out successfully' });
});

/**
 * @swagger
 * /api/instances:
 *   get:
 *     tags: [Instances]
 *     summary: Get all instances
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
 *   post:
 *     tags: [Instances]
 *     summary: Create new instance
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Instance'
 *     responses:
 *       200:
 *         description: Instance created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Instance'
 */
router.get('/instances', authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('instances')
    .select('*')
    .order('name');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.post('/instances', authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('instances')
    .insert(req.body)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json(data);
});

/**
 * @swagger
 * /api/instances/{id}:
 *   put:
 *     tags: [Instances]
 *     summary: Update instance
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
 *             $ref: '#/components/schemas/Instance'
 *     responses:
 *       200:
 *         description: Instance updated
 */
router.put('/instances/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('instances')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json(data);
});

/**
 * @swagger
 * /api/instances/{instanceId}/calendars:
 *   get:
 *     tags: [Calendars]
 *     summary: Get instance calendars
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
 *     summary: Create calendar
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
 *             $ref: '#/components/schemas/Calendar'
 *     responses:
 *       200:
 *         description: Calendar created
 */
router.get('/instances/:instanceId/calendars', authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('calendars')
    .select('*')
    .eq('instance_id', req.params.instanceId)
    .order('priority');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.post('/instances/:instanceId/calendars', authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('calendars')
    .insert({ ...req.body, instance_id: req.params.instanceId })
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json(data);
});

/**
 * @swagger
 * /api/instances/{instanceId}/services:
 *   get:
 *     tags: [Services]
 *     summary: Get instance services
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
 *     summary: Create service
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
 *             $ref: '#/components/schemas/Service'
 *     responses:
 *       200:
 *         description: Service created
 */
router.get('/instances/:instanceId/services', authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('instance_id', req.params.instanceId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.post('/instances/:instanceId/services', authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('services')
    .insert({ ...req.body, instance_id: req.params.instanceId })
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json(data);
});

/**
 * @swagger
 * /api/availability/check:
 *   post:
 *     tags: [Availability]
 *     summary: Check availability
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AvailabilityRequest'
 *     responses:
 *       200:
 *         description: Available time slots
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TimeSlot'
 */
router.post('/availability/check', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const slots = await availabilityService.getAvailableSlots(req.body);
    res.json(slots);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/availability/suggest:
 *   post:
 *     tags: [Availability]
 *     summary: Suggest best time slots
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               availability_request:
 *                 $ref: '#/components/schemas/AvailabilityRequest'
 *               preferences:
 *                 $ref: '#/components/schemas/PreferenceOptions'
 *     responses:
 *       200:
 *         description: Suggested time slots
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TimeSlot'
 */
router.post('/availability/suggest', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { availability_request, preferences } = req.body;
    const slots = await availabilityService.getAvailableSlots(availability_request);
    const suggestions = availabilityService.suggestBestSlots(slots, preferences);
    res.json(suggestions);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: Get appointments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, confirmed, cancelled, completed]
 *     responses:
 *       200:
 *         description: List of appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 *   post:
 *     tags: [Appointments]
 *     summary: Create appointment
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
 *               service_id:
 *                 type: string
 *                 format: uuid
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *               client_name:
 *                 type: string
 *               client_email:
 *                 type: string
 *                 format: email
 *               client_phone:
 *                 type: string
 *               description:
 *                 type: string
 *               calendar_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Appointment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 */
router.get('/appointments', authenticateToken, requireAdmin, async (req, res) => {
  const { instance_id, start_date, end_date, status } = req.query;
  
  let query = supabase
    .from('appointments')
    .select(`
      *,
      instances(name),
      calendars(name),
      services(name, duration)
    `)
    .order('start_datetime');

  if (instance_id) query = query.eq('instance_id', instance_id);
  if (start_date) query = query.gte('start_datetime', start_date);
  if (end_date) query = query.lte('start_datetime', end_date);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.post('/appointments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const appointment = await appointmentService.createAppointment(req.body);
    res.json(appointment);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/appointments/{id}:
 *   put:
 *     tags: [Appointments]
 *     summary: Update appointment
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
 *         description: Appointment updated
 *   delete:
 *     tags: [Appointments]
 *     summary: Cancel appointment
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
 *         description: Appointment cancelled
 */
router.put('/appointments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const appointment = await appointmentService.updateAppointment(req.params.id, req.body);
    res.json(appointment);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/appointments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await appointmentService.cancelAppointment(req.params.id);
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/availability/quick/{instanceId}/{days}:
 *   get:
 *     tags: [Availability]
 *     summary: Quick availability check
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: days
 *         required: true
 *         schema:
 *           type: integer
 *           enum: [2, 3, 7, 30]
 *       - in: query
 *         name: service_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Availability summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_slots:
 *                       type: integer
 *                     days_checked:
 *                       type: integer
 *                     first_available:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     by_calendar:
 *                       type: object
 *                 slots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TimeSlot'
 */
router.get('/availability/quick/:instanceId/:days', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { instanceId, days } = req.params;
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + parseInt(days));

    const slots = await availabilityService.getAvailableSlots({
      instance_id: instanceId,
      service_id: req.query.service_id as string,
      start_date: today.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    });

    const summary = {
      total_slots: slots.length,
      days_checked: parseInt(days),
      first_available: slots[0]?.start_datetime || null,
      by_calendar: slots.reduce((acc, slot) => {
        acc[slot.calendar_name] = (acc[slot.calendar_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({ summary, slots: slots.slice(0, 20) }); // Return first 20 slots
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;