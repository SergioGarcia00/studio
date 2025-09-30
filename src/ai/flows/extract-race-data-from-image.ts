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
  ExtractRaceDataFromImageOutputSchema
} from '@/ai/types';
import type { ExtractRaceDataFromImageInput, ExtractRaceDataFromImageOutput } from '@/ai/types';


export async function extractRaceDataFromImage(input: ExtractRaceDataFromImageInput): Promise<ExtractRaceDataFromImageOutput> {
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
  - Score for this race
  - Rank in this race (e.g., "1st", "5th")
  - An array of numbers representing the races where a lightning bolt (shock) icon is visible for that player. For example, if a player has a shock in Race 3, include 3 in the 'shockedRaces' array.

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

  Return the data in the specified JSON format. The output should be an array of player objects.`,
});

const extractRaceDataFromImageFlow = ai.defineFlow(
  {
    name: 'extractRaceDataFromImageFlow',
    inputSchema: ExtractRaceDataFromImageInputSchema,
    outputSchema: ExtractRaceDataFromImageOutputSchema,
  },
  async input => {
    const result = await prompt(input);
    const { output } = result;

    if (!output) {
      throw new Error('Failed to extract data from image.');
    }
    
    // Post-process the output to validate entries.
    const validatedData = output.map(entry => ({
      ...entry,
      isValid: !!entry.playerName && entry.playerName.trim() !== '',
    }));

    return validatedData;
  }
);
