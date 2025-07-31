import express from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { AvailabilityService } from '../service/availability';
import { AppointmentService } from '../service/appointment';

// Import das definições do Swagger
import '../docs/swagger-definitions';

const router = express.Router();
const availabilityService = new AvailabilityService();
const appointmentService = new AppointmentService();

// Authentication Routes
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

router.post('/auth/logout', authenticateToken, async (req, res) => {
  await supabase.auth.signOut();
  res.json({ message: 'Logged out successfully' });
});

// Instance Routes
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

// Instance-specific Calendar Routes
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

// Instance-specific Service Routes
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

// Global Calendar Routes
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

// Global Service Routes
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

// Appointment Routes
router.post('/appointments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const appointment = await appointmentService.createAppointment(req.body);
    res.json(appointment);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/appointments', authenticateToken, requireAdmin, async (req, res) => {
  const { 
    instance_id, 
    start_date, 
    end_date, 
    status,
    flow_id,
    agent_id,
    user_id
  } = req.query;
  
  let query = supabase
    .from('appointments')
    .select(`
      *,
      instances(name),
      calendars(name),
      services(name, duration)
    `)
    .order('start_datetime');

  // Apply filters
  if (instance_id) query = query.eq('instance_id', instance_id);
  if (start_date) query = query.gte('start_datetime', start_date);
  if (end_date) query = query.lte('start_datetime', end_date);
  if (status) query = query.eq('status', status);
  if (flow_id) query = query.eq('flow_id', parseInt(flow_id as string));
  if (agent_id) query = query.eq('agent_id', parseInt(agent_id as string));
  if (user_id) query = query.eq('user_id', parseInt(user_id as string));

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

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

// Availability Routes
router.post('/availability/check', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_datetime, service_id, calendar_ids } = req.body;
    
    // Validação de parâmetros
    if (!start_datetime || !service_id || !calendar_ids) {
      res.status(400).json({ 
        error: 'start_datetime, service_id, and calendar_ids are required' 
      });
      return;
    }

    // Validar se calendar_ids é um array
    if (!Array.isArray(calendar_ids) || calendar_ids.length === 0) {
      res.status(400).json({ 
        error: 'calendar_ids must be a non-empty array' 
      });
      return;
    }

    // Validar se todos os IDs são strings válidas
    const invalidIds = calendar_ids.filter(id => typeof id !== 'string' || !id.trim());
    if (invalidIds.length > 0) {
      res.status(400).json({ 
        error: 'All calendar_ids must be valid strings' 
      });
      return;
    }

    console.log(`🔍 Checking availability for ${calendar_ids.length} calendar(s) at ${start_datetime}`);

    const result = await availabilityService.checkCalendarsAvailability(
      start_datetime,
      service_id,
      calendar_ids
    );

    console.log(`✅ Availability check complete: ${result.total_available}/${result.total_calendars_checked} calendars available`);

    res.json(result);
  } catch (error) {
    console.error('❌ Error in availability check:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/availability/suggest', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      start_datetime, 
      end_datetime, 
      service_id, 
      calendar_ids,
      max_results = 10,
      expand_timeframe = false,
      interval_minutes = 30,
      strategy = 'priority'
    } = req.body;
    
    if (!start_datetime || !end_datetime || !service_id || !calendar_ids || !Array.isArray(calendar_ids)) {
      res.status(400).json({ 
        error: 'start_datetime, end_datetime, service_id, and calendar_ids (array) are required' 
      });
      return;
    }

    const suggestions = await availabilityService.suggestAvailability(
      start_datetime,
      end_datetime,
      service_id,
      calendar_ids,
      max_results,
      expand_timeframe,
      interval_minutes,
      strategy
    );

    res.json({ 
      suggestions,
      total_found: suggestions.length,
      search_params: {
        start_datetime,
        end_datetime,
        service_id,
        calendar_ids,
        max_results,
        expand_timeframe,
        interval_minutes,
        strategy
      }
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});



export default router;