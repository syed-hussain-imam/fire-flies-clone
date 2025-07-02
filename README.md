# Fireflies Clone

An AI-powered meeting transcription and note-taking service built with modern, lean technologies.

## 🚀 Tech Stack

This project follows a "lean" architecture approach for optimal performance and maintainability:

- **Backend**: Fastify + TypeScript (2x faster than Express, first-class TS support)
- **Database**: SQLite + Drizzle ORM (Zero-config, SQL-first with great TS types)
- **AI Services**: OpenAI Whisper (transcription) + GPT-4o (insights generation)
- **Frontend**: HTML templates + htmx + Alpine.js (No runtime bundle, progressive enhancement)
- **Styling**: Tailwind CSS standalone CLI (6KB minified output)
- **Build**: tsup (Single compiled JS file, <200ms cold start)

## 📁 Project Structure

```
fire-flies-clone/
├── src/
│   ├── server/
│   │   ├── index.ts              # Main Fastify server
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle database schema
│   │   │   ├── index.ts          # Database connection
│   │   │   └── migrate.ts        # Migration runner
│   │   ├── services/
│   │   │   ├── transcription.ts  # OpenAI Whisper integration
│   │   │   └── ai.ts             # GPT-4o analysis service
│   │   └── routes/
│   │       └── api.ts            # API endpoints
│   ├── public/
│   │   └── css/
│   │       ├── input.css         # Tailwind input
│   │       └── output.css        # Generated CSS (created on build)
│   └── views/
│       └── index.hbs             # Main HTML template
├── drizzle/                      # Database migrations (auto-generated)
├── uploads/                      # Audio file storage (created at runtime)
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── drizzle.config.ts
└── sqlite.db                     # SQLite database (created on first run)
```

## 🛠 Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd fire-flies-clone
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Set up the database:**
   ```bash
   npm run db:generate  # Generate migration files
   npm run db:migrate   # Run migrations
   ```

4. **Build CSS:**
   ```bash
   npm run css:build
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`

## 📝 Usage

### Development

- `npm run dev` - Start development server with hot reload
- `npm run css:watch` - Watch and rebuild CSS on changes
- `npm run db:studio` - Open Drizzle Studio for database management

### Production

- `npm run build` - Build for production
- `npm start` - Start production server

### Database Management

- `npm run db:generate` - Generate new migration files after schema changes
- `npm run db:migrate` - Apply pending migrations
- `npm run db:studio` - Visual database explorer

## 🎯 Features

- **Audio Upload**: Support for multiple audio formats (MP3, WAV, M4A, etc.)
- **Real-time Transcription**: Using OpenAI Whisper API
- **AI-Powered Insights**: 
  - Meeting summaries
  - Key points extraction
  - Action items identification
  - Participant recognition
- **Modern UI**: Responsive design with htmx for dynamic interactions
- **Fast Performance**: <200ms cold start, optimized for speed

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
- **transcriptions**: Store Whisper API transcription results  
- **aiNotes**: Store GPT-4o generated insights and summaries

## 🚀 Deployment

This application is designed for easy deployment on modern platforms:

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
