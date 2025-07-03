# Local Development Setup Guide

This document provides instructions for setting up the Fire Flies Clone project locally on your machine.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v20.11 or later)
- npm (comes with Node.js)
- Git
- FFmpeg (required for audio processing)

## Setup Steps

### 1. Clone the Repository

```bash
git clone https://github.com/syed-hussain-imam/fire-flies-clone.git
cd fire-flies-clone
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory with the following variables:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL=./data/sqlite.db

# File Upload Configuration
UPLOAD_DIR=./uploads

# Add any API keys required for AI services here
# OPENAI_API_KEY=your_key_here
# ASSEMBLY_AI_API_KEY=your_key_here
```

### 4. Database Setup

The project uses SQLite with Drizzle ORM. To set up the database:

1. Generate the database migrations:
```bash
npm run db:generate
```

2. Run the migrations:
```bash
npm run db:migrate
```

3. (Optional) To view the database using Drizzle Studio:
```bash
npm run db:studio
```

### 5. Build CSS

The project uses Tailwind CSS. Build the CSS files:

```bash
npm run css:build
```

### 6. Directory Setup

Ensure these directories exist and have proper permissions:
```bash
mkdir -p uploads
mkdir -p temp/recordings
mkdir -p data
mkdir -p logs
mkdir -p models
```

## Development

### Start the Development Server

```bash
npm run dev
```

This will:
- Start the server with hot-reload enabled
- Watch for TypeScript changes
- The server will be available at http://localhost:3000

### Watch CSS Changes

In a separate terminal, run:
```bash
npm run css:watch
```

### Type Checking

To run TypeScript type checking:
```bash
npm run type-check
```

### Linting

To lint the codebase:
```bash
npm run lint
```

## Docker Development

If you prefer using Docker for development:

### Development Environment
```bash
npm run docker:dev
```

### Production Environment
```bash
npm run docker:prod
```

### Stop Docker Containers
```bash
npm run docker:down
```

### View Docker Logs
```bash
npm run docker:logs
```

### Clean Docker Resources
```bash
npm run docker:clean
```

## Building for Production

To build the application for production:

```bash
npm run build
```

To start the production server:
```bash
npm start
```

## Project Structure

Key directories and their purposes:
- `src/` - Source code
  - `server/` - Backend server code
  - `public/` - Static assets
  - `views/` - Handlebars templates
- `data/` - SQLite database files
- `uploads/` - User uploaded files
- `temp/` - Temporary files
- `models/` - AI models
- `drizzle/` - Database migrations and schema

## Troubleshooting

1. If you encounter permission issues with directories, ensure proper write permissions for the `uploads`, `temp`, `data`, and `logs` directories.

2. If the database migration fails, try removing the existing database file and running the migrations again:
```bash
rm -f ./data/sqlite.db
npm run db:migrate
```

3. For any FFmpeg-related issues, ensure FFmpeg is properly installed and accessible in your system's PATH.

## Additional Resources

- Check `docker-setup.md` for detailed Docker setup instructions
- Refer to `SPEAKER_DIARIZATION_SETUP.md` for speaker diarization feature setup
- See `UNIVERSAL_STREAMING_MIGRATION.md` for streaming-related configurations 