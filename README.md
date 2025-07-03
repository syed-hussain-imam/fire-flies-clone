# Fireflies Clone

An AI-powered meeting transcription and note-taking service built with modern, lean technologies.

🌐 **Live Demo**: [https://fire-flies-clone-production.up.railway.app/](https://fire-flies-clone-production.up.railway.app/)

## 🚀 Tech Stack

This project follows a "lean" architecture approach for optimal performance and maintainability:

- **Backend**: Fastify + TypeScript (Prefered Setup)
- **Database**: SQLite + Drizzle ORM (Light-weight and capable)
- **AI Services**: AssemblyAI + OpenAI (speech -> text transcription + insights generation)
- **Frontend**: HTML templates + htmx + Alpine.js (keeping it fast and keeping it light)
- **Styling**: Tailwind CSS standalone CLI (6KB minified output)
- **Build**: tsup (Single compiled JS file, <200ms cold start)
- **Deployment**: Railway.app (Production hosting)

## 📁 Project Structure

```
fire-flies-clone/
├── data/                         # Data storage directory
├── src/
│   ├── server/
│   │   ├── index.ts             # Main Fastify server
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle database schema
│   │   │   ├── index.ts         # Database connection
│   │   │   └── migrate.ts       # Migration runner
│   │   ├── services/
│   │   │   ├── ai.ts            # AI service integration
│   │   │   ├── assemblyAiStreaming.ts    # Real-time transcription
│   │   │   ├── assemblyAiTranscription.ts # AssemblyAI integration
│   │   │   ├── recordingService.ts        # Audio recording handling
│   │   │   └── transcription.ts           # Transcription service
│   │   ├── routes/
│   │   │   └── api.ts           # API endpoints
│   │   └── uploads/             # Server-side upload storage
│   ├── public/
│   │   └── css/
│   │       └── input.css        # Tailwind input styles
│   ├── uploads/                 # Public upload directory
│   └── views/
│       └── index.hbs           # Main HTML template
├── drizzle/                    # Database migrations (auto-generated)
├── docker-compose.yml         # Docker compose configuration
├── Dockerfile                 # Production Docker configuration
├── Dockerfile.dev            # Development Docker configuration
├── drizzle.config.ts        # Drizzle ORM configuration
├── package.json             # Project dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── start.sh              # Startup script
```

## 🛠 Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm or yarn
- AssemblyAI API key (for speech transcription)
- OpenAI API key (for AI insights)
- Docker and Docker Compose (optional, for containerized setup)

### Local Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/yourusername/fire-flies-clone.git
   cd fire-flies-clone
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Configure the following in your `.env` file:
   ```bash
   PORT=3000
   NODE_ENV=development
   ASSEMBLY_AI_API_KEY=your_assembly_ai_key
   OPENAI_API_KEY=your_openai_key
   MAX_FILE_SIZE=25MB
   UPLOAD_DIR=./uploads
   ```

3. **Set up the database:**
   ```bash
   npm run db:generate  # Generate migration files
   npm run db:migrate   # Run migrations
   ```

4. **Build CSS:**
   ```bash
   npm run css:build   # Build CSS once
   # or
   npm run css:watch   # Watch for CSS changes
   ```

### Docker Setup (Recommended)

1. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

2. **Start with Docker Compose:**
   
   For development:
   ```bash
   docker-compose -f docker-compose.yml up --build
   ```
   
   For production:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build
   ```

3. **Access the application:**
   - Development: http://localhost:3000
   - Production: http://localhost:80

### Running the Application

#### Development Mode

```bash
# Start the development server with hot reload
npm run dev

# Watch for CSS changes
npm run css:watch
```

#### Production Mode

```bash
# Build the application
npm run build

# Build CSS
npm run css:build

# Start the production server
npm start
```

### Database Management

- `npm run db:generate` - Generate new migration files
- `npm run db:migrate` - Apply pending migrations
- `npm run db:studio` - Open Drizzle Studio for database management

## 🎯 Features

- **Audio Upload**: Support for multiple audio formats (MP3, WAV, M4A, etc.)
- **Real-time Transcription**: Using AssemblyAI
- **AI-Powered Insights**:
  - Meeting summaries
  - Key points extraction
  - Action items identification
  - Participant recognition
  *Note: For live recordings, summaries and takeaways will be available only after the recording has been stopped.*
- **Modern UI**: Responsive design with htmx for dynamic interactions
- **Fast Performance**: <200ms cold start, optimized for speed
- **Language Optimization**: Currently optimized for English language processing.

## 🔧 Configuration

### Environment Variables

```bash
PORT=3000                          # Server port
NODE_ENV=development               # Environment
DATABASE_URL=./sqlite.db           # SQLite database path
OPENAI_API_KEY=your_key_here      # OpenAI API key
MAX_FILE_SIZE=50MB                # Max upload file size
UPLOAD_DIR=./uploads              # File storage directory
```

### Database Schema

The application uses three main tables:

- **meetings**: Store meeting metadata and status
- **transcriptions**: Store OpenAI API transcription results  
- **aiNotes**: Store GPT-4o generated insights and summaries

## 🚀 Deployment

This application is designed for easy deployment on modern platforms:

### Production Deployment

The application is currently deployed on Railway.app and accessible at:
[https://fire-flies-clone-production.up.railway.app/](https://fire-flies-clone-production.up.railway.app/)

### 🐳 Docker (Recommended)

**Quick Start with Docker:**
```bash
# 1. Set up environment
cp .env.example .env
# Add your OpenAI API key to .env

# 2. Run in production
npm run docker:prod

# 3. Or run in development (with hot reload)
npm run docker:dev
```

**Available Docker Commands:**
- `npm run docker:build` - Build production image
- `npm run docker:prod` - Run production container
- `npm run docker:dev` - Run development container with hot reload
- `npm run docker:down` - Stop all containers
- `npm run docker:logs` - View container logs
- `npm run docker:clean` - Clean up containers and volumes

📖 **See [docker-setup.md](./docker-setup.md) for comprehensive Docker documentation**

### Fly.io
```bash
flyctl launch
flyctl deploy
```

### Deno Deploy
```bash
# Build first
npm run build
# Deploy the dist/ folder
```

### Traditional VPS
```bash
# After setting up Node.js 18+ on server
npm install
npm run build
npm run css:build
npm run db:generate
npm run db:migrate
npm start
```

## 🤝 Development Workflow

1. **Make changes** to TypeScript files in `src/`
2. **Update database schema** if needed in `src/server/db/schema.ts`
3. **Generate migrations**: `npm run db:generate`
4. **Apply migrations**: `npm run db:migrate`  
5. **Update CSS** if needed in `src/public/css/input.css`
6. **Build CSS**: `npm run css:build` or use `npm run css:watch`
7. **Test locally**: `npm run dev`
8. **Build for production**: `npm run build`

## 📋 API Endpoints

- `POST /api/upload` - Upload audio file for transcription
- `GET /api/meetings` - List all meetings with status
- `GET /api/meetings/:id` - Get detailed meeting information with transcription and AI insights

## 🔍 Troubleshooting

### Common Issues

1. **OpenAI API Errors**: Ensure your API key is valid and has sufficient credits
2. **File Upload Issues**: Check file size limits and upload directory permissions
3. **Database Issues**: Run migrations with `npm run db:migrate`
4. **CSS Not Loading**: Ensure Tailwind CSS is built with `npm run css:build`

### Logs

The application uses Fastify's built-in logger. In development, you'll see detailed logs in the console.

## 📄 License

ISC License - see LICENSE file for details.

## 📝 Usage

### Local Development & Testing

After following the installation steps, you can run the application in development mode and test its functionalities:

- `npm run dev` - Start development server with hot reload
- `npm run css:watch` - Watch and rebuild CSS on changes
- `npm run db:studio` - Open Drizzle Studio for database management

To test the speaker diarization feature, you can use the provided sample audio file of an Anthropic interview with 3 people, located in the `data/` directory. Upload this file via the UI to see the diarization in action.

### Production

- `npm run build` - Build for production
- `npm start` - Start production server
