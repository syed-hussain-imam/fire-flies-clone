import Fastify from 'fastify';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { apiRoutes } from './routes/api.js';
import { RecordingService } from './services/recordingService.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Server starting with environment:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- Environment variables available:', Object.keys(process.env));
console.log('- AssemblyAI API Key configured:', !!process.env.ASSEMBLYAI_API_KEY);
console.log('- AssemblyAI API Key length:', process.env.ASSEMBLYAI_API_KEY?.length || 0);

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Register multipart support for file uploads
await fastify.register(import('@fastify/multipart'), {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Register WebSocket support
await fastify.register(import('@fastify/websocket'));

// Register static files
await fastify.register(import('@fastify/static'), {
  root: join(__dirname, '../public'),
  prefix: '/static/',
});

// Register view engine for HTML templates
const handlebars = await import('handlebars');
await fastify.register(import('@fastify/view'), {
  engine: {
    handlebars: handlebars.default,
  },
  root: join(__dirname, '../views'),
});

// Register API routes
await fastify.register(apiRoutes);

// Initialize and register recording service
const recordingService = new RecordingService();
await recordingService.setupWebSocketRoute(fastify);

// Health check route
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Main route
fastify.get('/', async (request, reply) => {
  return reply.view('index.hbs', {
    title: 'Fireflies Clone',
    description: 'AI-powered meeting transcription and note-taking'
  });
});

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    const host = '0.0.0.0'; // Always bind to 0.0.0.0 for Docker compatibility
    
    await fastify.listen({ port, host });
    console.log(`🚀 Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start(); 