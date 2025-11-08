'use client';

import { useState } from 'react';
import { useResultsStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const SummarySettings = () => {
    const { 
        leagueTitle, setLeagueTitle,
        teams, setTeams,
        mergedData, updatePlayerName
    } = useResultsStore();
    
    const [localLeagueTitle, setLocalLeagueTitle] = useState(leagueTitle);
    const [localTeams, setLocalTeams] = useState(teams);
    const [localPlayerNames, setLocalPlayerNames] = useState<{[key: string]: string}>(
        Object.keys(mergedData).reduce((acc, name) => ({ ...acc, [name]: name }), {})
    );

    const handlePlayerNameChange = (oldName: string, newName: string) => {
        setLocalPlayerNames(prev => ({...prev, [oldName]: newName}));
    };
    
    const handlePlayerNameUpdate = (oldName: string) => {
        const newName = localPlayerNames[oldName];
        if (newName && oldName !== newName) {
            updatePlayerName(oldName, newName);
            // Update local state to reflect the change in keys
            const updatedNames = { ...localPlayerNames };
            delete updatedNames[oldName];
            updatedNames[newName] = newName;
            setLocalPlayerNames(updatedNames);
        }
    };


    return (
        <Card className="max-w-4xl mx-auto mt-8">
            <CardHeader>
                <CardTitle>Display Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" defaultValue={['item-1']}>
                    <AccordionItem value="item-1">
                        <AccordionTrigger className="text-lg font-semibold">General</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="league-title">League Title</Label>
                                <Input 
                                    id="league-title" 
                                    value={localLeagueTitle}
                                    onChange={(e) => setLocalLeagueTitle(e.target.value)}
                                    onBlur={() => setLeagueTitle(localLeagueTitle)}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger className="text-lg font-semibold">Teams</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Blue Team Name</Label>
                                    <Input 
                                        value={localTeams.blue.name}
                                        onChange={(e) => setLocalTeams(t => ({...t, blue: {...t.blue, name: e.target.value}}))}
                                        onBlur={() => setTeams(localTeams)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Blue Team Color</Label>
                                    <Input 
                                        type="color"
                                        value={localTeams.blue.color}
                                        onChange={(e) => setLocalTeams(t => ({...t, blue: {...t.blue, color: e.target.value}}))}
                                        onBlur={() => setTeams(localTeams)}
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Red Team Name</Label>
                                    <Input 
                                        value={localTeams.red.name}
                                        onChange={(e) => setLocalTeams(t => ({...t, red: {...t.red, name: e.target.value}}))}
                                        onBlur={() => setTeams(localTeams)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Red Team Color</Label>
                                    <Input 
                                        type="color"
                                        value={localTeams.red.color}
                                        onChange={(e) => setLocalTeams(t => ({...t, red: {...t.red, color: e.target.value}}))}
                                        onBlur={() => setTeams(localTeams)}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                        <AccordionTrigger className="text-lg font-semibold">Players</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.keys(localPlayerNames).map(originalName => (
                                    <div key={originalName} className="flex items-center gap-2">
                                        <Input 
                                            value={localPlayerNames[originalName]}
                                            onChange={(e) => handlePlayerNameChange(originalName, e.target.value)}
                                            onBlur={() => handlePlayerNameUpdate(originalName)}
                                            className="flex-1"
                                        />
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
};

export default SummarySettings;
