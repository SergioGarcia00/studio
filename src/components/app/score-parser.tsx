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
import { useToast } from '@/hooks/use-toast';
import { extractTableDataFromImage } from '@/ai/flows/extract-table-data-from-image';
import type { ExtractTableDataFromImageOutput } from '@/ai/flows/extract-table-data-from-image';
import { exportToCsv } from '@/lib/csv-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

type Player = ExtractTableDataFromImageOutput['tableData'][0];

export default function ScoreParser() {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Player[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setExtractedData(null);
      setError(null);
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExtractData = async () => {
    if (!imageUrl) {
      toast({
        title: 'No image selected',
        description: 'Please upload an image first.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    setExtractedData(null);
    try {
      const result = await extractTableDataFromImage({ photoDataUri: imageUrl });
      if (result.tableData && result.tableData.length > 0) {
        setExtractedData(result.tableData);
        toast({
          title: 'Extraction Successful',
          description: 'Player data has been extracted from the image.',
          className: 'bg-accent text-accent-foreground'
        });
      } else {
        setError('Could not extract any data from the image. Please try another image or check the image quality.');
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
        if (e.message.includes('503')) {
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
    const validData = extractedData.filter(p => p.isValid).map(({isValid, ...rest}) => rest);
    if(validData.length === 0) {
      toast({
        title: 'No valid data to export',
        description: 'There are no valid player entries to export to CSV.',
        variant: 'destructive',
      });
      return;
    }
    exportToCsv(validData, 'scores.csv');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
      <div className="lg:col-span-2 space-y-8">
        <Card className='shadow-lg'>
          <CardHeader>
            <CardTitle>1. Upload Scoreboard</CardTitle>
            <CardDescription>Select or drop an image file of the scoreboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center w-full">
              <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                  <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag & drop</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP</p>
                </div>
                <input id="dropzone-file" type="file" className="hidden" onChange={handleImageChange} accept="image/png, image/jpeg, image/webp" />
              </label>
            </div>
            
            <Button onClick={handleExtractData} disabled={!image || isLoading} className="w-full text-lg py-6">
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

        {imageUrl && !isLoading && !extractedData && !error && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Image Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video w-full">
                <Image src={imageUrl} alt="Uploaded scoreboard" fill className="rounded-lg object-contain" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:col-span-3">
        {isLoading && (
            <Card className="shadow-lg min-h-[400px]">
                <CardHeader>
                    <CardTitle>Extracting Data...</CardTitle>
                    <CardDescription>The AI is analyzing your image. Please wait a moment.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center pt-10">
                    <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                    <p className='text-muted-foreground'>Performing AI magic...</p>
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
                <Button onClick={handleDownloadCsv} disabled={!extractedData || extractedData.filter(p => p.isValid).length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead>Player Name</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedData.map((player, index) => (
                      <TableRow key={index} className={!player.isValid ? 'bg-destructive/10 hover:bg-destructive/20' : ''}>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
        {!isLoading && !error && !extractedData && (
          <Card className="flex flex-col items-center justify-center h-full min-h-[400px] border-dashed shadow-inner">
            <CardContent className="text-center p-6">
              {imageUrl ? 
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
