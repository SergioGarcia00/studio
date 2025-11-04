import { ScanSearch } from 'lucide-react';
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="border-b bg-card sticky top-0 z-10 bg-background/50 backdrop-blur-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <ScanSearch className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            ScoreParser
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;
