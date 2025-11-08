'use client';

import { useMemo, useRef } from 'react';
import { useResultsStore } from '@/lib/store';
import type { Player } from '@/ai/types';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ImageDown, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';

const FinalSummary = () => {
    const { mergedData } = useResultsStore();
    const data = Object.values(mergedData) as Player[];
    const printRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const groupedData = useMemo(() => {
        const validPlayers = data.filter(player => player.isValid && player.total !== null);
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
            groups[team].sort((a, b) => (a.total ?? 0) > (b.total ?? 0) ? -1 : 1);
        });
        
        return groups;
    }, [data]);

    const teamNames = Object.keys(groupedData);
    const teamA = teamNames.find(name => name.toLowerCase().includes('blue')) || teamNames[0];
    const teamB = teamNames.find(name => name.toLowerCase().includes('red')) || teamNames[1];

    const teamAData = teamA ? { name: teamA, players: groupedData[teamA] } : null;
    const teamBData = teamB ? { name: teamB, players: groupedData[teamB] } : null;
    
    const teamAScore = teamAData ? teamAData.players.reduce((acc, p) => acc + (p.total || 0), 0) : 0;
    const teamBScore = teamBData ? teamBData.players.reduce((acc, p) => acc + (p.total || 0), 0) : 0;
    
    const winningTeam = teamAScore >= teamBScore ? teamAData : teamBData;
    const losingTeam = teamAScore < teamBScore ? teamAData : teamBData;

    const scoreDifference = Math.abs(teamAScore - teamBScore);

    const winningTeamColor = winningTeam?.name.toLowerCase().includes('blue') ? 'text-blue-400' : 'text-red-500';
    const losingTeamColor = losingTeam?.name.toLowerCase().includes('blue') ? 'text-blue-400' : 'text-red-500';

    const today = format(new Date(), 'd MMM yyyy');

    const downloadAsPng = async () => {
      const elementToCapture = printRef.current;
      if (!elementToCapture) return;

      const backgroundColorHsl = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
      
      const canvas = await html2canvas(elementToCapture, {
        scale: 2,
        backgroundColor: `hsl(${backgroundColorHsl})`,
        useCORS: true,
        allowTaint: true,
      });

      const data = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = data;
      link.download = `final-results-${format(new Date(), 'yyyy-MM-dd')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const copyToClipboard = () => {
        if (!winningTeam || !losingTeam) return;

        const formatTeam = (team: { name: string; players: Player[] }) => {
            const teamName = team.name.split(' (')[0].trim();
            const teamTotal = team.players.reduce((acc, p) => acc + (p.total || 0), 0);
            const playersText = team.players.map(p => `${p.playerName} ${p.total}`).join('\n');
            return `${teamName} - ${teamTotal}\n${playersText}`;
        };

        const sortedTeams = [winningTeam, losingTeam];
        const textToCopy = sortedTeams.map(formatTeam).join('\n\n');
        
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
            <Card className="max-w-4xl mx-auto">
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
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-end items-center mb-4 gap-2">
                <Button variant="outline" size="icon" onClick={downloadAsPng} aria-label="Download as PNG">
                    <ImageDown className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Copy Results">
                    <ClipboardCopy className="h-4 w-4" />
                </Button>
            </div>
            <Card className="bg-card border-border overflow-hidden" ref={printRef}>
                <div className="p-8 bg-background/80" style={{backgroundImage: 'radial-gradient(circle, hsl(var(--border)/0.2) 1px, transparent 1px)', backgroundSize: '1rem 1rem'}}>
                    <CardHeader className="text-center p-0 mb-10">
                        <div className="flex justify-between items-baseline">
                            <h2 className="text-xl font-bold text-foreground">Atlas League</h2>
                            <p className="text-muted-foreground">{today}</p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-[1fr_2fr_1fr] items-center gap-8">
                            {/* Winning Team */}
                            {winningTeam && (
                                <>
                                    <div className={cn("text-8xl font-bold justify-self-center", winningTeamColor)}>
                                        {winningTeam.name.split(' ')[0].trim()}
                                    </div>
                                    <div className="space-y-3">
                                        {winningTeam.players.map(player => (
                                            <div key={player.playerName} className="flex justify-between items-baseline text-2xl">
                                                <span className={cn("font-semibold", winningTeamColor)}>{player.playerName}</span>
                                                <div>
                                                    <span className="font-mono font-medium text-foreground">{player.total}</span>
                                                    <span className="text-lg text-muted-foreground ml-4 w-12 inline-block text-right">{player.rank}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className={cn("text-9xl font-bold justify-self-center", winningTeamColor)}>
                                        {winningTeam.players.reduce((acc, p) => acc + (p.total || 0), 0)}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-[1fr_2fr_1fr] items-center gap-8 my-8">
                            <div></div>
                            <div></div>
                             <div className="text-4xl font-light text-muted-foreground self-center justify-self-center">
                                &plusmn;{scoreDifference}
                            </div>
                        </div>

                        <div className="grid grid-cols-[1fr_2fr_1fr] items-center gap-8">
                            {/* Losing Team */}
                            {losingTeam && (
                                <>
                                    <div className="text-8xl font-bold text-muted-foreground justify-self-center">
                                        {losingTeam.name.split(' ')[0].trim()}
                                    </div>
                                    <div className="space-y-3">
                                        {losingTeam.players.map(player => (
                                            <div key={player.playerName} className="flex justify-between items-baseline text-2xl">
                                                <span className="font-semibold text-foreground">{player.playerName}</span>
                                                <div>
                                                    <span className="font-mono font-medium text-foreground">{player.total}</span>
                                                    <span className="text-lg text-muted-foreground ml-4 w-12 inline-block text-right">{player.rank}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-9xl font-bold text-muted-foreground justify-self-center">
                                        {losingTeam.players.reduce((acc, p) => acc + (p.total || 0), 0)}
                                    </div>
                                </>
                            )}
                        </div>

                    </CardContent>
                </div>
            </Card>
        </div>
    );
};

export default FinalSummary;
