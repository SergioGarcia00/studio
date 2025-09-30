import Header from '@/components/app/header';
import ScoreParser from '@/components/app/score-parser';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto py-8 px-4">
        <ScoreParser />
      </main>
    </div>
  );
}
