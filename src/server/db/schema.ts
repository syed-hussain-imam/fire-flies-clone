import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const meetings = sqliteTable('meetings', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  audioUrl: text('audio_url'),
  duration: real('duration'), // in seconds
  status: text('status', { enum: ['uploading', 'transcribing', 'transcription_complete', 'completed', 'failed'] })
    .notNull()
    .default('uploading'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const transcriptions = sqliteTable('transcriptions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  confidence: real('confidence'), // 0-1 confidence score from transcription service
  language: text('language'),
  speakers: text('speakers'), // JSON string of speaker segments
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const aiNotes = sqliteTable('ai_notes', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  keyPoints: text('key_points'), // JSON string of key points array
  actionItems: text('action_items'), // JSON string of action items array
  participants: text('participants'), // JSON string of participants array
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
export type Transcription = typeof transcriptions.$inferSelect;
export type NewTranscription = typeof transcriptions.$inferInsert;
export type AiNote = typeof aiNotes.$inferSelect;
export type NewAiNote = typeof aiNotes.$inferInsert; 