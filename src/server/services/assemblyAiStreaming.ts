import WebSocket from 'ws';
import { EventEmitter } from 'events';
import fetch from 'node-fetch';

export interface StreamingTranscriptionChunk {
  text: string;
  timestamp: number;
  confidence: number;
  speaker?: string;
  isFinal: boolean;
  turnOrder?: number;
  endOfTurn?: boolean;
  isFormatted?: boolean;
}

export class AssemblyAIStreamingService extends EventEmitter {
  private apiKey: string;
  private websocket: WebSocket | null = null;
  private isConnected: boolean = false;
  private sessionId: string;
  private sampleRate: number = 16000;
  private encoding: string = 'pcm_s16le';
  private formatTurns: boolean = true;
  private speakerMapping: Map<string, string> = new Map();
  private speakerLetters: string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
  private currentTurnText: string = '';
  private sessionStarted: boolean = false;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
    this.apiKey = process.env.ASSEMBLYAI_API_KEY || '';
    if (!this.apiKey) {
      console.error('AssemblyAI API key not configured for session:', this.sessionId);
    }
  }

  private async getTemporaryToken(): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured.');
    }

    try {
      const response = await fetch('https://streaming.assemblyai.com/v3/token', {
        method: 'GET',
        headers: {
          'Authorization': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to get temporary token: ${response.statusText} - ${errorData}`);
      }
      
      const data = await response.json() as { token: string };
      return data.token;

    } catch (error) {
        console.error('Error fetching AssemblyAI temporary token:', error);
        throw error;
    }
  }

  async startRealTimeTranscription(): Promise<boolean> {
    if (!this.apiKey) {
      console.error(`Cannot start AssemblyAI transcription for session ${this.sessionId}: API key not set.`);
      return false;
    }

    try {
      return new Promise(async (resolve, reject) => {
        const token = await this.getTemporaryToken();

        const connectionUrl = `wss://streaming.assemblyai.com/v3/ws` +
          `?token=${token}` +
          `&sample_rate=${this.sampleRate}` +
          `&encoding=${this.encoding}`;

        this.websocket = new WebSocket(connectionUrl);

        this.websocket.on('open', () => {
          console.log(`AssemblyAI Universal-Streaming connected for session: ${this.sessionId}`);
          this.isConnected = true;
          this.emit('connected');
          resolve(true);
        });

        this.websocket.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleStreamingMessage(message);
          } catch (error) {
            console.error('Error parsing AssemblyAI streaming message:', error);
          }
        });

        this.websocket.on('error', (error) => {
          console.error(`AssemblyAI Universal-Streaming error for session ${this.sessionId}:`, error);
          this.isConnected = false;
          this.emit('error', error);
          reject(error);
        });

        this.websocket.on('close', (code, reason) => {
          console.log(`AssemblyAI Universal-Streaming closed for session ${this.sessionId}:`, code, reason.toString());
          this.isConnected = false;
          this.emit('disconnected');
        });

        // Set a timeout for connection
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('AssemblyAI Universal-Streaming connection timeout'));
          }
        }, 10000); // 10 second timeout
      });
    } catch (error) {
      console.error(`Failed to start AssemblyAI Universal-Streaming for session ${this.sessionId}:`, error);
      return false;
    }
  }

  private handleStreamingMessage(message: any): void {
    switch (message.type) {
      case 'Begin':
        console.log(`AssemblyAI Universal-Streaming session began for ${this.sessionId}:`, message.id);
        this.sessionStarted = true;
        break;

      case 'Turn':
        this.handleTurnMessage(message);
        break;

      case 'Termination':
        console.log(`AssemblyAI Universal-Streaming session terminated for ${this.sessionId}`);
        this.isConnected = false;
        this.emit('disconnected');
        break;

      default:
        console.log(`Unknown AssemblyAI Universal-Streaming message type for ${this.sessionId}:`, message.type);
    }
  }

  private handleTurnMessage(message: any): void {
    if (!message.transcript || !message.transcript.trim()) {
      return;
    }

    // Handle speaker detection from words if available
    let speakerLabel: string | undefined;
    if (message.words && message.words.length > 0) {
      // Check if any word has speaker information
      const wordsWithSpeaker = message.words.filter((word: any) => word.speaker);
      if (wordsWithSpeaker.length > 0) {
        // Use the most common speaker in this turn
        const speakerCounts = new Map<string, number>();
        wordsWithSpeaker.forEach((word: any) => {
          const count = speakerCounts.get(word.speaker) || 0;
          speakerCounts.set(word.speaker, count + 1);
        });
        
        const mostCommonSpeaker = Array.from(speakerCounts.entries())
          .sort(([,a], [,b]) => b - a)[0][0];
        
        speakerLabel = `Speaker ${this.mapSpeakerToLetter(mostCommonSpeaker)}`;
      }
    }

    // Create transcription chunk
    const chunk: StreamingTranscriptionChunk = {
      text: message.transcript,
      timestamp: Date.now(),
      confidence: this.calculateAverageConfidence(message.words || []),
      speaker: speakerLabel,
      isFinal: message.end_of_turn || false,
      turnOrder: message.turn_order,
      endOfTurn: message.end_of_turn || false,
      isFormatted: message.turn_is_formatted || false,
    };

    // Update current turn text for partial transcripts
    if (!chunk.isFinal) {
      this.currentTurnText = message.transcript;
    } else {
      this.currentTurnText = '';
    }

    console.log(`Universal-Streaming transcription for ${this.sessionId}:`, 
      chunk.text, 
      chunk.speaker ? `(${chunk.speaker})` : '',
      chunk.isFinal ? '(FINAL)' : '(PARTIAL)',
      chunk.isFormatted ? '(FORMATTED)' : '(UNFORMATTED)'
    );

    this.emit('transcription', chunk);
  }

  private calculateAverageConfidence(words: any[]): number {
    if (!words || words.length === 0) return 0.8;
    
    const confidences = words
      .map(word => word.confidence)
      .filter(conf => typeof conf === 'number');
    
    if (confidences.length === 0) return 0.8;
    
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  // Helper method to map numeric speaker to letter
  private mapSpeakerToLetter(numericSpeaker: string): string {
    if (!this.speakerMapping.has(numericSpeaker)) {
      const speakerIndex = this.speakerMapping.size;
      const speakerLetter = this.speakerLetters[speakerIndex] || `Speaker${speakerIndex + 1}`;
      this.speakerMapping.set(numericSpeaker, speakerLetter);
    }
    return this.speakerMapping.get(numericSpeaker)!;
  }

  sendAudioChunk(audioBuffer: Buffer): void {
    if (!this.websocket || !this.isConnected || !this.sessionStarted) {
      console.warn(`AssemblyAI Universal-Streaming not ready for session ${this.sessionId}, cannot send audio`);
      return;
    }

    try {
      // Per documentation, send the raw buffer as bytes
      this.websocket.send(audioBuffer);
    } catch (error) {
      console.error(`Error sending audio chunk to AssemblyAI Universal-Streaming for session ${this.sessionId}:`, error);
      this.emit('error', error);
    }
  }

  stopRealTimeTranscription(): void {
    if (this.websocket) {
      console.log(`Stopping AssemblyAI Universal-Streaming for session: ${this.sessionId}`);
      
      // Send terminate message
      try {
        this.websocket.send(JSON.stringify({ type: 'Terminate' }));
      } catch (error) {
        console.warn(`Error sending terminate message for session ${this.sessionId}:`, error);
      }
      
      // Close connection
      this.websocket.close();
      this.websocket = null;
      this.isConnected = false;
      this.sessionStarted = false;
    }
  }

  isStreaming(): boolean {
    return this.isConnected && this.websocket !== null && this.sessionStarted;
  }

  // Force end of turn (useful for conversation management)
  forceEndOfTurn(): void {
    if (!this.websocket || !this.isConnected) {
      return;
    }

    try {
      this.websocket.send(JSON.stringify({ type: 'ForceEndpoint' }));
    } catch (error) {
      console.error(`Error forcing end of turn for session ${this.sessionId}:`, error);
    }
  }

  // Update streaming parameters during session
  updateConfiguration(config: {
    endOfTurnConfidenceThreshold?: number;
    minEndOfTurnSilenceWhenConfident?: number;
    maxTurnSilence?: number;
  }): void {
    if (!this.websocket || !this.isConnected) {
      return;
    }

    try {
      const updateMessage: any = {
        type: 'UpdateConfiguration'
      };

      if (config.endOfTurnConfidenceThreshold !== undefined) {
        updateMessage.end_of_turn_confidence_threshold = config.endOfTurnConfidenceThreshold;
      }
      if (config.minEndOfTurnSilenceWhenConfident !== undefined) {
        updateMessage.min_end_of_turn_silence_when_confident = config.minEndOfTurnSilenceWhenConfident;
      }
      if (config.maxTurnSilence !== undefined) {
        updateMessage.max_turn_silence = config.maxTurnSilence;
      }

      this.websocket.send(JSON.stringify(updateMessage));
    } catch (error) {
      console.error(`Error updating configuration for session ${this.sessionId}:`, error);
    }
  }
} 