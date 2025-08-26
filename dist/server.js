"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const routes_1 = __importDefault(require("./routes"));
const { createClient } = require('@supabase/supabase-js');
dotenv_1.default.config();
// Teste rápido das credenciais
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .limit(1);
    console.log('Data:', data);
    console.log('Error:', error);
}
test();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3010;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production' ? 'https://calendar.armtexai.org' : '*',
    //origin:  '*',
    credentials: true
}));
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api', routes_1.default);
// Swagger documentation
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Calendar API Documentation'
}));
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.listen(PORT, () => {
    console.log(`🚀 Calendar API running on port ${PORT}`);
    console.log(`📋 Health check: http://0.0.0.0:${PORT}/health`);
});
