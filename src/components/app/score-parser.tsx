'use client';

import { useState } from 'react';
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
import type { ExtractTableDataFromImageOutput } from '@/ai/flows/extract-table-data-from-image';
import { exportToCsv } from '@/lib/csv-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Player = ExtractTableDataFromImageOutput['tableData'][0];
type ExtractedData = {
  imageUrl: string;
  filename: string;
  data: Player[];
};

export default function ScoreParser() {
  const [images, setImages] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData[] | null>(null);
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
      setExtractedData(null);
      setError(null);
      setImages(fileArray);
    }
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
    setExtractedData(null);
    setProgress(0);
    
    const allData: ExtractedData[] = [];
    
    // Create a function to read file as data URL
    const readFileAsDataURL = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    try {
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        try {
          const url = await readFileAsDataURL(file);
          const result = await extractTableDataFromImage({ photoDataUri: url });
          allData.push({
            imageUrl: url,
            filename: file.name,
            data: result.tableData,
          });
        } catch (e) {
            console.error(`Failed to process image ${file.name}:`, e);
        }
        setProgress(((i + 1) / images.length) * 100);
      }

      if (allData.length > 0 && allData.some(d => d.data.length > 0)) {
        setExtractedData(allData);
        toast({
          title: 'Extraction Successful',
          description: `Player data has been extracted from ${images.length} image(s).`,
          className: 'bg-accent text-accent-foreground'
        });
      } else {
        setError('Could not extract any data from the images. Please try other images or check the image quality.');
        toast({
          title: 'Extraction Failed',
          description: 'No data could be extracted.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error(e);
      let errorMessage = 'An unknown error occurred.';
      if (e instanceof Error) {
        if (e.message.includes('overloaded')) {
            errorMessage = 'The AI model is currently overloaded. Please try again in a moment.';
        } else {
            errorMessage = e.message;
        }
      }
      setError(errorMessage);
      toast({
        title: 'Extraction Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!extractedData) return;
    
    const allValidData = extractedData.flatMap(result => 
        result.data
            .filter(p => p.isValid)
            .map(p => ({
                playerName: p.playerName,
                team: p.team,
                score: p.score,
                image: result.filename
            }))
    );

    if (allValidData.length === 0) {
      toast({
        title: 'No valid data to export',
        description: 'There are no valid player entries to export to CSV.',
        variant: 'destructive',
      });
      return;
    }
    
    exportToCsv(allValidData, 'scores.csv', ['Player Name', 'Team', 'Score', 'Image']);
  };

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

        {images.length > 0 && !isLoading && !extractedData && !error && (
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
                    <p className='text-muted-foreground mb-4'>Processing image {Math.floor(progress / (100 / images.length))} of {images.length}... ({Math.round(progress)}%)</p>
                    <Progress value={progress} className="w-3/4" />
                </CardContent>
            </Card>
        )}
        {error && (
          <Alert variant="destructive">
            {error.includes('overloaded') ? <ServerCrash className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <AlertTitle>Extraction Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {extractedData && (
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>3. Review & Download</CardTitle>
                  <CardDescription>Review the extracted data and download the CSV.</CardDescription>
                </div>
                <Button onClick={handleDownloadCsv} disabled={!extractedData || extractedData.flatMap(r => r.data).filter(p => p.isValid).length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Download All as CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full" defaultValue={extractedData.map((_, i) => `item-${i}`)}>
                {extractedData.map((result, index) => (
                  <AccordionItem value={`item-${index}`} key={index}>
                    <AccordionTrigger>
                        <div className='flex items-center gap-4'>
                            <div className="relative aspect-video w-24">
                                <Image src={result.imageUrl} alt={`Scoreboard ${index + 1}`} fill className="rounded-md object-contain" />
                            </div>
                            <div className='text-left'>
                                <p className='font-semibold'>{result.filename}</p>
                                <p className='text-sm text-muted-foreground'>{result.data.length} records found</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                       <div className='overflow-x-auto max-h-[60vh]'>
                        <Table>
                          <TableHeader className='sticky top-0 bg-card'>
                            <TableRow>
                              <TableHead className="w-[120px]">Status</TableHead>
                              <TableHead>Player Name</TableHead>
                              <TableHead>Team</TableHead>
                              <TableHead className="text-right">Score</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.data.length > 0 ? result.data.map((player, pIndex) => (
                              <TableRow key={pIndex} className={!player.isValid ? 'bg-destructive/10 hover:bg-destructive/20' : ''}>
                                <TableCell>
                                  {player.isValid ? (
                                    <span className="flex items-center font-medium text-emerald-600">
                                      <CheckCircle2 className="h-4 w-4 mr-2" /> Valid
                                    </span>
                                  ) : (
                                    <span className="flex items-center font-medium text-destructive">
                                      <XCircle className="h-4 w-4 mr-2" /> Invalid
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className='font-medium'>{player.playerName || 'N/A'}</TableCell>
                                <TableCell>{player.team || 'N/A'}</TableCell>
                                <TableCell className="text-right font-mono">{player.score ?? 'N/A'}</TableCell>
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
        {!isLoading && !error && !extractedData && (
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
