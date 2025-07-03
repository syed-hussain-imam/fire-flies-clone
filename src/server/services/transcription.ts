import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { AssemblyAITranscriptionService, DiarizedTranscriptionResult } from './assemblyAiTranscription.js';

let openai: OpenAI | null = null;

export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  formattedText?: string; // Text with speaker labels
  speakers?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export class TranscriptionService {
  private assemblyAiService: AssemblyAITranscriptionService;

  constructor() {
    this.assemblyAiService = new AssemblyAITranscriptionService();
  }

  private initializeOpenAI(): void {
    if (!openai && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      console.log('Initializing OpenAI client...');
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async transcribeAudio(audioFilePath: string): Promise<TranscriptionResult> {
    // Initialize OpenAI client if not already done
    this.initializeOpenAI();
    
    // Check if OpenAI is configured
    if (!openai) {
      console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable for cloud transcription.');
    }

    try {
      const audioFile = readFileSync(audioFilePath);
      const transcription = await openai.audio.transcriptions.create({
        file: new File([audioFile], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-1',
        response_format: 'verbose_json',
      });

      return {
        text: transcription.text,
        language: transcription.language,
        // OpenAI API doesn't provide confidence scores in the response
        // but we can estimate based on the response format
        confidence: 0.85, // placeholder
      };
    } catch (error: any) {
      console.error('Transcription error:', error);
      
      // Handle specific OpenAI errors with better messages
      if (error?.status === 413) {
        throw new Error('File too large. OpenAI API supports files up to 25MB. Please compress your audio file and try again.');
      } else if (error?.status === 415) {
        throw new Error('Unsupported file format. Please use MP3, WAV, M4A, or MP4 format.');
      } else if (error?.status === 401) {
        throw new Error('Authentication failed. Please check OpenAI API key configuration.');
      }
      
      throw new Error('Failed to transcribe audio');
    }
  }

  async transcribeAudioWithSpeakers(audioFilePath: string): Promise<TranscriptionResult> {
    // Check if AssemblyAI is configured and prefer it for speaker diarization
    if (process.env.ASSEMBLYAI_API_KEY) {
      console.log('Using AssemblyAI for speaker diarization...');
      try {
        const result = await this.assemblyAiService.transcribeAudioWithSpeakers(audioFilePath);
        return {
          text: result.text,
          language: result.language,
          confidence: result.confidence,
          formattedText: result.formattedText,
          speakers: result.speakers,
        };
      } catch (error) {
        console.error('AssemblyAI failed, falling back to OpenAI:', error);
        // Fall back to OpenAI transcription
        const fallbackResult = await this.transcribeAudio(audioFilePath);
        return {
          ...fallbackResult,
          formattedText: fallbackResult.text, // No speaker labels
        };
      }
    } else {
      console.log('AssemblyAI not configured, using OpenAI without speaker diarization');
      const result = await this.transcribeAudio(audioFilePath);
      return {
        ...result,
        formattedText: result.text, // No speaker labels
      };
    }
  }
} 