import { FastifyInstance } from 'fastify';
import { LocalWhisperService, TranscriptionChunk } from './localWhisper.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface RecordingSession {
  id: string;
  connection: any; // Using any for now to avoid complex typing
  whisperService: LocalWhisperService;
  audioChunks: Buffer[];
  chunkCounter: number;
  isRecording: boolean;
  startTime: number;
  fullTranscript: string;
}

export class RecordingService {
  private sessions: Map<string, RecordingSession> = new Map();
  private tempDir: string;

  constructor() {
    this.tempDir = join(process.cwd(), 'temp', 'recordings');
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async setupWebSocketRoute(fastify: FastifyInstance): Promise<void> {
    const self = this;
    
    await fastify.register(async function (fastify) {
      fastify.get('/ws/recording', { websocket: true }, async (connection, req) => {
        const sessionId = self.generateSessionId();
        console.log(`New recording session: ${sessionId}`);

        const whisperService = new LocalWhisperService();
        
        // Setup whisper service
        try {
          await whisperService.startRealTimeTranscription();
        } catch (error) {
          connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to initialize transcription service'
          }));
          connection.close();
          return;
        }

        const session: RecordingSession = {
          id: sessionId,
          connection: connection,
          whisperService,
          audioChunks: [],
          chunkCounter: 0,
          isRecording: false,
          startTime: 0,
          fullTranscript: ''
        };

        self.sessions.set(sessionId, session);

        // Handle transcription events
        whisperService.on('transcription', (chunk: TranscriptionChunk) => {
          session.fullTranscript += ' ' + chunk.text;
          
          connection.send(JSON.stringify({
            type: 'transcription',
            data: {
              text: chunk.text,
              fullTranscript: session.fullTranscript.trim(),
              timestamp: chunk.timestamp,
              confidence: chunk.confidence
            }
          }));
        });

        whisperService.on('error', (error: Error) => {
          connection.send(JSON.stringify({
            type: 'error',
            message: error.message
          }));
        });

        // Handle incoming messages
        connection.on('message', async (message: any) => {
          try {
            const data = JSON.parse(message.toString());
            await self.handleMessage(session, data);
          } catch (error) {
            console.error('Error handling message:', error);
            connection.send(JSON.stringify({
              type: 'error',
              message: 'Invalid message format'
            }));
          }
        });

        // Handle connection close
        connection.on('close', () => {
          console.log(`Recording session ended: ${sessionId}`);
          self.endSession(sessionId);
        });

        // Send ready message
        connection.send(JSON.stringify({
          type: 'ready',
          sessionId: sessionId
        }));
      });
    });
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private async handleMessage(session: RecordingSession, data: any): Promise<void> {
    switch (data.type) {
      case 'start_recording':
        await this.startRecording(session);
        break;
      
      case 'stop_recording':
        await this.stopRecording(session);
        break;
      
      case 'audio_chunk':
        await this.processAudioChunk(session, data.data);
        break;
      
      case 'pause_recording':
        await this.pauseRecording(session);
        break;
      
      case 'resume_recording':
        await this.resumeRecording(session);
        break;
      
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  private async startRecording(session: RecordingSession): Promise<void> {
    session.isRecording = true;
    session.startTime = Date.now();
    session.audioChunks = [];
    session.chunkCounter = 0;
    session.fullTranscript = '';
    
    console.log(`Recording started for session: ${session.id}`);
    
    session.connection.send(JSON.stringify({
      type: 'recording_started',
      timestamp: session.startTime
    }));
  }

  private async stopRecording(session: RecordingSession): Promise<void> {
    session.isRecording = false;
    
    console.log(`Recording stopped for session: ${session.id}`);
    
    session.connection.send(JSON.stringify({
      type: 'recording_stopped',
      finalTranscript: session.fullTranscript.trim(),
      duration: Date.now() - session.startTime
    }));
  }

  private async pauseRecording(session: RecordingSession): Promise<void> {
    session.isRecording = false;
    
    session.connection.send(JSON.stringify({
      type: 'recording_paused'
    }));
  }

  private async resumeRecording(session: RecordingSession): Promise<void> {
    session.isRecording = true;
    
    session.connection.send(JSON.stringify({
      type: 'recording_resumed'
    }));
  }

  private async processAudioChunk(session: RecordingSession, audioData: string): Promise<void> {
    if (!session.isRecording) return;
    
    try {
      // Convert base64 audio data to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      session.audioChunks.push(audioBuffer);
      
      // Process audio chunk every 3 seconds worth of data (approximate)
      // This creates a balance between latency and accuracy
      if (session.audioChunks.length >= 3) {
        const combinedBuffer = Buffer.concat(session.audioChunks);
        const chunkFilename = `${session.id}_chunk_${session.chunkCounter++}`;
        
        // Process the audio chunk with whisper
        await session.whisperService.processAudioChunk(combinedBuffer, chunkFilename);
        
        // Clear processed chunks but keep some overlap for better continuity
        session.audioChunks = session.audioChunks.slice(-1);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      session.connection.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process audio chunk'
      }));
    }
  }

  private endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.whisperService.stopRealTimeTranscription();
      this.sessions.delete(sessionId);
    }
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }
} 