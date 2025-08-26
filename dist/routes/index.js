"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabase_1 = require("../config/supabase");
const auth_1 = require("../middleware/auth");
const availability_1 = require("../service/availability");
const appointment_1 = require("../service/appointment");
// Import das definições do Swagger
require("../docs/swagger-definitions");
const router = express_1.default.Router();
const availabilityService = new availability_1.AvailabilityService();
const appointmentService = new appointment_1.AppointmentService();
// Authentication Routes
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase_1.supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) {
        res.status(400).json({ error: error.message });
        return;
    }
    res.json({ user: data.user, token: data.session?.access_token });
});
router.post('/auth/logout', auth_1.authenticateToken, async (req, res) => {
    await supabase_1.supabase.auth.signOut();
    res.json({ message: 'Logged out successfully' });
});
// Instance Routes
router.get('/instances', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    const { data, error } = await supabase_1.supabase
        .from('instances')
        .select('*')
        .order('name');
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    res.json(data);
});
router.post('/instances', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    const { data, error } = await supabase_1.supabase
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
router.put('/instances/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    const { data, error } = await supabase_1.supabase
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
router.delete('/instances/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        // Check if instance has appointments
        const { data: appointments, error: appointmentsError } = await supabase_1.supabase
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
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Instance-specific Calendar Routes
router.get('/instances/:instanceId/calendars', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    const { data, error } = await supabase_1.supabase
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
router.post('/instances/:instanceId/calendars', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    const { data, error } = await supabase_1.supabase
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
router.get('/instances/:instanceId/services', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    const { data, error } = await supabase_1.supabase
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
router.post('/instances/:instanceId/services', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    const { data, error } = await supabase_1.supabase
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
router.get('/calendars', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { instance_id, is_active } = req.query;
        let query = supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/calendars/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/calendars/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/calendars/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Global Service Routes
router.get('/services', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { instance_id, is_active, category } = req.query;
        let query = supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/services/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/services/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/services/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/services/categories', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Appointment Routes
router.post('/appointments', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        await appointmentService.updateExpiredAppointments();
        const appointment = await appointmentService.createAppointment(req.body);
        res.json(appointment);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Substitua a rota GET /appointments no arquivo src/routes/index.ts
router.get('/appointments', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { instance_id, start_date, end_date, status, flow_id, agent_id, user_id, calendar_id, service_id, client_email, page = '1', limit = '50' } = req.query;
        await appointmentService.updateExpiredAppointments();
        // Validação de parâmetros
        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 por página
        const offset = (pageNum - 1) * limitNum;
        let query = supabase_1.supabase
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
            }
            catch (error) {
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
            }
            catch (error) {
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
                flow_id: flow_id ? parseInt(flow_id) : null,
                agent_id: agent_id ? parseInt(agent_id) : null,
                user_id: user_id ? parseInt(user_id) : null,
                client_email: client_email || null
            }
        });
    }
    catch (error) {
        console.error('Error in appointments endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/appointments/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        await appointmentService.updateExpiredAppointments();
        const appointment = await appointmentService.updateAppointment(req.params.id, req.body);
        res.json(appointment);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.delete('/appointments/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        await appointmentService.cancelAppointment(req.params.id);
        res.json({ message: 'Appointment cancelled successfully' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.delete('/appointments/:id/delete', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        await appointmentService.deleteAppointment(req.params.id);
        res.json({ message: 'Appointment deleted permanently' });
    }
    catch (error) {
        if (error.message === 'Appointment not found') {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(400).json({ error: error.message });
        }
    }
});
// Availability Routes
router.post('/availability/check', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
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
        const result = await availabilityService.checkCalendarsAvailability(start_datetime, service_id, calendar_ids);
        console.log(`✅ Availability check complete: ${result.total_available}/${result.total_calendars_checked} calendars available`);
        res.json(result);
    }
    catch (error) {
        console.error('❌ Error in availability check:', error);
        res.status(400).json({ error: error.message });
    }
});
router.post('/availability/suggest', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { start_datetime, end_datetime, service_id, calendar_ids, max_results = 10, expand_timeframe = false, interval_minutes = 30, strategy = 'priority' } = req.body;
        if (!start_datetime || !end_datetime || !service_id || !calendar_ids || !Array.isArray(calendar_ids)) {
            res.status(400).json({
                error: 'start_datetime, end_datetime, service_id, and calendar_ids (array) are required'
            });
            return;
        }
        const suggestions = await availabilityService.suggestAvailability(start_datetime, end_datetime, service_id, calendar_ids, max_results, expand_timeframe, interval_minutes, strategy);
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
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/appointments/update-expired', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const filters = req.body || {};
        console.log('🔄 Updating expired appointments with filters:', filters);
        const result = await appointmentService.updateExpiredAppointments(filters);
        res.json({
            ...result,
            message: `Successfully updated ${result.updated_count} expired appointments`
        });
    }
    catch (error) {
        console.error('❌ Error in update-expired endpoint:', error);
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
