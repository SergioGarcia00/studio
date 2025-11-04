'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/app/header';
import FinalSummary from '@/components/app/final-summary';

export default function SummaryPage() {

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <Header />
            <div className="flex-1 overflow-auto p-4">
                <div className="container mx-auto">
                    <div className="flex justify-start mb-4">
                        <Button asChild variant="outline" className='bg-gray-800 border-gray-700 hover:bg-gray-700'>
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Main Page
                            </Link>
                        </Button>
                    </div>
                    <FinalSummary />
                </div>
            </div>
        </div>
    );
}
