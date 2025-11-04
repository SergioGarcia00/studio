

'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  FileUp,
  Loader2,
  Sparkles,
  Download,
  XCircle,
  FileImage,
  ServerCrash,
  TableIcon,
  Trash2,
 Zap,
 ImageDown,
 TestTube2,
 FileDown,
 ChevronDown,
 RefreshCw,
 Circle,
 Minus,
 Users,
 UploadCloud,
 List,
 Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { extractRaceDataFromImage } from '@/ai/flows/extract-race-data-from-image';
import { extractTableDataFromImage } from '@/ai/flows/extract-table-data-from-image';
import type { 
    ExtractedData, 
    MergedRaceData, 
    Player, 
    ValidatedRacePlayerResult, 
    ExtractRaceDataFromImageInput, 
    ExtractTableDataFromImageInput,
    RacePlayerResult, 
    ShockLog, 
    RacePicks, 
    RacePick,
    RawPlayer
} from '@/ai/types';
import { exportToCsv } from '@/lib/csv-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { RACE_TRACKS } from '@/lib/race-tracks';
import Header from './header';
import { useResultsStore } from '@/lib/store';


type ImageQueueItem = {
 file: File;
 retries: number;
};

type LocalExtractedData = ExtractedData & { imageObjectURL?: string };


type Usage = {
  count: number;
  timestamp: number;
};


const RANK_TO_SCORE: { [key: string]: number } = {
 '1st': 15, '2nd': 12, '3rd': 10, '4th': 9, '5th': 8, '6th': 7,
 '7th': 6, '8th': 5, '9th': 4, '10th': 3, '11th': 2, '12th': 1,
};

const SCORE_TO_RANK: { [key: number]: string } = Object.fromEntries(
 Object.entries(RANK_TO_SCORE).map(([rank, score]) => [score, rank])
);

const rankToScore = (rank: string | null): number => {
    if (!rank) return 1; // Treat null rank as 12th place for score calculation
    return RANK_TO_SCORE[rank] || 1;
};

const sumRanks = (arr: (string|null)[]) => arr.reduce((acc: number, rank) => acc + rankToScore(rank), 0);

export default function ScoreParser() {
 const [images, setImages] = useState<File[]>([]);
 const [playerNames, setPlayerNames] = useState('');
 const { 
    mergedData, setMergedData, 
    shockLog, setShockLog,
    extractedData, setExtractedData,
    racePicks, setRacePicks
  } = useResultsStore();
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [progress, setProgress] = useState(0);
 const [nextRaceNumber, setNextRaceNumber] = useState(1);
 const { toast } = useToast();
 const [usage, setUsage] = useState({ count: 0 });
 const [localExtractedData, setLocalExtractedData] = useState<LocalExtractedData[]>([]);

 useEffect(() => {
    // Sync local state with persisted store on mount
    setLocalExtractedData(extractedData.map(d => ({ ...d })));
  }, []);

  useEffect(() => {
    // When local data changes, update the zustand store (without image data)
    setExtractedData(localExtractedData);
  }, [localExtractedData, setExtractedData]);


  useEffect(() => {
    const getUsageCount = () => {
      const storedUsage = localStorage.getItem('scoreParserUsage');
      if (storedUsage) {
        const parsedUsage: Usage = JSON.parse(storedUsage);
        const now = new Date().getTime();
        // Reset if it's been more than 24 hours
        if (now - parsedUsage.timestamp > 24 * 60 * 60 * 1000) {
          localStorage.removeItem('scoreParserUsage');
          setUsage({ count: 0 });
        } else {
          setUsage({ count: parsedUsage.count });
        }
      }
    };
    getUsageCount();
  }, []);

  const incrementUsage = () => {
    const newCount = usage.count + 1;
    const newUsage: Usage = {
      count: newCount,
      timestamp: new Date().getTime(),
    };
    localStorage.setItem('scoreParserUsage', JSON.stringify(newUsage));
    setUsage({ count: newCount });
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files).slice(0, 12 - (nextRaceNumber - 1));
      if (files.length > 12) {
        toast({
          title: 'Too many files',
          description: 'You can upload a maximum of 12 images in total.',
          variant: 'destructive',
        });
      }
      setError(null);
      setImages(fileArray);
    }
  };

  const normalizePlayerName = (name: string): string => {
    if (!name) return '';
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalized
      .toLowerCase()
      .replace(/^(ds|jj|d\$)[-\s.]*/i, '')
      .replace(/[^a-z0-9]/gi, '')
      .trim();
  }
 
  const recalculateAllTotals = (data: MergedRaceData): MergedRaceData => {
    const newData = JSON.parse(JSON.stringify(data)) as MergedRaceData;
   
    Object.values(newData).forEach(player => {
        const gp1Ranks = player.ranks.slice(0, 4);
        const gp2Ranks = player.ranks.slice(4, 8);
        const gp3Ranks = player.ranks.slice(8, 12);
       
        player.gp1 = player.ranks[3] !== null ? sumRanks(gp1Ranks) : null;
        player.gp2 = player.ranks[7] !== null ? sumRanks(gp2Ranks) : null;
        player.gp3 = player.ranks[11] !== null ? sumRanks(gp3Ranks) : null;

        player.total = sumRanks(player.ranks);
    });
     
    const sortedPlayers = Object.values(newData).sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    sortedPlayers.forEach((p, index) => {
        const playerToUpdate = Object.values(newData).find(pl => pl.playerName === p.playerName);
        if (playerToUpdate) {
            const rankSuffixes = ['st', 'nd', 'rd'];
            const rank = index + 1;
            const suffix = rankSuffixes[rank - 1] || 'th';
            playerToUpdate.rank = `${rank}${suffix}`;
        }
    });

    return newData;
  }

  const getMasterPlayerName = (
    newPlayerName: string,
    masterPlayerList: string[]
  ): string => {
    if (masterPlayerList.length === 0) {
      return newPlayerName;
    }
 
    const normalizedNewName = normalizePlayerName(newPlayerName);
   
    const normalizedMasterMap = masterPlayerList.reduce((acc, masterName) => {
      acc[normalizePlayerName(masterName)] = masterName;
      return acc;
    }, {} as { [key: string]: string });
 
    // Try to find an exact or near-exact match first.
    const directMatch = Object.entries(normalizedMasterMap).find(([normMaster, origMaster]) => {
      return normMaster === normalizedNewName || 
             normMaster.startsWith(normalizedNewName) || 
             normalizedNewName.startsWith(normMaster) ||
             (normMaster.length > 5 && normMaster.includes(normalizedNewName)) ||
             (normalizedNewName.length > 5 && normalizedNewName.includes(normMaster));
    });

    if (directMatch) {
      return directMatch[1];
    }
   
    // If no good match is found, and we still have slots, return the new name.
    // Otherwise, it's likely a misread player, and we shouldn't add them.
    if (masterPlayerList.length < 12) {
      return newPlayerName;
    }
   
    // If list is full and no match, return a placeholder or empty to be filtered.
    return '';
  };
  
  const handleAbsences = (
      raceData: ValidatedRacePlayerResult[],
      masterPlayerList: string[]
  ): ValidatedRacePlayerResult[] => {
      if (masterPlayerList.length !== 12) {
          return raceData; // Only apply logic when a full 12-player roster is expected
      }
      
      const presentPlayerNames = new Set(raceData.map(p => getMasterPlayerName(p.playerName, masterPlayerList)));
      const absentPlayerCount = 12 - presentPlayerNames.size;

      if (absentPlayerCount === 0) {
          return raceData;
      }
      
      const bonusPoints = absentPlayerCount > 0 ? absentPlayerCount - 1 : 0;

      const adjustedRaceData = raceData.map(player => {
          let adjustedRaceScore = player.raceScore || 0;
          if (player.rank === '1st') {
              adjustedRaceScore += 3 + bonusPoints;
          } else if (player.rank === '2nd') {
              adjustedRaceScore += 2 + bonusPoints;
          } else {
              adjustedRaceScore += 1 + bonusPoints;
          }
          return { ...player, raceScore: adjustedRaceScore };
      });
      
      const absentPlayerNames = masterPlayerList.filter(name => !presentPlayerNames.has(name));

      for (const absentPlayerName of absentPlayerNames) {
          adjustedRaceData.push({
              playerName: absentPlayerName,
              team: 'Unassigned', // Will be filled in later
              score: 0, // This will be recalculated
              rank: 'N/A',
              isValid: true,
              raceScore: 1, // They get 1 point for not playing
          });
      }
      
      return adjustedRaceData;
  };


  const updateMergedDataWithRace = (
    currentMergedData: MergedRaceData,
    raceResults: ValidatedRacePlayerResult[], 
    raceNumber: number, 
    masterPlayerList: string[]
  ): MergedRaceData => {
    let updatedData = JSON.parse(JSON.stringify(currentMergedData)) as MergedRaceData;

    // If master list is provided and it's the first race, initialize data
    if (raceNumber === 1 && masterPlayerList.length > 0 && Object.keys(updatedData).length === 0) {
      masterPlayerList.forEach(name => {
        updatedData[name] = {
          playerName: name,
          team: 'Unassigned',
          ranks: Array(12).fill(null),
          gp1: null, gp2: null, gp3: null,
          total: null, rank: null, isValid: true,
        };
      });
    }

    const currentMasterList = Object.keys(updatedData).length > 0 ? Object.keys(updatedData) : masterPlayerList;

    for (const racePlayer of raceResults) {
      if (!racePlayer.isValid || !racePlayer.playerName) continue;

      const masterName = getMasterPlayerName(racePlayer.playerName, currentMasterList);
      
      if (!masterName) {
        // Could not match player and list is full
        continue;
      }

      // If player doesn't exist, create them
      if (!updatedData[masterName]) {
          if (Object.keys(updatedData).length < 12) {
            updatedData[masterName] = {
              playerName: masterName,
              team: racePlayer.team,
              ranks: Array(12).fill(null),
              gp1: null, gp2: null, gp3: null,
              total: null, rank: null, isValid: true,
            };
          } else {
            continue;
          }
      }

      const mergedPlayer = updatedData[masterName];

      if (raceNumber >= 1 && raceNumber <= 12) {
        mergedPlayer.ranks[raceNumber - 1] = racePlayer.rank;
      }

      // Lock in the team name once a valid one with a color is found
      if (racePlayer.team && (mergedPlayer.team === 'Unassigned' || !mergedPlayer.team.includes('('))) {
          if (racePlayer.team.includes('(BLUE)') || racePlayer.team.includes('(RED)')) {
            mergedPlayer.team = racePlayer.team;
          }
      }
    }

    const finalData = recalculateAllTotals(updatedData);
    return finalData;
  };

  const handleToggleShock = (raceNumber: number, playerName: string) => {
    setShockLog(currentLog => {
      const newLog = { ...currentLog };
      const currentShockedPlayer = newLog[raceNumber];
 
      if (currentShockedPlayer === playerName) {
        // If the same player is clicked, remove the shock
        delete newLog[raceNumber];
      } else {
        // Otherwise, set the shock for this player
        newLog[raceNumber] = playerName;
      }
     
      return newLog;
    });
  };

  const handleGenerateDemoData = () => {
    handleClearResults(); // Clear everything first
    setIsLoading(true);

    const demoPlayers = [
 'Sipgb', 'Elgraco', 'Vick', 'Oniix', 'Wolfeet', 'Morioh',
 'Jecht', 'Braska', 'Cid', 'Wedge', 'Biggs', 'Seymour'
    ];
    
    const blueTeamPlayers = demoPlayers.slice(0, 6);
    const redTeamPlayers = demoPlayers.slice(6);

    const blueTeamName = 'old legends (BLUE)';
    const redTeamName = 'DS (RED)';

    const newMergedData: MergedRaceData = {};

    demoPlayers.forEach((name, index) => {
        newMergedData[name] = {
            playerName: name,
            team: index < 6 ? blueTeamName : redTeamName,
            ranks: Array(12).fill(null),
            gp1: null, gp2: null, gp3: null,
            total: null, rank: null, isValid: true,
        };
    });

    const rankSuffixes = ['st', 'nd', 'rd'];
    const getRankString = (rank: number) => `${rank}${rankSuffixes[rank - 1] || 'th'}`;
    const allRanks = Array.from({ length: 12 }, (_, i) => getRankString(i + 1));
    const newShockLog: ShockLog = {};
    const newRacePicks: RacePicks = {};

    // --- Scenario 1: Single DC ---
    const singleDcRace = Math.floor(Math.random() * 12);
    const singleDcPlayer = redTeamPlayers[Math.floor(Math.random() * redTeamPlayers.length)];

    // --- Scenario 2: Double DC ---
    let doubleDcRace;
    do {
      doubleDcRace = Math.floor(Math.random() * 12);
    } while (doubleDcRace === singleDcRace);

    const shuffledPlayers = [...demoPlayers].sort(() => Math.random() - 0.5);
    const doubleDcPlayer1 = shuffledPlayers[0];
    const doubleDcPlayer2 = shuffledPlayers[1];

    for (let i = 0; i < 12; i++) { // For each race
        let ranksToAssign: (string | null)[];
        let playersInRace: string[];

        if (i === singleDcRace) {
            playersInRace = demoPlayers.filter(p => p !== singleDcPlayer);
            ranksToAssign = allRanks.slice(0, 11);
        } else if (i === doubleDcRace) {
            playersInRace = demoPlayers.filter(p => p !== doubleDcPlayer1 && p !== doubleDcPlayer2);
            ranksToAssign = allRanks.slice(0, 10);
        } else {
            playersInRace = [...demoPlayers];
            ranksToAssign = [...allRanks];
        }
        
        ranksToAssign.sort(() => Math.random() - 0.5);
       
        playersInRace.forEach((name, pIndex) => {
            newMergedData[name].ranks[i] = ranksToAssign[pIndex];
        });

        if (i === singleDcRace) {
            newMergedData[singleDcPlayer].ranks[i] = null;
        }
        if (i === doubleDcRace) {
            newMergedData[doubleDcPlayer1].ranks[i] = null;
            newMergedData[doubleDcPlayer2].ranks[i] = null;
        }

        if (Math.random() < 0.8) {
          const shockedPlayer = playersInRace[Math.floor(Math.random() * playersInRace.length)];
          newShockLog[i + 1] = shockedPlayer;
        }
        
        const pick = Math.random();
        if (pick < 0.45) newRacePicks[i + 1] = 'blue';
        else if (pick < 0.9) newRacePicks[i + 1] = 'red';
        else newRacePicks[i + 1] = 'none';

    }
   
    let finalData = recalculateAllTotals(newMergedData);

    const newExtractedData: LocalExtractedData[] = [];
    for (let i = 0; i < 12; i++) {
        let playersForExtractedData;
        if (i === singleDcRace) {
            playersForExtractedData = demoPlayers.filter(p => p !== singleDcPlayer);
        } else if (i === doubleDcRace) {
            playersForExtractedData = demoPlayers.filter(p => p !== doubleDcPlayer1 && p !== doubleDcPlayer2);
        } else {
            playersForExtractedData = [...demoPlayers];
        }

        newExtractedData.push({
            imageUrl: '',
            filename: `Demo Race ${i + 1}`,
            raceNumber: i + 1,
            data: playersForExtractedData.map(p => {
                const raceScore = rankToScore(finalData[p].ranks[i]);
                const totalScore = finalData[p].ranks.slice(0, i + 1).reduce((acc, rank) => acc + rankToScore(rank), 0);

                return {
                    playerName: p,
                    team: finalData[p].team,
                    score: totalScore,
                    rank: finalData[p].ranks[i]!,
                    isValid: true,
                    raceScore: raceScore,
                }
            })
        });
    }
   
    setLocalExtractedData(newExtractedData);
    setMergedData(finalData);
    setShockLog(newShockLog);
    setRacePicks(newRacePicks);

    setTimeout(() => {
        setIsLoading(false);
        toast({
            title: "Demo Data Generated",
            description: `Simulated 1 DC on Race ${singleDcRace + 1} and 2 DCs on Race ${doubleDcRace + 1}.`,
            className: 'bg-accent text-accent-foreground'
        });
    }, 500);
  };


  const handleExtractData = async () => {
    if (images.length === 0) {
      toast({
        title: 'No images selected',
        description: 'Please upload at least one image first.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    const imageQueue: ImageQueueItem[] = images.map(file => ({ file, retries: 0 }));
    let processedCount = 0;
    const providedPlayerNames = playerNames.split(',').map(name => name.trim()).filter(name => name.length > 0);
    
    const readFileAsDataURL = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };
    
    // --- SINGLE IMAGE (SUMMARY TABLE) LOGIC ---
    if (images.length === 1) {
        const file = images[0];
        try {
            const url = await readFileAsDataURL(file);
            const input: ExtractTableDataFromImageInput = {
                photoDataUri: url,
                playerNames: providedPlayerNames.length > 0 ? providedPlayerNames : undefined,
            };

            const aiResult = await extractTableDataFromImage(input);
            const { tableData } = aiResult;
            
            const newMergedData: MergedRaceData = {};
            const newShockLog: ShockLog = {};

            tableData.forEach(player => {
                if (!player.playerName) return;

                newMergedData[player.playerName] = {
                    playerName: player.playerName,
                    team: player.team,
                    ranks: Array(12).fill(null), // Summary table doesn't have individual ranks
                    gp1: player.gp1,
                    gp2: player.gp2,
                    gp3: player.gp3,
                    total: player.total,
                    rank: player.rank,
                    isValid: true,
                };
                
                if (player.shockedRaces) {
                    player.shockedRaces.forEach(raceNum => {
                        newShockLog[raceNum] = player.playerName;
                    });
                }
            });

            setMergedData(newMergedData);
            setShockLog(newShockLog);
            
            // Create a single "ExtractedData" item for review purposes
            const summaryExtractedData: LocalExtractedData = {
                imageUrl: '',
                imageObjectURL: URL.createObjectURL(file),
                filename: file.name,
                raceNumber: 1, // Treat as one block
                raceName: 'Final Summary',
                data: tableData.map(p => ({
                    playerName: p.playerName,
                    team: p.team,
                    score: p.total,
                    rank: p.rank,
                    isValid: true,
                })),
            };
            setLocalExtractedData([summaryExtractedData]);
            setNextRaceNumber(13); // Mark as complete
            incrementUsage();

            toast({
              title: 'Summary Extraction Complete',
              description: `Processed final summary table.`,
              className: 'bg-accent text-accent-foreground'
            });

        } catch (e: any) {
            console.error(`Failed to process summary image ${file.name}:`, e);
            setError(e.message || 'An unknown error occurred during summary extraction.');
            toast({
                title: `Failed to process '${file.name}'`,
                description: e.message || 'An unknown error occurred.',
                variant: 'destructive',
            });
        }

        setIsLoading(false);
        setImages([]);
        return;
    }

    // --- MULTIPLE IMAGE (RACE-BY-RACE) LOGIC ---
    let currentRaceNumber = nextRaceNumber;
    const batchExtractedResults: LocalExtractedData[] = [];
    let masterPlayerList = providedPlayerNames.length > 0 ? providedPlayerNames : Object.keys(useResultsStore.getState().mergedData);
    
    for (const item of imageQueue) {
      const { file, retries } = item;
      const raceForThisImage = currentRaceNumber;

      try {
        const url = await readFileAsDataURL(file);
        const input: ExtractRaceDataFromImageInput = { 
            photoDataUri: url,
            raceNumber: raceForThisImage
        };
        
        if (masterPlayerList.length > 0) {
            input.playerNames = masterPlayerList;
        }

        const aiResult = await extractRaceDataFromImage(input);
        
        const tempMergedDataForThisRace = updateMergedDataWithRace(useResultsStore.getState().mergedData, [], raceForThisImage -1, masterPlayerList);
        
        let raceDataWithScores = aiResult.map(player => {
            if (!player.isValid || !player.playerName) {
              return { ...player, rank: '?th', raceScore: 0, score: player.score ?? 0 };
            }

            const masterName = getMasterPlayerName(player.playerName, masterPlayerList);
            const prevTotal = raceForThisImage > 1 ? (tempMergedDataForThisRace[masterName]?.total ?? 0) : 0;
            const currentTotal = player.score;
            const raceScore = currentTotal - prevTotal;
            const rank = SCORE_TO_RANK[raceScore] || '?th';
            
            return {
              ...player,
              score: currentTotal,
              raceScore: raceScore,
              rank: rank, 
            };
        });
        
        if (masterPlayerList.length === 12) {
          raceDataWithScores = handleAbsences(raceDataWithScores, masterPlayerList);
        }

        const finalRaceData = raceDataWithScores.map(player => {
            if (!player.isValid) return player;
            const masterName = getMasterPlayerName(player.playerName, masterPlayerList);
            const prevTotal = raceForThisImage > 1 ? (tempMergedDataForThisRace[masterName]?.total ?? 0) : 0;
            return {
                ...player,
                score: prevTotal + (player.raceScore || 0),
            };
        });

        const newExtractedResult: LocalExtractedData = {
          imageUrl: '',
          imageObjectURL: URL.createObjectURL(file),
          filename: file.name,
          raceNumber: raceForThisImage,
          data: finalRaceData,
        };
        
        if (masterPlayerList.length === 0 && finalRaceData.some(d => d.isValid)) {
            masterPlayerList = finalRaceData.filter(r => r.isValid).map(r => r.playerName);
        }

        if(finalRaceData.some(d => d.isValid)) {
          batchExtractedResults.push(newExtractedResult);
          incrementUsage();
        }
        
        processedCount++;
        currentRaceNumber++;

      } catch (e: any) {
          console.error(`Failed to process image ${file.name}:`, e);
          if (e.message && e.message.includes('overloaded') && retries < 2) {
              imageQueue.push({ file, retries: retries + 1 });
              toast({
                  title: 'Service Busy',
                  description: `Retrying '${file.name}'...`,
              });
          } else {
              const errorResult: LocalExtractedData = {
                  imageUrl: '',
                  imageObjectURL: URL.createObjectURL(file),
                  filename: file.name,
                  raceNumber: raceForThisImage,
                  data: [],
              };
              batchExtractedResults.push(errorResult);
              processedCount++;
               currentRaceNumber++;
              toast({
                  title: `Failed to process '${file.name}'`,
                  description: e.message || 'An unknown error occurred.',
                  variant: 'destructive',
              });
          }
      }
      
      setProgress((processedCount / images.length) * 100);
    }
    
    // Batch state updates
    if (batchExtractedResults.length > 0) {
        batchExtractedResults.sort((a,b) => a.raceNumber - b.raceNumber);

        setLocalExtractedData(prev => [...prev, ...batchExtractedResults].sort((a, b) => a.raceNumber - b.raceNumber));

        let newMergedData = useResultsStore.getState().mergedData;
        for (const result of batchExtractedResults) {
          if (result.data.length > 0) {
            newMergedData = updateMergedDataWithRace(newMergedData, result.data, result.raceNumber, masterPlayerList);
          }
        }
        setMergedData(newMergedData);
    }

    setNextRaceNumber(currentRaceNumber);

    toast({
      title: 'Extraction Complete',
      description: `Data processing finished for ${images.length} image(s).`,
      className: 'bg-accent text-accent-foreground'
    });
    setImages([]); // Clear selection
    setIsLoading(false);
  };

  const handleDownloadSingleRaceCsv = (raceData: ExtractedData) => {
    if (raceData.data.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no player entries for this race to export to CSV.',
        variant: 'destructive',
      });
      return;
    }
    
    const allPlayersInApp = Object.values(mergedData);
    const teams = Array.from(new Set(allPlayersInApp.map(p => p.team).filter(Boolean)));
    const teamA = teams.find(t => t.includes('BLUE')) || 'Team A';
    const teamB = teams.find(t => t.includes('RED')) || 'Team B';
    
    const shockedPlayerName = shockLog[raceData.raceNumber];
    const shockedPlayer = allPlayersInApp.find(p => p.playerName === shockedPlayerName);
    const shockedTeam = shockedPlayer?.team;

    const shocksTeamA = shockedTeam === teamA ? 1 : 0;
    const shocksTeamB = shockedTeam === teamB ? 1 : 0;


    const csvData = raceData.data.map(player => {
      const masterName = getMasterPlayerName(player.playerName, Object.keys(mergedData));
      const playerTeam = mergedData[masterName]?.team || 'Unassigned';

      return {
        timestamp: new Date().toISOString(),
        race: raceData.raceNumber,
        team: playerTeam,
        player: player.playerName,
        delta: player.rank,
        score: player.score,
        shocks_teamA: shocksTeamA,
        shocks_teamB: shocksTeamB,
      };
    });

    if (csvData.length === 0) {
      toast({
        title: 'No race data to export',
        description: 'No individual race scores have been recorded yet.',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['timestamp', 'race', 'team', 'player', 'delta', 'score', 'shocks_teamA', 'shocks_teamB'];
    exportToCsv(csvData, `race_${raceData.raceNumber}_details.csv`, headers);
  };
  
  
  const handleClearResults = () => {
    setLocalExtractedData([]);
    setMergedData({});
    setImages([]);
    setError(null);
    setProgress(0);
    setNextRaceNumber(1);
    setPlayerNames('');
    setShockLog({});
    setRacePicks({});
    localStorage.removeItem('scoreParserUsage');
    setUsage({ count: 0 });
    toast({
        title: "Results Cleared",
        description: "The review and download area has been cleared.",
    });
  }

  const handleRaceNameChange = (raceNumberToUpdate: number, newRaceName: string) => {
    setLocalExtractedData(currentData => {
        if (!Array.isArray(currentData)) return [];
        const newData = currentData.map(item => {
            if (item.raceNumber === raceNumberToUpdate) {
                return { ...item, raceName: newRaceName };
            }
            return item;
        });
        return newData;
    });
  };


  const handleUpdateOrder = () => {
      setLocalExtractedData(currentData => [...currentData].sort((a, b) => a.raceNumber - b.raceNumber));
      toast({
        title: 'Race Order Updated',
        description: 'The race list has been re-sorted based on the race numbers.',
      });
  };

  const handleTeamPickChange = (raceNumber: number, value: number) => {
    const pick: RacePick = value === 0 ? 'blue' : value === 1 ? 'none' : 'red';
    setRacePicks(currentPicks => ({
        ...currentPicks,
        [raceNumber]: pick,
    }));
  };

  const allPlayers = useMemo(() => Object.values(mergedData), [mergedData]);
  const isDemoData = useMemo(() => Array.isArray(localExtractedData) && localExtractedData.length > 0 && localExtractedData.every(d => !d.imageObjectURL), [localExtractedData]);

  return (
    <div className="flex flex-col h-full">
      <Header />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column for Controls */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UploadCloud /> 1. Upload Images</CardTitle>
                <CardDescription>Upload a single summary image, or up to 12 race images. Usage: {usage.count} images.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center w-full">
                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                        <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP</p>
                      </div>
                      <input id="dropzone-file" type="file" className="hidden" onChange={handleImageChange} accept="image/png, image/jpeg, image/webp" multiple disabled={nextRaceNumber > 12} />
                    </label>
                  </div>
                  {nextRaceNumber > 12 && <p className='text-sm text-center text-destructive mt-2'>Maximum of 12 races reached.</p>}

                  {images.length > 0 && !isLoading && (
                    <div className='grid grid-cols-3 md:grid-cols-4 lg:grid-cols-3 gap-2 mt-4'>
                        {images.map((file, index) => (
                        <div key={index} className="relative aspect-video w-full">
                            <Image src={URL.createObjectURL(file)} alt={`Uploaded scoreboard ${index+1}`} fill className="rounded-lg object-contain" />
                        </div>
                        ))}
                    </div>
                  )}
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> Optional: Player Names</CardTitle>
                    <CardDescription>Provide a comma-separated list of player names to improve OCR accuracy.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                    placeholder="e.g. Player 1, Player 2, Player 3, ..."
                    value={playerNames}
                    onChange={(e) => setPlayerNames(e.target.value)}
                    rows={4}
                    disabled={isLoading || (Array.isArray(localExtractedData) && localExtractedData.length > 0)}
                    />
                </CardContent>
            </Card>
            
            <div className="space-y-2">
                <Button onClick={handleExtractData} disabled={images.length === 0 || isLoading} className="w-full text-lg py-6">
                  {isLoading && images.length > 0 ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      2. Extract Data
                    </>
                  )}
                </Button>
                <div className='flex gap-2'>
                  {!isDemoData ? (
                      <Button onClick={handleGenerateDemoData} variant="secondary" className="w-full" disabled={isLoading}>
                          <TestTube2 className="mr-2 h-5 w-5" />
                          Generate Demo
                      </Button>
                  ) : (
                      <Button onClick={handleClearResults} variant="secondary" className="w-full" disabled={isLoading}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Clear Demo
                      </Button>
                  )}
                </div>
            </div>
          </div>

          {/* Right Column for Results */}
          <div className="lg:col-span-2">
            {isLoading && (
              <Card className="shadow-lg min-h-[400px]">
                <CardHeader>
                  <CardTitle>Processing...</CardTitle>
                  <CardDescription>Please wait a moment.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center pt-10">
                  <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                  {images.length > 0 ? (
                    <>
                      <p className='text-muted-foreground mb-4'>Processing image {processedCount + 1} of {images.length}... ({Math.round(progress)}%)</p>
                      <Progress value={progress} className="w-3/4" />
                    </>
                  ) : (
                    <p className='text-muted-foreground'>Generating demo data...</p>
                  )}
                </CardContent>
              </Card>
            )}
            {error && !isLoading && (
              <Alert variant="destructive">
                {error.includes('overloaded') ? <ServerCrash className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <AlertTitle>Extraction Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {Array.isArray(localExtractedData) && localExtractedData.length > 0 && !isLoading && (
              <Card className="shadow-lg">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <CardTitle className='flex items-center gap-2'><List /> 3. Review &amp; Download</CardTitle>
                      <CardDescription>Review extracted data and download or preview results.</CardDescription>
                    </div>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <Button asChild variant="outline" disabled={allPlayers.length === 0}>
                        <Link href="/preview">
                          <TableIcon className="mr-2 h-4 w-4" />
                          Preview Results
                        </Link>
                      </Button>
                      <Button onClick={handleClearResults} variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Clear Results</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='flex justify-end mb-2'>
                    <Button onClick={handleUpdateOrder} size="sm" variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Update Order
                    </Button>
                  </div>
                  {Array.isArray(localExtractedData) && (
                    <Accordion type="multiple" className="w-full" defaultValue={localExtractedData.map((_, i) => `item-${i}`)}>
                      {localExtractedData.map((result, index) => (
                        <AccordionItem value={`item-${index}`} key={`${result.filename}-${index}`}>
                          <AccordionTrigger>
                            <div className='flex items-center justify-between w-full pr-4'>
                              <div className='flex items-center gap-4'>
                                {result.imageObjectURL ? (
                                  <div className="relative aspect-video w-24">
                                    <Image src={result.imageObjectURL} alt={`Scoreboard ${index + 1}`} fill className="rounded-md object-contain" />
                                  </div>
                                ) : (
                                  <div className="relative aspect-video w-24 flex items-center justify-center bg-secondary rounded-md">
                                    <TestTube2 className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                )}
                                <div className='text-left'>
                                  <p className='font-semibold'>
                                    {`Race ${result.raceNumber}${result.raceName ? `: ${result.raceName}` : ''}`}
                                  </p>
                                  <p className='text-sm text-muted-foreground'>{result.data.filter(p => p.isValid).length} valid records</p>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className='flex justify-end mb-2'>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadSingleRaceCsv(result);
                                }}
                                aria-label="Download CSV for this race"
                              >
                                <Download className='h-4 w-4 mr-2' />
                                Download Race CSV
                              </Button>
                            </div>
                            <div className='overflow-x-auto max-h-[60vh]'>
                              <Table>
                                <TableHeader className='sticky top-0 bg-card'>
                                  <TableRow>
                                    <TableHead>Player Name</TableHead>
                                    <TableHead>Team</TableHead>
                                    <TableHead className="text-right">Total Score</TableHead>
                                    <TableHead className='text-right'>Race Score</TableHead>
                                    <TableHead>Rank</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {result.data.length > 0 ? result.data.map((player, pIndex) => (
                                    <TableRow key={pIndex} className={!player.isValid ? 'bg-destructive/10 hover:bg-destructive/20' : ''}>
                                      <TableCell className='font-medium'>{player.playerName || 'N/A'}</TableCell>
                                      <TableCell>{player.team || 'N/A'}</TableCell>
                                      <TableCell className="text-right font-mono">{player.score ?? 'N/A'}</TableCell>
                                      <TableCell className="text-right font-mono">{player.raceScore ?? 'N/A'}</TableCell>
                                      <TableCell className='font-bold'>{player.rank || 'N/A'}</TableCell>
                                    </TableRow>
                                  )) : (
                                    <TableRow>
                                      <TableCell colSpan={5} className="text-center text-muted-foreground">No data extracted from this image.</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                            <div className='space-y-6 mt-4 p-4 border rounded-lg'>
                              <div className="grid gap-2">
                                <Label>Race Name</Label>
                                <Select
                                  value={result.raceName}
                                  onValueChange={(value) => handleRaceNameChange(result.raceNumber, value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a race track..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(RACE_TRACKS).map(([abbr, fullName]) => (
                                      <SelectItem key={abbr} value={fullName}>{fullName}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid gap-2">
                                <Label>Team Pick</Label>
                                <div className='flex items-center gap-4'>
                                  <Circle className="h-5 w-5 text-blue-500 fill-blue-500" />
                                  <Slider
                                    value={[racePicks[result.raceNumber] === 'blue' ? 0 : racePicks[result.raceNumber] === 'none' ? 1 : 2]}
                                    onValueChange={([val]) => handleTeamPickChange(result.raceNumber, val)}
                                    min={0}
                                    max={2}
                                    step={1}
                                    className='flex-1'
                                  />
                                  <Circle className="h-5 w-5 text-red-500 fill-red-500" />
                                </div>
                              </div>

                              <div className='flex items-center justify-end gap-2 border-t pt-4'>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Zap className="mr-2 h-4 w-4" />
                                      {shockLog[result.raceNumber] ? `Shock: ${shockLog[result.raceNumber]}` : 'Mark Shock'}
                                      <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleToggleShock(result.raceNumber, shockLog[result.raceNumber])}>
                                      Remove Shock
                                    </DropdownMenuItem>
                                    {allPlayers.map(p => (
                                      <DropdownMenuItem key={p.playerName} onClick={() => handleToggleShock(result.raceNumber, p.playerName)}>
                                        {p.playerName}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            )}
            {!isLoading && (!Array.isArray(localExtractedData) || localExtractedData.length === 0) && (
              <Card className="flex flex-col items-center justify-center h-full min-h-[400px] border-dashed shadow-inner">
                <CardContent className="text-center p-6">
                  {images.length > 0 ?
                    <>
                      <FileImage className="mx-auto h-16 w-16 text-muted-foreground" />
                      <h3 className="mt-4 text-xl font-semibold">Ready to Extract</h3>
                      <p className="mt-2 text-base text-muted-foreground">
                        Click the "Extract Data" button to begin.
                      </p>
                    </>
                    :
                    <>
                      <FileImage className="mx-auto h-16 w-16 text-muted-foreground" />
                      <h3 className="mt-4 text-xl font-semibold">Results will appear here</h3>
                      <p className="mt-2 text-base text-muted-foreground">
                        Upload race images and click "Extract Data" to see the magic.
                      </p>
                    </>
                  }
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
