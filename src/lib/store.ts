import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergedRaceData, ShockLog, ExtractedData, RacePicks } from '@/ai/types';

interface ResultsState {
  mergedData: MergedRaceData;
  setMergedData: (data: MergedRaceData) => void;
  shockLog: ShockLog;
  setShockLog: (log: ShockLog | ((current: ShockLog) => ShockLog)) => void;
  handleToggleShock: (raceNumber: number, playerName: string) => void;
  extractedData: ExtractedData[];
  setExtractedData: (data: ExtractedData[]) => void;
  racePicks: RacePicks;
  setRacePicks: (picks: RacePicks | ((current: RacePicks) => RacePicks)) => void;
}

export const useResultsStore = create<ResultsState>()(
  persist(
    (set) => ({
      mergedData: {},
      setMergedData: (data) => set({ mergedData: data }),
      shockLog: {},
      setShockLog: (log) => set(state => ({ shockLog: typeof log === 'function' ? log(state.shockLog) : log })),
      handleToggleShock: (raceNumber, playerName) => set(state => {
        const newLog = { ...state.shockLog };
        if (newLog[raceNumber] === playerName || playerName === 'none') {
          delete newLog[raceNumber];
        } else {
          newLog[raceNumber] = playerName;
        }
        return { shockLog: newLog };
      }),
      extractedData: [],
      setExtractedData: (data) => set({ extractedData: data }),
      racePicks: {},
      setRacePicks: (picks) => set(state => ({ racePicks: typeof picks === 'function' ? picks(state.racePicks) : picks })),
    }),
    {
      name: 'race-results-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);
