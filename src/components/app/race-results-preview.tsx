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
import { Zap } from 'lucide-react';
import html2canvas from 'html2canvas';

interface RaceResultsPreviewProps {
  data: Player[];
  shockLog: ShockLog;
}

export interface RaceResultsPreviewRef {
  downloadAsPng: () => void;
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


export const RaceResultsPreview = forwardRef<RaceResultsPreviewRef, RaceResultsPreviewProps>(({ data, shockLog }, ref) => {
  const printRef = useRef<HTMLTableElement>(null);

  useImperativeHandle(ref, () => ({
    downloadAsPng: async () => {
      const element = printRef.current;
      if (element) {
        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--card'),
        });
        const data = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = data;
        link.download = 'race-results.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
  }));

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
        const aIsBlue = a.includes('BLUE');
        const bIsBlue = b.includes('BLUE');
        if (aIsBlue && !bIsBlue) return -1;
        if (!aIsBlue && bIsBlue) return 1;
        return 0;
    });

    return Object.fromEntries(teamOrder.map(team => [team, groups[team]]));
  }, [data]);
  
  const blueTeamName = Object.keys(groupedData).find(team => team.includes('BLUE'));
  const redTeamName = Object.keys(groupedData).find(team => team.includes('RED'));

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


  const teamColors: { [key: string]: string } = {
    'JJ (BLUE)': 'bg-blue-900/50',
    'DS (RED)': 'bg-red-900/50',
  };

  const hasData = Object.keys(groupedData).length > 0;
  const numColumns = 12 + 3 + 3; // 12 races + 3 GPs + Player + Rank + Total

  return (
    <ScrollArea className="h-[70vh] w-full">
      <Table ref={printRef} className='border-collapse border-spacing-0 bg-card'>
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
                <TableRow className={cn('font-bold text-lg', teamColors[team] || 'bg-muted/50')}>
                    <TableCell className="sticky left-0">
                        {team}
                    </TableCell>
                    {Array.from({length: 4}).map((_, i) => (
                        <TableCell key={`shock-r${i+1}`} className="text-center">
                            {shockLog[i+1] === team && <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400 mx-auto" />}
                        </TableCell>
                    ))}
                    <TableCell className="bg-muted/50"></TableCell>
                    {Array.from({length: 4}).map((_, i) => (
                        <TableCell key={`shock-r${i+5}`} className="text-center">
                            {shockLog[i+5] === team && <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400 mx-auto" />}
                        </TableCell>
                    ))}
                    <TableCell className="bg-muted/50"></TableCell>
                    {Array.from({length: 4}).map((_, i) => (
                        <TableCell key={`shock-r${i+9}`} className="text-center">
                             {shockLog[i+9] === team && <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400 mx-auto" />}
                        </TableCell>
                    ))}
                    <TableCell className="bg-muted/50"></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                </TableRow>
                {players.map((player, pIndex) => (
                  <TableRow key={pIndex}>
                    <TableCell className="font-medium sticky left-0 bg-card/95">{player.playerName}</TableCell>
                    {player.ranks.slice(0,4).map((rank, sIndex) => (
                        <TableCell key={sIndex} className={cn("text-center font-mono", getRankClass(rank))}>
                          <div className='flex items-center justify-center gap-1'>
                            {rank ?? '-'}
                          </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.ranks[3] !== null ? player.gp1 : '-'}</TableCell>
                    {player.ranks.slice(4,8).map((rank, sIndex) => (
                        <TableCell key={sIndex+4} className={cn("text-center font-mono", getRankClass(rank))}>
                          <div className='flex items-center justify-center gap-1'>
                            {rank ?? '-'}
                          </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.ranks[7] !== null ? player.gp2 : '-'}</TableCell>
                     {player.ranks.slice(8,12).map((rank, sIndex) => (
                        <TableCell key={sIndex+8} className={cn("text-center font-mono", getRankClass(rank))}>
                          <div className='flex items-center justify-center gap-1'>
                            {rank ?? '-'}
                          </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.ranks[11] !== null ? player.gp3 : '-'}</TableCell>

                    <TableCell className={cn("text-center font-mono font-bold", getRankClass(player.rank))}>{player.rank ?? '-'}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{player.total ?? '-'}</TableCell>
                  </TableRow>
                ))}
                
                {tIndex === 0 && blueTeamName && (
                <React.Fragment>
                  <TableRow className='bg-muted/20 font-bold'>
                    <TableCell className="sticky left-0 bg-card/95">Puntos Equipo Azul</TableCell>
                    {teamStats.blue.raceScores.slice(0,4).map((s,i) => <TableCell key={i} className="text-center font-mono"><div className='flex items-center justify-center gap-1'>{s}</div></TableCell>)}
                    <TableCell className="text-center font-mono bg-muted/50">{teamStats.blue.gp1}</TableCell>
                    {teamStats.blue.raceScores.slice(4,8).map((s,i) => <TableCell key={i+4} className="text-center font-mono"><div className='flex items-center justify-center gap-1'>{s}</div></TableCell>)}
                    <TableCell className="text-center font-mono bg-muted/50">{teamStats.blue.gp2}</TableCell>
                    {teamStats.blue.raceScores.slice(8,12).map((s,i) => <TableCell key={i+8} className="text-center font-mono"><div className='flex items-center justify-center gap-1'>{s}</div></TableCell>)}
                    <TableCell className="text-center font-mono bg-muted/50">{teamStats.blue.gp3}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center font-mono">{teamStats.blue.total}</TableCell>
                  </TableRow>
                  <TableRow className='bg-purple-500/50 font-bold'>
                    <TableCell className="sticky left-0 bg-card/95">Diferencia</TableCell>
                    {teamStats.diff.raceScores.slice(0,4).map((s,i) => <TableCell key={i} className="text-center font-mono">{s > 0 ? `+${s}` : s}</TableCell>)}
                    <TableCell className="text-center font-mono bg-muted/50">{teamStats.diff.gp1 > 0 ? `+${teamStats.diff.gp1}`: teamStats.diff.gp1}</TableCell>
                    {teamStats.diff.raceScores.slice(4,8).map((s,i) => <TableCell key={i+4} className="text-center font-mono">{s > 0 ? `+${s}` : s}</TableCell>)}
                    <TableCell className="text-center font-mono bg-muted/50">{teamStats.diff.gp2 > 0 ? `+${teamStats.diff.gp2}`: teamStats.diff.gp2}</TableCell>
                    {teamStats.diff.raceScores.slice(8,12).map((s,i) => <TableCell key={i+8} className="text-center font-mono">{s > 0 ? `+${s}` : s}</TableCell>)}
                    <TableCell className="text-center font-mono bg-muted/50">{teamStats.diff.gp3 > 0 ? `+${teamStats.diff.gp3}`: teamStats.diff.gp3}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center font-mono">{teamStats.diff.total > 0 ? `+${teamStats.diff.total}`: teamStats.diff.total}</TableCell>
                  </TableRow>
                   {redTeamName && (
                  <TableRow className='bg-muted/20 font-bold'>
                    <TableCell className="sticky left-0 bg-card/95">Puntos Equipo Rojo</TableCell>
                     {teamStats.red.raceScores.slice(0,4).map((s,i) => <TableCell key={i} className="text-center font-mono"><div className='flex items-center justify-center gap-1'>{s}</div></TableCell>)}
                    <TableCell className="text-center font-mono bg-muted/50">{teamStats.red.gp1}</TableCell>
                    {teamStats.red.raceScores.slice(4,8).map((s,i) => <TableCell key={i+4} className="text-center font-mono"><div className='flex items-center justify-center gap-1'>{s}</div></TableCell>)}
                    <TableCell className="text-center font-mono bg-muted/50">{teamStats.red.gp2}</TableCell>
                    {teamStats.red.raceScores.slice(8,12).map((s,i) => <TableCell key={i+8} className="text-center font-mono"><div className='flex items-center justify-center gap-1'>{s}</div></TableCell>)}
                    <TableCell className="text-center font-mono bg-muted/50">{teamStats.red.gp3}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center font-mono">{teamStats.red.total}</TableCell>
                  </TableRow>
                  )}
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

    
