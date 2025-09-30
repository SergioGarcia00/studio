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
  const numColumns = 12 + 3 + 3; // 12 races + 3 GPs + Player + Rank + Total

  return (
    <ScrollArea className="h-[70vh] w-full">
      <Table className='border-collapse border-spacing-0'>
        <TableHeader className='sticky top-0 bg-background z-10'>
          <TableRow>
            <TableHead className="w-[150px] font-bold text-lg sticky left-0 bg-background">Player</TableHead>
            {/* GP1 */}
            {Array.from({length: 4}).map((_, i) => (
                <TableHead key={`r${i+1}`} className="text-center font-bold text-xs">{`R${i+1}`}</TableHead>
            ))}
            <TableHead className="text-center font-bold bg-muted/50">GP1</TableHead>
            {/* GP2 */}
            {Array.from({length: 4}).map((_, i) => (
                <TableHead key={`r${i+5}`} className="text-center font-bold text-xs">{`R${i+5}`}</TableHead>
            ))}
            <TableHead className="text-center font-bold bg-muted/50">GP2</TableHead>
            {/* GP3 */}
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
            Object.entries(groupedData).map(([team, players]) => (
              <React.Fragment key={team}>
                <TableRow className={cn('font-bold text-lg', teamColors[team] || 'bg-muted/50')}>
                  <TableCell colSpan={numColumns} className="sticky left-0">
                    {team}
                  </TableCell>
                </TableRow>
                {players.map((player, pIndex) => (
                  <TableRow key={pIndex}>
                    <TableCell className="font-medium sticky left-0 bg-background/95">{player.playerName}</TableCell>
                    {/* GP1 Ranks */}
                    {player.ranks.slice(0,4).map((rank, sIndex) => (
                        <TableCell key={sIndex} className="text-center font-mono">
                          <div className='flex items-center justify-center gap-1'>
                            {rank ?? '-'}
                            {player.shocks.includes(sIndex + 1) && (
                              <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            )}
                          </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.gp1 ?? '-'}</TableCell>
                    
                    {/* GP2 Ranks */}
                    {player.ranks.slice(4,8).map((rank, sIndex) => (
                        <TableCell key={sIndex+4} className="text-center font-mono">
                          <div className='flex items-center justify-center gap-1'>
                            {rank ?? '-'}
                            {player.shocks.includes(sIndex + 5) && (
                              <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            )}
                          </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.gp2 ?? '-'}</TableCell>

                    {/* GP3 Ranks */}
                     {player.ranks.slice(8,12).map((rank, sIndex) => (
                        <TableCell key={sIndex+8} className="text-center font-mono">
                          <div className='flex items-center justify-center gap-1'>
                            {rank ?? '-'}
                            {player.shocks.includes(sIndex + 9) && (
                              <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            )}
                          </div>
                        </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold bg-muted/50">{player.gp3 ?? '-'}</TableCell>

                    <TableCell className="text-center font-mono font-bold">{player.rank ?? '-'}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{player.total ?? '-'}</TableCell>
                  </TableRow>
                ))}
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
}
