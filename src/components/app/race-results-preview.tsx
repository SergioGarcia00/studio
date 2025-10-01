'use client';

import { useMemo, forwardRef, useRef, useImperativeHandle } from 'react';
import type { Player, ShockLog } from '@/ai/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import React from 'react';
import html2canvas from 'html2canvas';
import { exportToCsv } from '@/lib/csv-utils';
import { Button } from '../ui/button';
import { FileDown, ImageDown, Zap } from 'lucide-react';

interface RaceResultsPreviewProps {
  data: Player[];
  shockLog: ShockLog;
}

export interface RaceResultsPreviewRef {
  downloadAsPng: () => void;
  downloadAsCsv: () => void;
}

const RANK_TO_SCORE: { [key: string]: number } = {
  '1st': 15, '2nd': 12, '3rd': 10, '4th': 9, '5th': 8, '6th': 7,
  '7th': 6, '8th': 5, '9th': 4, '10th': 3, '11th': 2, '12th': 1,
};

const rankToScore = (rank: string | null): number => {
    if (!rank) return 0;
    return RANK_TO_SCORE[rank] || 0;
};

const getRankClass = (rank: string | null) => {
    if (!rank) return '';
    if (rank === '1st') return 'bg-yellow-400/70 text-black font-bold';
    if (rank === '2nd') return 'bg-slate-300/70 text-black font-bold';
    if (rank === '3rd') return 'bg-orange-400/70 text-black font-bold';
    return '';
};

const ShockIcon = ({ className }: { className?: string }) => (
  <Zap
    className={cn("h-5 w-5 text-yellow-400 fill-yellow-400 mx-auto", className)}
  />
);


export const RaceResultsPreview = forwardRef<RaceResultsPreviewRef, RaceResultsPreviewProps>(({ data, shockLog }, ref) => {
  const printRef = useRef<HTMLDivElement>(null);

    const groupedData = useMemo(() => {
    const validPlayers = data.filter(player => player.isValid);
    const groups: { [key: string]: Player[] } = {};
    
    validPlayers.forEach(player => {
      const team = player.team || 'Unassigned';
      if (!groups[team]) {
        groups[team] = [];
      }
      groups[team].push(player);
    });

    const rankToNumber = (rank: string | null): number => {
        if (!rank) return 99;
        const num = parseInt(rank.replace(/\D/g, ''), 10);
        return isNaN(num) ? 99 : num;
    };

    Object.keys(groups).forEach(team => {
        groups[team].sort((a, b) => rankToNumber(a.rank) - rankToNumber(b.rank));
    });
    
    const teamOrder = Object.keys(groups).sort((a, b) => {
        const aIsBlue = a.toLowerCase().includes('blue');
        const bIsBlue = b.toLowerCase().includes('red');
        if (aIsBlue && !bIsBlue) return -1;
        if (!aIsBlue && bIsBlue) return 1;
        return 0;
    });

    return Object.fromEntries(teamOrder.map(team => [team, groups[team]]));
  }, [data]);
  
  const blueTeamName = Object.keys(groupedData).find(team => team.toLowerCase().includes('blue'));
  const redTeamName = Object.keys(groupedData).find(team => team.toLowerCase().includes('red'));

  const teamStats = useMemo(() => {
    const bluePlayers = blueTeamName ? groupedData[blueTeamName] : [];
    const redPlayers = redTeamName ? groupedData[redTeamName] : [];

    const calculateTeamScores = (players: Player[]) => {
      const raceScores = Array(12).fill(0);
      players.forEach(p => {
        p.ranks.forEach((rank, i) => {
          raceScores[i] += rankToScore(rank);
        });
      });
      const gp1 = raceScores.slice(0, 4).reduce((a, b) => a + b, 0);
      const gp2 = raceScores.slice(4, 8).reduce((a, b) => a + b, 0);
      const gp3 = raceScores.slice(8, 12).reduce((a, b) => a + b, 0);
      const total = gp1 + gp2 + gp3;
      return { raceScores, gp1, gp2, gp3, total };
    };

    const blueScores = calculateTeamScores(bluePlayers);
    const redScores = calculateTeamScores(redPlayers);

    const raceDifference = blueScores.raceScores.map((bs, i) => bs - redScores.raceScores[i]);
    const gp1Diff = blueScores.gp1 - redScores.gp1;
    const gp2Diff = blueScores.gp2 - redScores.gp2;
    const gp3Diff = blueScores.gp3 - redScores.gp3;
    const totalDiff = blueScores.total - redScores.total;

    return {
      blue: { name: blueTeamName || 'Team Blue', ...blueScores },
      red: { name: redTeamName || 'Team Red', ...redScores },
      diff: { raceScores: raceDifference, gp1: gp1Diff, gp2: gp2Diff, gp3: gp3Diff, total: totalDiff },
    };
  }, [groupedData, blueTeamName, redTeamName]);


  useImperativeHandle(ref, () => ({
    downloadAsPng: async () => {
      const element = printRef.current;
      if (!element) return;
  
      // The element to capture is the direct child of the scroll area's viewport
      const captureTarget = element.querySelector<HTMLElement>(':scope > div > table');
      if (!captureTarget) return;

      const clonedElement = captureTarget.cloneNode(true) as HTMLElement;
      
      // Prepare the clone for off-screen rendering to get the full size
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0px';
      clonedElement.style.width = `${captureTarget.scrollWidth}px`;
      clonedElement.style.height = 'auto'; // Let it expand to full height
      
      document.body.appendChild(clonedElement);
      
      const backgroundColorHsl = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
      
      const canvas = await html2canvas(clonedElement, {
          scale: 2,
          backgroundColor: `hsl(${backgroundColorHsl})`,
          useCORS: true,
          allowTaint: true,
          scrollX: 0,
          scrollY: -window.scrollY,
          windowWidth: clonedElement.scrollWidth,
          windowHeight: clonedElement.scrollHeight,
      });

      document.body.removeChild(clonedElement);
      
      const data = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = data;
      link.download = 'race-results.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    downloadAsCsv: () => {
        const csvData: any[] = [];
        const headers = ['Player', 'R1', 'R2', 'R3', 'R4', 'GP1', 'R5', 'R6', 'R7', 'R8', 'GP2', 'R9', 'R10', 'R11', 'R12', 'GP3', 'Rank', 'Total'];

        const teamEntries = Object.entries(groupedData);

        teamEntries.forEach(([team, players], teamIndex) => {
            csvData.push({Player: team}); // Team name row
            players.forEach(p => {
                csvData.push({
                    Player: p.playerName,
                    R1: rankToScore(p.ranks[0]), R2: rankToScore(p.ranks[1]), R3: rankToScore(p.ranks[2]), R4: rankToScore(p.ranks[3]),
                    GP1: p.gp1,
                    R5: rankToScore(p.ranks[4]), R6: rankToScore(p.ranks[5]), R7: rankToScore(p.ranks[6]), R8: rankToScore(p.ranks[7]),
                    GP2: p.gp2,
                    R9: rankToScore(p.ranks[8]), R10: rankToScore(p.ranks[9]), R11: rankToScore(p.ranks[10]), R12: rankToScore(p.ranks[11]),
                    GP3: p.gp3,
                    Rank: p.rank,
                    Total: p.total,
                });
            });

            if (teamIndex === 0 && teamEntries.length > 1) {
                csvData.push({Player: ''}); // Spacer
                const { blue, red, diff } = teamStats;
                csvData.push({
                    Player: 'Puntos Equipo Azul',
                    R1: blue.raceScores[0], R2: blue.raceScores[1], R3: blue.raceScores[2], R4: blue.raceScores[3], GP1: blue.gp1,
                    R5: blue.raceScores[4], R6: blue.raceScores[5], R7: blue.raceScores[6], R8: blue.raceScores[7], GP2: blue.gp2,
                    R9: blue.raceScores[8], R10: blue.raceScores[9], R11: blue.raceScores[10], R12: blue.raceScores[11], GP3: blue.gp3,
                    Total: blue.total,
                });
                 csvData.push({
                    Player: 'Diferencia',
                    R1: diff.raceScores[0], R2: diff.raceScores[1], R3: diff.raceScores[2], R4: diff.raceScores[3], GP1: diff.gp1,
                    R5: diff.raceScores[4], R6: diff.raceScores[5], R7: diff.raceScores[6], R8: diff.raceScores[7], GP2: diff.gp2,
                    R9: diff.raceScores[8], R10: diff.raceScores[9], R11: diff.raceScores[10], R12: diff.raceScores[11], GP3: diff.gp3,
                    Total: diff.total,
                });
                if (redTeamName) {
                  csvData.push({
                      Player: 'Puntos Equipo Rojo',
                      R1: red.raceScores[0], R2: red.raceScores[1], R3: red.raceScores[2], R4: red.raceScores[3], GP1: red.gp1,
                      R5: red.raceScores[4], R6: red.raceScores[5], R7: red.raceScores[6], R8: red.raceScores[7], GP2: red.gp2,
                      R9: red.raceScores[8], R10: red.raceScores[9], R11: red.raceScores[10], R12: red.raceScores[11], GP3: red.gp3,
                      Total: red.total,
                  });
                }
                csvData.push({Player: ''}); // Spacer
            }
        });
        
        exportToCsv(csvData, 'race-summary.csv', headers);
    }
  }));

  const hasData = Object.keys(groupedData).length > 0;
  const numColumns = 12 + 3 + 3; // 12 races + 3 GPs + Player + Rank + Total

  return (
    <ScrollArea className="h-[70vh] w-full" ref={printRef}>
      <Table className='border-collapse border-spacing-0 bg-card'>
        <TableHeader className='sticky top-0 bg-background z-10'>
          <TableRow>
            <TableHead className="w-[150px] font-bold text-lg sticky left-0 bg-background">Player</TableHead>
            {Array.from({length: 4}).map((_, i) => (
                <TableHead key={`r${i+1}`} className="text-center font-bold text-xs">{`R${i+1}`}</TableHead>
            ))}
            <TableHead className="text-center font-bold bg-muted/50">GP1</TableHead>
            {Array.from({length: 4}).map((_, i) => (
                <TableHead key={`r${i+5}`} className="text-center font-bold text-xs">{`R${i+5}`}</TableHead>
            ))}
            <TableHead className="text-center font-bold bg-muted/50">GP2</TableHead>
            {Array.from({length: 4}).map((_, i) => (
                <TableHead key={`r${i+9}`} className="text-center font-bold text-xs">{`R${i+9}`}</TableHead>
            ))}
            <TableHead className="text-center font-bold bg-muted/50">GP3</TableHead>

            <TableHead className="text-center font-bold">Rank</TableHead>
            <TableHead className="text-center font-bold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hasData ? (
            Object.entries(groupedData).map(([team, players], tIndex) => (
              <React.Fragment key={team}>
                <TableRow className={cn('font-bold text-lg',
                    team.toLowerCase().includes('blue') ? 'bg-blue-900/50' : team.toLowerCase().includes('red') ? 'bg-red-900/50' : 'bg-muted/50'
                )}>
                    <TableCell className="sticky left-0">
                        {team}
                    </TableCell>
                    {Array.from({ length: 17 }).map((_, i) => {
                      const isGpColumn = i === 4 || i === 9 || i === 14;
                      return (
                        <TableCell key={i} className={cn( isGpColumn ? 'bg-muted/50' : '' )}>
                          {!isGpColumn && shockLog[i + 1] === team && (
                            <div className='flex items-center justify-center'>
                              <ShockIcon className='h-4 w-4' />
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                </TableRow>
                {players.map((player, pIndex) => (
                  <TableRow key={pIndex}>
                    <TableCell className="font-medium sticky left-0 bg-card/95">{player.playerName}</TableCell>
                    {player.ranks.slice(0,4).map((rank, sIndex) => (
                        <TableCell key={sIndex} className={cn("text-center font-mono", getRankClass(rank))}>
                          {rank ?? '-'}
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.ranks[3] !== null ? player.gp1 : '-'}</TableCell>
                    {player.ranks.slice(4,8).map((rank, sIndex) => (
                        <TableCell key={sIndex+4} className={cn("text-center font-mono", getRankClass(rank))}>
                            {rank ?? '-'}
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.ranks[7] !== null ? player.gp2 : '-'}</TableCell>
                     {player.ranks.slice(8,12).map((rank, sIndex) => (
                        <TableCell key={sIndex+8} className={cn("text-center font-mono", getRankClass(rank))}>
                            {rank ?? '-'}
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.ranks[11] !== null ? player.gp3 : '-'}</TableCell>

                    <TableCell className={cn("text-center font-mono font-bold", getRankClass(player.rank))}>{player.rank ?? '-'}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{player.total ?? '-'}</TableCell>
                  </TableRow>
                ))}
                
                {tIndex === 0 && Object.keys(groupedData).length > 1 && (
                <React.Fragment>
                    <TableRow className="h-2 bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={numColumns}></TableCell>
                    </TableRow>
                    <TableRow className='font-bold border-y'>
                        <TableCell className="sticky left-0 bg-card/95">Puntos Equipo Azul</TableCell>
                        {teamStats.blue.raceScores.slice(0,4).map((s,i) => <TableCell key={i} className="text-center font-mono">{s}</TableCell>)}
                        <TableCell className="text-center font-mono bg-muted/50">{teamStats.blue.gp1}</TableCell>
                        {teamStats.blue.raceScores.slice(4,8).map((s,i) => <TableCell key={i+4} className="text-center font-mono">{s}</TableCell>)}
                        <TableCell className="text-center font-mono bg-muted/50">{teamStats.blue.gp2}</TableCell>
                        {teamStats.blue.raceScores.slice(8,12).map((s,i) => <TableCell key={i+8} className="text-center font-mono">{s}</TableCell>)}
                        <TableCell className="text-center font-mono bg-muted/50">{teamStats.blue.gp3}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-center font-mono">{teamStats.blue.total}</TableCell>
                    </TableRow>
                    <TableRow className='font-bold border-y'>
                        <TableCell className="sticky left-0 bg-card/95">Diferencia</TableCell>
                        {teamStats.diff.raceScores.slice(0,4).map((s,i) => <TableCell key={i} className={cn("text-center font-mono", s > 0 ? 'text-blue-500' : 'text-red-500')}>{Math.abs(s)}</TableCell>)}
                        <TableCell className={cn("text-center font-mono bg-muted/50", teamStats.diff.gp1 > 0 ? 'text-blue-500' : 'text-red-500')}>{Math.abs(teamStats.diff.gp1)}</TableCell>
                        {teamStats.diff.raceScores.slice(4,8).map((s,i) => <TableCell key={i+4} className={cn("text-center font-mono", s > 0 ? 'text-blue-500' : 'text-red-500')}>{Math.abs(s)}</TableCell>)}
                        <TableCell className={cn("text-center font-mono bg-muted/50", teamStats.diff.gp2 > 0 ? 'text-blue-500' : 'text-red-500')}>{Math.abs(teamStats.diff.gp2)}</TableCell>
                        {teamStats.diff.raceScores.slice(8,12).map((s,i) => <TableCell key={i+8} className={cn("text-center font-mono", s > 0 ? 'text-blue-500' : 'text-red-500')}>{Math.abs(s)}</TableCell>)}
                        <TableCell className={cn("text-center font-mono bg-muted/50", teamStats.diff.gp3 > 0 ? 'text-blue-500' : 'text-red-500')}>{Math.abs(teamStats.diff.gp3)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className={cn("text-center font-mono", teamStats.diff.total > 0 ? 'text-blue-500' : 'text-red-500')}>{Math.abs(teamStats.diff.total)}</TableCell>
                    </TableRow>
                    {redTeamName && (
                    <TableRow className='font-bold border-y'>
                        <TableCell className="sticky left-0 bg-card/95">Puntos Equipo Rojo</TableCell>
                        {teamStats.red.raceScores.slice(0,4).map((s,i) => <TableCell key={i} className="text-center font-mono">{s}</TableCell>)}
                        <TableCell className="text-center font-mono bg-muted/50">{teamStats.red.gp1}</TableCell>
                        {teamStats.red.raceScores.slice(4,8).map((s,i) => <TableCell key={i+4} className="text-center font-mono">{s}</TableCell>)}
                        <TableCell className="text-center font-mono bg-muted/50">{teamStats.red.gp2}</TableCell>
                        {teamStats.red.raceScores.slice(8,12).map((s,i) => <TableCell key={i+8} className="text-center font-mono">{s}</TableCell>)}
                        <TableCell className="text-center font-mono bg-muted/50">{teamStats.red.gp3}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-center font-mono">{teamStats.red.total}</TableCell>
                    </TableRow>
                    )}
                    <TableRow className="h-2 bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={numColumns}></TableCell>
                    </TableRow>
                </React.Fragment>
                )}
              </React.Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={numColumns} className="text-center text-muted-foreground h-24">
                No valid data to display.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
});

RaceResultsPreview.displayName = 'RaceResultsPreview';
