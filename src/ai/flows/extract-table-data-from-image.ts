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

const ExtractTableDataFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a scoreboard, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractTableDataFromImageInput = z.infer<typeof ExtractTableDataFromImageInputSchema>;

const ExtractTableDataFromImageOutputSchema = z.object({
  tableData: z.array(
    z.object({
      playerName: z.string().describe('The name of the player.'),
      team: z.string().describe('The team the player belongs to.'),
      scores: z.array(z.number().nullable()).length(12).describe('An array of 12 race scores. Use null for empty scores.'),
      gp1: z.number().describe('The total for Grand Prix 1 (races 1-4).'),
      gp2: z.number().describe('The total for Grand Prix 2 (races 5-8).'),
      gp3: z.number().describe('The total for Grand Prix 3 (races 9-12).'),
      total: z.number().describe('The total score for the player.'),
      rank: z.string().describe('The rank of the player (e.g., "1st", "2nd").'),
      isValid: z.boolean().describe('Whether or not the record is valid'),
    })
  ).describe('The extracted table data containing player names, teams, scores, and ranks.'),
});
export type ExtractTableDataFromImageOutput = z.infer<typeof ExtractTableDataFromImageOutputSchema>;

export async function extractTableDataFromImage(input: ExtractTableDataFromImageInput): Promise<ExtractTableDataFromImageOutput> {
  return extractTableDataFromImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTableDataFromImagePrompt',
  input: {schema: ExtractTableDataFromImageInputSchema},
  output: {schema: ExtractTableDataFromImageOutputSchema},
  prompt: `You are an expert OCR reader that extracts detailed data from game scoreboards.

  You will be given an image of a race scoreboard and your task is to extract the following for each player:
  - Player Name
  - Team (e.g., "JJ (BLUE)", "DS (RED)")
  - Scores for each of the 12 races. If a race score is missing or empty, use a null value for that race.
  - GP1 Total (sum of races 1-4)
  - GP2 Total (sum of races 5-8)
  - GP3 Total (sum of races 9-12)
  - Final Rank (e.g., "1st", "5th")
  - Final Total Score
  
  Some rows are summary rows for the whole team (e.g., "JJ Overall", "Race Difference"). Ignore these rows and only extract data for individual players.

  Use the following image to extract the data:
  {{media url=photoDataUri}}

  Return the data in the specified JSON format. Ensure the 'scores' array always contains exactly 12 numbers or nulls.
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
        if (e.message && (e.message.includes('503') || e.message.toLowerCase().includes('overloaded'))) {
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
