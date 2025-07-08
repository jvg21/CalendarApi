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
// Adicione estas rotas ao seu arquivo src/routes/index.ts

/**
 * @swagger
 * /api/calendars:
 *   get:
 *     tags: [Calendars]
 *     summary: Get all calendars
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by instance ID (optional)
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (optional)
 *     responses:
 *       200:
 *         description: List of all calendars
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Calendar'
 */
router.get('/calendars', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { instance_id, is_active } = req.query;
    
    let query = supabase
      .from('calendars')
      .select(`
        *,
        instances(id, name)
      `)
      .order('priority');

    if (instance_id) {
      query = query.eq('instance_id', instance_id);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/calendars/{id}:
 *   get:
 *     tags: [Calendars]
 *     summary: Get calendar by ID
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
 *               $ref: '#/components/schemas/Calendar'
 *       404:
 *         description: Calendar not found
 */
router.get('/calendars/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calendars')
      .select(`
        *,
        instances(id, name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Calendar not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/calendars/{id}:
 *   put:
 *     tags: [Calendars]
 *     summary: Update calendar
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
 *       404:
 *         description: Calendar not found
 */
router.put('/calendars/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calendars')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Calendar not found' });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/calendars/{id}:
 *   delete:
 *     tags: [Calendars]
 *     summary: Delete calendar
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
 *       404:
 *         description: Calendar not found
 */
router.delete('/calendars/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calendars')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Calendar not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Calendar deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services:
 *   get:
 *     tags: [Services]
 *     summary: Get all services
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by instance ID (optional)
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (optional)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category (optional)
 *     responses:
 *       200:
 *         description: List of all services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */
router.get('/services', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { instance_id, is_active, category } = req.query;
    
    let query = supabase
      .from('services')
      .select(`
        *,
        instances(id, name)
      `)
      .order('name');

    if (instance_id) {
      query = query.eq('instance_id', instance_id);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     tags: [Services]
 *     summary: Get service by ID
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
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Service not found
 */
router.get('/services/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        instances(id, name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services/{id}:
 *   put:
 *     tags: [Services]
 *     summary: Update service
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
 *       404:
 *         description: Service not found
 */
router.put('/services/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services/{id}:
 *   delete:
 *     tags: [Services]
 *     summary: Delete service
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
 *       404:
 *         description: Service not found
 */
router.delete('/services/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services/categories:
 *   get:
 *     tags: [Services]
 *     summary: Get service categories
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
 */
router.get('/services/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('category')
      .not('category', 'is', null)
      .order('category');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Extract unique categories
    const categories = [...new Set(data.map(item => item.category))];
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
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
 *               end_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Optional - will be calculated based on service duration if not provided
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
 *                 description: Optional - will use highest priority calendar if not provided
 *     responses:
 *       200:
 *         description: Appointment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Bad request - validation error
 *       404:
 *         description: Service or calendar not found
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
 *           minimum: 1
 *         description: Number of days to check availability
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


// Adicione estas rotas ao seu arquivo src/routes/index.ts

/**
 * @swagger
 * /api/calendars:
 *   get:
 *     tags: [Calendars]
 *     summary: Get all calendars
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by instance ID (optional)
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (optional)
 *     responses:
 *       200:
 *         description: List of all calendars
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Calendar'
 */
router.get('/calendars', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { instance_id, is_active } = req.query;
    
    let query = supabase
      .from('calendars')
      .select(`
        *,
        instances(id, name)
      `)
      .order('priority');

    if (instance_id) {
      query = query.eq('instance_id', instance_id);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/calendars/{id}:
 *   get:
 *     tags: [Calendars]
 *     summary: Get calendar by ID
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
 *               $ref: '#/components/schemas/Calendar'
 *       404:
 *         description: Calendar not found
 */
router.get('/calendars/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calendars')
      .select(`
        *,
        instances(id, name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Calendar not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/calendars/{id}:
 *   put:
 *     tags: [Calendars]
 *     summary: Update calendar
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
 *       404:
 *         description: Calendar not found
 */
router.put('/calendars/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calendars')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Calendar not found' });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/calendars/{id}:
 *   delete:
 *     tags: [Calendars]
 *     summary: Delete calendar
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
 *       404:
 *         description: Calendar not found
 */
router.delete('/calendars/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calendars')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Calendar not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Calendar deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services:
 *   get:
 *     tags: [Services]
 *     summary: Get all services
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by instance ID (optional)
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (optional)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category (optional)
 *     responses:
 *       200:
 *         description: List of all services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */
router.get('/services', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { instance_id, is_active, category } = req.query;
    
    let query = supabase
      .from('services')
      .select(`
        *,
        instances(id, name)
      `)
      .order('name');

    if (instance_id) {
      query = query.eq('instance_id', instance_id);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     tags: [Services]
 *     summary: Get service by ID
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
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Service not found
 */
router.get('/services/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        instances(id, name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services/{id}:
 *   put:
 *     tags: [Services]
 *     summary: Update service
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
 *       404:
 *         description: Service not found
 */
router.put('/services/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services/{id}:
 *   delete:
 *     tags: [Services]
 *     summary: Delete service
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
 *       404:
 *         description: Service not found
 */
router.delete('/services/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/services/categories:
 *   get:
 *     tags: [Services]
 *     summary: Get service categories
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
 */
router.get('/services/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('category')
      .not('category', 'is', null)
      .order('category');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Extract unique categories
    const categories = [...new Set(data.map(item => item.category))];
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/instances/{id}:
 *   delete:
 *     tags: [Instances]
 *     summary: Delete instance
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
 *       404:
 *         description: Instance not found
 *       400:
 *         description: Cannot delete instance with existing appointments
 */
router.delete('/instances/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Check if instance has appointments
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id')
      .eq('instance_id', req.params.id)
      .eq('status', 'scheduled')
      .limit(1);

    if (appointmentsError) {
      res.status(500).json({ error: appointmentsError.message });
      return;
    }

    if (appointments && appointments.length > 0) {
      res.status(400).json({ 
        error: 'Cannot delete instance with active appointments. Cancel all appointments first.' 
      });
      return;
    }

    // Delete the instance
    const { data, error } = await supabase
      .from('instances')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Instance not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Instance deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/appointments/{id}/delete:
 *   delete:
 *     tags: [Appointments]
 *     summary: Delete appointment permanently
 *     description: Permanently deletes an appointment from database and Google Calendar
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
router.delete('/appointments/:id/delete', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await appointmentService.deleteAppointment(req.params.id);
    res.json({ message: 'Appointment deleted permanently' });
  } catch (error) {
    if ((error as Error).message === 'Appointment not found') {
      res.status(404).json({ error: (error as Error).message });
    } else {
      res.status(400).json({ error: (error as Error).message });
    }
  }
});
export default router;