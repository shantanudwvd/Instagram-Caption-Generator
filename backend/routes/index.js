const adminRoutes = require('./adminRoutes');
const captionRoutes = require('./captionRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');

module.exports = function(app) {
    // Public auth routes
    app.use('/api/auth', authRoutes);

    // Admin API routes remain protected via API key
    app.use('/api/admin', adminRoutes);

    // User dashboard routes (require auth inside router)
    app.use('/api/dashboard', dashboardRoutes);

    // Application routes that require authentication (middleware applied within routers)
    app.use('/api', captionRoutes);
    app.use('/api', feedbackRoutes);

    // Add a catch-all route for API 404s
    app.use('/api/*', (req, res) => {
        res.status(404).json({ error: 'API endpoint not found' });
    });
};
