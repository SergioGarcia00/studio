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
import { FileDown, ImageDown, Zap, Circle } from 'lucide-react';
import { useResultsStore } from '@/lib/store';
import { RACE_TRACKS } from '@/lib/race-tracks';

interface RaceResultsPreviewProps {
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
    if (!rank) return 1; // Treat null rank as 12th place for score calculation
    return RANK_TO_SCORE[rank] || 1;
};

const getRankClass = (rank: string | null) => {
    if (!rank) return '';
    if (rank === '1st') return 'bg-primary text-primary-foreground font-bold';
    if (rank === '2nd') return 'bg-primary/80 text-primary-foreground font-bold';
    if (rank === '3rd') return 'bg-primary/60 text-primary-foreground font-bold';
    return '';
};

const ShockIcon = ({ className }: { className?: string }) => (
  <Zap
    className={cn("h-5 w-5 text-primary fill-primary mx-auto", className)}
  />
);


export const RaceResultsPreview = forwardRef<RaceResultsPreviewRef, RaceResultsPreviewProps>((_, ref) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { mergedData, shockLog, extractedData, racePicks } = useResultsStore();
  const data = Object.values(mergedData) as Player[];

  const raceHeaders = useMemo(() => {
    const invertedRaceTracks = Object.fromEntries(Object.entries(RACE_TRACKS).map(([k, v]) => [v, k]));
    return Array.from({length: 12}).map((_, i) => {
        const raceNumber = i + 1;
        const raceInfo = extractedData.find(d => d.raceNumber === raceNumber);
        const raceName = raceInfo?.raceName;
        const shortName = raceName ? invertedRaceTracks[raceName] : null;
        return {
            fullName: raceName,
            shortName: shortName ?? `R${raceNumber}`,
            pick: racePicks[raceNumber]
        }
    });
  }, [extractedData, racePicks]);

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
      const elementToCapture = printRef.current?.querySelector<HTMLDivElement>(':scope > div');

      if (!elementToCapture) {
        console.error("Could not find the element to capture for PNG export.");
        return;
      }
      
      const clonedElement = elementToCapture.cloneNode(true) as HTMLElement;
      
      // Prepare the clone for off-screen rendering to get the full size
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0';
      clonedElement.style.height = 'auto'; // Let it expand to full height
      clonedElement.style.width = `${elementToCapture.scrollWidth}px`; // Use scrollWidth
      
      document.body.appendChild(clonedElement);
      
      const backgroundColorHsl = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
      
      try {
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
        
        const data = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = data;
        link.download = 'race-results.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } catch (error) {
        console.error("Error generating PNG:", error);
      } finally {
        document.body.removeChild(clonedElement);
      }
    },
    downloadAsCsv: () => {
        const csvData: any[] = [];
        const headers = ['playerName', 'team', 'raceNumber', 'raceName', 'rank', 'score', 'teamPick', 'shockUsed'];
        
        const allPlayers = Object.values(mergedData);

        for(let i=0; i<12; i++){
            const raceNumber = i + 1;
            const raceInfo = extractedData.find(d => d.raceNumber === raceNumber);
            if (!raceInfo) continue;

            const teamPick = racePicks[raceNumber] || 'none';
            const shockedPlayerInRace = shockLog[raceNumber];

            allPlayers.forEach(player => {
                const rank = player.ranks[i];
                if (rank === null && (player.gp1 !== null || player.gp2 !== null || player.gp3 !== null)) { // Player was in the game but DCed
                    csvData.push({
                        playerName: player.playerName,
                        team: player.team,
                        raceNumber: raceNumber,
                        raceName: raceInfo.raceName,
                        rank: 'N/A',
                        score: 0,
                        teamPick: teamPick,
                        shockUsed: shockedPlayerInRace === player.playerName,
                    });
                } else if (rank !== null) {
                    csvData.push({
                        playerName: player.playerName,
                        team: player.team,
                        raceNumber: raceNumber,
                        raceName: raceInfo.raceName,
                        rank: rank,
                        score: rankToScore(rank),
                        teamPick: teamPick,
                        shockUsed: shockedPlayerInRace === player.playerName,
                    });
                }
            });
        }
        
        exportToCsv(csvData, 'race-details.csv', headers);
    }
  }));

  const hasData = Object.keys(groupedData).length > 0;
  const numColumns = 12 + 3 + 3; // 12 races + 3 GPs + Player + Rank + Total

  return (
    <ScrollArea className="h-[100vh] w-full" ref={printRef}>
        <div className="bg-card p-4">
      <Table className='border-collapse border-spacing-0 bg-card'>
        <TableHeader className='sticky top-0 bg-background z-10'>
          <TableRow>
            <TableHead className="w-[150px] font-bold text-lg sticky left-0 bg-background">Player</TableHead>
            {raceHeaders.slice(0, 4).map((header, i) => (
                <TableHead key={`h${i}`} className="text-center font-bold text-xs p-1">
                  {header.shortName}
                  {header.pick && header.pick !== 'none' && (
                    <Circle className={cn("h-2 w-2 mx-auto mt-1", header.pick === 'blue' ? 'fill-blue-500' : 'fill-red-500')} />
                  )}
                </TableHead>
            ))}
            <TableHead className="text-center font-bold bg-muted/50">GP1</TableHead>
            {raceHeaders.slice(4, 8).map((header, i) => (
                <TableHead key={`h${i+4}`} className="text-center font-bold text-xs p-1">
                  {header.shortName}
                  {header.pick && header.pick !== 'none' && (
                    <Circle className={cn("h-2 w-2 mx-auto mt-1", header.pick === 'blue' ? 'fill-blue-500' : 'fill-red-500')} />
                  )}
                </TableHead>
            ))}
            <TableHead className="text-center font-bold bg-muted/50">GP2</TableHead>
            {raceHeaders.slice(8, 12).map((header, i) => (
                <TableHead key={`h${i+8}`} className="text-center font-bold text-xs p-1">
                  {header.shortName}
                  {header.pick && header.pick !== 'none' && (
                    <Circle className={cn("h-2 w-2 mx-auto mt-1", header.pick === 'blue' ? 'fill-blue-500' : 'fill-red-500')} />
                  )}
                </TableHead>
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
                <TableRow className='font-bold text-lg bg-muted/50'>
                    <TableCell className="sticky left-0">
                        {team.split(' (')[0]}
                    </TableCell>
                    <TableCell colSpan={16}></TableCell>
                </TableRow>
                {players.map((player, pIndex) => (
                  <TableRow key={pIndex}>
                    <TableCell className="font-medium sticky left-0 bg-card/95">{player.playerName}</TableCell>
                    {player.ranks.slice(0,4).map((rank, sIndex) => (
                        <TableCell key={sIndex} className={cn("text-center font-mono", getRankClass(rank), !rank && 'bg-destructive/50')}>
                          <div className='flex items-center justify-center gap-1'>
                            {rank ?? '12th'}
                            {shockLog[sIndex + 1] === player.playerName && <ShockIcon className='h-3 w-3' />}
                          </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.ranks[3] !== null ? player.gp1 : '-'}</TableCell>
                    {player.ranks.slice(4,8).map((rank, sIndex) => (
                        <TableCell key={sIndex+4} className={cn("text-center font-mono", getRankClass(rank), !rank && 'bg-destructive/50')}>
                            <div className='flex items-center justify-center gap-1'>
                              {rank ?? '12th'}
                              {shockLog[sIndex + 5] === player.playerName && <ShockIcon className='h-3 w-3' />}
                            </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.ranks[7] !== null ? player.gp2 : '-'}</TableCell>
                     {player.ranks.slice(8,12).map((rank, sIndex) => (
                        <TableCell key={sIndex+8} className={cn("text-center font-mono", getRankClass(rank), !rank && 'bg-destructive/50')}>
                            <div className='flex items-center justify-center gap-1'>
                              {rank ?? '12th'}
                              {shockLog[sIndex + 9] === player.playerName && <ShockIcon className='h-3 w-3' />}
                            </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.ranks[11] !== null ? player.gp3 : '-'}</TableCell>

                    <TableCell className={cn("text-center font-mono font-bold", getRankClass(player.rank))}>{player.rank ?? '-'}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{player.total ?? '-'}</TableCell>
                  </TableRow>
                ))}
                
                {tIndex === 0 && Object.keys(groupedData).length > 1 && (
                <React.Fragment>
                    <TableRow className="h-2 bg-muted/20 hover:bg-muted/20">
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
                        {teamStats.diff.raceScores.slice(0,4).map((s,i) => <TableCell key={i} className={cn("text-center font-mono", s > 0 ? 'text-green-500' : 'text-red-500')}>{Math.abs(s)}</TableCell>)}
                        <TableCell className={cn("text-center font-mono bg-muted/50", teamStats.diff.gp1 > 0 ? 'text-green-500' : 'text-red-500')}>{Math.abs(teamStats.diff.gp1)}</TableCell>
                        {teamStats.diff.raceScores.slice(4,8).map((s,i) => <TableCell key={i+4} className={cn("text-center font-mono", s > 0 ? 'text-green-500' : 'text-red-500')}>{Math.abs(s)}</TableCell>)}
                        <TableCell className={cn("text-center font-mono bg-muted/50", teamStats.diff.gp2 > 0 ? 'text-green-500' : 'text-red-500')}>{Math.abs(teamStats.diff.gp2)}</TableCell>
                        {teamStats.diff.raceScores.slice(8,12).map((s,i) => <TableCell key={i+8} className={cn("text-center font-mono", s > 0 ? 'text-green-500' : 'text-red-500')}>{Math.abs(s)}</TableCell>)}
                        <TableCell className={cn("text-center font-mono bg-muted/50", teamStats.diff.gp3 > 0 ? 'text-green-500' : 'text-red-500')}>{Math.abs(teamStats.diff.gp3)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className={cn("text-center font-mono", teamStats.diff.total > 0 ? 'text-green-500' : 'text-red-500')}>{Math.abs(teamStats.diff.total)}</TableCell>
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
                    <TableRow className="h-2 bg-muted/20 hover:bg-muted/20">
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
      </div>
    </ScrollArea>
  );
});

RaceResultsPreview.displayName = 'RaceResultsPreview';
