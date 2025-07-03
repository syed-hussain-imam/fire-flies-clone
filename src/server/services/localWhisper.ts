import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
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
  private audioChunks: Buffer[] = [];
  private lastProcessedChunk: number = -1;
  private processedTranscript: string = '';
  private isProcessing: boolean = false;

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
      console.log(`Receiving audio chunk: ${filename}, size: ${audioBuffer.length} bytes`);
      
      // Validate audio buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        console.warn(`Skipping empty audio chunk: ${filename}`);
        return;
      }
      
      // Skip very small audio chunks (likely incomplete)
      if (audioBuffer.length < 1000) {
        console.warn(`Skipping very small audio chunk: ${filename} (${audioBuffer.length} bytes)`);
        return;
      }
      
      // Add chunk to our accumulated chunks
      this.audioChunks.push(audioBuffer);
      
      // Extract chunk number from filename (e.g., "session_123_chunk_5" -> 5)
      const chunkMatch = filename.match(/_chunk_(\d+)/);
      const chunkNumber = chunkMatch ? parseInt(chunkMatch[1]) : 0;
      
      console.log(`Added chunk ${chunkNumber} to accumulator. Total chunks: ${this.audioChunks.length}`);
      
      // Process accumulated chunks for better real-time response
      // Process first chunk immediately, then every 3 chunks, or every 6 seconds
      const shouldProcess = chunkNumber === 0 || 
                           (chunkNumber > 0 && chunkNumber % 3 === 0) ||
                           (this.audioChunks.length >= 4);
      
      if (shouldProcess && !this.isProcessing) {
        await this.processAccumulatedChunks(filename);
      }
      
    } catch (error) {
      console.error(`Error processing audio chunk ${filename}:`, error);
      this.emit('error', error);
    }
  }

  private async processAccumulatedChunks(filename: string): Promise<void> {
    try {
      if (this.audioChunks.length === 0 || this.isProcessing) {
        console.log('No chunks to process or already processing');
        return;
      }

      this.isProcessing = true;
      console.log(`Processing ${this.audioChunks.length} accumulated chunks`);
      
      // Combine all chunks into a single WebM file
      const combinedBuffer = Buffer.concat(this.audioChunks);
      const sessionId = filename.split('_chunk_')[0];
      const combinedFilename = `${sessionId}_combined_${Date.now()}`;
      
      console.log(`Combined ${this.audioChunks.length} chunks into ${combinedBuffer.length} bytes`);
      
      // Save combined audio chunk to temp file
      const tempAudioPath = join(this.tempDir, `${combinedFilename}.wav`);
      
      // Convert combined audio to 16kHz WAV format using FFmpeg
      try {
        await this.convertToWav(combinedBuffer, tempAudioPath);
      } catch (conversionError) {
        console.error(`FFmpeg conversion failed for combined chunks:`, conversionError);
        // Reset chunks and continue - this combined buffer is corrupted
        this.audioChunks = [];
        throw conversionError;
      }
      
      // Process with Whisper and get full transcript
      const fullTranscript = await this.transcribeFileSync(tempAudioPath, combinedFilename);
      
      // Always send the complete transcript for reliable display
      if (fullTranscript && fullTranscript.trim()) {
        // Only emit if the transcript has actually changed
        if (fullTranscript !== this.processedTranscript) {
          console.log(`Complete transcription text: "${fullTranscript}"`);
          
          // Update our processed transcript
          this.processedTranscript = fullTranscript;
          
          // Emit the complete transcript
          const chunk: TranscriptionChunk = {
            text: fullTranscript,
            timestamp: Date.now(),
            confidence: 0.8
          };
          
          console.log(`Emitting complete transcription: ${JSON.stringify(chunk)}`);
          this.emit('transcription', chunk);
        } else {
          console.log(`No changes in transcript: "${fullTranscript}"`);
        }
      }
      
      // Clean up the WAV file after processing
      try {
        if (existsSync(tempAudioPath)) {
          unlinkSync(tempAudioPath);
        }
      } catch (cleanupErr) {
        console.warn(`Failed to clean up WAV file ${tempAudioPath}:`, cleanupErr);
      }
      
      // Option 1: Remove reset to avoid WebM corruption
      // Let chunks accumulate naturally - accept memory growth for stability
      // if (this.audioChunks.length > 8) {
      //   this.audioChunks = [];
      //   console.log('Reset audio chunks to prevent memory issues');
      // }
      
    } catch (error) {
      console.error(`Error processing accumulated chunks:`, error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async convertToWav(audioBuffer: Buffer, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!ffmpeg) {
        reject(new Error('FFmpeg not available'));
        return;
      }

      // Validate audio buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        reject(new Error('Invalid or empty audio buffer'));
        return;
      }

      const tempInputPath = outputPath + '.tmp';
      
      try {
        // Write buffer to temp file
        writeFileSync(tempInputPath, audioBuffer);
        
        // Verify the file was written correctly
        if (!existsSync(tempInputPath)) {
          reject(new Error('Failed to write temp audio file'));
          return;
        }
        
        console.log(`Converting audio: ${tempInputPath} -> ${outputPath} (${audioBuffer.length} bytes)`);

        // Use robust FFmpeg options for WebM input
        const ffmpegProcess = spawn(ffmpeg, [
          '-i', tempInputPath,
          '-ar', '16000',
          '-ac', '1',
          '-c:a', 'pcm_s16le',
          '-f', 'wav',
          '-y',
          outputPath,
          '-hide_banner',
          '-loglevel', 'warning'
        ]);

        let errorOutput = '';

        ffmpegProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        ffmpegProcess.on('close', (code) => {
          // Clean up temp input file
          try {
            if (existsSync(tempInputPath)) {
              unlinkSync(tempInputPath);
            }
          } catch (err) {
            console.warn('Failed to clean up temp file:', err);
          }

          if (code === 0) {
            // Verify output file was created
            if (existsSync(outputPath)) {
              console.log(`Audio conversion successful: ${outputPath}`);
              resolve();
            } else {
              reject(new Error('FFmpeg completed but output file not found'));
            }
          } else {
            console.error(`FFmpeg failed with code ${code}:`, errorOutput);
            reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput}`));
          }
        });

        ffmpegProcess.on('error', (err) => {
          console.error('FFmpeg process error:', err);
          // Clean up temp file on error
          try {
            if (existsSync(tempInputPath)) {
              unlinkSync(tempInputPath);
            }
          } catch (cleanupErr) {
            console.warn('Failed to clean up temp file on error:', cleanupErr);
          }
          reject(err);
        });

      } catch (err) {
        console.error('Error writing temp audio file:', err);
        reject(err);
      }
    });
  }

  private async transcribeFile(audioPath: string, chunkId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const whisperPath = this.getWhisperPath();
      
      console.log(`Starting transcription for ${chunkId} using ${whisperPath}`);
      
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
        console.log(`Whisper process finished for ${chunkId} with code ${code}`);
        
        if (code === 0) {
          const text = this.extractTextFromOutput(output);
          console.log(`Extracted text from ${chunkId}:`, text ? `"${text}"` : '[empty]');
          
          if (text.trim()) {
            const chunk: TranscriptionChunk = {
              text: text.trim(),
              timestamp: Date.now(),
              confidence: 0.8 // Estimated confidence
            };
            console.log(`Emitting transcription for ${chunkId}:`, chunk);
            this.emit('transcription', chunk);
          } else {
            console.log(`No text extracted from ${chunkId}, skipping emission`);
          }
          resolve();
        } else {
          console.error(`Whisper error for ${chunkId}:`, errorOutput);
          reject(new Error(`Whisper failed with code ${code}: ${errorOutput}`));
        }
      });

      whisperProcess.on('error', (err) => {
        console.error(`Whisper process error for ${chunkId}:`, err);
        reject(err);
      });
    });
  }

  private async transcribeFileSync(audioPath: string, chunkId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const whisperPath = this.getWhisperPath();
      
      console.log(`Starting sync transcription for ${chunkId} using ${whisperPath}`);
      
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
        console.log(`Sync whisper process finished for ${chunkId} with code ${code}`);
        
        if (code === 0) {
          const text = this.extractTextFromOutput(output);
          console.log(`Sync extracted text from ${chunkId}:`, text ? `"${text}"` : '[empty]');
          resolve(text || '');
        } else {
          console.error(`Sync whisper error for ${chunkId}:`, errorOutput);
          reject(new Error(`Whisper failed with code ${code}: ${errorOutput}`));
        }
      });

      whisperProcess.on('error', (err) => {
        console.error(`Sync whisper process error for ${chunkId}:`, err);
        reject(err);
      });
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
    
    // Reset state for new session
    this.resetTranscriptionState();
    
    const isSetup = await this.setupWhisper();
    if (!isSetup) {
      throw new Error('Failed to setup Whisper service');
    }
    console.log('Real-time transcription service ready');
  }

  private resetTranscriptionState(): void {
    this.audioChunks = [];
    this.lastProcessedChunk = -1;
    this.processedTranscript = '';
    this.isProcessing = false;
    console.log('Reset transcription state for new session');
  }

  stopRealTimeTranscription(): void {
    if (this.whisperProcess) {
      this.whisperProcess.kill();
      this.whisperProcess = null;
    }
    console.log('Real-time transcription service stopped');
  }
} 