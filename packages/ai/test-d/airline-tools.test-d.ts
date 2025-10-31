import z from 'zod';
import { generateText } from 'ai';
import { mkTool } from '../src/builder.js';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import 'dotenv/config';

// Shared entries as in examples/airline.ts
const entries = [
  { departure: 'london', arrival: 'New York', date: '2026-10-01', seats: 100 },
  { departure: 'london', arrival: 'NEW_YORK', date: '2026-10-02', seats: 2 },
  { departure: 'Berlin', arrival: 'New York', date: '2026-10-03', seats: 2 },
  { departure: 'Berlin', arrival: 'London', date: '2026-10-04', seats: 2 },
  { departure: 'Paris', arrival: 'Tokyo', date: '2026-10-05', seats: 50 },
  { departure: 'New York', arrival: 'Los Angeles', date: '2026-10-06', seats: 25 },
];

const uniq = <T>(values: T[]): T[] => Array.from(new Set(values));

// This type is used as fully validated input for the tool's execute function
export const airlineBookingSchema = z.object({
  departure: z.string().min(1),
  arrival: z.string().min(1),
  date: z.string().min(1),
  passengers: z.number().min(1),
});
export type AirlineBookingSchema = typeof airlineBookingSchema;
export type AirlineBooking = z.infer<AirlineBookingSchema>;

const tool1 = mkTool<AirlineBookingSchema, AirlineBookingSchema>({
  inputSchema: airlineBookingSchema,
  outputSchema: airlineBookingSchema,
  description: 'Validate and compute options for airline booking parameters.',
  // we are not doing anything here, just returning the input,
  // that's why the type parameters of `mkTool` are `<AirlineBookingSchema, AirlineBookingSchema>`
  execute: async (input: AirlineBooking) => input,
})
  .field('departure', {
    requires: [],
    // @ts-expect-error influencedBy must include existing fields
    influencedBy: ['nonexistent'],
    description: 'City of departure',
    validate: async (value: string | undefined, context: { arrival?: string }) => {
      const filtered = entries.filter(e =>
        context.arrival ? e.arrival === context.arrival : true,
      );
      const allowed = uniq(filtered.map(e => e.departure));
      const normalized = typeof value === 'string' ? value : undefined;
      if (normalized === undefined)
        return {
          allowedValues: allowed,
          valid: false as const,
          refusalReasons: ['value required'],
        };
      if (!allowed.some(v => Object.is(v, normalized)))
        return {
          allowedValues: allowed,
          valid: false as const,
          refusalReasons: ['no matching options'],
        };
      return { allowedValues: allowed, valid: true as const, normalizedValue: normalized };
    },
  })
  .field('arrival', {
    requires: ['departure'],
    influencedBy: ['date'],
    description: 'City of arrival',
    // @ts-expect-error value must be string | undefined
    validate: async (value: null | undefined, context: { departure: string; date?: string }) => {
      const filtered = entries.filter(
        e => e.departure === context.departure && (context.date ? e.date === context.date : true),
      );
      const allowed = uniq(filtered.map(e => e.arrival));
      const normalized = typeof value === 'string' ? value : undefined;
      if (normalized === undefined) return { allowedValues: allowed };
      if (!allowed.some(v => Object.is(v, normalized)))
        return { allowedValues: allowed, valid: false, refusalReasons: ['no matching options'] };
      return { allowedValues: allowed, valid: true, normalizedValue: normalized };
    },
  })
  .field('date', {
    requires: ['departure'],
    influencedBy: ['passengers'],
    description: 'Date of departure',
    // @ts-expect-error arrival is not in required list
    validate: async (
      value: string | undefined,
      context: { departure: string; arrival: string; passengers?: number },
    ) => {
      const filtered = entries.filter(
        e =>
          e.departure === context.departure &&
          e.arrival === context.arrival &&
          (context.passengers ? e.seats >= context.passengers : true),
      );
      const allowed = uniq(filtered.map(e => e.date));
      const normalized = typeof value === 'string' ? value : undefined;
      if (normalized === undefined) return { allowedValues: allowed };
      if (!allowed.some(v => Object.is(v, normalized)))
        return { allowedValues: allowed, valid: false, refusalReasons: ['no matching options'] };
      return { allowedValues: allowed, valid: true, normalizedValue: normalized };
    },
  });

// @ts-expect-error build is not available, missing `passengers` field
const buildCheckedTool1 = tool1.build();

const bookFlight = tool1
  .field('passengers', {
    requires: ['departure', 'arrival', 'date'],
    influencedBy: [],
    description: 'Number of passengers',
    validate: async (
      value: number | undefined,
      context: { departure: string; arrival: string; date: string },
    ) => {
      const filtered = entries.filter(
        e =>
          e.departure === context.departure &&
          e.arrival === context.arrival &&
          e.date === context.date,
      );
      const allowed = uniq(filtered.map(e => e.seats));
      const rawNum = typeof value === 'string' ? Number(value) : value;
      const normalized =
        typeof rawNum === 'number' && Number.isFinite(rawNum) && rawNum > 0 ? rawNum : undefined;
      if (normalized === undefined)
        return {
          allowedValues: allowed,
          valid: false as const,
          refusalReasons: ['value required'],
        };
      const max = Math.max(0, ...allowed.map(o => Number(o)));
      if (normalized > max)
        return { allowedValues: allowed, valid: false, refusalReasons: ['no matching options'] };
      return { allowedValues: allowed, valid: true, normalizedValue: normalized };
    },
  })
  .build();

// text completion with tools using ai sdk:
// this will fail obviously, because we muted critical errors
// just an example.
const _ = generateText({
  model: createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! })('openai/gpt-5'),
  tools: { bookFlight: bookFlight },
  toolChoice: 'auto',
  stopWhen: ({ steps }) => steps.length > 5,
  prompt: `Book a flight from London to New York for 2 passengers on 2026 October 2nd if you can. Do not choose closest options. Only exactly matching is allowed.
   use tools. try calling tools until you get a successful tool response.
   If you get a rejection, pay attention to the response validation and rejection reasons and retry.
   `,
});
