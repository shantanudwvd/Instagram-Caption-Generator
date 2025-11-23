# Instagram Caption Generator (Caption Muse)

An AI-powered Instagram caption generator that creates authentic, human-like captions by analyzing images, incorporating music context, and learning from user preferences.

## 🚀 Features

- **AI-Powered Caption Generation**: Uses GPT-4 Vision to analyze images and generate contextually relevant captions
- **Music Integration**: Connect Spotify tracks to enhance captions with music context
- **Audio Transcription**: Upload audio files to provide context via voice input
- **Customization Options**:
  - Multiple tones (casual, professional, funny, poetic, etc.)
  - Variable caption lengths
  - Language support (English, Hindi, Hinglish)
  - Emoji and hashtag customization
- **Learning System**: Caption generator learns from user feedback to improve future suggestions
- **User Profiles**: Track caption history, statistics, and preferences
- **Image Storage**: Cloudinary integration for persistent image storage
- **Spotify Integration**: Search and select tracks to enhance caption context

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI framework
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Supabase** - Authentication
- **Recharts** - Data visualization
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **MongoDB** - Database
- **OpenAI API** - GPT-4 Vision for image analysis and caption generation
- **Spotify Web API** - Music integration
- **Cloudinary** - Image storage
- **Winston** - Logging
- **Multer** - File upload handling

### Infrastructure
- **AWS ECS (Fargate)** - Container orchestration
- **AWS ECR** - Container registry
- **Docker** - Containerization
- **MongoDB Atlas** - Managed database
- **AWS Secrets Manager** - Environment variable management

## 📁 Project Structure

```
Instagram-Caption-Generator/
├── backend/
│   ├── deploy.sh              # AWS deployment script
│   ├── Dockerfile             # Container configuration
│   ├── .dockerignore          # Docker build exclusions
│   ├── server.js              # Express server entry point
│   ├── routes/                # API route handlers
│   ├── services/              # Business logic services
│   ├── middleware/            # Express middleware
│   ├── utils/                 # Utility functions
│   └── scripts/               # Migration and utility scripts
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── context/           # React context providers
│   │   └── utils/             # Frontend utilities
│   └── public/                # Static assets
└── README.md
```

## 🚦 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** (local or MongoDB Atlas)
- **AWS Account** (for deployment)
- **Docker** (for containerization)
- **AWS CLI** (for deployment)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Instagram-Caption-Generator.git
   cd Instagram-Caption-Generator
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies (if any)
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Configure environment variables**

   **Backend** (create `backend/.env`):
   ```env
   # Server
   PORT=3001
   NODE_ENV=development
   
   # Database
   MONGODB_URI=your_mongodb_connection_string
   
   # Authentication
   JWT_SECRET=your_jwt_secret_key
   
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key
   
   # Spotify
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
   
   # Cloudinary (optional, for image storage)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   
   # CORS
   CORS_ORIGINS=http://localhost:3000
   FRONTEND_URL=http://localhost:3000
   ```

   **Frontend** (create `frontend/.env`):
   ```env
   REACT_APP_BACKEND_URL=http://localhost:3001
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development servers**

   **Backend** (from `backend/` directory):
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:3001`

   **Frontend** (from `frontend/` directory):
   ```bash
   npm start
   ```
   App runs on `http://localhost:3000`

## 📜 Available Scripts

### Backend
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

### Frontend
- `npm start` - Start React development server
- `npm run build` - Build production bundle
- `npm test` - Run tests
- `npm test -- -t "test name"` - Run specific test

## 🚢 Deployment

### AWS ECS Deployment

The project includes an automated deployment script for AWS ECS with Fargate.

#### Prerequisites
- AWS CLI configured (`aws configure`)
- Docker installed
- Valid AWS credentials

#### Deployment Script

The `backend/deploy.sh` script automates the deployment process:

**Dry-run mode** (safe testing - no AWS changes):
```bash
cd backend
./deploy.sh --dry-run
```

**Actual deployment**:
```bash
cd backend
./deploy.sh
```

**What the script does:**
1. Automatically detects AWS account ID and region from your AWS CLI configuration
2. Builds Docker image
3. Pushes image to Amazon ECR
4. Updates ECS service with new image

**Configuration:**
The script uses these defaults (can be overridden with environment variables):
- ECR Repository: `instagram-caption-backend`
- ECS Cluster: `instagram-caption-backend`
- ECS Service: `instagram-caption-backend-service`
- Region: Auto-detected from AWS CLI config

**Override defaults:**
```bash
ECR_REPOSITORY=my-repo ECS_CLUSTER=my-cluster ./deploy.sh
```

#### Manual Deployment Steps

1. **Build and push Docker image**
   ```bash
   cd backend
   docker build --platform linux/amd64 -t instagram-caption-backend:latest .
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   docker tag instagram-caption-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/instagram-caption-backend:latest
   docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/instagram-caption-backend:latest
   ```

2. **Update ECS service**
   ```bash
   aws ecs update-service \
     --cluster instagram-caption-backend \
     --service instagram-caption-backend-service \
     --force-new-deployment \
     --region us-east-1
   ```

### Environment Variables in Production

For production deployment, use **AWS Secrets Manager** to store sensitive environment variables. The ECS task definition should reference secrets from Secrets Manager.

## 🖼️ Image Storage

### Cloudinary Setup (Recommended for Production)

1. **Create a Cloudinary Account**
   - Sign up at [https://cloudinary.com](https://cloudinary.com) (free tier available)
   - Get your credentials from the dashboard

2. **Configure Environment Variables**
   Add these to your backend `.env` file or AWS Secrets Manager:
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

## 🔧 Configuration

### CORS Configuration

The backend allows requests from configured origins. Add your frontend URL to the CORS configuration in `backend/server.js` or via environment variables:

```env
CORS_ORIGINS=https://your-frontend.com,https://another-domain.com
FRONTEND_URL=https://your-frontend.com
```

### Database

The application uses MongoDB. For production, use **MongoDB Atlas** or a managed MongoDB service. Update the `MONGODB_URI` in your environment variables.

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Captions
- `POST /api/captions/generate-caption` - Generate new caption
- `GET /api/captions` - Get user's captions
- `GET /api/captions/:id` - Get specific caption
- `PUT /api/captions/:id/feedback` - Submit feedback on caption

### Spotify
- `GET /api/spotify/search` - Search for tracks
- `GET /api/spotify/recommendations` - Get song recommendations

### Dashboard
- `GET /api/dashboard/stats` - Get user statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- OpenAI for GPT-4 Vision API
- Spotify for Web API
- Cloudinary for image storage
- AWS for cloud infrastructure

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

**Note**: Make sure to keep your API keys and secrets secure. Never commit `.env` files or sensitive credentials to version control.
