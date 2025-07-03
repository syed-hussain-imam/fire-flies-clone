# AssemblyAI Universal-Streaming Migration

## Overview

This document describes the migration from local Whisper.cpp functionality to AssemblyAI Universal-Streaming for real-time transcription in the fire-flies-clone application.

## Migration Summary

### What Changed

1. **Removed Local Whisper Fallback**: The application now exclusively uses AssemblyAI Universal-Streaming for real-time transcription
2. **Upgraded to Universal-Streaming API**: Migrated from deprecated AssemblyAI Real-Time API to the new Universal-Streaming API
3. **Simplified Architecture**: Eliminated the complex fallback logic between AssemblyAI and local Whisper
4. **Improved Performance**: Universal-Streaming provides 300ms latency with immutable transcripts

### Files Modified

- `src/server/services/assemblyAiStreaming.ts` - Completely rewritten for Universal-Streaming
- `src/server/services/recordingService.ts` - Removed Whisper fallback, simplified to use only AssemblyAI
- `package.json` - Removed `node-whisper` dependency

### Files Removed

- `src/server/services/localWhisper.ts` - Local Whisper service
- `setup-whisper.sh` - Whisper setup script

## Universal-Streaming Features

### Key Improvements

1. **Turn-Based Transcription**: Results are organized by speaking turns
2. **Immutable Transcripts**: Once text is finalized, it won't change
3. **Intelligent Endpointing**: Automatic detection of when a speaker finishes talking
4. **Enhanced Accuracy**: Better performance on names, emails, and technical terms
5. **Transparent Pricing**: $0.15/hour based on session duration

### New API Structure

```typescript
interface StreamingTranscriptionChunk {
  text: string;
  timestamp: number;
  confidence: number;
  speaker?: string;
  isFinal: boolean;
  turnOrder?: number;
  endOfTurn?: boolean;
  isFormatted?: boolean;
}
```

## Configuration

### Required Environment Variables

```bash
# Required for Universal-Streaming
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Optional for speaker detection
SPEAKERS_EXPECTED=auto  # or specific number like "2" for 2 speakers
```

### API Endpoint

- **Old**: `wss://api.assemblyai.com/v2/realtime/ws`
- **New**: `wss://streaming.assemblyai.com/v3/stream`

## Usage

### Basic Streaming

The application automatically handles Universal-Streaming connections when a recording session starts:

```typescript
// Recording service automatically sets up Universal-Streaming
const assemblyAiService = new AssemblyAIStreamingService(sessionId);
await assemblyAiService.startRealTimeTranscription();
```

### Advanced Features

#### Force End of Turn

```typescript
// Force the end of a speaking turn
session.assemblyAiService.forceEndOfTurn();
```

#### Update Configuration

```typescript
// Adjust endpointing parameters during session
session.assemblyAiService.updateConfiguration({
  endOfTurnConfidenceThreshold: 0.8,
  minEndOfTurnSilenceWhenConfident: 200,
  maxTurnSilence: 3000
});
```

## Speaker Diarization

### Automatic Detection

Universal-Streaming automatically detects speakers and maps them to letters (A, B, C, etc.):

```typescript
// Speakers are automatically detected and labeled
// Speaker A: "Hello, how are you?"
// Speaker B: "I'm doing well, thanks!"
```

### Configuration Options

- `SPEAKERS_EXPECTED=auto` - Unlimited speaker detection
- `SPEAKERS_EXPECTED=2` - Optimize for 2 speakers
- `SPEAKERS_EXPECTED=3` - Optimize for 3 speakers

## Error Handling

### Connection Failures

The application now requires AssemblyAI API key and will fail gracefully:

```typescript
if (!process.env.ASSEMBLYAI_API_KEY) {
  // Connection will be rejected with clear error message
  connection.send(JSON.stringify({
    type: 'error',
    message: 'AssemblyAI API key not configured'
  }));
}
```

### Fallback Strategy

- **Previous**: AssemblyAI → Local Whisper fallback
- **Current**: AssemblyAI Universal-Streaming only (more reliable)

## Performance Improvements

### Latency

- **Universal-Streaming**: ~300ms latency
- **Previous Real-Time API**: ~500-1000ms latency

### Accuracy

- **Better proper noun recognition**: Names, companies, technical terms
- **Improved formatting**: Punctuation, capitalization, number formatting
- **Enhanced speaker detection**: More accurate speaker boundaries

## Development Notes

### Testing

1. Ensure `ASSEMBLYAI_API_KEY` is set in your environment
2. Test with different speaker configurations
3. Verify turn-based transcription works correctly

### Docker Deployment

The Docker setup remains the same, but ensure your `.env` file includes:

```bash
ASSEMBLYAI_API_KEY=your_key_here
```

### Monitoring

Monitor the following for optimal performance:

- Connection stability to `streaming.assemblyai.com`
- Turn detection accuracy
- Speaker diarization quality
- Audio chunk processing latency

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check `ASSEMBLYAI_API_KEY` is valid
2. **No Speaker Detection**: Ensure audio quality is good and speakers are distinct
3. **High Latency**: Check network connection to AssemblyAI servers
4. **Partial Transcripts**: Normal behavior - final transcripts come when turn ends

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
// Check connection status
console.log('Streaming status:', assemblyAiService.isStreaming());

// Monitor turn events
assemblyAiService.on('transcription', (chunk) => {
  console.log('Turn:', chunk.turnOrder, 'Final:', chunk.isFinal);
});
```

## Migration Checklist

- [x] Remove local Whisper service
- [x] Update AssemblyAI streaming to Universal-Streaming
- [x] Remove Whisper fallback logic
- [x] Update package.json dependencies
- [x] Remove setup scripts
- [x] Update error handling
- [x] Test speaker diarization
- [x] Verify turn-based transcription

## Resources

- [AssemblyAI Universal-Streaming Documentation](https://www.assemblyai.com/docs/speech-to-text/streaming)
- [Universal-Streaming API Reference](https://www.assemblyai.com/docs/api-reference/streaming)
- [AssemblyAI Pricing](https://www.assemblyai.com/pricing) 