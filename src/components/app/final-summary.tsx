'use client';

import { useMemo } from 'react';
import { useResultsStore } from '@/lib/store';
import type { Player } from '@/ai/types';
import { format } from 'date-fns';

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
            const bIsBlue = b.toLowerCase().includes('red');
            if (aIsBlue && !bIsBlue) return -1;
            if (!aIsBlue && bIsBlue) return 1;
            return 0;
        });
    
        return Object.fromEntries(teamOrder.map(team => [team, groups[team]]));
    }, [data]);

    const teamNames = Object.keys(groupedData);
    const teamA = teamNames[0] ? { name: teamNames[0].split('(')[0].trim(), players: groupedData[teamNames[0]] } : null;
    const teamB = teamNames[1] ? { name: teamNames[1].split('(')[0].trim(), players: groupedData[teamNames[1]] } : null;
    
    const teamAScore = teamA ? teamA.players.reduce((acc, p) => acc + (p.total || 0), 0) : 0;
    const teamBScore = teamB ? teamB.players.reduce((acc, p) => acc + (p.total || 0), 0) : 0;
    const scoreDifference = teamAScore - teamBScore;

    const today = format(new Date(), 'd MMM yyyy');

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-center text-gray-400">
                <p>No summary data available.<br/>Process 12 races or a summary image to see the results.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-gray-900 p-8 rounded-lg max-w-4xl mx-auto flex flex-col items-center">
            {/* Header */}
            <div className="w-full flex justify-between items-center text-gray-400 mb-8">
                <div className="flex items-center gap-2">
                    {/* Placeholder for a logo if needed */}
                    <div className='w-10 h-10'></div>
                </div>
                <div className="text-right">
                    <p className="font-bold text-xl">{today}</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="w-full grid grid-cols-3 items-center gap-8">
                {/* Team A */}
                <div className="flex flex-col items-center justify-center text-center">
                    <h2 className="text-8xl font-bold text-blue-400">{teamA?.name || 'Team 1'}</h2>
                    <p className="text-9xl font-thin text-blue-300 mt-4">{teamAScore}</p>
                </div>

                {/* Player List */}
                <div className="flex flex-col text-2xl">
                    {teamA?.players.map((player, index) => (
                        <div key={index} className="flex justify-between items-baseline py-1 text-blue-400 gap-4">
                            <span className="font-medium w-40 truncate text-left">{player.playerName}</span>
                            <span className="font-mono w-16 text-right">{player.total}</span>
                            <span className="text-xl text-gray-400 w-16 text-right">{player.rank}</span>
                        </div>
                    ))}
                    <div className='h-8'></div>
                     {teamB?.players.map((player, index) => (
                        <div key={index} className="flex justify-between items-baseline py-1 text-gray-300 gap-4">
                            <span className="font-medium w-40 truncate text-left">{player.playerName}</span>
                            <span className="font-mono w-16 text-right">{player.total}</span>
                            <span className="text-xl text-gray-400 w-16 text-right">{player.rank}</span>
                        </div>
                    ))}
                </div>

                {/* Team B */}
                <div className="flex flex-col items-center justify-center text-center">
                    <h2 className="text-8xl font-bold text-gray-300">{teamB?.name || 'Team 2'}</h2>
                    <p className="text-9xl font-thin text-gray-400 mt-4">{teamBScore}</p>
                </div>
            </div>

            {/* Footer / Difference */}
            <div className="w-full text-center mt-8">
                <p className="text-6xl font-light text-gray-400">
                    {scoreDifference >= 0 ? '+' : ''}{scoreDifference}
                </p>
            </div>
        </div>
    );
};

export default FinalSummary;
