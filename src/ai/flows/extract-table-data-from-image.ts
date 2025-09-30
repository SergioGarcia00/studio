'use server';
/**
 * @fileOverview Extracts table data (player names, teams, and scores) from an image of a scoreboard using OCR.
 *
 * - extractTableDataFromImage - A function that handles the extraction process.
 * - ExtractTableDataFromImageInput - The input type for the extractTableDataFromImage function.
 * - ExtractTableDataFromImageOutput - The return type for the extractTableDataFromImage function.
 */

import {ai} from '@/ai/genkit';
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
    })
  ).describe('The extracted table data containing player names, teams, and scores.'),
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
    const {output} = await prompt(input);

    // Post-process the output to convert scores to numbers and validate entries
    const processedTableData = await Promise.all(
      output!.tableData.map(async (entry) => {
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

    return {
      tableData: processedTableData,
    };
  }
);
