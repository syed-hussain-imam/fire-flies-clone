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
        Analyze the following meeting transcription and extract meaningful insights. Focus on creating professional, actionable analysis suitable for business use.

        Transcription:
        ${transcription}

        Please provide:

        1. **SUMMARY**: Create a concise, professional summary (2-4 sentences) that captures the main purpose, key topics discussed, and overall outcomes of the meeting. Focus on what was accomplished and decided.

        2. **KEY TAKEAWAYS**: Extract 3-6 specific, actionable key points that represent the most important insights, decisions, or information shared. Each point should be clear, standalone, and valuable for someone who wasn't present.

        3. **ACTION ITEMS**: Identify specific tasks, follow-ups, or next steps mentioned in the discussion. Include responsible parties if mentioned, deadlines if specified, and the context for each action.

        4. **PARTICIPANTS**: List any individuals mentioned by name, role, or title in the conversation. Include speakers if identified (e.g., "Speaker A", "Speaker B") and any other people referenced.

        Format your response as valid JSON with this exact structure:
        {
          "summary": "Professional summary focusing on main outcomes and decisions...",
          "keyPoints": [
            "Specific actionable insight or decision from the meeting...",
            "Another key point that provides value to stakeholders...",
            "Important information or conclusion reached..."
          ],
          "actionItems": [
            "Specific task or follow-up with context and owner if mentioned...",
            "Next step or deadline identified in the discussion..."
          ],
          "participants": [
            "Person Name or Role",
            "Speaker A",
            "Another Participant"
          ]
        }

        Ensure all content is professional, accurate to the transcription, and provides real business value.
      `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert meeting analyst specialized in extracting high-quality, actionable business insights from transcriptions. You excel at identifying key decisions, important information, and meaningful takeaways that provide real value to stakeholders. Your analysis should be professional, accurate, and focused on outcomes that matter for business operations. Always respond with valid JSON in the exact format requested.',
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