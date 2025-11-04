import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergedRaceData, ShockLog, ExtractedData, RacePicks } from '@/ai/types';

interface ResultsState {
  mergedData: MergedRaceData;
  setMergedData: (data: MergedRaceData) => void;
  shockLog: ShockLog;
  setShockLog: (log: ShockLog) => void;
  extractedData: ExtractedData[];
  setExtractedData: (data: ExtractedData[]) => void;
  racePicks: RacePicks;
  setRacePicks: (picks: RacePicks) => void;
}

export const useResultsStore = create<ResultsState>()(
  persist(
    (set) => ({
      mergedData: {},
      setMergedData: (data) => set({ mergedData: data }),
      shockLog: {},
      setShockLog: (log) => set({ shockLog: log }),
      extractedData: [],
      setExtractedData: (data) => set({ extractedData: data }),
      racePicks: {},
      setRacePicks: (picks) => set({ racePicks: picks }),
    }),
    {
      name: 'race-results-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
    }
  )
);
