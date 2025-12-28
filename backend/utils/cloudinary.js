const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

// Configure Cloudinary only if credentials are provided
const hasCloudinaryConfig =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

if (hasCloudinaryConfig) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    logger.info('Cloudinary configured successfully');
} else {
    logger.warn('Cloudinary not configured - images will be stored locally');
}

/**
 * Upload image to Cloudinary
 * @param {string} filePath - Path to the local file
 * @param {string} folder - Folder name in Cloudinary (e.g., 'profile_photos', 'captions')
 * @param {string} publicId - Optional public ID for the image
 * @returns {Promise<Object>} Cloudinary upload result
 */
async function uploadImage(filePath, folder, publicId = null) {
    if (!hasCloudinaryConfig) {
        throw new Error(
            'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.'
        );
    }

    try {
        const options = {
            folder: folder,
            resource_type: 'image',
            overwrite: false,
            invalidate: true,
        };

        if (publicId) {
            options.public_id = publicId;
        }

        const result = await cloudinary.uploader.upload(filePath, options);

        logger.info('Image uploaded to Cloudinary', {
            folder,
            publicId: result.public_id,
            url: result.secure_url,
        });

        return {
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
        };
    } catch (error) {
        logger.error('Error uploading image to Cloudinary', {
            error: error.message,
            stack: error.stack,
            folder,
            filePath,
        });
        throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
    }
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Public ID of the image to delete
 * @returns {Promise<Object>} Deletion result
 */
async function deleteImage(publicId) {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        logger.info('Image deleted from Cloudinary', { publicId, result });
        return result;
    } catch (error) {
        logger.error('Error deleting image from Cloudinary', {
            error: error.message,
            stack: error.stack,
            publicId,
        });
        throw new Error(`Failed to delete image from Cloudinary: ${error.message}`);
    }
}

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID or null if not a Cloudinary URL
 */
function extractPublicId(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    // Check if it's a Cloudinary URL
    if (!url.includes('cloudinary.com')) {
        return null;
    }

    try {
        // Extract public ID from URL
        // Format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
        const match = url.match(/\/upload\/(?:v\d+\/)?([^\/]+)\.(jpg|jpeg|png|gif|webp)/i);
        if (match && match[1]) {
            // Remove folder prefix if present
            const publicId = match[1];
            return publicId;
        }
        return null;
    } catch (error) {
        logger.error('Error extracting public ID from URL', {
            url,
            error: error.message,
        });
        return null;
    }
}

module.exports = {
    uploadImage,
    deleteImage,
    extractPublicId,
    cloudinary,
};
