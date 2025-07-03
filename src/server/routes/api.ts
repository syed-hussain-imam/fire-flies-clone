import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { meetings, transcriptions, aiNotes } from '../db/schema.js';
// Enable both transcription and AI services for full functionality
import { TranscriptionService } from '../services/transcription.js';
import { AIService } from '../services/ai.js';
import { eq, desc } from 'drizzle-orm';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize both transcription and AI services for full functionality
const transcriptionService = new TranscriptionService();
const aiService = new AIService();

export async function apiRoutes(fastify: FastifyInstance) {
  // Ensure uploads directory exists
  const uploadsDir = join(__dirname, '../uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  // Upload audio file
  fastify.post('/api/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Save file
      const filename = `${Date.now()}-${data.filename}`;
      const filepath = join(uploadsDir, filename);
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      writeFileSync(filepath, buffer);

      // Create meeting record
      const [meeting] = await db.insert(meetings).values({
        title: data.filename || 'Untitled Meeting',
        audioUrl: filepath,
        status: 'uploading'
      }).returning();

      // Start real transcription processing
      processAudioFile(meeting.id, filepath);

      return reply.send({ 
        message: 'File uploaded successfully', 
        meetingId: meeting.id 
      });
    } catch (error) {
      console.error('Upload error:', error);
      return reply.code(500).send({ error: 'Upload failed' });
    }
  });

  // Get all meetings
  fastify.get('/api/meetings', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const allMeetings = await db.select().from(meetings).orderBy(desc(meetings.createdAt));
      
      const meetingsHtml = allMeetings.length > 0 
        ? allMeetings.map(meeting => `
            <div class="border border-gray-200 rounded-lg p-4 mb-4">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-semibold text-lg">${meeting.title}</h3>
                  <p class="text-gray-600 text-sm">${new Date(meeting.createdAt).toLocaleDateString()}</p>
                </div>
                <span class="status-badge status-${meeting.status}">${meeting.status}</span>
              </div>
              ${meeting.status === 'completed' ? `
                <button 
                  class="btn btn-primary mt-3"
                  hx-get="/api/meetings/${meeting.id}"
                  hx-target="#meeting-content"
                  onclick="document.dispatchEvent(new CustomEvent('toggle-modal'))"
                >
                  View Details
                </button>
              ` : ''}
            </div>
          `).join('')
        : '<p class="text-gray-500 text-center py-8">No meetings found. Upload your first recording!</p>';

      return reply.type('text/html').send(meetingsHtml);
    } catch (error) {
      console.error('Meetings fetch error:', error);
      return reply.code(500).send('<p class="text-red-500">Failed to load meetings</p>');
    }
  });

  // Get meeting details
  fastify.get('/api/meetings/:id', async (request: FastifyRequest<{ Params: { id: string }, Querystring: { format?: string } }>, reply: FastifyReply) => {
    try {
      const meetingId = parseInt(request.params.id);
      const format = request.query.format;
      
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting not found' });
      }

      const [transcription] = await db.select().from(transcriptions).where(eq(transcriptions.meetingId, meetingId));
      const [notes] = await db.select().from(aiNotes).where(eq(aiNotes.meetingId, meetingId));

      // Return JSON if requested
      if (format === 'json') {
        return reply.send({
          meeting,
          transcription,
          aiNotes: notes,
          status: meeting.status
        });
      }

      // Return HTML for display
      const detailsHtml = `
        <div class="space-y-6">
          <div>
            <h4 class="font-semibold text-lg mb-2">${meeting.title}</h4>
            <p class="text-gray-600">${meeting.description || 'No description'}</p>
            <p class="text-sm text-gray-500 mt-2">Created: ${new Date(meeting.createdAt).toLocaleString()}</p>
          </div>
          
          ${notes ? `
            <div>
              <h5 class="font-semibold mb-2">Summary</h5>
              <p class="text-gray-700">${notes.summary}</p>
            </div>
            
            <div>
              <h5 class="font-semibold mb-2">Key Points</h5>
              <ul class="list-disc list-inside text-gray-700 space-y-1">
                ${JSON.parse(notes.keyPoints || '[]').map((point: string) => `<li>${point}</li>`).join('')}
              </ul>
            </div>
            
            <div>
              <h5 class="font-semibold mb-2">Action Items</h5>
              <ul class="list-disc list-inside text-gray-700 space-y-1">
                ${JSON.parse(notes.actionItems || '[]').map((item: string) => `<li>${item}</li>`).join('')}
              </ul>
            </div>
            
            <div>
              <h5 class="font-semibold mb-2">Participants</h5>
              <div class="flex flex-wrap gap-2">
                ${JSON.parse(notes.participants || '[]').map((participant: string) => 
                  `<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">${participant}</span>`
                ).join('')}
              </div>
            </div>
          ` : '<p class="text-gray-500">AI analysis not yet available</p>'}
          
          ${transcription ? `
            <div>
              <h5 class="font-semibold mb-2">Full Transcription</h5>
              <div class="bg-gray-50 p-4 rounded max-h-64 overflow-y-auto scrollbar-thin">
                <p class="text-gray-700 whitespace-pre-wrap">${transcription.text}</p>
              </div>
            </div>
          ` : '<p class="text-gray-500">Transcription not yet available</p>'}
        </div>
      `;

      return reply.type('text/html').send(detailsHtml);
    } catch (error) {
      console.error('Meeting details error:', error);
      return reply.code(500).send('<p class="text-red-500">Failed to load meeting details</p>');
    }
  });
}

// Real transcription processing function (OpenAI Whisper)
async function processAudioFile(meetingId: number, filepath: string) {
  try {
    // Update status to transcribing
    await db.update(meetings)
      .set({ status: 'transcribing' })
      .where(eq(meetings.id, meetingId));

    console.log(`Starting transcription for meeting ${meetingId}, file: ${filepath}`);

    // Transcribe audio with speaker diarization (if available)
    const transcriptionResult = await transcriptionService.transcribeAudioWithSpeakers(filepath);
    
    console.log(`Transcription completed for meeting ${meetingId}`);

    // Save transcription to database (use formatted text with speaker labels if available)
    await db.insert(transcriptions).values({
      meetingId,
      text: transcriptionResult.formattedText || transcriptionResult.text,
      language: transcriptionResult.language || 'en',
      confidence: transcriptionResult.confidence || 0.85,
      speakers: transcriptionResult.speakers ? JSON.stringify(transcriptionResult.speakers) : null,
    });

    // Update status to transcription_complete so frontend can show transcription
    await db.update(meetings)
      .set({ status: 'transcription_complete' })
      .where(eq(meetings.id, meetingId));

    console.log(`Transcription ready for display, starting AI analysis for meeting ${meetingId}`);

    // Generate real AI insights from the transcription
    console.log(`Starting AI analysis for meeting ${meetingId}`);
    const insights = await aiService.generateMeetingInsights(transcriptionResult.text);
    console.log(`AI analysis completed for meeting ${meetingId}`);
    
    // Save real AI-generated insights
    await db.insert(aiNotes).values({
      meetingId,
      summary: insights.summary,
      keyPoints: JSON.stringify(insights.keyPoints),
      actionItems: JSON.stringify(insights.actionItems),
      participants: JSON.stringify(insights.participants),
    });

    // Update status to completed (now everything is ready)
    await db.update(meetings)
      .set({ status: 'completed' })
      .where(eq(meetings.id, meetingId));

    console.log(`Processing completed for meeting ${meetingId}`);

  } catch (error: any) {
    console.error('Processing error:', error);
    
    // Store error message in description field for user feedback
    const errorMessage = error?.message || 'Unknown processing error occurred';
    
    // Update status to failed with error details
    await db.update(meetings)
      .set({ 
        status: 'failed',
        description: errorMessage
      })
      .where(eq(meetings.id, meetingId));
  }
}

// Demo processing function removed - now using real OpenAI Whisper transcription 