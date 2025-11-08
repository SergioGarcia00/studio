'use server';
/**
 * @fileOverview Extracts table data (player names, teams, and scores) from an image of a scoreboard using OCR.
 *
 * - extractTableDataFromImage - A function that handles the extraction process.
 * - ExtractTableDataFromImageInput - The input type for the extractTableDataFromImage function.
 * - ExtractTableDataFromImageOutput - The return type for the extractTableDataFromImage function.
 */

import {ai} from '@/ai/genkit';
import {GenerateResponse} from 'genkit';
import {z} from 'genkit';
import type { ExtractTableDataFromImageInput, ExtractTableDataFromImageOutput, RawPlayer } from '@/ai/types';
import { ExtractTableDataFromImageInputSchema, ExtractTableDataFromImageOutputSchema } from '@/ai/types';


export async function extractTableDataFromImage(input: ExtractTableDataFromImageInput): Promise<ExtractTableDataFromImageOutput> {
  return extractTableDataFromImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTableDataFromImagePrompt',
  input: {schema: ExtractTableDataFromImageInputSchema},
  output: {schema: ExtractTableDataFromImageOutputSchema},
  prompt: `You are an expert OCR reader that extracts detailed data from game scoreboards.

  You will be given an image of a race scoreboard. The image might show a full summary of 12 races, or it might show a partial summary after 4, 8, or 12 races.
  
  Your task is to extract the following for each player:
  - Player Name
  - Team (e.g., "JJ (BLUE)", "DS (RED)")
  - GP1 Total (sum of races 1-4). If not present, use null.
  - GP2 Total (sum of races 5-8). If not present, use null.
  - GP3 Total (sum of races 9-12). If not present, use null.
  - Final Rank (e.g., "1st", "5th")
  - Final Total Score
  - An array of numbers representing the races where a lightning bolt (shock) icon is visible for that player. For example, if a player has a shock in Race 3, include 3 in the 'shockedRaces' array.
  
  When extracting player names, normalize them to use only standard English alphabet characters and numbers. Do not include team tags like 'JJ' or 'DS' in the player name itself. For example, 'JJ Tario' should be extracted as 'Tario'.
  
  {{#if playerNames}}
  A list of player names has been provided. Use these names as a reference to ensure the "playerName" field is accurate, even if the OCR is not perfect. Match the players on the scoreboard to these names:
  {{#each playerNames}}
  - {{{this}}}
  {{/each}}
  {{/if}}

  Some rows are summary rows for the whole team (e.g., "JJ Overall", "Race Difference"). Ignore these rows and only extract data for individual players. Do not include them in the output.

  Use the following image to extract the data:
  {{media url=photoDataUri}}

  Return the data in the specified JSON format.
  `,
});

const extractTableDataFromImageFlow = ai.defineFlow(
  {
    name: 'extractTableDataFromImageFlow',
    inputSchema: ExtractTableDataFromImageInputSchema,
    outputSchema: ExtractTableDataFromImageOutputSchema,
  },
  async input => {
    const maxRetries = 3;
    let attempt = 0;
    let response: GenerateResponse<z.infer<typeof ExtractTableDataFromImageOutputSchema>> | null = null;
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
    const validatedData = response.output.tableData.map(entry => {
        // A simple validation: a valid entry must have a player name.
        const isValid = !!entry.playerName && entry.playerName.trim() !== '';
        return {
          ...entry,
          isValid,
        };
      });

    return {
      tableData: validatedData,
    };
  }
);
