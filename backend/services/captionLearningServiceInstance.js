const CaptionLearningService = require('./captionLearningService');

// Shared singleton to avoid multiple Mongo connections and duplicated logs
const captionLearningService = new CaptionLearningService();

module.exports = captionLearningService;
