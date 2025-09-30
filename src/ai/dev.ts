import { config } from 'dotenv';
config();

import '@/ai/flows/validate-extracted-data.ts';
import '@/ai/flows/extract-table-data-from-image.ts';