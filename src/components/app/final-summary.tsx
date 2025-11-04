'use client';

import { useMemo } from 'react';
import { useResultsStore } from '@/lib/store';
import type { Player } from '@/ai/types';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const FinalSummary = () => {
    const { mergedData } = useResultsStore();
    const data = Object.values(mergedData) as Player[];

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
            const bIsBlue = b.toLowerCase().includes('blue');
            if (aIsBlue && !bIsBlue) return -1;
            if (!aIsBlue && bIsBlue) return 1;
            return 0;
        });
    
        return Object.fromEntries(teamOrder.map(team => [team, groups[team]]));
    }, [data]);

    const teamNames = Object.keys(groupedData);
    const teamA = teamNames[0] ? { name: teamNames[0], players: groupedData[teamNames[0]] } : null;
    const teamB = teamNames[1] ? { name: teamNames[1], players: groupedData[teamNames[1]] } : null;
    
    const teamAScore = teamA ? teamA.players.reduce((acc, p) => acc + (p.total || 0), 0) : 0;
    const teamBScore = teamB ? teamB.players.reduce((acc, p) => acc + (p.total || 0), 0) : 0;
    
    const winningTeam = teamAScore >= teamBScore ? teamA : teamB;
    const losingTeam = teamAScore < teamBScore ? teamA : teamB;
    const winningScore = Math.max(teamAScore, teamBScore);
    const losingScore = Math.min(teamAScore, teamBScore);
    const scoreDifference = winningScore - losingScore;

    const today = format(new Date(), 'MMMM d, yyyy');

    if (data.length === 0) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>No Summary Data</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-64 text-center text-gray-400">
                    <p>Process 12 races or a summary image to see the results.</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className="max-w-2xl mx-auto bg-gray-900/50 border-gray-800 text-white">
            <CardHeader className="text-center">
                <CardTitle className="text-3xl font-bold">Final Results</CardTitle>
                <CardDescription className="text-gray-400">{today}</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                {/* Score Summary */}
                <div className="flex justify-around items-center mb-8 text-center">
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl font-semibold text-blue-400">{winningTeam?.name.split('(')[0].trim() || 'Team 1'}</h2>
                        <p className="text-6xl font-bold text-blue-300">{winningScore}</p>
                    </div>
                    <div className="flex flex-col items-center">
                         <p className="text-3xl font-light text-gray-400 self-center mt-8">
                            +{scoreDifference}
                        </p>
                    </div>
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl font-semibold text-gray-400">{losingTeam?.name.split('(')[0].trim() || 'Team 2'}</h2>
                        <p className="text-6xl font-bold text-gray-500">{losingScore}</p>
                    </div>
                </div>

                {/* Player Tables */}
                <div className="grid md:grid-cols-2 gap-6">
                    {winningTeam && (
                        <div>
                            <h3 className="text-xl font-semibold mb-2 text-blue-400">{winningTeam.name}</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-gray-700">
                                        <TableHead className="w-1/3 text-gray-400">Player</TableHead>
                                        <TableHead className="w-1/3 text-right text-gray-400">Total</TableHead>
                                        <TableHead className="w-1/3 text-right text-gray-400">Rank</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {winningTeam.players.map((player) => (
                                        <TableRow key={player.playerName} className="border-gray-800">
                                            <TableCell className="font-medium">{player.playerName}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">{player.total}</TableCell>
                                            <TableCell className="text-right font-semibold text-sm">{player.rank}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {losingTeam && (
                         <div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-400">{losingTeam.name}</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-gray-700">
                                        <TableHead className="w-1/3 text-gray-400">Player</TableHead>
                                        <TableHead className="w-1/3 text-right text-gray-400">Total</TableHead>
                                        <TableHead className="w-1/3 text-right text-gray-400">Rank</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {losingTeam.players.map((player) => (
                                        <TableRow key={player.playerName} className="border-gray-800">
                                            <TableCell className="font-medium">{player.playerName}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">{player.total}</TableCell>
                                            <TableCell className="text-right font-semibold text-sm">{player.rank}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default FinalSummary;
