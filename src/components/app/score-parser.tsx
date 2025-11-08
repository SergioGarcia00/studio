

'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  FileUp,
  Loader2,
  Sparkles,
  X,
  ServerCrash,
  TableIcon,
  Trash2,
  TestTube2,
  RefreshCw,
  Circle,
  Settings,
  UploadCloud,
  List,
  ClipboardCheck,
  PanelRightOpen,
  PanelRightClose
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
    RacePick,
    ValidatedRacePlayerResult, 
    ExtractRaceDataFromImageInput, 
    ExtractTableDataFromImageInput,
    ShockLog, 
    RacePicks, 
} from '@/ai/types';
import { exportToCsv } from '@/lib/csv-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { RACE_TRACKS } from '@/lib/race-tracks';
import Header from './header';
import { useResultsStore } from '@/lib/store';
import { Switch } from '../ui/switch';


type ImageQueueItem = {
 file: File;
 retries: number;
};

// Add imageObjectURL to ExtractedData for local display
type LocalExtractedData = ExtractedData & { imageObjectURL?: string };


type Usage = {
  count: number;
  timestamp: number;
};

type UploadMode = 'summary' | 'race-by-race';


const RANK_TO_SCORE: { [key: string]: number } = {
 '1st': 15, '2nd': 12, '3rd': 10, '4th': 9, '5th': 8, '6th': 7,
 '7th': 6, '8th': 5, '9th': 4, '10th': 3, '11th': 2, '12th': 1,
};

const rankToScore = (rank: string | null): number => {
    if (!rank) return 1; // Treat null rank as 12th place for score calculation
    return RANK_TO_SCORE[rank] || 1;
};

const sumRanks = (arr: (string|null)[]) => arr.reduce((acc: number, rank) => acc + rankToScore(rank), 0);

export default function ScoreParser() {
 const [images, setImages] = useState<File[]>([]);
 const [uploadMode, setUploadMode] = useState<UploadMode>('race-by-race');
 const { 
    mergedData, setMergedData, 
    shockLog, setShockLog,
    extractedData, setExtractedData,
    racePicks, setRacePicks,
    handleToggleShock
  } = useResultsStore();
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [progress, setProgress] = useState(0);
 const [processedCount, setProcessedCount] = useState(0);
 const [nextRaceNumber, setNextRaceNumber] = useState(1);
 const { toast } = useToast();
 const [usage, setUsage] = useState({ count: 0 });
 
 useEffect(() => {
    const lastRace = extractedData.reduce((max, d) => Math.max(max, d.raceNumber), 0);
    setNextRaceNumber(lastRace + 1);
  }, [extractedData]);


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
    if (!files) return;

    setError(null);
    const newFiles = Array.from(files);

    if (uploadMode === 'summary') {
        if (newFiles.length > 1) {
            toast({ title: 'Summary Mode', description: 'Only one image can be uploaded in summary mode.', variant: 'destructive' });
        }
        setImages(newFiles.slice(0, 1));
    } else { // race-by-race
        const totalAfterAdd = images.length + newFiles.length;
        const totalAllowed = 12 - (nextRaceNumber - 1);

        if (totalAfterAdd > totalAllowed) {
            toast({
                title: 'Too many files',
                description: `You can only add ${totalAllowed - images.length} more images.`,
                variant: 'destructive',
            });
            const allowedNewFiles = newFiles.slice(0, totalAllowed - images.length);
            setImages(prev => [...prev, ...allowedNewFiles]);
        } else {
            setImages(prev => [...prev, ...newFiles]);
        }
    }
};

const handleRemoveImage = (indexToRemove: number) => {
    setImages(images.filter((_, index) => index !== indexToRemove));
};

  const normalizePlayerName = (name: string): string => {
    if (!name) return '';
    // This regex is designed to remove prefixes like "JJ ", "DS ", "d$ ", etc.
    // It looks for these prefixes at the start of the string, followed by optional whitespace or symbols.
    const cleanedName = name.replace(/^(ds|jj|d\$)\s*[-. ]?\s*/i, '');
    
    // Fallback to remove any bracketed content if the first method fails
    const finalName = cleanedName.includes('(') ? cleanedName.replace(/\s*\(.*\)\s*/, '') : cleanedName;
    
    // Final cleanup of accents and special characters
    return finalName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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
    const normalizedNewName = normalizePlayerName(newPlayerName);

    if (masterPlayerList.length === 0) {
      return normalizedNewName;
    }
 
    const normalizedMasterMap = masterPlayerList.reduce((acc, masterName) => {
      acc[normalizePlayerName(masterName)] = masterName;
      return acc;
    }, {} as { [key: string]: string });
 
    const directMatch = Object.entries(normalizedMasterMap).find(([normMaster, origMaster]) => {
      const lNormMaster = normMaster.toLowerCase();
      const lNormalizedNewName = normalizedNewName.toLowerCase();
      return lNormMaster === lNormalizedNewName || 
             lNormMaster.startsWith(lNormalizedNewName) || 
             lNormalizedNewName.startsWith(lNormMaster) ||
             (lNormMaster.length > 5 && lNormMaster.includes(lNormalizedNewName)) ||
             (lNormalizedNewName.length > 5 && lNormalizedNewName.includes(lNormMaster));
    });

    if (directMatch) {
      return directMatch[1];
    }
   
    if (masterPlayerList.length < 12) {
      return normalizedNewName;
    }
   
    return '';
  };
  
  const handleAbsences = (
      raceData: ValidatedRacePlayerResult[],
      masterPlayerList: string[]
  ): ValidatedRacePlayerResult[] => {
      if (masterPlayerList.length !== 12) {
          return raceData; 
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
              team: 'Unassigned',
              score: 0, 
              rank: 'N/A',
              isValid: true,
              raceScore: 1, 
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

    if (raceNumber === 1 && masterPlayerList.length > 0 && Object.keys(updatedData).length === 0) {
      masterPlayerList.forEach(name => {
        const cleanName = normalizePlayerName(name);
        updatedData[cleanName] = {
          playerName: cleanName,
          team: 'Unassigned',
          ranks: Array(12).fill(null),
          gp1: null, gp2: null, gp3: null,
          total: null, rank: null, isValid: true,
        };
      });
    }

    const currentMasterList = Object.keys(updatedData).length > 0 ? Object.keys(updatedData) : masterPlayerList.map(normalizePlayerName);

    for (const racePlayer of raceResults) {
      if (!racePlayer.isValid || !racePlayer.playerName) continue;

      const masterName = getMasterPlayerName(racePlayer.playerName, currentMasterList);
      
      if (!masterName) {
        continue;
      }

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

      if (racePlayer.team && (mergedPlayer.team === 'Unassigned' || !mergedPlayer.team.includes('('))) {
          if (racePlayer.team.includes('(BLUE)') || racePlayer.team.includes('(RED)')) {
            mergedPlayer.team = racePlayer.team;
          }
      }
    }

    const finalData = recalculateAllTotals(updatedData);
    return finalData;
  };

  const handleGenerateDemoData = () => {
    handleClearResults(); // Clear everything first
    setIsLoading(true);

    const demoPlayers = [
 'Sipgb', 'Elgraco', 'Vick', 'Oniix', 'Wolfeet', 'Morioh',
 'Jecht', 'Braska', 'Cid', 'Wedge', 'Biggs', 'Seymour'
    ];
    
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

    const singleDcRace = Math.floor(Math.random() * 12);
    const singleDcPlayer = demoPlayers[Math.floor(Math.random() * demoPlayers.length)];

    let doubleDcRace;
    do {
      doubleDcRace = Math.floor(Math.random() * 12);
    } while (doubleDcRace === singleDcRace);

    const shuffledPlayers = [...demoPlayers].sort(() => Math.random() - 0.5);
    const doubleDcPlayer1 = shuffledPlayers[0];
    const doubleDcPlayer2 = shuffledPlayers[1];

    for (let i = 0; i < 12; i++) { 
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
    const allTrackNames = Object.values(RACE_TRACKS);

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
            raceName: allTrackNames[i % allTrackNames.length],
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
   
    setExtractedData(newExtractedData);
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
    setProcessedCount(0);
    
    const imageQueue: ImageQueueItem[] = images.map(file => ({ file, retries: 0 }));
    
    const readFileAsDataURL = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };
    
    if (uploadMode === 'summary') {
        const file = images[0];
        try {
            const url = await readFileAsDataURL(file);
            const input: ExtractTableDataFromImageInput = {
                photoDataUri: url,
                playerNames: Object.keys(mergedData).length > 0 ? Object.keys(mergedData) : undefined,
            };

            const aiResult = await extractTableDataFromImage(input);
            const { tableData } = aiResult;
            
            const newMergedData: MergedRaceData = {};
            const newShockLog: ShockLog = {};

            tableData.forEach(player => {
                if (!player.playerName) return;

                const cleanName = normalizePlayerName(player.playerName);

                newMergedData[cleanName] = {
                    playerName: cleanName,
                    team: player.team,
                    ranks: Array(12).fill(null),
                    gp1: player.gp1,
                    gp2: player.gp2,
                    gp3: player.gp3,
                    total: player.total,
                    rank: player.rank,
                    isValid: true,
                };
                
                if (player.shockedRaces) {
                    player.shockedRaces.forEach(raceNum => {
                        newShockLog[raceNum] = cleanName;
                    });
                }
            });

            setMergedData(newMergedData);
            setShockLog(newShockLog);
            
            const summaryExtractedData: ExtractedData = {
                imageUrl: '',
                filename: file.name,
                raceNumber: 1, 
                raceName: 'Final Summary',
                data: tableData.map(p => ({
                    playerName: normalizePlayerName(p.playerName),
                    team: p.team,
                    score: p.total,
                    rank: p.rank,
                    isValid: true,
                })),
            };
            setExtractedData([summaryExtractedData]);
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

    // Race by Race logic
    let currentRaceNumber = nextRaceNumber;
    const batchExtractedResults: ExtractedData[] = [];
    let masterPlayerList = Object.keys(useResultsStore.getState().mergedData);
    
    let processedImageCount = 0;
    for (const item of imageQueue) {
      const { file, retries } = item;
      const raceForThisImage = currentRaceNumber + processedImageCount;

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
              return { ...player, rank: player.rank || '?th', raceScore: 0, score: player.score ?? 0, playerName: normalizePlayerName(player.playerName) };
            }
            
            const raceScore = rankToScore(player.rank);
            
            return {
              ...player,
              playerName: normalizePlayerName(player.playerName),
              raceScore: raceScore, 
              rank: player.rank,
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

        const newExtractedResult: ExtractedData = {
          imageUrl: '',
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
        
        processedImageCount++;
        setProcessedCount(processedImageCount);

      } catch (e: any) {
          console.error(`Failed to process image ${file.name}:`, e);
          if (e.message && e.message.includes('overloaded') && retries < 2) {
              imageQueue.push({ file, retries: retries + 1 });
              toast({
                  title: 'Service Busy',
                  description: `Retrying '${file.name}'...`,
              });
          } else {
              const errorResult: ExtractedData = {
                  imageUrl: '',
                  filename: file.name,
                  raceNumber: raceForThisImage,
                  data: [],
              };
              batchExtractedResults.push(errorResult);
              processedImageCount++;
              setProcessedCount(processedImageCount);
              toast({
                  title: `Failed to process '${file.name}'`,
                  description: e.message || 'An unknown error occurred.',
                  variant: 'destructive',
              });
          }
      }
      
      setProgress((processedImageCount / images.length) * 100);
    }
    
    const uniqueResults: ExtractedData[] = [];
    const existingSignatures = new Set(
        extractedData.map(res => {
            if (res.data.length === 0) return null;
            const sortedPlayers = [...res.data].sort((a,b) => a.playerName.localeCompare(b.playerName));
            return sortedPlayers.map(p => `${p.playerName}:${p.score}`).join(',');
        }).filter(Boolean)
    );

    for (const result of batchExtractedResults) {
        if (result.data.length === 0) {
            uniqueResults.push(result);
            continue;
        }
        const sortedPlayers = [...result.data].sort((a, b) => a.playerName.localeCompare(b.playerName));
        const signature = sortedPlayers.map(p => `${p.playerName}:${p.score}`).join(',');

        if (!existingSignatures.has(signature)) {
            uniqueResults.push(result);
            existingSignatures.add(signature);
        } else {
             toast({
                title: 'Duplicate Race Found',
                description: `Race data from '${result.filename}' seems to be a duplicate and was ignored.`,
            });
        }
    }
    
    const duplicatesFound = batchExtractedResults.filter(r => r.data.length > 0).length - uniqueResults.filter(r => r.data.length > 0).length;
    if (duplicatesFound > 0) {
        toast({
            title: 'Duplicate Races Found',
            description: `${duplicatesFound} duplicate race(s) were automatically removed.`,
        });
    }

    let raceNumberCounter = nextRaceNumber;
    const finalUniqueResults = uniqueResults.map(res => {
        if(res.data.length > 0) { 
            res.raceNumber = raceNumberCounter++;
        }
        return res;
    });

    if (finalUniqueResults.length > 0) {
        finalUniqueResults.sort((a,b) => a.raceNumber - b.raceNumber);

        setExtractedData([...extractedData, ...finalUniqueResults].sort((a, b) => a.raceNumber - b.raceNumber));

        let newMergedData = useResultsStore.getState().mergedData;
        for (const result of finalUniqueResults) {
          if (result.data.length > 0) {
            newMergedData = updateMergedDataWithRace(newMergedData, result.data, result.raceNumber, masterPlayerList);
          }
        }
        setMergedData(newMergedData);
    }


    toast({
      title: 'Extraction Complete',
      description: `Data processing finished for ${images.length} image(s).`,
      className: 'bg-accent text-accent-foreground'
    });
    setImages([]); 
    setIsLoading(false);
  };
  
  const handleClearResults = () => {
    setExtractedData([]);
    setMergedData({});
    setImages([]);
    setError(null);
    setProgress(0);
    setProcessedCount(0);
    setNextRaceNumber(1);
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
    const dataCopy = [...extractedData];
    const raceToUpdate = dataCopy.find((item) => item.raceNumber === raceNumberToUpdate);
    if (raceToUpdate) {
        raceToUpdate.raceName = newRaceName;
    } else {
        // If the race doesn't exist, we might need to create a placeholder
        const placeholder: ExtractedData = {
            imageUrl: '',
            filename: `Race ${raceNumberToUpdate}`,
            raceNumber: raceNumberToUpdate,
            raceName: newRaceName,
            data: [],
        };
        dataCopy.push(placeholder);
    }
    setExtractedData(dataCopy.sort((a,b) => a.raceNumber - b.raceNumber));
  };


  const handleUpdateOrder = () => {
      setExtractedData([...extractedData].sort((a, b) => a.raceNumber - b.raceNumber));
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

  const allPlayers = useMemo(() => Object.keys(mergedData).sort(), [mergedData]);
  const isComplete = useMemo(() => {
    if (extractedData.length === 1 && extractedData[0].raceName === 'Final Summary') {
        return true;
    }
    const validRaces = extractedData.filter(d => d.data.length > 0);
    return validRaces.length === 12;
  }, [extractedData]);
  
  const isDemoData = useMemo(() => Array.isArray(extractedData) && extractedData.length > 0 && extractedData.every(d => d.imageUrl === '' && d.filename.startsWith('Demo')), [extractedData]);

  const hasResults = Array.isArray(extractedData) && extractedData.length > 0;

  const preloadedRaces = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const raceNumber = i + 1;
      const existingData = extractedData.find(d => d.raceNumber === raceNumber);
      return {
        raceNumber: raceNumber,
        raceName: existingData?.raceName || '',
        pick: racePicks[raceNumber] || 'none',
      };
    });
  }, [extractedData, racePicks]);


  return (
    <div className="flex flex-col h-full bg-background">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <div className="container mx-auto max-w-7xl">
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 items-start'>

                    {/* Left Column */}
                    <div className='space-y-8'>
                        <Card>
                             <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Settings className="text-primary"/> 1. Configuration</CardTitle>
                                <CardDescription>Choose upload mode and pre-configure race settings.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center space-x-4">
                                    <Label>Upload Mode:</Label>
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="upload-mode" className="text-muted-foreground">Race-by-Race</Label>
                                        <Switch
                                            id="upload-mode"
                                            checked={uploadMode === 'summary'}
                                            onCheckedChange={(checked) => {
                                                setUploadMode(checked ? 'summary' : 'race-by-race');
                                                setImages([]); 
                                            }}
                                        />
                                        <Label htmlFor="upload-mode">Summary</Label>
                                    </div>
                                </div>
                                
                                {uploadMode === 'race-by-race' && (
                                     <Accordion type="single" collapsible>
                                        <AccordionItem value="item-1">
                                            <AccordionTrigger>
                                                <Label className="flex items-center gap-2 text-base"><List /> Pre-Race Settings</Label>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="border rounded-lg overflow-auto max-h-[50vh]">
                                                    <Table>
                                                        <TableHeader className='sticky top-0 bg-background/95 backdrop-blur-sm z-10'>
                                                            <TableRow>
                                                                <TableHead className="w-[10%]">Race</TableHead>
                                                                <TableHead className="w-[40%]">Track</TableHead>
                                                                <TableHead className="w-[25%] text-center">Team Pick</TableHead>
                                                                <TableHead className="w-[25%]">Shock User</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {preloadedRaces.map(({ raceNumber, raceName, pick }) => (
                                                                <TableRow key={raceNumber}>
                                                                    <TableCell className="font-medium">{raceNumber}</TableCell>
                                                                    <TableCell>
                                                                        <Select
                                                                            value={raceName}
                                                                            onValueChange={(value) => handleRaceNameChange(raceNumber, value)}
                                                                        >
                                                                            <SelectTrigger className="h-8">
                                                                                <SelectValue placeholder="Select track..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {Object.entries(RACE_TRACKS).map(([abbr, fullName]) => (
                                                                                    <SelectItem key={abbr} value={fullName}>{fullName}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className='flex items-center justify-center gap-2'>
                                                                            <Circle className="h-4 w-4 text-blue-500 fill-blue-500" />
                                                                            <Slider
                                                                                value={[pick === 'blue' ? 0 : pick === 'none' ? 1 : 2]}
                                                                                onValueChange={([val]) => handleTeamPickChange(raceNumber, val)}
                                                                                min={0} max={2} step={1}
                                                                                className='w-20'
                                                                            />
                                                                            <Circle className="h-4 w-4 text-red-500 fill-red-500" />
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Select
                                                                            value={shockLog[raceNumber] || 'none'}
                                                                            onValueChange={(value) => handleToggleShock(raceNumber, value)}
                                                                            disabled={allPlayers.length === 0}
                                                                        >
                                                                            <SelectTrigger className="h-8">
                                                                                <SelectValue placeholder={allPlayers.length === 0 ? "Process races first" : "Select player..."} />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="none">None</SelectItem>
                                                                                {allPlayers.map((player) => (
                                                                                    <SelectItem key={player} value={player}>{player}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                     </Accordion>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><UploadCloud className="text-primary"/> 2. Upload Images</CardTitle>
                                <CardDescription>
                                    {uploadMode === 'summary' ? 'Upload a single summary image.' : `Upload up to 12 race images. You have ${12 - (nextRaceNumber-1)} slots remaining.`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col items-center justify-center w-full">
                                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50 transition-colors">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                                            <FileUp className="w-10 h-10 mb-4 text-muted-foreground" />
                                            <p className="mb-2 text-md"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                            <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP</p>
                                        </div>
                                        <input id="dropzone-file" type="file" className="hidden" 
                                            onChange={handleImageChange} 
                                            accept="image/png, image/jpeg, image/webp" 
                                            multiple={uploadMode === 'race-by-race'}
                                            disabled={nextRaceNumber > 12 && uploadMode === 'race-by-race'} />
                                    </label>
                                </div>
                                
                                {images.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="font-semibold mb-2">Selected Files ({images.length}):</h3>
                                        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'>
                                            {images.map((file, index) => (
                                                <div key={index} className="relative group aspect-w-16 aspect-h-9">
                                                    <Image src={URL.createObjectURL(file)} alt={`Uploaded scoreboard ${index+1}`} fill className="rounded-lg object-cover" />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className='h-8 w-8'
                                                            onClick={() => handleRemoveImage(index)}
                                                            aria-label="Remove image"
                                                        >
                                                            <X className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column */}
                    <div className='space-y-8'>
                        <Card className='min-h-[600px]'>
                             <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle className='flex items-center gap-2'><ClipboardCheck className="text-primary"/> 3. Results</CardTitle>
                                    {hasResults && !isDemoData && (
                                        <Button onClick={handleUpdateOrder} size="sm" variant="outline">
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Re-order
                                        </Button>
                                    )}
                                </div>
                                <CardDescription>Review extracted data. Add more race images if needed.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                 {isLoading ? (
                                    <div className="flex flex-col items-center justify-center pt-10">
                                        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                                        {images.length > 0 ? (
                                            <>
                                            <p className='text-muted-foreground mb-4'>Processing image {processedCount + 1} of {images.length}... ({Math.round(progress)}%)</p>
                                            <Progress value={progress} className="w-3/4" />
                                            </>
                                        ) : (
                                            <p className='text-muted-foreground'>Generating demo data...</p>
                                        )}
                                    </div>
                                ) : !hasResults ? (
                                    <div className='flex flex-col items-center justify-center text-center text-muted-foreground pt-20'>
                                        <PanelRightClose className='w-16 h-16 mb-4'/>
                                        <p className='text-lg font-medium'>No Results Yet</p>
                                        <p>Process your images to see the results here.</p>
                                    </div>
                                ) : (
                                    <>
                                        {error && (
                                            <Alert variant="destructive" className="mb-4">
                                                {error.includes('overloaded') ? <ServerCrash className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                <AlertTitle>Extraction Failed</AlertTitle>
                                                <AlertDescription>{error}</AlertDescription>
                                            </Alert>
                                        )}
                                        <Accordion type="multiple" className="w-full" defaultValue={[`item-${extractedData.length - 1}`]}>
                                        {extractedData.map((result, index) => (
                                            <AccordionItem value={`item-${index}`} key={`${result.filename}-${index}`}>
                                            <AccordionTrigger>
                                                <div className='flex items-center justify-between w-full pr-4'>
                                                <div className='flex items-center gap-4'>
                                                    {isDemoData ? (
                                                        <div className="relative aspect-video w-24 flex items-center justify-center bg-secondary rounded-md">
                                                            <TestTube2 className="h-8 w-8 text-muted-foreground" />
                                                        </div>
                                                    ) : (
                                                     <div className="relative aspect-video w-24 flex items-center justify-center bg-secondary rounded-md">
                                                        <List className="h-8 w-8 text-muted-foreground" />
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
                                            </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                        </Accordion>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </main>
        
        {/* Action Footer */}
        <footer className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t p-4 z-10">
            <div className="container mx-auto max-w-7xl flex items-center justify-between">
                <div className='flex items-center gap-2'>
                  <Button onClick={!isDemoData ? handleGenerateDemoData : handleClearResults} variant="secondary" disabled={isLoading}>
                      <TestTube2 className="mr-2 h-4 w-4" />
                      {isDemoData ? 'Clear Demo' : 'Demo Data'}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                    {hasResults && (
                        <Button onClick={handleClearResults} variant="destructive" disabled={isLoading}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear All
                        </Button>
                    )}
                    {images.length > 0 ? (
                        <Button onClick={handleExtractData} className="min-w-[150px]" disabled={isLoading}>
                            {isLoading ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...</>
                            ) : (
                                <><Sparkles className="mr-2 h-5 w-5" /> Extract Data</>
                            )}
                        </Button>
                    ) : hasResults ? (
                        <>
                            <Button asChild variant="outline" disabled={allPlayers.length === 0}>
                                <Link href="/preview">
                                <TableIcon className="mr-2 h-4 w-4" />
                                Full Preview
                                </Link>
                            </Button>
                            <Button asChild variant="default" disabled={!isComplete}>
                                <Link href="/summary">
                                <ClipboardCheck className="mr-2 h-4 w-4" />
                                Final Summary
                                </Link>
                            </Button>
                        </>
                    ): null}
                </div>
            </div>
        </footer>
    </div>
  );
}
