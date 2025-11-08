'use client';

import { useState } from 'react';
import { useResultsStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const SummarySettings = () => {
    const { 
        leagueTitle, setLeagueTitle,
        teams, setTeams,
    } = useResultsStore();
    
    const [localLeagueTitle, setLocalLeagueTitle] = useState(leagueTitle);
    
    // Use a local state for team edits to avoid performance issues on color picker drag
    // but read directly from the store for rendering.
    // The onBlur/onChange will write back to the store.
    const handleTeamNameChange = (team: 'blue' | 'red', name: string) => {
        setTeams(currentTeams => ({
            ...currentTeams,
            [team]: { ...currentTeams[team], name }
        }));
    };

    const handleTeamColorChange = (team: 'blue' | 'red', color: string) => {
        setTeams(currentTeams => ({
            ...currentTeams,
            [team]: { ...currentTeams[team], color }
        }));
    };

    return (
        <Card className="max-w-4xl mx-auto mt-8">
            <CardHeader>
                <CardTitle>Display Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" defaultValue={['item-1', 'item-2']}>
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
                                        value={teams.blue.name}
                                        onChange={(e) => handleTeamNameChange('blue', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Blue Team Color</Label>
                                    <Input 
                                        type="color"
                                        value={teams.blue.color}
                                        onChange={(e) => handleTeamColorChange('blue', e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Red Team Name</Label>
                                    <Input 
                                        value={teams.red.name}
                                        onChange={(e) => handleTeamNameChange('red', e.target.value)}
                                    />

                                </div>
                                <div className="space-y-2">
                                    <Label>Red Team Color</Label>
                                    <Input 
                                        type="color"
                                        value={teams.red.color}
                                        onChange={(e) => handleTeamColorChange('red', e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
};

export default SummarySettings;
