"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.authenticateToken = void 0;
const supabase_1 = require("../config/supabase");
// src/middleware/auth.ts - Modifique ambos middlewares
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }
    // Verifica se é Service Role Key
    if (token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
        req.user = { id: 'service-role', role: 'admin', email: 'admin@service' };
        next();
        return;
    }
    // Sistema JWT original (inalterado)
    try {
        const { data: { user }, error } = await supabase_1.supabase.auth.getUser(token);
        if (error || !user) {
            res.status(403).json({ error: 'Invalid token' });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        res.status(403).json({ error: 'Invalid token' });
    }
};
exports.authenticateToken = authenticateToken;
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    // Se já tem role definido (Service Role Key), pula verificação no banco
    if (req.user.role === 'admin') {
        next();
        return;
    }
    // Verificação normal no banco para JWT users
    const { data: profile, error } = await supabase_1.supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', req.user.id)
        .single();
    if (!profile || profile.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
