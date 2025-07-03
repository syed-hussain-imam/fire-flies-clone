import { readFileSync } from 'fs';
import fetch from 'node-fetch';
import WebSocket from 'ws';

export interface SpeakerSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface DiarizedTranscriptionResult {
  text: string;
  speakers: SpeakerSegment[];
  language?: string;
  confidence?: number;
  formattedText: string; // Text with speaker labels
}

export class AssemblyAITranscriptionService {
  private apiKey: string;
  private baseUrl = 'https://api.assemblyai.com/v2';

  constructor() {
    this.apiKey = process.env.ASSEMBLYAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('AssemblyAI API key not configured. Set ASSEMBLYAI_API_KEY environment variable.');
    }
  }

  // Helper method to determine number of speakers
  private getSpeakersExpected(): number | undefined {
    // Check environment variable first, then default to auto-detection
    const envSpeakers = process.env.SPEAKERS_EXPECTED;
    if (envSpeakers && !isNaN(parseInt(envSpeakers))) {
      const speakerCount = parseInt(envSpeakers);
      console.log(`Using configured speaker count: ${speakerCount}`);
      return speakerCount;
    }
    
    // Return undefined to let AssemblyAI auto-detect speakers
    // This allows for unlimited speakers (up to AssemblyAI's limits)
    console.log('Using auto-detection for unlimited speakers');
    return undefined;
  }

  async transcribeAudioWithSpeakers(audioFilePath: string): Promise<DiarizedTranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured. Please set ASSEMBLYAI_API_KEY environment variable.');
    }

    try {
      // Step 1: Upload audio file
      const uploadUrl = await this.uploadAudioFile(audioFilePath);
      console.log('Audio file uploaded to AssemblyAI');

      // Step 2: Request transcription with speaker diarization
      const transcriptId = await this.requestTranscription(uploadUrl);
      console.log('Transcription requested with ID:', transcriptId);

      // Step 3: Poll for completion
      const result = await this.pollForCompletion(transcriptId);
      console.log('Transcription completed');

      // Step 4: Process and format results
      return this.processTranscriptionResult(result);
    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      throw new Error('Failed to transcribe audio with speaker diarization');
    }
  }

  private async uploadAudioFile(filePath: string): Promise<string> {
    const audioData = readFileSync(filePath);
    
    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: audioData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json() as { upload_url: string };
    return data.upload_url;
  }

  private async requestTranscription(audioUrl: string): Promise<string> {
    const speakersExpected = this.getSpeakersExpected();
    
    // Build the request payload
    const requestPayload: any = {
      audio_url: audioUrl,
      speaker_labels: true, // Enable speaker diarization
      language_code: 'en', // Can be made configurable
      punctuate: true,
      format_text: true,
      dual_channel: false,
      speech_model: 'nano', // Fast model, can use 'best' for higher accuracy
    };

    // Only include speakers_expected if we have a specific number
    // Otherwise, let AssemblyAI auto-detect for unlimited speakers
    if (speakersExpected !== undefined) {
      requestPayload.speakers_expected = speakersExpected;
    }

    const response = await fetch(`${this.baseUrl}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error(`Transcription request failed: ${response.statusText}`);
    }

    const data = await response.json() as { id: string };
    return data.id;
  }

  private async pollForCompletion(transcriptId: string): Promise<any> {
    const maxAttempts = 120; // 10 minutes max
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${this.baseUrl}/transcript/${transcriptId}`, {
        headers: {
          'Authorization': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get transcription status: ${response.statusText}`);
      }

      const data = await response.json() as { status: string; error?: string };
      
      if (data.status === 'completed') {
        return data;
      } else if (data.status === 'error') {
        throw new Error(`Transcription failed: ${data.error}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Transcription timed out');
  }

  private processTranscriptionResult(result: any): DiarizedTranscriptionResult {
    const speakers: SpeakerSegment[] = [];
    let formattedText = '';

    if (result.utterances && result.utterances.length > 0) {
      // Create a mapping from speaker numbers to letters
      const speakerMapping = new Map<string, string>();
      const speakerLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
      
      // Process utterances (speaker-labeled segments)
      result.utterances.forEach((utterance: any) => {
        // Map numeric speaker to letter
        if (!speakerMapping.has(utterance.speaker)) {
          const speakerIndex = speakerMapping.size;
          const speakerLetter = speakerLetters[speakerIndex] || `Speaker${speakerIndex + 1}`;
          speakerMapping.set(utterance.speaker, speakerLetter);
        }
        
        const speakerLabel = `Speaker ${speakerMapping.get(utterance.speaker)}`;
        const speakerClass = `speaker-${speakerMapping.get(utterance.speaker)?.toLowerCase()}`;
        
        speakers.push({
          speaker: speakerLabel,
          text: utterance.text,
          start: utterance.start,
          end: utterance.end,
          confidence: utterance.confidence,
        });

        // Format text with speaker labels in separate blocks with unique colors
        if (formattedText) {
          formattedText += '\n\n';
        }
        formattedText += `<div class="speaker-block mb-4">
          <div class="speaker-label font-semibold ${speakerClass} mb-2">${speakerLabel}:</div>
          <div class="speaker-text text-white/90 leading-relaxed pl-4">${utterance.text}</div>
        </div>`;
      });
    } else {
      // Fallback to regular transcription if no speaker data
      formattedText = result.text || '';
    }

    return {
      text: result.text || '',
      speakers,
      language: result.language_code,
      confidence: result.confidence,
      formattedText: formattedText.trim(),
    };
  }

  // For real-time transcription (streaming)
  async startRealTimeTranscription(): Promise<WebSocket> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    const ws = new WebSocket('wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000', {
      headers: {
        'Authorization': this.apiKey,
      },
    });

    ws.on('open', () => {
      console.log('Connected to AssemblyAI real-time transcription');
    });

    ws.on('message', (data: any) => {
      const message = JSON.parse(data.toString());
      if (message.message_type === 'FinalTranscript') {
        // Process real-time transcription result
        console.log('Real-time transcription:', message.text);
      }
    });

    return ws;
  }
} 