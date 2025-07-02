import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MeetingInsights {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  participants: string[];
}

export class AIService {
  async generateMeetingInsights(transcription: string): Promise<MeetingInsights> {
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
} 