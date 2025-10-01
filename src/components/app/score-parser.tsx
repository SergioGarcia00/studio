'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { extractRaceDataFromImage } from '@/ai/flows/extract-race-data-from-image';
import type { ExtractedData, MergedRaceData, Player, ValidatedRacePlayerResult, ExtractRaceDataFromImageInput, RacePlayerResult, ShockLog } from '@/ai/types';
import { exportToCsv } from '@/lib/csv-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RaceResultsPreview, type RaceResultsPreviewRef } from './race-results-preview';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';


type ImageQueueItem = {
  file: File;
  retries: number;
};

const RANK_TO_SCORE: { [key: string]: number } = {
  '1st': 15, '2nd': 12, '3rd': 10, '4th': 9, '5th': 8, '6th': 7,
  '7th': 6, '8th': 5, '9th': 4, '10th': 3, '11th': 2, '12th': 1,
};

const rankToScore = (rank: string | null): number => {
    if (!rank) return 0;
    return RANK_TO_SCORE[rank] || 0;
};

const sumRanks = (arr: (string|null)[]) => arr.reduce((acc: number, rank) => acc + rankToScore(rank), 0);

export default function ScoreParser() {
  const [images, setImages] = useState<File[]>([]);
  const [playerNames, setPlayerNames] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
  const [mergedData, setMergedData] = useState<MergedRaceData>({});
  const [shockLog, setShockLog] = useState<ShockLog>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [nextRaceNumber, setNextRaceNumber] = useState(1);
  const { toast } = useToast();
  const previewRef = useRef<RaceResultsPreviewRef>(null);

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

  const updateMergedDataWithRace = useCallback((raceResults: (RacePlayerResult & {isValid: boolean})[], raceNumber: number, masterPlayerList: string[]) => {
      setMergedData(prevData => {
        let updatedData = JSON.parse(JSON.stringify(prevData)) as MergedRaceData;
    
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
      });
  }, []);

  const handleToggleShock = (raceNumber: number, team: string) => {
    setShockLog(currentLog => {
      const newLog = { ...currentLog };
      const currentShockedTeam = newLog[raceNumber];
  
      if (currentShockedTeam === team) {
        // If the same team is clicked, remove the shock
        delete newLog[raceNumber];
      } else {
        // Otherwise, set the shock for this team
        newLog[raceNumber] = team;
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

    for (let i = 0; i < 12; i++) { // For each race
        const shuffledRanks = [...allRanks].sort(() => Math.random() - 0.5);
        
        // Assign ranks to players for the current race
        demoPlayers.forEach((name, pIndex) => {
            newMergedData[name].ranks[i] = shuffledRanks[pIndex];
        });

        // Assign one shock per race randomly to a team
        if (Math.random() < 0.8) { // 80% chance for a race to have a shock
          const shockedTeam = Math.random() < 0.5 ? blueTeamName : redTeamName;
          newShockLog[i + 1] = shockedTeam;
        }
    }
    
    // Set dummy extracted data for previewing shocks and individual race data
    const newExtractedData: ExtractedData[] = [];
    for (let i=0; i<12; i++) {
        newExtractedData.push({
            imageUrl: '',
            filename: `Demo Race ${i + 1}`,
            raceNumber: i + 1,
            data: demoPlayers.map(p => ({
                playerName: p,
                team: newMergedData[p].team,
                score: rankToScore(newMergedData[p].ranks[i]),
                rank: newMergedData[p].ranks[i]!,
                isValid: true,
            }))
        });
    }

    let finalData = recalculateAllTotals(newMergedData);

    // Ensure Vick is 8th
    const sortedPlayers = Object.values(finalData).sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    const vickPlayer = sortedPlayers.find(p => p.playerName === 'Vick');
    const eighthPlayer = sortedPlayers[7];

    if (vickPlayer && eighthPlayer && vickPlayer.playerName !== eighthPlayer.playerName) {
        // Swap total and rank between Vick and the 8th player
        const vickOriginalTotal = vickPlayer.total;
        const vickOriginalRank = vickPlayer.rank;

        vickPlayer.total = eighthPlayer.total;
        vickPlayer.rank = eighthPlayer.rank;

        eighthPlayer.total = vickOriginalTotal;
        eighthPlayer.rank = vickOriginalRank;

        // Re-assign to finalData object
        finalData[vickPlayer.playerName] = vickPlayer;
        finalData[eighthPlayer.playerName] = eighthPlayer;
    }
    
    setExtractedData(newExtractedData);
    setMergedData(finalData);
    setShockLog(newShockLog);

    setTimeout(() => {
        setIsLoading(false);
        toast({
            title: "Demo Data Generated",
            description: "12 races with 12 players have been created for you.",
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
    const newExtractedResults: ExtractedData[] = [];
    const providedPlayerNames = playerNames.split(',').map(name => name.trim()).filter(name => name.length > 0);
    let currentRaceNumber = nextRaceNumber;
    
    const readFileAsDataURL = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };
    
    let masterPlayerList = providedPlayerNames.length > 0 ? providedPlayerNames : Object.keys(mergedData);


    while (imageQueue.length > 0) {
      const item = imageQueue.shift();
      if (!item) continue;

      const { file, retries } = item;
      let newExtractedResult: ExtractedData | null = null;
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
        
        // The AI now returns the rank directly. No need to recalculate it from score.
        const finalRaceData = aiResult.map(player => ({
            ...player,
            // The rank is directly from the AI, ensure it's not null.
            rank: player.rank || '?th', 
        }));

        newExtractedResult = {
          imageUrl: url,
          filename: file.name,
          raceNumber: raceForThisImage,
          data: finalRaceData,
        };
        
        if (masterPlayerList.length === 0 && finalRaceData.some(d => d.isValid)) {
            masterPlayerList = finalRaceData.filter(r => r.isValid).map(r => r.playerName);
        }

        if(finalRaceData.some(d => d.isValid)) {
          updateMergedDataWithRace(finalRaceData, raceForThisImage, masterPlayerList);
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
              newExtractedResult = {
                  imageUrl: URL.createObjectURL(file),
                  filename: file.name,
                  raceNumber: raceForThisImage,
                  data: [],
              };
              processedCount++;
              toast({
                  title: `Failed to process '${file.name}'`,
                  description: e.message || 'An unknown error occurred.',
                  variant: 'destructive',
              });
          }
      }
      
      if(newExtractedResult){
          newExtractedResults.push(newExtractedResult);
      }
      setProgress((processedCount / images.length) * 100);
    }
    
    setExtractedData(prev => [...prev, ...newExtractedResults].sort((a,b) => a.raceNumber - b.raceNumber));
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
    
    const shockedTeam = shockLog[raceData.raceNumber];

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
    setExtractedData([]);
    setMergedData({});
    setImages([]);
    setError(null);
    setProgress(0);
    setNextRaceNumber(1);
    setPlayerNames('');
    setShockLog({});
    toast({
        title: "Results Cleared",
        description: "The review and download area has been cleared.",
    });
  }

  const allPlayers = useMemo(() => Object.values(mergedData), [mergedData]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
      <div className="lg:col-span-2 space-y-8">
        <Card className='shadow-lg'>
          <CardHeader>
            <CardTitle>1. Upload Race Scoreboards</CardTitle>
            <CardDescription>Select or drop race images one by one or in a batch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center w-full">
              <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                  <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag & drop</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP (up to 12 files)</p>
                </div>
                <input id="dropzone-file" type="file" className="hidden" onChange={handleImageChange} accept="image/png, image/jpeg, image/webp" multiple disabled={nextRaceNumber > 12} />
              </label>
            </div>
             {nextRaceNumber > 12 && <p className='text-sm text-center text-destructive'>Maximum of 12 races reached.</p>}
          </CardContent>
        </Card>

        <Card className='shadow-lg'>
          <CardHeader>
            <CardTitle>Optional: Provide Player Names</CardTitle>
            <CardDescription>Enter a comma-separated list of the 12 player names to guide the AI. Best to do this before uploading any images.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="e.g. Player 1, Player 2, Player 3, ..."
              value={playerNames}
              onChange={(e) => setPlayerNames(e.target.value)}
              rows={4}
              disabled={isLoading || extractedData.length > 0}
            />
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button onClick={handleExtractData} disabled={images.length === 0 || isLoading} className="w-full text-lg py-6">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                2. Extract Race Data
              </>
            )}
          </Button>
          <Button onClick={handleGenerateDemoData} variant="secondary" className="w-full" disabled={isLoading}>
            <TestTube2 className="mr-2 h-5 w-5" />
            Generate Demo Data
          </Button>
        </div>


        {images.length > 0 && !isLoading && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Queued Images ({images.length})</CardTitle>
            </CardHeader>
            <CardContent className='grid grid-cols-2 md:grid-cols-3 gap-2'>
              {images.map((file, index) => (
                <div key={index} className="relative aspect-video w-full">
                  <Image src={URL.createObjectURL(file)} alt={`Uploaded scoreboard ${index+1}`} fill className="rounded-lg object-contain" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:col-span-3">
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
                        <p className='text-muted-foreground mb-4'>Processing race {Math.min(Math.floor(progress / (100 / images.length)) + nextRaceNumber, 12)} of 12... ({Math.round(progress)}%)</p>
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
        {extractedData.length > 0 && !isLoading && (
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>3. Review &amp; Download</CardTitle>
                  <CardDescription>Review extracted data and download or preview results.</CardDescription>
                </div>
                <div className='flex items-center gap-2 flex-wrap'>
                   <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" disabled={allPlayers.length === 0}>
                                <TableIcon className="mr-2 h-4 w-4" />
                                Preview Results
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-7xl">
                            <DialogHeader className="flex-row items-center justify-between">
                                <DialogTitle>Race Results Preview</DialogTitle>
                                <Button variant="outline" onClick={() => previewRef.current?.downloadAsPng()} disabled={allPlayers.length === 0}>
                                    <ImageDown className="mr-2 h-4 w-4" />
                                    Download PNG
                                </Button>
                            </DialogHeader>
                            <RaceResultsPreview ref={previewRef} data={allPlayers as Player[]} shockLog={shockLog} />
                        </DialogContent>
                    </Dialog>
                     <Button onClick={handleClearResults} variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Clear Results</span>
                    </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full" defaultValue={extractedData.map((_, i) => `item-${i}`)}>
                {extractedData.map((result, index) => (
                  <AccordionItem value={`item-${index}`} key={`${result.filename}-${index}`}>
                    <AccordionTrigger>
                        <div className='flex items-center justify-between w-full pr-4'>
                          <div className='flex items-center gap-4'>
                              {result.imageUrl ? (
                                <div className="relative aspect-video w-24">
                                    <Image src={result.imageUrl} alt={`Scoreboard ${index + 1}`} fill className="rounded-md object-contain" />
                                </div>
                              ) : (
                                <div className="relative aspect-video w-24 flex items-center justify-center bg-secondary rounded-md">
                                  <TestTube2 className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                              <div className='text-left'>
                                  <p className='font-semibold'>{result.filename} (Race {result.raceNumber})</p>
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
                              <TableHead>Rank</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.data.length > 0 ? result.data.map((player, pIndex) => (
                              <TableRow key={pIndex} className={!player.isValid ? 'bg-destructive/10 hover:bg-destructive/20' : ''}>
                                <TableCell className='font-medium'>{player.playerName || 'N/A'}</TableCell>
                                <TableCell>{player.team || 'N/A'}</TableCell>
                                <TableCell className="text-right font-mono">{player.score ?? 'N/A'}</TableCell>
                                <TableCell className='font-bold'>{player.rank || 'N/A'}</TableCell>
                              </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">No data extracted from this image.</TableCell>
                                </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <div className='flex items-center justify-end gap-2 mt-4 p-2 border-t'>
                          <span className='text-sm font-medium mr-2'>Shock:</span>
                          <Button 
                              size="sm" 
                              onClick={() => handleToggleShock(result.raceNumber, 'JJ (BLUE)')}
                              className={cn(
                                'border-blue-500 text-blue-500',
                                shockLog[result.raceNumber] === 'JJ (BLUE)' ? 'bg-blue-500/20' : 'bg-transparent'
                              )}
                              variant={shockLog[result.raceNumber] === 'JJ (BLUE)' ? 'secondary' : 'outline'}
                          >
                            <Zap className="mr-2 h-4 w-4" />
                            Rayo Azul
                          </Button>
                          <Button 
                              size="sm"
                              onClick={() => handleToggleShock(result.raceNumber, 'DS (RED)')}
                              className={cn(
                                'border-red-500 text-red-500',
                                shockLog[result.raceNumber] === 'DS (RED)' ? 'bg-red-500/20' : 'bg-transparent'
                              )}
                               variant={shockLog[result.raceNumber] === 'DS (RED)' ? 'secondary' : 'outline'}
                          >
                             <Zap className="mr-2 h-4 w-4" />
                            Rayo Rojo
                          </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
        {!isLoading && extractedData.length === 0 && (
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
  );
}
