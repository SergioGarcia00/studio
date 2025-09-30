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
  playerNames: z.array(z.string()).optional().describe('An optional list of player names to help guide the OCR process.'),
});
export type ExtractTableDataFromImageInput = z.infer<typeof ExtractTableDataFromImageInputSchema>;

// Raw data from AI (old gp-based schema)
export const RawPlayerSchema = z.object({
  playerName: z.string().describe('The name of the player.'),
  team: z.string().describe('The team the player belongs to.'),
  gp1: z.number().nullable().describe('The total for Grand Prix 1 (races 1-4). Null if not available.'),
  gp2: z.number().nullable().describe('The total for Grand Prix 2 (races 5-8). Null if not available.'),
  gp3: z.number().nullable().describe('The total for Grand Prix 3 (races 9-12). Null if not available.'),
  total: z.number().describe('The total score for the player.'),
  rank: z.string().describe('The rank of the player (e.g., "1st", "2nd").'),
  shockedRaces: z.array(z.number()).optional().describe('An array of race numbers where a shock icon was detected for this player.'),
});
export type RawPlayer = z.infer<typeof RawPlayerSchema>;

export const ExtractTableDataFromImageOutputSchema = z.object({
  tableData: z.array(RawPlayerSchema).describe('The extracted table data containing player names, teams, scores, and ranks.'),
});
export type ExtractTableDataFromImageOutput = z.infer<typeof ExtractTableDataFromImageOutputSchema>;


// New schema for single race extraction
export const ExtractRaceDataFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a scoreboard, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  raceNumber: z.number().describe('The number of the race being processed.'),
  playerNames: z.array(z.string()).optional().describe('An optional list of player names to help guide the OCR process.'),
});
export type ExtractRaceDataFromImageInput = z.infer<typeof ExtractRaceDataFromImageInputSchema>;

export const RacePlayerResultSchema = z.object({
  playerName: z.string().describe('The name of the player.'),
  team: z.string().describe('The team the player belongs to.'),
  score: z.number().describe('The score for this specific race.'),
  rank: z.string().describe('The rank in this specific race (e.g., "1st").'),
});
export type RacePlayerResult = z.infer<typeof RacePlayerResultSchema>;

export const ValidatedRacePlayerResultSchema = RacePlayerResultSchema.extend({
  shocked: z.boolean().optional(),
  isValid: z.boolean(),
  raceScore: z.number().optional(),
});
export type ValidatedRacePlayerResult = z.infer<typeof ValidatedRacePlayerResultSchema>;


export const ExtractRaceDataFromImageOutputSchema = z.array(RacePlayerResultSchema);


// Processed data for client, includes validity check
export const ProcessedPlayerSchema = RawPlayerSchema.extend({
    isValid: z.boolean().describe('Whether or not the record is valid'),
});
export type ProcessedPlayer = z.infer<typeof ProcessedPlayerSchema>;


// Final merged data for display
export const PlayerSchema = z.object({
  playerName: z.string(),
  team: z.string(),
  ranks: z.array(z.string().nullable()).length(12),
  shocks: z.array(z.number()), // Array of race numbers with shocks
  gp1: z.number().nullable(),
  gp2: z.number().nullable(),
  gp3: z.number().nullable(),
  total: z.number().nullable(),
  rank: z.string().nullable(),
  isValid: z.boolean(),
});
export type Player = z.infer<typeof PlayerSchema>;


export type ExtractedData = {
  imageUrl: string;
  filename: string;
  raceNumber: number;
  data: ValidatedRacePlayerResult[];
};

export type MergedPlayer = Player;

export type MergedRaceData = {
  [playerName: string]: MergedPlayer;
}
