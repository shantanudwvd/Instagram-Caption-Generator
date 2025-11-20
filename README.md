# Instagram-Caption-Generator

## Image Storage Setup

This application supports cloud storage for images to ensure they persist across deployments. By default, images are stored locally, but for production deployments, it's recommended to use Cloudinary.

### Cloudinary Setup (Recommended for Production)

1. **Create a Cloudinary Account**
   - Sign up at [https://cloudinary.com](https://cloudinary.com) (free tier available)
   - Get your credentials from the dashboard

2. **Configure Environment Variables**
   Add these to your backend `.env` file:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

3. **How It Works**
   - When Cloudinary is configured, all uploaded images (profile photos and caption images) are automatically uploaded to Cloudinary
   - Images are stored in folders: `profile_photos/` and `captions/`
   - Old images are automatically deleted when replaced
   - If Cloudinary is not configured, the app falls back to local storage (which gets wiped on redeployment)

### Local Storage (Development Only)

- Images are stored in `backend/uploads/` directory
- This directory is ephemeral and gets wiped on redeployment
- **Not recommended for production** as images will disappear after each deployment

### Migration Notes

- Existing images stored locally will continue to work until the next deployment
- New uploads will use Cloudinary if configured
- The frontend automatically handles both local and Cloudinary URLs