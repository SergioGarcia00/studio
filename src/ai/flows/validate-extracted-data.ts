'use server';

/**
 * @fileOverview A flow to validate extracted player data using an LLM.
 *
 * - validateExtractedData - A function that validates the extracted player data.
 * - ValidateExtractedDataInput - The input type for the validateExtractedData function.
 * - ValidateExtractedDataOutput - The return type for the validateExtractedData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PlayerEntrySchema = z.object({
  name: z.string().describe('The name of the player.'),
  team: z.string().describe('The team the player belongs to.'),
  score: z.string().describe('The score of the player.'),
});

export type PlayerEntry = z.infer<typeof PlayerEntrySchema>;

const ValidateExtractedDataInputSchema = z.array(PlayerEntrySchema).describe(
  'An array of player entries, each containing the name, team, and score.'
);
export type ValidateExtractedDataInput = z.infer<typeof ValidateExtractedDataInputSchema>;

const ValidateExtractedDataOutputSchema = z.object({
  valid: z.boolean().describe('Whether the extracted data is valid or not.'),
  reason: z.string().optional().describe('If the data is invalid, the reason why.'),
});
export type ValidateExtractedDataOutput = z.infer<typeof ValidateExtractedDataOutputSchema>;

export async function validateExtractedData(
  input: ValidateExtractedDataInput
): Promise<ValidateExtractedDataOutput> {
  return validateExtractedDataFlow(input);
}

const validateExtractedDataPrompt = ai.definePrompt({
  name: 'validateExtractedDataPrompt',
  input: {schema: ValidateExtractedDataInputSchema},
  output: {schema: ValidateExtractedDataOutputSchema},
  prompt: `You are a data validation expert. Your task is to validate the extracted player data to ensure that each entry contains the required fields: name, team, and score.\n\nHere is the data:\n\n{{#each this}}\n- Name: {{name}}, Team: {{team}}, Score: {{score}}\n{{/each}}\n\nDetermine if the data is valid. If any entry is missing a required field, the data is invalid. Return a boolean value indicating whether the data is valid or not. If the data is invalid, provide a reason why. Make sure the reason is concise and easy to understand.\n\nReturn a JSON object with the following format:\n{
  "valid": boolean,
  "reason": string (optional)
}`,
});

const validateExtractedDataFlow = ai.defineFlow(
  {
    name: 'validateExtractedDataFlow',
    inputSchema: ValidateExtractedDataInputSchema,
    outputSchema: ValidateExtractedDataOutputSchema,
  },
  async input => {
    if (!input || input.length === 0) {
      return {valid: false, reason: 'No data provided.'};
    }

    const {output} = await validateExtractedDataPrompt(input);
    return output!;
  }
);
