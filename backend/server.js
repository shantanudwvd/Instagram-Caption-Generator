const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const routes = require('./routes');
const logger = require('./utils/logger');

dotenv.config();

const app = express();

const corsOptions = {
    origin: [
        "https://captionmuse.adityagusain.com",
        "https://instagram-caption-generator-shantanudwvds-projects.vercel.app",
        "http://localhost:3000", // Replace with your Vercel frontend URL
    ],
    methods: "GET,POST,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

// Middleware
// app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Apply routes
routes(app);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});