'use server';

import {z} from 'genkit';

export const PlayerEntrySchema = z.object({
  name: z.string().describe('The name of the player.'),
  team: z.string().describe('The team the player belongs to.'),
  score: z.string().describe('The score of the player.'),
});

export type PlayerEntry = z.infer<typeof PlayerEntrySchema>;

export const ValidateExtractedDataInputSchema = z.array(PlayerEntrySchema).describe(
  'An array of player entries, each containing the name, team, and score.'
);
export type ValidateExtractedDataInput = z.infer<typeof ValidateExtractedDataInputSchema>;

export const ValidateExtractedDataOutputSchema = z.object({
  valid: z.boolean().describe('Whether the extracted data is valid or not.'),
  reason: z.string().optional().describe('If the data is invalid, the reason why.'),
});
export type ValidateExtractedDataOutput = z.infer<typeof ValidateExtractedDataOutputSchema>;

export const ExtractTableDataFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a scoreboard, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractTableDataFromImageInput = z.infer<typeof ExtractTableDataFromImageInputSchema>;

const PlayerSchema = z.object({
  playerName: z.string().describe('The name of the player.'),
  team: z.string().describe('The team the player belongs to.'),
  scores: z.array(z.number().nullable()).length(12).describe('An array of 12 race scores. Use null for empty scores.'),
  gp1: z.number().describe('The total for Grand Prix 1 (races 1-4).'),
  gp2: z.number().describe('The total for Grand Prix 2 (races 5-8).'),
  gp3: z.number().describe('The total for Grand Prix 3 (races 9-12).'),
  total: z.number().describe('The total score for the player.'),
  rank: z.string().describe('The rank of the player (e.g., "1st", "2nd").'),
  isValid: z.boolean().describe('Whether or not the record is valid'),
});
export type Player = z.infer<typeof PlayerSchema>;


export const ExtractTableDataFromImageOutputSchema = z.object({
  tableData: z.array(PlayerSchema).describe('The extracted table data containing player names, teams, scores, and ranks.'),
});
export type ExtractTableDataFromImageOutput = z.infer<typeof ExtractTableDataFromImageOutputSchema>;

export type ExtractedData = {
  imageUrl: string;
  filename: string;
  data: Player[];
};
