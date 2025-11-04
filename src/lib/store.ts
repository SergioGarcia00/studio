import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergedRaceData, ShockLog } from '@/ai/types';

interface ResultsState {
  mergedData: MergedRaceData;
  setMergedData: (data: MergedRaceData) => void;
  shockLog: ShockLog;
  setShockLog: (log: ShockLog) => void;
}

export const useResultsStore = create<ResultsState>()(
  persist(
    (set) => ({
      mergedData: {},
      setMergedData: (data) => set({ mergedData: data }),
      shockLog: {},
      setShockLog: (log) => set({ shockLog: log }),
    }),
    {
      name: 'race-results-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
    }
  )
);
