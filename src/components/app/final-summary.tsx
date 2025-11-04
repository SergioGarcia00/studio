'use client';

import { useMemo, useRef } from 'react';
import { useResultsStore } from '@/lib/store';
import type { Player } from '@/ai/types';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Medal, ImageDown, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';


const getRankMedal = (rank: string | null) => {
    if (!rank) return null;
    const rankNum = parseInt(rank.replace(/\D/g, ''), 10);
    if (rankNum === 1) return <Medal className="h-4 w-4 text-yellow-500" />;
    if (rankNum === 2) return <Medal className="h-4 w-4 text-slate-400" />;
    if (rankNum === 3) return <Medal className="h-4 w-4 text-orange-600" />;
    return null;
};


const FinalSummary = () => {
    const { mergedData } = useResultsStore();
    const data = Object.values(mergedData) as Player[];
    const printRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

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

    const downloadAsPng = async () => {
      const elementToCapture = printRef.current;
      if (!elementToCapture) return;

      const backgroundColorHsl = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
      
      const canvas = await html2canvas(elementToCapture, {
        scale: 2,
        backgroundColor: `hsl(${backgroundColorHsl})`,
        useCORS: true,
        allowTaint: true,
      });

      const data = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = data;
      link.download = 'final-results.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const copyToClipboard = () => {
        if (!winningTeam || !losingTeam) return;

        const formatTeam = (team: { name: string; players: Player[] }) => {
            const teamName = team.name.split(' (')[0].trim();
            const playersText = team.players.map(p => `${p.playerName} ${p.total}`).join('\n');
            return `${teamName}\n${playersText}`;
        };

        const textToCopy = `${formatTeam(winningTeam)}\n\n${formatTeam(losingTeam)}`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            toast({
                title: 'Resultados Copiados',
                description: 'La lista de resultados ha sido copiada al portapapeles.',
            });
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudieron copiar los resultados.',
            });
        });
    };


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
        <Card className="max-w-2xl mx-auto bg-card border-border" ref={printRef}>
            <CardHeader className="text-center">
                 <div className="flex justify-between items-center">
                    <CardDescription>{today}</CardDescription>
                    <div className='flex items-center gap-2'>
                        <Button variant="outline" size="icon" onClick={downloadAsPng}>
                            <ImageDown className="h-4 w-4" />
                            <span className="sr-only">Create PNG</span>
                        </Button>
                        <Button variant="outline" size="icon" onClick={copyToClipboard}>
                            <ClipboardCopy className="h-4 w-4" />
                            <span className="sr-only">Copy Results</span>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {/* Score Summary */}
                <div className="flex justify-around items-center mb-8 text-center">
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl font-semibold">{winningTeam?.name.split(' (')[0].trim() || 'Team 1'}</h2>
                        <p className="text-6xl font-bold">{winningScore}</p>
                    </div>
                    <div className="flex flex-col items-center">
                         <p className="text-3xl font-light text-muted-foreground self-center mt-8">
                            +{scoreDifference}
                        </p>
                    </div>
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl font-semibold">{losingTeam?.name.split(' (')[0].trim() || 'Team 2'}</h2>
                        <p className="text-6xl font-bold">{losingScore}</p>
                    </div>
                </div>

                {/* Player Tables */}
                <div className="grid md:grid-cols-2 gap-6">
                    {winningTeam && (
                        <div>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border">
                                        <TableHead className="w-1/3 text-muted-foreground">Player</TableHead>
                                        <TableHead className="w-1/3 text-right text-muted-foreground">Total</TableHead>
                                        <TableHead className="w-1/3 text-right text-muted-foreground">Rank</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {winningTeam.players.map((player) => (
                                        <TableRow key={player.playerName} className="border-border/50">
                                            <TableCell className="font-medium">{player.playerName}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">{player.total}</TableCell>
                                            <TableCell className="text-right font-semibold text-sm">
                                                <div className="flex items-center justify-end gap-2">
                                                    {getRankMedal(player.rank)}
                                                    <span>{player.rank}</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {losingTeam && (
                         <div>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border">
                                        <TableHead className="w-1/3 text-muted-foreground">Player</TableHead>
                                        <TableHead className="w-1/3 text-right text-muted-foreground">Total</TableHead>
                                        <TableHead className="w-1/3 text-right text-muted-foreground">Rank</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {losingTeam.players.map((player) => (
                                        <TableRow key={player.playerName} className="border-border/50">
                                            <TableCell className="font-medium">{player.playerName}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">{player.total}</TableCell>
                                            <TableCell className="text-right font-semibold text-sm">
                                                <div className="flex items-center justify-end gap-2">
                                                    {getRankMedal(player.rank)}
                                                    <span>{player.rank}</span>
                                                </div>
                                            </TableCell>
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
