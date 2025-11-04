'use server';
/**
 * @fileOverview Extracts player data from an image of a single race scoreboard.
 *
 * - extractRaceDataFromImage - A function that handles the extraction process.
 * - ExtractRaceDataFromImageInput - The input type for the function.
 * - ExtractRaceDataFromImageOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  ExtractRaceDataFromImageInputSchema,
  ExtractRaceDataFromImageOutputSchema,
  RacePlayerResult,
  RacePlayerResultSchema
} from '@/ai/types';
import type { ExtractRaceDataFromImageInput } from '@/ai/types';
import { GenerateResponse } from 'genkit';


export async function extractRaceDataFromImage(input: ExtractRaceDataFromImageInput): Promise<(RacePlayerResult & {isValid: boolean})[]> {
  return extractRaceDataFromImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractRaceDataFromImagePrompt',
  input: {schema: ExtractRaceDataFromImageInputSchema},
  output: {schema: ExtractRaceDataFromImageOutputSchema},
  prompt: `You are an expert OCR reader for game scoreboards.

  You will be given an image showing the results of a single race. Your task is to extract the following for each player:
  - Player Name
  - Team (e.g., "JJ (BLUE)", "DS (RED)")
  - Score for this race (this is the TOTAL score up to this race, not the delta)
  - Rank in this race (e.g., "1st", "5th")
  
  When extracting player names, normalize them to use only standard English alphabet characters and numbers. Remove any special characters, accents, or symbols.

  The rank is the most important field. Prioritize its accuracy.

  This image is for Race Number: {{{raceNumber}}}
  
  {{#if playerNames}}
  A list of player names has been provided. Use these names as a reference to ensure the "playerName" field is accurate, even if the OCR is not perfect. Match the players on the scoreboard to these names:
  {{#each playerNames}}
  - {{{this}}}
  {{/each}}
  {{/if}}

  Some rows are summary rows for the whole team (e.g., "JJ Overall", "Race Difference"). Ignore these rows and only extract data for individual players.

  Use the following image to extract the data:
  {{media url=photoDataUri}}

  Return the data in the specified JSON format. The output should be an array of player objects. I need the total score, not the race score.`,
});

const extractRaceDataFromImageFlow = ai.defineFlow(
  {
    name: 'extractRaceDataFromImageFlow',
    inputSchema: ExtractRaceDataFromImageInputSchema,
    outputSchema: z.array(RacePlayerResultSchema.extend({ isValid: z.boolean() })),
  },
  async input => {
    const maxRetries = 3;
    let attempt = 0;
    let response: GenerateResponse<z.infer<typeof ExtractRaceDataFromImageOutputSchema>> | null = null;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        const result = await prompt(input);
        response = result;
        break; // Success, exit loop
      } catch (e: any) {
        lastError = e;
        if (e.message && (e.message.includes('503') || e.message.toLowerCase().includes('overloaded') || e.message.includes('429'))) {
          attempt++;
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } else {
          // Not a retryable error
          throw e;
        }
      }
    }
    
    if (!response?.output) {
      if (lastError) {
        throw new Error(`The model is overloaded and retries failed. Last error: ${lastError.message}`);
      }
      throw new Error(`Failed to extract data after ${maxRetries} attempts.`);
    }

    // Post-process the output to validate entries.
    const validatedData = response.output.map(entry => ({
      ...entry,
      isValid: !!entry.playerName && entry.playerName.trim() !== '' && !!entry.rank && entry.rank.trim() !== '',
    }));

    return validatedData;
  }
);
