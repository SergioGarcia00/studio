'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/app/header';
import FinalSummary from '@/components/app/final-summary';
import SummarySettings from '@/components/app/summary-settings';

export default function SummaryPage() {

    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            <Header />
            <div className="flex-1 overflow-auto p-4">
                <div className="container mx-auto">
                    <div className="flex justify-start mb-4">
                        <Button asChild variant="outline">
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Main Page
                            </Link>
                        </Button>
                    </div>
                    <FinalSummary />
                    <SummarySettings />
                </div>
            </div>
        </div>
    );
}
