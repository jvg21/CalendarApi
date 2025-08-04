import express from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { AvailabilityService } from '../service/availability';
import { AppointmentService } from '../service/appointment';

// Import das definições do Swagger
import '../docs/swagger-definitions';
import { fi } from 'date-fns/locale';

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
    await appointmentService.updateExpiredAppointments();
    const appointment = await appointmentService.createAppointment(req.body);
    res.json(appointment);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
// Substitua a rota GET /appointments no arquivo src/routes/index.ts

router.get('/appointments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      instance_id, 
      start_date, 
      end_date, 
      status,
      flow_id,
      agent_id,
      user_id,
      calendar_id,
      service_id,
      client_email,
      page = '1',
      limit = '50'
    } = req.query;

     await appointmentService.updateExpiredAppointments();

    // Validação de parâmetros
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100); // Max 100 por página
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('appointments')
      .select(`
        *,
        instances(name),
        calendars(name, google_calendar_id),
        services(name, duration, price)
      `, { count: 'exact' }) // Para paginação
      .order('start_datetime', { ascending: false }); // Mais recentes primeiro

    // 🔧 FILTROS CORRIGIDOS

    // Filtro por instância
    if (instance_id && typeof instance_id === 'string') {
      query = query.eq('instance_id', instance_id);
    }

    // Filtro por calendário
    if (calendar_id && typeof calendar_id === 'string') {
      query = query.eq('calendar_id', calendar_id);
    }

    // Filtro por serviço
    if (service_id && typeof service_id === 'string') {
      query = query.eq('service_id', service_id);
    }

    // 🔧 FILTROS DE DATA CORRIGIDOS
    if (start_date && typeof start_date === 'string') {
      try {
        // Validar formato da data
        const startDateParsed = new Date(start_date);
        if (isNaN(startDateParsed.getTime())) {
          res.status(400).json({ 
            error: 'Invalid start_date format. Use ISO 8601 format (e.g., 2024-03-15 or 2024-03-15T10:00:00)' 
          });
          return;
        }
        
        // Filtrar agendamentos que começam a partir desta data
        query = query.gte('start_datetime', start_date);
      } catch (error) {
        res.status(400).json({ error: 'Invalid start_date format' });
        return;
      }
    }

    if (end_date && typeof end_date === 'string') {
      try {
        // Validar formato da data
        const endDateParsed = new Date(end_date);
        if (isNaN(endDateParsed.getTime())) {
          res.status(400).json({ 
            error: 'Invalid end_date format. Use ISO 8601 format (e.g., 2024-03-15 or 2024-03-15T23:59:59)' 
          });
          return;
        }

        // Se end_date não tem horário, adicionar fim do dia
        const endDateStr = end_date.includes('T') ? end_date : `${end_date}T23:59:59`;
        
        // Filtrar agendamentos que começam antes ou no final desta data
        query = query.lte('start_datetime', endDateStr);
      } catch (error) {
        res.status(400).json({ error: 'Invalid end_date format' });
        return;
      }
    }

    // 🔧 FILTRO DE STATUS CORRIGIDO
    if (status && typeof status === 'string') {
      const validStatuses = ['scheduled', 'confirmed', 'cancelled', 'completed'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
        return;
      }
      query = query.eq('status', status);
    }

    // 🔧 FILTROS NUMÉRICOS CORRIGIDOS
    if (flow_id && typeof flow_id === 'string') {
      const flowIdNum = parseInt(flow_id);
      if (isNaN(flowIdNum)) {
        res.status(400).json({ error: 'flow_id must be a valid integer' });
        return;
      }
      query = query.eq('flow_id', flowIdNum);
    }

    if (agent_id && typeof agent_id === 'string') {
      const agentIdNum = parseInt(agent_id);
      if (isNaN(agentIdNum)) {
        res.status(400).json({ error: 'agent_id must be a valid integer' });
        return;
      }
      query = query.eq('agent_id', agentIdNum);
    }

    if (user_id && typeof user_id === 'string') {
      const userIdNum = parseInt(user_id);
      if (isNaN(userIdNum)) {
        res.status(400).json({ error: 'user_id must be a valid integer' });
        return;
      }
      query = query.eq('user_id', userIdNum);
    }

    // 🔧 FILTRO POR EMAIL DO CLIENTE
    if (client_email && typeof client_email === 'string') {
      query = query.ilike('client_email', `%${client_email}%`);
    }

    // 🔧 APLICAR PAGINAÇÃO
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // 🔧 RESPOSTA COM METADADOS DE PAGINAÇÃO
    res.json({
      data: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum),
        has_next: (count || 0) > offset + limitNum,
        has_prev: pageNum > 1
      },
      filters_applied: {
        instance_id: instance_id || null,
        calendar_id: calendar_id || null,
        service_id: service_id || null,
        start_date: start_date || null,
        end_date: end_date || null,
        status: status || null,
        flow_id: flow_id ? parseInt(flow_id as string) : null,
        agent_id: agent_id ? parseInt(agent_id as string) : null,
        user_id: user_id ? parseInt(user_id as string) : null,
        client_email: client_email || null
      }
    });

  } catch (error) {
    console.error('Error in appointments endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/appointments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await appointmentService.updateExpiredAppointments();
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

router.post('/appointments/update-expired', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const filters = req.body || {};
    
    console.log('🔄 Updating expired appointments with filters:', filters);
    
    const result = await appointmentService.updateExpiredAppointments(filters);
    
    res.json({
      ...result,
      message: `Successfully updated ${result.updated_count} expired appointments`
    });
    
  } catch (error) {
    console.error('❌ Error in update-expired endpoint:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});


export default router;