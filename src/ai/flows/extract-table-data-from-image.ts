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
      score: z.number().describe('The score of the player.'),
      isValid: z.boolean().describe('Whether or not the record is valid'),
      rank: z.number().describe('The rank of the player in the race.'),
    })
  ).describe('The extracted table data containing player names, teams, scores, and ranks.'),
});
export type ExtractTableDataFromImageOutput = z.infer<typeof ExtractTableDataFromImageOutputSchema>;

export async function extractTableDataFromImage(input: ExtractTableDataFromImageInput): Promise<ExtractTableDataFromImageOutput> {
  return extractTableDataFromImageFlow(input);
}

const validatePlayerEntry = ai.defineTool({
  name: 'validatePlayerEntry',
  description: 'Checks if a player entry has all the required fields (name, team, and score).',
  inputSchema: z.object({
    playerName: z.string().describe('The name of the player.'),
    team: z.string().describe('The team the player belongs to.'),
    score: z.string().describe('The score of the player.'),
  }),
  outputSchema: z.boolean(),
}, async (input) => {
    // Check if the player entry has all the required fields
    if (input.playerName && input.team && input.score) {
      return true;
    }
    return false;
  });

const prompt = ai.definePrompt({
  name: 'extractTableDataFromImagePrompt',
  input: {schema: ExtractTableDataFromImageInputSchema},
  output: {schema: ExtractTableDataFromImageOutputSchema},
  tools: [validatePlayerEntry],
  prompt: `You are an expert OCR reader that extracts data from tabular data in images.

  You will be given an image of a scoreboard and your task is to extract the player names, their team, and their score.
  You MUST call the validatePlayerEntry tool to validate each player entry.

  Use the following image to extract the data:
  {{media url=photoDataUri}}

  Return the data in JSON format.
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
    let output: GenerateResponse<z.infer<typeof ExtractTableDataFromImageOutputSchema>> | null = null;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        const result = await prompt(input);
        output = result;
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
    
    if (!output?.output) {
      if (lastError) {
        throw new Error(`The model is overloaded and retries failed. Last error: ${lastError.message}`);
      }
      throw new Error(`Failed to extract data after ${maxRetries} attempts.`);
    }

    // Post-process the output to convert scores to numbers, validate entries, and add ranking
    const validatedData = await Promise.all(
        output.output.tableData.map(async (entry) => {
        const isValid = await validatePlayerEntry({
          playerName: entry.playerName,
          team: entry.team,
          score: String(entry.score),
        });
        return {
          ...entry,
          score: Number(entry.score),
          isValid,
        };
      })
    );

    // Sort by score descending to determine rank
    const sortedData = validatedData.sort((a, b) => b.score - a.score);

    const rankedData = sortedData.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return {
      tableData: rankedData,
    };
  }
);
