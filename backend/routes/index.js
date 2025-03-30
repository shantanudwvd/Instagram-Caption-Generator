const adminRoutes = require('./adminRoutes');
const captionRoutes = require('./captionRoutes');
const feedbackRoutes = require('./feedbackRoutes');

module.exports = function(app) {
    // Apply the routes to the Express app
    app.use('/api', captionRoutes);
    app.use('/api', feedbackRoutes);
    app.use('/api/admin', adminRoutes);

    // Add a catch-all route for API 404s
    app.use('/api/*', (req, res) => {
        res.status(404).json({ error: 'API endpoint not found' });
    });
};