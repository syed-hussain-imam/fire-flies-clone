import OpenAI from 'openai';

let openai: OpenAI | null = null;

export interface MeetingInsights {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  participants: string[];
}

export class AIService {
  private initializeOpenAI(): void {
    if (!openai && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      console.log('Initializing OpenAI client for AI service...');
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async generateMeetingInsights(transcription: string): Promise<MeetingInsights> {
    // Initialize OpenAI client if not already done
    this.initializeOpenAI();
    
    // Check if OpenAI is configured
    if (!openai) {
      console.warn('OpenAI API key not configured. Providing fallback insights for local transcription.');
      return this.generateFallbackInsights(transcription);
    }

    try {
      const prompt = `
        Analyze the following meeting transcription and provide:
        1. A concise summary (2-3 sentences)
        2. Key points discussed (bullet points)
        3. Action items with owners if mentioned
        4. Participants mentioned by name

        Transcription:
        ${transcription}

        Please respond in JSON format with the structure:
        {
          "summary": "...",
          "keyPoints": ["...", "..."],
          "actionItems": ["...", "..."],
          "participants": ["...", "..."]
        }
      `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant specialized in analyzing meeting transcriptions and extracting actionable insights. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = completion.choices[0].message.content;
      if (!result) {
        throw new Error('No response from AI service');
      }

      return JSON.parse(result) as MeetingInsights;
    } catch (error) {
      console.error('AI analysis error:', error);
      throw new Error('Failed to generate meeting insights');
    }
  }

  private generateFallbackInsights(transcription: string): MeetingInsights {
    // Simple fallback analysis when OpenAI is not available
    const words = transcription.split(' ');
    const sentences = transcription.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // Extract potential participants (words that appear after "Speaker" or common names)
    const participants = this.extractParticipants(transcription);
    
    // Generate simple key points from sentences
    const keyPoints = sentences.slice(0, 5).map(s => s.trim()).filter(s => s.length > 0);
    
    return {
      summary: `This meeting covered ${words.length} words across ${sentences.length} main discussion points. ${participants.length > 0 ? `Participants included: ${participants.join(', ')}.` : ''} For detailed AI analysis, configure OpenAI API key.`,
      keyPoints: keyPoints.length > 0 ? keyPoints : ['Meeting transcription completed', 'Local processing active'],
      actionItems: ['Configure OpenAI API key for detailed action item extraction'],
      participants: participants
    };
  }

  private extractParticipants(transcription: string): string[] {
    // Extract participants mentioned in the transcription
    const speakerPattern = /Speaker\s+(\d+|[A-Z][a-z]+)/g;
    const participants = new Set<string>();
    
    let match;
    while ((match = speakerPattern.exec(transcription)) !== null) {
      participants.add(match[1]);
    }
    
    return Array.from(participants);
  }
} 