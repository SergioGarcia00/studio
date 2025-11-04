'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/app/header';
import { RaceResultsPreview, type RaceResultsPreviewRef } from '@/components/app/race-results-preview';
import { Button } from '@/components/ui/button';
import { FileDown, ImageDown, ArrowLeft } from 'lucide-react';
import { useResultsStore } from '@/lib/store';

export default function PreviewPage() {
    const previewRef = useRef<RaceResultsPreviewRef>(null);
    const { mergedData } = useResultsStore();
    const allPlayers = Object.values(mergedData);

    return (
        <div className="flex flex-col h-full bg-background">
            <Header />
            <div className="flex-1 overflow-auto">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                        <h1 className="text-2xl font-bold">Race Results</h1>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <Button asChild variant="outline">
                            <Link href="/">
                              <ArrowLeft className="mr-2 h-4 w-4" />
                              Volver a la página principal
                            </Link>
                          </Button>
                          <Button variant="outline" onClick={() => previewRef.current?.downloadAsCsv()} disabled={allPlayers.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export to Excel
                          </Button>
                          <Button variant="outline" onClick={() => previewRef.current?.downloadAsPng()} disabled={allPlayers.length === 0}>
                            <ImageDown className="mr-2 h-4 w-4" />
                            Create PNG
                          </Button>
                        </div>
                    </div>
                    <RaceResultsPreview ref={previewRef} />
                </div>
            </div>
        </div>
    );
}
