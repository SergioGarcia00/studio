import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergedRaceData, ShockLog, ExtractedData, RacePicks } from '@/ai/types';

interface TeamConfig {
  name: string;
  color: string;
}
interface Teams {
  blue: TeamConfig;
  red: TeamConfig;
}

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
  leagueTitle: string;
  setLeagueTitle: (title: string) => void;
  teams: Teams;
  setTeams: (teams: Teams | ((current: Teams) => Teams)) => void;
  updatePlayerName: (oldName: string, newName: string) => void;
}

export const useResultsStore = create<ResultsState>()(
  persist(
    (set, get) => ({
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

      leagueTitle: 'Atlas League',
      setLeagueTitle: (title) => set({ leagueTitle: title }),

      teams: {
        blue: { name: 'JJ', color: '#3b82f6' },
        red: { name: 'DS', color: '#ef4444' },
      },
      setTeams: (teams) => set(state => ({ teams: typeof teams === 'function' ? teams(state.teams) : teams })),

      updatePlayerName: (oldName, newName) => {
        const { mergedData, extractedData, shockLog } = get();
        
        if (oldName === newName || !mergedData[oldName]) return;

        // Update mergedData
        const newMergedData = { ...mergedData };
        const playerData = newMergedData[oldName];
        playerData.playerName = newName;
        delete newMergedData[oldName];
        newMergedData[newName] = playerData;
        
        // Update extractedData
        const newExtractedData = extractedData.map(race => ({
          ...race,
          data: race.data.map(player => 
            player.playerName === oldName ? { ...player, playerName: newName } : player
          )
        }));

        // Update shockLog
        const newShockLog = { ...shockLog };
        Object.keys(newShockLog).forEach(raceNum => {
          const num = Number(raceNum);
          if (newShockLog[num] === oldName) {
            newShockLog[num] = newName;
          }
        });

        set({ 
          mergedData: newMergedData,
          extractedData: newExtractedData,
          shockLog: newShockLog
        });
      },
    }),
    {
      name: 'race-results-storage',
      storage: createJSONStorage(() => localStorage), 
    }
  )
);
