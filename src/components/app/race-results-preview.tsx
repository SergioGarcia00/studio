'use client';

import { useMemo } from 'react';
import type { Player } from '@/ai/types';
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

interface RaceResultsPreviewProps {
  data: Player[];
}

export function RaceResultsPreview({ data }: RaceResultsPreviewProps) {
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
    // Sort players within each group by rank
    Object.keys(groups).forEach(team => {
        const rankToNumber = (rank: string | null) => parseInt(String(rank).replace(/[^0-9]/g, ''), 10) || 99;
        groups[team].sort((a, b) => rankToNumber(a.rank) - rankToNumber(b.rank));
    });
    return groups;
  }, [data]);

  const teamColors: { [key: string]: string } = {
    'JJ (BLUE)': 'bg-blue-900/50',
    'DS (RED)': 'bg-red-900/50',
  };

  const hasData = Object.keys(groupedData).length > 0;

  return (
    <ScrollArea className="h-[70vh] w-full">
      <Table className='border-collapse border-spacing-0'>
        <TableHeader className='sticky top-0 bg-background z-10'>
          <TableRow>
            <TableHead className="w-[150px] font-bold text-lg">Player</TableHead>
            {Array.from({length: 12}).map((_, i) => (
                <TableHead key={i} className="text-center font-bold text-xs">{`R${i+1}`}</TableHead>
            ))}
            <TableHead className="text-center font-bold">GP1</TableHead>
            <TableHead className="text-center font-bold">GP2</TableHead>
            <TableHead className="text-center font-bold">GP3</TableHead>
            <TableHead className="text-center font-bold">Rank</TableHead>
            <TableHead className="text-center font-bold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hasData ? (
            Object.entries(groupedData).map(([team, players]) => (
              <React.Fragment key={team}>
                <TableRow className={cn('font-bold text-lg', teamColors[team] || 'bg-muted/50')}>
                  <TableCell colSpan={18}>{team}</TableCell>
                </TableRow>
                {players.map((player, pIndex) => (
                  <TableRow key={pIndex}>
                    <TableCell className="font-medium">{player.playerName}</TableCell>
                    {player.scores.map((score, sIndex) => (
                        <TableCell key={sIndex} className="text-center font-mono">
                          <div className='flex items-center justify-center gap-1'>
                            {score ?? '-'}
                            {player.shocks.includes(sIndex + 1) && (
                              <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            )}
                          </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold">{player.gp1 ?? '-'}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{player.gp2 ?? '-'}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{player.gp3 ?? '-'}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{player.rank ?? '-'}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{player.total ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={18} className="text-center text-muted-foreground h-24">
                No valid data to display.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
