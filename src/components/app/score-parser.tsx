'use client';

import { useState, useMemo, useEffect } from 'react';
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
import type { ExtractedData, MergedRaceData, Player, ValidatedRacePlayerResult, ExtractRaceDataFromImageInput } from '@/ai/types';
import { exportToCsv } from '@/lib/csv-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RaceResultsPreview } from './race-results-preview';
import { findBestMatch } from 'string-similarity';
import { Textarea } from '../ui/textarea';


type ImageQueueItem = {
  file: File;
  retries: number;
};

type MergedPlayerInfo = {
  from: string;
  to: string;
};

const RANK_TO_SCORE: { [key: string]: number } = {
  '1st': 15, '2nd': 12, '3rd': 10, '4th': 9, '5th': 8, '6th': 7,
  '7th': 6, '8th': 5, '9th': 4, '10th': 3, '11th': 2, '12th': 1,
};

const rankToScore = (rank: string | null): number => {
    if (!rank) return 0;
    return RANK_TO_SCORE[rank] || 0;
};


export default function ScoreParser() {
  const [images, setImages] = useState<File[]>([]);
  const [playerNames, setPlayerNames] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
  const [mergedData, setMergedData] = useState<MergedRaceData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [lastForcedMerge, setLastForcedMerge] = useState<MergedPlayerInfo | null>(null);
  const [nextRaceNumber, setNextRaceNumber] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    if (lastForcedMerge) {
      toast({
        title: 'Player Merged',
        description: `"${lastForcedMerge.from}" was merged with "${lastForcedMerge.to}" to keep the player count at 12.`,
      });
      setLastForcedMerge(null); // Reset after showing toast
    }
  }, [lastForcedMerge, toast]);

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
      .replace(/^(DS|JJ|D\$)[-\s.]*/i, '')
      .replace(/[^\w\s]/gi, '')
      .trim();
  }


  const updateMergedData = (raceResults: ValidatedRacePlayerResult[], raceNumber: number) => {
    const newForcedMerges: MergedPlayerInfo[] = [];
    
    setMergedData(prevData => {
      let updatedData = JSON.parse(JSON.stringify(prevData)) as MergedRaceData;
      const existingPlayerNames = Object.keys(updatedData);

      const normalizedMap = existingPlayerNames.reduce((acc, name) => {
          acc[normalizePlayerName(name)] = name;
          return acc;
      }, {} as {[key: string]: string});
      const normalizedExistingNames = Object.keys(normalizedMap);


      for (const racePlayer of raceResults) {
        if (!racePlayer.isValid || !racePlayer.playerName) continue;

        const normalizedNewName = normalizePlayerName(racePlayer.playerName);
        let bestMatchName = racePlayer.playerName;
        let isNewPlayer = true;

        if (normalizedExistingNames.length > 0) {
            const { bestMatch } = findBestMatch(normalizedNewName, normalizedExistingNames);
            if (bestMatch.rating > 0.6) { // Adjusted threshold for better matching
                bestMatchName = normalizedMap[bestMatch.target];
                isNewPlayer = false;
            }
        }
        
        if (isNewPlayer && existingPlayerNames.length >= 12 && normalizedExistingNames.length > 0) {
            const { bestMatch } = findBestMatch(normalizedNewName, normalizedExistingNames);
            bestMatchName = normalizedMap[bestMatch.target];
            isNewPlayer = false;
            newForcedMerges.push({ from: racePlayer.playerName, to: bestMatchName });
        }

        if (isNewPlayer && (!updatedData[bestMatchName] || Object.keys(updatedData).length < 12)) {
            updatedData[bestMatchName] = {
                playerName: bestMatchName,
                team: racePlayer.team,
                ranks: Array(12).fill(null),
                shocks: [],
                gp1: null,
                gp2: null,
                gp3: null,
                total: null,
                rank: null,
                isValid: true,
            };
        }
        
        const mergedPlayer = updatedData[bestMatchName];
        if (!mergedPlayer) continue;

        if (raceNumber >= 1 && raceNumber <= 12) {
          mergedPlayer.ranks[raceNumber - 1] = racePlayer.rank;
        }
        
        // Only update the team if it's not already set to a more specific value
        if (racePlayer.team && (!mergedPlayer.team || !mergedPlayer.team.includes('('))) {
            mergedPlayer.team = racePlayer.team;
        }
        
        if(racePlayer.shocked) {
            if (!mergedPlayer.shocks.includes(raceNumber)) {
                mergedPlayer.shocks.push(raceNumber);
            }
        }
      }

      Object.values(updatedData).forEach(player => {
        const sumRanks = (arr: (string|null)[]) => arr.reduce((acc: number, rank) => acc + rankToScore(rank), 0);
        
        const gp1Ranks = player.ranks.slice(0, 4);
        const gp2Ranks = player.ranks.slice(4, 8);
        const gp3Ranks = player.ranks.slice(8, 12);

        if (gp1Ranks.some(r => r !== null)) player.gp1 = sumRanks(gp1Ranks);
        if (gp2Ranks.some(r => r !== null)) player.gp2 = sumRanks(gp2Ranks);
        if (gp3Ranks.some(r => r !== null)) player.gp3 = sumRanks(gp3Ranks);

        player.total = sumRanks(player.ranks);
      });
      
      const sortedPlayers = Object.values(updatedData).sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
      sortedPlayers.forEach((p, index) => {
        if(updatedData[p.playerName]){
            const rankSuffix = ['st', 'nd', 'rd'][index] ?? 'th';
            updatedData[p.playerName].rank = `${index + 1}${rankSuffix}`;
        }
      });


      return updatedData;
    });

    if (newForcedMerges.length > 0) {
      setLastForcedMerge(newForcedMerges[newForcedMerges.length - 1]);
    }
  }

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
        
        const existingPlayerNames = Object.keys(mergedData);
        if (raceForThisImage === 1 && providedPlayerNames.length > 0) {
            input.playerNames = providedPlayerNames;
        } else if (existingPlayerNames.length > 0) {
            input.playerNames = existingPlayerNames;
        }


        const result = await extractRaceDataFromImage(input);
        
        newExtractedResult = {
          imageUrl: url,
          filename: file.name,
          raceNumber: raceForThisImage,
          data: result,
        };
        
        if(result.some(d => d.isValid)) {
          updateMergedData(result, raceForThisImage);
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
    const teamA = teams[0] || 'Team A';
    const teamB = teams[1] || 'Team B';
    
    const shocksTeamA = raceData.data.filter(p => p.shocked && allPlayersInApp.find(ap => ap.playerName === p.playerName)?.team === teamA).length;
    const shocksTeamB = raceData.data.filter(p => p.shocked && allPlayersInApp.find(ap => ap.playerName === p.playerName)?.team === teamB).length;


    const csvData = raceData.data.map(player => {
      return {
        timestamp: new Date().toISOString(),
        race: raceData.raceNumber,
        team: player.team,
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

        {images.length > 0 && !isLoading && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Images Queued ({images.length})</CardTitle>
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
                    <CardTitle>Extracting Data...</CardTitle>
                    <CardDescription>The AI is analyzing your image(s). Please wait a moment.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center pt-10">
                    <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                    <p className='text-muted-foreground mb-4'>Processing race {Math.min(Math.floor(progress / (100 / images.length)) + nextRaceNumber, 12)} of 12... ({Math.round(progress)}%)</p>
                    <Progress value={progress} className="w-3/4" />
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
                  <CardTitle>3. Review & Download</CardTitle>
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
                            <DialogHeader>
                                <DialogTitle>Race Results Preview</DialogTitle>
                            </DialogHeader>
                            <RaceResultsPreview data={allPlayers as Player[]} />
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
                              <div className="relative aspect-video w-24">
                                  <Image src={result.imageUrl} alt={`Scoreboard ${index + 1}`} fill className="rounded-md object-contain" />
                              </div>
                              <div className='text-left'>
                                  <p className='font-semibold'>{result.filename} (Race {result.raceNumber})</p>
                                  <p className='text-sm text-muted-foreground'>{result.data.filter(p => p.isValid).length} valid records</p>
                              </div>
                          </div>
                           <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadSingleRaceCsv(result);
                              }}
                              aria-label="Download CSV for this race"
                            >
                              <Download className='h-5 w-5 text-muted-foreground' />
                           </Button>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                       <div className='overflow-x-auto max-h-[60vh]'>
                        <Table>
                          <TableHeader className='sticky top-0 bg-card'>
                            <TableRow>
                              <TableHead>Player Name</TableHead>
                              <TableHead>Team</TableHead>
                              <TableHead className="text-right">Score</TableHead>
                              <TableHead>Rank</TableHead>
                              <TableHead>Shock</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.data.length > 0 ? result.data.map((player, pIndex) => (
                              <TableRow key={pIndex} className={!player.isValid ? 'bg-destructive/10 hover:bg-destructive/20' : ''}>
                                <TableCell className='font-medium'>{player.playerName || 'N/A'}</TableCell>
                                <TableCell>{player.team || 'N/A'}</TableCell>
                                <TableCell className="text-right font-mono">{player.score ?? 'N/A'}</TableCell>
                                <TableCell className='font-bold'>{player.rank || 'N/A'}</TableCell>
                                <TableCell>{player.shocked ? <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" /> : ''}</TableCell>
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

    