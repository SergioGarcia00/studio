'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  FileUp,
  Loader2,
  Sparkles,
  Download,
  CheckCircle2,
  XCircle,
  FileImage,
  ServerCrash,
  TableIcon,
  Trash2,
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
import { extractTableDataFromImage } from '@/ai/flows/extract-table-data-from-image';
import type { ExtractedData, RawPlayer, MergedPlayer, MergedRaceData, Player, ProcessedPlayer } from '@/ai/types';
import { exportToCsv } from '@/lib/csv-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RaceResultsPreview } from './race-results-preview';

type ImageQueueItem = {
  file: File;
  retries: number;
};


export default function ScoreParser() {
  const [images, setImages] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
  const [mergedData, setMergedData] = useState<MergedRaceData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files).slice(0, 12);
      if (files.length > 12) {
        toast({
          title: 'Too many files',
          description: 'You can upload a maximum of 12 images at a time.',
          variant: 'destructive',
        });
      }
      setError(null);
      setImages(fileArray);
    }
  };

  const updateMergedData = (newRawPlayers: ProcessedPlayer[]) => {
    setMergedData(prevData => {
      const updatedData = JSON.parse(JSON.stringify(prevData)) as MergedRaceData;

      for (const rawPlayer of newRawPlayers) {
        if (!rawPlayer.isValid) continue;

        const pName = rawPlayer.playerName;
        if (!updatedData[pName]) {
          updatedData[pName] = {
            playerName: pName,
            team: rawPlayer.team,
            scores: Array(12).fill(null),
            gp1: null,
            gp2: null,
            gp3: null,
            total: null,
            rank: null,
            isValid: true,
          };
        }
        
        const mergedPlayer = updatedData[pName];
        mergedPlayer.team = rawPlayer.team || mergedPlayer.team;
        mergedPlayer.rank = rawPlayer.rank || mergedPlayer.rank;
        mergedPlayer.total = rawPlayer.total ?? mergedPlayer.total;

        // Merge GP scores
        if (rawPlayer.gp1 !== null) mergedPlayer.gp1 = rawPlayer.gp1;
        if (rawPlayer.gp2 !== null) mergedPlayer.gp2 = rawPlayer.gp2;
        if (rawPlayer.gp3 !== null) mergedPlayer.gp3 = rawPlayer.gp3;
      }
      return updatedData;
    });
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

      try {
        const url = await readFileAsDataURL(file);
        const result = await extractTableDataFromImage({ photoDataUri: url });
        
        const processedResultData = result.tableData.map(d => ({
            ...d,
            isValid: !!d.playerName && d.playerName.trim() !== '',
        }));

        newExtractedResult = {
          imageUrl: url,
          filename: file.name,
          data: processedResultData,
        };

        if(processedResultData.some(d => d.isValid)) {
          updateMergedData(processedResultData);
        }
        processedCount++;

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
    
    setExtractedData(prev => [...prev, ...newExtractedResults]);

    toast({
      title: 'Extraction Complete',
      description: `Data processing finished for ${images.length} image(s).`,
      className: 'bg-accent text-accent-foreground'
    });
    setImages([]); // Clear selection
    setIsLoading(false);
  };

  const handleDownloadCsv = () => {
    if (Object.keys(mergedData).length === 0) {
       toast({
        title: 'No data to export',
        description: 'There are no player entries to export to CSV.',
        variant: 'destructive',
      });
      return;
    }

    const allValidData = Object.values(mergedData).map(p => ({
        playerName: p.playerName,
        team: p.team,
        ...Array.from({length: 12}).reduce((acc, _, i) => ({ ...acc, [`race${i+1}`]: p.scores[i] }), {}),
        gp1: p.gp1,
        gp2: p.gp2,
        gp3: p.gp3,
        total: p.total,
        rank: p.rank,
    }));
    
    const headers = [
        'Player Name', 'Team',
        ...Array.from({length: 12}, (_, i) => `Race ${i+1}`),
        'GP1', 'GP2', 'GP3', 'Total', 'Rank'
    ];
    
    exportToCsv(allValidData, 'merged_scores.csv', headers);
  };
  
  const handleClearResults = () => {
    setExtractedData([]);
    setMergedData({});
    setImages([]);
    setError(null);
    setProgress(0);
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
            <CardTitle>1. Upload Scoreboards</CardTitle>
            <CardDescription>Select or drop up to 12 images.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center w-full">
              <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                  <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag & drop</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP (up to 12 files)</p>
                </div>
                <input id="dropzone-file" type="file" className="hidden" onChange={handleImageChange} accept="image/png, image/jpeg, image/webp" multiple />
              </label>
            </div>
            
            <Button onClick={handleExtractData} disabled={images.length === 0 || isLoading} className="w-full text-lg py-6">
              {isLoading ? (
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
          </CardContent>
        </Card>

        {images.length > 0 && !isLoading && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Image Previews ({images.length})</CardTitle>
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
                    <p className='text-muted-foreground mb-4'>Processing image {Math.min(Math.floor(progress / (100 / images.length)) + 1, images.length)} of {images.length}... ({Math.round(progress)}%)</p>
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
                    <Button onClick={handleDownloadCsv} disabled={allPlayers.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Download CSV
                    </Button>
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
                        <div className='flex items-center gap-4'>
                            <div className="relative aspect-video w-24">
                                <Image src={result.imageUrl} alt={`Scoreboard ${index + 1}`} fill className="rounded-md object-contain" />
                            </div>
                            <div className='text-left'>
                                <p className='font-semibold'>{result.filename}</p>
                                <p className='text-sm text-muted-foreground'>{result.data.filter(p => p.isValid).length} valid records</p>
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
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead>Rank</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.data.length > 0 ? result.data.map((player, pIndex) => (
                              <TableRow key={pIndex} className={!player.isValid ? 'bg-destructive/10 hover:bg-destructive/20' : ''}>
                                <TableCell className='font-medium'>{player.playerName || 'N/A'}</TableCell>
                                <TableCell>{player.team || 'N/A'}</TableCell>
                                <TableCell className="text-right font-mono">{player.total ?? 'N/A'}</TableCell>
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
                        Upload an image and click "Extract Data" to see the magic.
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

    