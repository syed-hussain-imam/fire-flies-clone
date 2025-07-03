import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import ffmpeg from 'ffmpeg-static';

export interface TranscriptionChunk {
  text: string;
  timestamp: number;
  confidence?: number;
}

export class LocalWhisperService extends EventEmitter {
  private whisperProcess: ChildProcess | null = null;
  private modelPath: string;
  private tempDir: string;

  constructor() {
    super();
    this.tempDir = join(process.cwd(), 'temp');
    this.modelPath = join(process.cwd(), 'models', 'ggml-base.en.bin');
    
    // Ensure temp directory exists
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async setupWhisper(): Promise<boolean> {
    try {
      // Check if whisper.cpp is available
      const whisperPath = this.getWhisperPath();
      if (!existsSync(whisperPath)) {
        console.log('Whisper.cpp not found. Please install it first.');
        return false;
      }

      // Check if model exists
      if (!existsSync(this.modelPath)) {
        console.log('Whisper model not found. Downloading base English model...');
        await this.downloadModel();
      }

      return true;
    } catch (error) {
      console.error('Failed to setup whisper:', error);
      return false;
    }
  }

  private getWhisperPath(): string {
    // Try common installation paths
    const possiblePaths = [
      join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'whisper-cli'),
      join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'main'),
      '/usr/local/bin/whisper',
      '/opt/homebrew/bin/whisper',
      'whisper' // Assume it's in PATH
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'whisper-cli'); // Fallback to built version
  }

  private async downloadModel(): Promise<void> {
    const modelDir = join(process.cwd(), 'models');
    if (!existsSync(modelDir)) {
      mkdirSync(modelDir, { recursive: true });
    }

    // Download base English model (smaller and faster for real-time)
    const modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';
    
    console.log('Downloading Whisper model...');
    const response = await fetch(modelUrl);
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(this.modelPath, buffer);
    console.log('Whisper model downloaded successfully');
  }

  async processAudioChunk(audioBuffer: Buffer, filename: string): Promise<void> {
    try {
      // Save audio chunk to temp file
      const tempAudioPath = join(this.tempDir, `${filename}.wav`);
      
      // Convert audio to 16kHz WAV format using FFmpeg
      await this.convertToWav(audioBuffer, tempAudioPath);
      
      // Process with Whisper
      await this.transcribeFile(tempAudioPath, filename);
      
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      this.emit('error', error);
    }
  }

  private async convertToWav(audioBuffer: Buffer, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!ffmpeg) {
        reject(new Error('FFmpeg not available'));
        return;
      }

      const tempInputPath = outputPath + '.tmp';
      writeFileSync(tempInputPath, audioBuffer);

      const ffmpegProcess = spawn(ffmpeg, [
        '-i', tempInputPath,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-y',
        outputPath
      ]);

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });

      ffmpegProcess.on('error', reject);
    });
  }

  private async transcribeFile(audioPath: string, chunkId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const whisperPath = this.getWhisperPath();
      
      const whisperProcess = spawn(whisperPath, [
        '-m', this.modelPath,
        '-f', audioPath,
        '--output-txt',
        '--no-timestamps',
        '--language', 'en',
        '--threads', '4'
      ]);

      let output = '';
      let errorOutput = '';

      whisperProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      whisperProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      whisperProcess.on('close', (code) => {
        if (code === 0) {
          const text = this.extractTextFromOutput(output);
          if (text.trim()) {
            const chunk: TranscriptionChunk = {
              text: text.trim(),
              timestamp: Date.now(),
              confidence: 0.8 // Estimated confidence
            };
            this.emit('transcription', chunk);
          }
          resolve();
        } else {
          console.error('Whisper error:', errorOutput);
          reject(new Error(`Whisper failed with code ${code}: ${errorOutput}`));
        }
      });

      whisperProcess.on('error', reject);
    });
  }

  private extractTextFromOutput(output: string): string {
    // Extract text from whisper output
    // Whisper.cpp outputs the transcription directly
    const lines = output.split('\n');
    return lines
      .filter(line => line.trim() && !line.includes('['))
      .join(' ')
      .trim();
  }

  async startRealTimeTranscription(): Promise<void> {
    console.log('Starting real-time transcription service...');
    const isSetup = await this.setupWhisper();
    if (!isSetup) {
      throw new Error('Failed to setup Whisper service');
    }
    console.log('Real-time transcription service ready');
  }

  stopRealTimeTranscription(): void {
    if (this.whisperProcess) {
      this.whisperProcess.kill();
      this.whisperProcess = null;
    }
    console.log('Real-time transcription service stopped');
  }
} 