import { FastifyInstance } from 'fastify';
import { AssemblyAIStreamingService, StreamingTranscriptionChunk } from './assemblyAiStreaming.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface RecordingSession {
  id: string;
  connection: any; // Using any for now to avoid complex typing
  assemblyAiService: AssemblyAIStreamingService | null;
  audioChunks: Buffer[];
  chunkCounter: number;
  isRecording: boolean;
  startTime: number;
  fullTranscript: string;
  speakerTranscript: Map<string, string[]>; // Track speaker-specific transcripts
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

        let assemblyAiService: AssemblyAIStreamingService | null = null;

        // Check if AssemblyAI API key is configured
        if (!process.env.ASSEMBLYAI_API_KEY) {
          console.error(`AssemblyAI API key not configured - cannot start session: ${sessionId}`);
          connection.send(JSON.stringify({
            type: 'error',
            message: 'AssemblyAI API key not configured. Please set ASSEMBLYAI_API_KEY environment variable.'
          }));
          connection.close();
          return;
        }

        // Setup AssemblyAI Universal-Streaming
        console.log(`Setting up AssemblyAI Universal-Streaming for session: ${sessionId}`);
        assemblyAiService = new AssemblyAIStreamingService(sessionId);
        
        try {
          const success = await assemblyAiService.startRealTimeTranscription();
          if (!success) {
            console.error(`Failed to start AssemblyAI Universal-Streaming for session: ${sessionId}`);
            connection.send(JSON.stringify({
              type: 'error',
              message: 'Failed to initialize AssemblyAI Universal-Streaming transcription service'
            }));
            connection.close();
            return;
          }
          console.log(`AssemblyAI Universal-Streaming ready for session: ${sessionId}`);
        } catch (error) {
          console.error(`AssemblyAI Universal-Streaming setup failed for session ${sessionId}:`, error);
          connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to initialize AssemblyAI Universal-Streaming transcription service'
          }));
          connection.close();
          return;
        }

        const session: RecordingSession = {
          id: sessionId,
          connection: connection,
          assemblyAiService,
          audioChunks: [],
          chunkCounter: 0,
          isRecording: false,
          startTime: 0,
          fullTranscript: '',
          speakerTranscript: new Map(),
        };

        self.sessions.set(sessionId, session);

        // Handle AssemblyAI Universal-Streaming events
        assemblyAiService.on('transcription', (chunk: StreamingTranscriptionChunk) => {
          // Handle turn-based transcription from Universal-Streaming
          if (chunk.speaker && chunk.isFinal) {
            // Extract speaker letter for color class
            const speakerLetter = chunk.speaker.replace('Speaker ', '').toLowerCase();
            const speakerClass = `speaker-${speakerLetter}`;
            
            // Add speaker segment to chronological transcript
            const speakerBlock = `<div class="speaker-block mb-4">
              <div class="speaker-label font-semibold ${speakerClass} mb-2">${chunk.speaker}:</div>
              <div class="speaker-text text-white/90 leading-relaxed pl-4">${chunk.text}</div>
            </div>`;
            
            if (session.fullTranscript) {
              session.fullTranscript += '\n\n' + speakerBlock;
            } else {
              session.fullTranscript = speakerBlock;
            }
            
            // Also update the speaker map for potential future use
            if (!session.speakerTranscript.has(chunk.speaker)) {
              session.speakerTranscript.set(chunk.speaker, []);
            }
            session.speakerTranscript.get(chunk.speaker)!.push(chunk.text);
            
          } else if (!chunk.speaker && chunk.isFinal) {
            // No speaker identification, append to general transcript
            if (session.fullTranscript) {
              session.fullTranscript += (session.fullTranscript.includes('<div') ? '\n\n' : ' ') + chunk.text;
            } else {
              session.fullTranscript = chunk.text;
            }
          }
          
          console.log(`Sending AssemblyAI Universal-Streaming transcription to session ${sessionId}:`, 
            chunk.text, 
            chunk.speaker ? `(${chunk.speaker})` : '',
            chunk.isFinal ? '(FINAL)' : '(PARTIAL)',
            chunk.isFormatted ? '(FORMATTED)' : '(UNFORMATTED)'
          );
          
          connection.send(JSON.stringify({
            type: 'transcription',
            data: {
              text: chunk.text,
              fullTranscript: session.fullTranscript,
              timestamp: chunk.timestamp,
              confidence: chunk.confidence,
              speaker: chunk.speaker,
              isFinal: chunk.isFinal,
              turnOrder: chunk.turnOrder,
              endOfTurn: chunk.endOfTurn,
              isFormatted: chunk.isFormatted
            }
          }));
        });

        assemblyAiService.on('error', (error: Error) => {
          console.error(`AssemblyAI Universal-Streaming error for session ${sessionId}:`, error);
          connection.send(JSON.stringify({
            type: 'error',
            message: `AssemblyAI Universal-Streaming error: ${error.message}`
          }));
        });

        assemblyAiService.on('disconnected', () => {
          console.log(`AssemblyAI Universal-Streaming disconnected for session ${sessionId}`);
          connection.send(JSON.stringify({
            type: 'warning',
            message: 'Real-time transcription disconnected'
          }));
        });

        assemblyAiService.on('connected', () => {
          console.log(`AssemblyAI Universal-Streaming connected for session ${sessionId}`);
          connection.send(JSON.stringify({
            type: 'info',
            message: 'Real-time transcription connected'
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

      case 'force_end_of_turn':
        this.forceEndOfTurn(session);
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

  private forceEndOfTurn(session: RecordingSession): void {
    if (session.assemblyAiService) {
      session.assemblyAiService.forceEndOfTurn();
      console.log(`Forced end of turn for session: ${session.id}`);
    }
  }

  private async processAudioChunk(session: RecordingSession, audioData: string): Promise<void> {
    if (!session.isRecording) {
      console.log(`Session ${session.id} not recording, ignoring audio chunk`);
      return;
    }
    
    try {
      // Validate base64 audio data
      if (!audioData || typeof audioData !== 'string') {
        console.warn(`Invalid audio data for session ${session.id}: data is ${typeof audioData}, length: ${audioData?.length || 'undefined'}`);
        return;
      }
      
      // Additional validation for base64 format
      if (audioData.length === 0) {
        console.warn(`Empty audio data string for session ${session.id}`);
        return;
      }
      
      // Convert base64 audio data to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      console.log(`Received audio chunk for session ${session.id}: ${audioBuffer.length} bytes (base64 length: ${audioData.length})`);
      
      // Validate the converted buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        console.warn(`Empty audio buffer for session ${session.id}, skipping`);
        return;
      }
      
      // Additional validation for PCM_S16LE format (should be even number of bytes)
      if (audioBuffer.length % 2 !== 0) {
        console.warn(`Invalid PCM_S16LE audio buffer for session ${session.id}: length ${audioBuffer.length} is not even`);
        return;
      }
      
      session.audioChunks.push(audioBuffer);
      session.chunkCounter++;
      
      // Send audio chunk to AssemblyAI Universal-Streaming
      if (session.assemblyAiService) {
        session.assemblyAiService.sendAudioChunk(audioBuffer);
      } else {
        console.error(`No AssemblyAI service available for session ${session.id}`);
        session.connection.send(JSON.stringify({
          type: 'error',
          message: 'Transcription service not available'
        }));
      }
      
    } catch (error) {
      console.error(`Error processing audio chunk for session ${session.id}:`, error);
      session.connection.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process audio chunk: ' + (error instanceof Error ? error.message : String(error))
      }));
    }
  }

  private endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.assemblyAiService) {
        session.assemblyAiService.stopRealTimeTranscription();
      }
      this.sessions.delete(sessionId);
      console.log(`Session ${sessionId} ended and cleaned up`);
    }
  }

  private buildFormattedTranscript(speakerTranscript: Map<string, string[]>): string {
    let formattedTranscript = '';
    
    // Get all speakers and their messages
    const speakers = Array.from(speakerTranscript.keys()).sort();
    
    // Build a chronological transcript with speaker labels in separate blocks
    for (const speaker of speakers) {
      const messages = speakerTranscript.get(speaker)!;
      
      // Extract speaker letter for color class
      const speakerLetter = speaker.replace('Speaker ', '').toLowerCase();
      const speakerClass = `speaker-${speakerLetter}`;
      
      for (const message of messages) {
        // Each speaker gets their own paragraph block
        if (formattedTranscript) {
          formattedTranscript += '\n\n';
        }
        formattedTranscript += `<div class="speaker-block mb-4">
          <div class="speaker-label font-semibold ${speakerClass} mb-2">${speaker}:</div>
          <div class="speaker-text text-white/90 leading-relaxed pl-4">${message}</div>
        </div>`;
      }
    }
    
    return formattedTranscript;
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }
} 