'use client';

import { useState } from 'react';
import { useResultsStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const SummarySettings = () => {
    const { 
        leagueTitle: storeLeagueTitle, setLeagueTitle,
        teams: storeTeams, setTeams,
    } = useResultsStore();
    
    const [localLeagueTitle, setLocalLeagueTitle] = useState(storeLeagueTitle);
    const [localTeams, setLocalTeams] = useState(storeTeams);
    
    const handleTeamNameChange = (team: 'blue' | 'red', name: string) => {
        setLocalTeams(currentTeams => ({
            ...currentTeams,
            [team]: { ...currentTeams[team], name }
        }));
    };

    const handleTeamColorChange = (team: 'blue' | 'red', color: string) => {
        setLocalTeams(currentTeams => ({
            ...currentTeams,
            [team]: { ...currentTeams[team], color }
        }));
    };

    const handleRefresh = () => {
        setLeagueTitle(localLeagueTitle);
        setTeams(localTeams);
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
                                        onChange={(e) => handleTeamNameChange('blue', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Blue Team Color</Label>
                                    <Input 
                                        type="color"
                                        value={localTeams.blue.color}
                                        onChange={(e) => handleTeamColorChange('blue', e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Red Team Name</Label>
                                    <Input 
                                        value={localTeams.red.name}
                                        onChange={(e) => handleTeamNameChange('red', e.target.value)}
                                    />

                                </div>
                                <div className="space-y-2">
                                    <Label>Red Team Color</Label>
                                    <Input 
                                        type="color"
                                        value={localTeams.red.color}
                                        onChange={(e) => handleTeamColorChange('red', e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
                <div className="flex justify-end mt-6">
                    <Button onClick={handleRefresh}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Table
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default SummarySettings;
