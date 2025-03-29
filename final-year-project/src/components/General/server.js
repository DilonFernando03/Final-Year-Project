const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { Round } = require('@tensorflow/tfjs');
const Papa = require('papaparse');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 5000;

app.use(cors());

/* Global Data Store */
let dataStore = {
    drivers: [],
    races: [],
    results: [],
    constructors: [],
    circuits: [],
    qualifying: [],
    driverStandings: [],
    constructorStandings: [],
    lapTimes: [],
    pitStops: [],
    sprintResults: [],
    status: [],
    podiumCache: []
};

/* Load CSV Data Function */
async function loadCSVData() {
    try {
        const basePath = '../../dataset/';
        const files = {
            drivers: `${basePath}/drivers.csv`,
            races: `${basePath}/races.csv`,
            results: `${basePath}/results.csv`,
            constructors: `${basePath}/constructors.csv`,
            circuits: `${basePath}/circuits.csv`,
            qualifying: `${basePath}/qualifying.csv`,
            driverStandings: `${basePath}/driver_standings.csv`,
            constructorStandings: `${basePath}/constructor_standings.csv`,
            lapTimes: `${basePath}/lap_times.csv`,
            pitStops: `${basePath}/pit_stops.csv`,
            sprintResults: `${basePath}/sprint_results.csv`,
            status: `${basePath}/status.csv`,
        };

        for (const [key, filename] of Object.entries(files)) {
            const fileContent = await fs.readFile(filename, 'utf-8');
            const parsed = Papa.parse(fileContent, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            });
            dataStore[key] = parsed.data;
        }
    } catch (error) {
        console.error('Error loading CSV files:', error);
        throw error;
    }
}

/* Load Podium Cache */
async function loadPodiumCache() {
    try {
        const podiumCachePath = path.join(__dirname, '../../dataset/podium.csv');
        try {
            const fileContent = await fs.readFile(podiumCachePath, 'utf-8');
            const parsed = Papa.parse(fileContent, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            });
            dataStore.podiumCache = parsed.data;
        } catch (error) {
            if (error.code === 'ENOENT') {
                /* Create empty cache file if it doesn't exist */
                const headers = 'driver_number,year,headshot_url,team_colour,full_name\n';
                await fs.writeFile(podiumCachePath, headers);
                dataStore.podiumCache = [];
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error loading podium cache:', error);
        throw error;
    }
}

/* Initialize data loading on server start */
(async () => {
    try {
        await loadCSVData();
        await loadPodiumCache();
    } catch (error) {
        console.error('Failed to initialize data store:', error);
    }
})();

/* Get driver by ID */
function getDriverById(driverId) {
    return dataStore.drivers.find(d => d.driverId === parseInt(driverId));
}

/* Get race results */
function getRaceResults(year, round = null) {
    const race = dataStore.races.find(r => 
        r.year === parseInt(year) && (!round || r.round === parseInt(round))
    );
    
    if (!race) return null;
    
    const results = dataStore.results.filter(r => r.raceId === race.raceId);
    return { race, results };
}

/* ALL API Endpoints */

/* Check podium cache endpoint */
app.post('/api/check-podium-cache', express.json(), async (req, res) => {
    const { driverNumber, year } = req.body;
    
    try {
        const cachedRecord = dataStore.podiumCache.find(record => 
            record.driver_number === parseInt(driverNumber) && 
            record.year === parseInt(year)
        );
        
        if (cachedRecord) {
            return res.json({
                cached: true,
                driverInfo: cachedRecord
            });
        }
        return res.json({ cached: false });
    } catch (error) {
        console.error('Error checking podium cache:', error);
        return res.json({ cached: false });
    }
});

/* Save podium cache endpoint */
app.post('/api/save-podium-cache', express.json(), async (req, res) => {
    try {
        const podiumCachePath = path.join(__dirname, '../../dataset/podium.csv');
        const newRecord = {
            driver_number: parseInt(req.body.driver_number),
            year: parseInt(req.body.year),
            headshot_url: req.body.headshot_url,
            team_colour: req.body.team_colour,
            full_name: req.body.full_name
        };

        /* Check if record already exists */
        const existingIndex = dataStore.podiumCache.findIndex(record => 
            record.driver_number === newRecord.driver_number && 
            record.year === newRecord.year
        );

        if (existingIndex === -1) {
            /* Add new record */
            dataStore.podiumCache.push(newRecord);
            
            /* Write updated data to CSV */
            const csv = Papa.unparse(dataStore.podiumCache);
            await fs.writeFile(podiumCachePath, csv);
            
            return res.json({ success: true });
        }
        
        return res.json({ 
            success: false, 
            message: 'Record already exists' 
        });
    } catch (error) {
        console.error('Error saving to podium cache:', error);
        return res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

/* Season Stats Endpoint */
app.get('/api/season-stats', async (req, res) => {
    const { driverId, season = new Date().getFullYear() } = req.query;
    
    if (!driverId) {
        return res.status(400).json({ error: 'Driver ID is required' });
    }

    try {
        /* Fetch from Ergast API */
        const url = `http://api.jolpi.ca/ergast/f1/${season}/drivers/${driverId}/results.json`;
        const { data } = await axios.get(url);
        
        /* Check if race data is valid */
        if (!data.MRData?.RaceTable?.Races || data.MRData.RaceTable.Races.length === 0) {
            return res.status(404).json({ 
                error: 'No results found for driver in this season',
                points: 0,
                podiums: 0,
                wins: 0,
                dnfs: 0,
                averageFinish: 10,
                recentResults: []
            });
        }
        
        /* Process the results from API */
        const results = data.MRData.RaceTable.Races.map(race => {
            /* Each race should have at least one result for our driver */
            const result = race.Results[0];
            return {
                position: parseInt(result.position) || 20,
                points: parseFloat(result.points),
                positionText: result.positionText,
                status: result.status
            };
        });
        
        /* Calculate the statistics */
        const stats = {
            points: results.reduce((sum, race) => sum + race.points, 0),
            podiums: results.filter(race => race.position <= 3).length,
            wins: results.filter(race => race.position === 1).length,
            dnfs: results.filter(race => race.status === "Accident" || 
                                        race.status === "Retired" || 
                                        race.status.includes("Lap") ||
                                        race.positionText === 'R').length,
            averageFinish: results.reduce((sum, race) => 
                sum + (race.status === "Accident" || 
                      race.status === "Retired" || 
                      race.status.includes("Lap") ||
                      race.positionText === 'R' ? 20 : race.position), 0) / results.length,
            recentResults: results.slice(-5).map(race => 
                (race.status === "Accident" || 
                race.status === "Retired" || 
                race.status.includes("Lap") ||
                race.positionText === 'R') ? 'DNF' : race.position)
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error fetching season stats:', error);
        res.status(500).json({ 
            error: 'Failed to fetch season stats',
            points: 0,
            podiums: 0,
            wins: 0,
            dnfs: 0,
            averageFinish: 10,
            recentResults: []
        });
    }
});

/* Driver History Endpoint */
app.get('/api/driver-history', async (req, res) => {
    const {driverId, driverNum, circuitId } = req.query;
    if (!driverId || !driverNum || !circuitId) {
        return res.status(400).json({ error: 'Driver Number and circuit ID are required' });
    }
    try {
        const circuit = dataStore.circuits.find(c => 
            c.circuitRef.toLowerCase() === circuitId.replace(/-/g, '_').toLowerCase()
        );

        if (!circuit) {
            console.warn(`Circuit not found in local data: ${circuitId}`);
            throw new Error('Circuit not found in local data');
        }

        /* Get all races for this circuit */
        const allRaces = dataStore.races.filter(r => r.circuitId === circuit.circuitId);
        
        if (allRaces.length === 0) {
            console.warn(`No races found for circuit: ${circuitId}`);
            throw new Error('No races found for circuit');
        }

        /* Find driver with more flexible matching */
        const driver = dataStore.drivers.find(d => {
            /* Then try matching by driverId/driverRef */
            if (d.driverRef && d.driverRef.toLowerCase() === driverId.toLowerCase()) return true;
            
            return false;
        });

        if (!driver) {
            console.warn(`Driver not found: number=${driverNum}, id=${driverId}`);
            return res.status(404).json({ 
                error: 'Driver not found',
                trackWins: 0,
                trackPodiums: 0,
                dnfs: 0,
                recentResults: []
            });
        }

        let trackWins = 0;
        let trackPodiums = 0;
        let dnfs = 0;
        const recentResults = [];
        const currentYear = new Date().getFullYear();

        /* Process local data */
        for (const race of allRaces) {
            const result = dataStore.results.find(r => 
                r.raceId === race.raceId && 
                r.driverId === driver.driverId
            );
            
            if (result) {
                const position = parseInt(result.position) || 20;
                
                if (position === 1) trackWins++;
                if (position <= 3) trackPodiums++;
                if (result.positionText === 'R') dnfs++;

                if (race.year > currentYear - 25) {
                    recentResults.push({
                        year: race.year,
                        position: result.positionText === 'R' ? 'DNF' : position
                    });
                }
            }
        }

        const sortedResults = recentResults
            .sort((a, b) => b.year - a.year)
            .map(result => result.position);

        return res.json({
            trackWins,
            trackPodiums,
            dnfs,
            recentResults: sortedResults
        });

    } catch (error) {
        console.error('Error fetching driver history:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch driver history',
            trackWins: 0,
            trackPodiums: 0,
            dnfs: 0,
            recentResults: []
        });
    }
});

/* Team Stats Endpoint */
app.get('/api/team-stats', async (req, res) => {
    const { constructorId, year = new Date().getFullYear() } = req.query;
    
    if (!constructorId) {
        return res.status(400).json({ error: 'Constructor ID is required' });
    }

    try {
        /* Fetch team results from API */
        let url = `http://api.jolpi.ca/ergast/f1/${year}/constructors/${constructorId}/results.json`;
        let { data } = await axios.get(url);

        /* If no races in current season, try previous season */
        if (!data.MRData?.RaceTable?.Races || data.MRData.RaceTable.Races.length === 0) {
            url = `http://api.jolpi.ca/ergast/f1/${year-1}/constructors/${constructorId}/results.json`;
            const response = await axios.get(url);
            data = response.data;
        }

        /* If still no data, return error */
        if (!data.MRData?.RaceTable?.Races || data.MRData.RaceTable.Races.length === 0) {
            return res.status(404).json({ error: 'No results found for team' });
        }

        /* Process all results across all races */
        const allResults = data.MRData.RaceTable.Races.reduce((acc, race) => {
            return acc.concat(race.Results);
        }, []);

        if (allResults.length === 0) {
            return res.status(404).json({ error: 'No results found for team' });
        }

        /* Calculate statistics */
        const stats = {
            totalPoints: allResults.reduce((sum, result) => sum + parseInt(result.points), 0),
            wins: allResults.filter(result => result.position === "1").length,
            podiums: allResults.filter(result => parseInt(result.position) <= 3).length,
            dnfs: allResults.filter(result => result.status === "Retired" || result.status.includes("Lap")).length,
            averageFinish: allResults.reduce((sum, result) => {
                const position = result.status === "Finished" ? 
                    parseInt(result.position) : 
                    20; /* DNF or other issues */
                return sum + position;
            }, 0) / allResults.length,
            reliability: 1 - (allResults.filter(result => 
                result.status === "Retired" || result.status.includes("Lap")
            ).length / (allResults.length)),
            performance: allResults.reduce((sum, result) => {
                const position = result.status === "Finished" ? 
                    parseInt(result.position) : 
                    20;
                return sum + (21 - position);
            }, 0) / (allResults.length * 20)
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching team stats:', error);
        res.status(500).json({ error: 'Failed to fetch team stats' });
    }
});

/* Race Results Endpoint */
app.get('/api/race-results', async (req, res) => {
    const { driverId, year, round } = req.query;
    
    if (!driverId || !year) {
        return res.status(400).json({ error: 'Driver ID and year are required' });
    }

    try {
        /* First try to find the race in local data store */
        const race = dataStore.races.find(r => 
            r.year === parseInt(year) && (!round || r.round === parseInt(round))
        );

        if (!race) {
            /* If race not found in local data, try API */
            const url = `http://api.jolpi.ca/ergast/f1/${year}/drivers/${driverId}/results.json`;
            const { data } = await axios.get(url);
            
            /* Check if API returned any races */
            if (data.MRData?.RaceTable?.Races && data.MRData.RaceTable.Races.length > 0) {
                /* Find the race that matches the round if specified */
                let targetRace = data.MRData.RaceTable.Races;
                if (round) {
                    targetRace = targetRace.filter(r => r.round === round);
                }
                
                /* If we found the race and it has results, return the first result */
                if (targetRace.length > 0 && targetRace[0].Results && targetRace[0].Results.length > 0) {
                    const result = targetRace[0].Results[0];
                    return res.json({
                        position: result.position,
                        positionText: result.positionText,
                        points: result.points
                    });
                }
            }
            
            /* If we get here, API didn't have the data or no results */
            return res.status(404).json({ error: 'Race result not found' });
        }

        /* Use local data if race is found */
        const result = dataStore.results.find(r => 
            r.raceId === race.raceId && r.driverId === parseInt(driverId)
        );

        if (!result) {
            return res.status(404).json({ error: 'Race result not found' });
        }

        res.json({
            position: result.position,
            positionText: result.positionText,
            points: result.points
        });
    } catch (error) {
        console.error('Error fetching race results:', error);
        res.status(500).json({ error: 'Failed to fetch race results' });
    }
});

/* Driver Position Flow Endpoint */
app.get('/api/driver-positions', async (req, res) => {
    const { year, round, sessionKey} = req.query;
    
    if (!year || !round || !sessionKey) {
        return res.status(400).json({ error: 'Year and round and session key are required' });
    }
    
    /* Get driver data from OpenF1 API with error handling */
    let f1Response = { data: [] };
    try {
        const response = await axios.get(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
        f1Response = response;
    } catch (error) {
        console.warn('OpenF1 API error:', error.message);
    }
    
    try {
        const race = dataStore.races.find(r => 
            r.year === parseInt(year) && r.round === parseInt(round)
        );

        if (!race) {
            /* If race not found in local data store, fetch from API */
            const url = `http://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`;
            try {
                const { data } = await axios.get(url);
                
                /* Check if API returned valid race data */
                if (!data?.MRData?.RaceTable?.Races || data.MRData.RaceTable.Races.length === 0) {
                    return res.status(404).json({ error: 'Race data not available' });
                }
                
                /* Process API data for visualization */
                const raceData = data.MRData.RaceTable.Races[0];
                const driverPositions = await Promise.all(raceData.Results.map(async (result) => {
                    // Get driver details
                    const driverName = `${result.Driver.givenName} ${result.Driver.familyName}`;
                    const driverShortName = result.Driver.code || 
                        `${result.Driver.givenName[0]}${result.Driver.familyName.substring(0, 3)}`.toUpperCase();
                    
                    /* Grid position (starting position) */
                    const gridPosition = parseInt(result.grid) || 20; /* Default to 20 if not available */
                    
                    /* Finishing position */
                    const finishPosition = result.positionText === 'R' ? 21 : parseInt(result.position); /* Use 21 for DNF */
                    
                    /* Try to get team color from OpenF1 API by driver number */
                    let teamColor = null;
                    try {
                        /* Use driver number for more reliable matching */
                        let driverNumber = result.Driver.permanentNumber;
                        if (driverNumber == 33){
                            driverNumber = 1;
                        }else if (driverNumber == 61){
                            driverNumber = 7;
                        }else if (driverNumber == 38){
                            driverNumber = 87;
                        }
                        if (driverNumber && f1Response.data && Array.isArray(f1Response.data) && f1Response.data.length > 0) {
                            /* Loop through all drivers in the response */
                            for (let i = 0; i < f1Response.data.length; i++) {
                                if (f1Response.data[i].driver_number == driverNumber) {
                                    teamColor = f1Response.data[i].team_colour;
                                    if (teamColor && !teamColor.startsWith('#')) {
                                        teamColor = `#${teamColor}`;
                                    }
                                    break; 
                                }
                            }
                        }
                    } catch (openF1Error) {
                        console.warn(`Failed to get OpenF1 data for driver ${result.Driver.permanentNumber}:`, openF1Error.message);
                    }
                    
                    return {
                        driverName: driverName,
                        driverShortName: driverShortName,
                        driverId: result.Driver.driverId,
                        teamId: result.Constructor.constructorId,
                        teamName: result.Constructor.name,
                        teamColor: teamColor || "#666666",
                        gridPosition: gridPosition,
                        finishPosition: finishPosition,
                        status: result.status,
                        positionChange: gridPosition - (result.positionText === 'R' ? 21 : parseInt(result.position))
                    };
                }));
                
                /* Prepare nodes and links for the visualization */
                const nodes = [];
                const links = [];
                
                /* Create two nodes for each driver (start and finish) */
                driverPositions.forEach(dp => {
                    /* Source node (Starting position) */
                    nodes.push({
                        id: `${dp.driverShortName}_start`,
                        name: dp.driverShortName,
                        fullName: dp.driverName,
                        team: dp.teamName,
                        teamColor: dp.teamColor, /* Add team color to nodes */
                        position: dp.gridPosition,
                        type: 'start',
                        sortKey: dp.gridPosition /* Sort by grid position */
                    });
                    
                    /* Target node (Finishing position) */
                    nodes.push({
                        id: `${dp.driverShortName}_finish`,
                        name: dp.driverShortName,
                        fullName: dp.driverName,
                        team: dp.teamName,
                        teamColor: dp.teamColor,
                        position: dp.finishPosition === 21 ? 'DNF' : dp.finishPosition,
                        type: 'finish',
                        sortKey: dp.finishPosition /* Sort by finish position */
                    });
                    
                    /* Link from start to finish */
                    links.push({
                        source: `${dp.driverShortName}_start`,
                        target: `${dp.driverShortName}_finish`,
                        value: 1,
                        team: dp.teamId,
                        teamColor: dp.teamColor, 
                        driverName: dp.driverName,
                        positionChange: dp.positionChange
                    });
                });
                
                /* Sort nodes by position */
                nodes.sort((a, b) => {
                    if (a.type === b.type) {
                        /* If same type, sort by position */
                        return a.sortKey - b.sortKey;
                    }
                    /* Otherwise, keep start nodes and finish nodes grouped */
                    return a.type === 'start' ? -1 : 1;
                });
                
                return res.json({ nodes, links });
            } catch (apiError) {
                console.error('Error fetching from API:', apiError);
                return res.status(500).json({ error: 'Failed to fetch race data from API' });
            }
        }
        
        /* Using local data store */
        const raceResults = dataStore.results.filter(r => r.raceId === race.raceId);
        
        /* Map drivers with their start and finish positions */
        const driverPositions = await Promise.all(raceResults.map(async (result) => {
            const driver = dataStore.drivers.find(d => d.driverId === result.driverId);
            const constructor = dataStore.constructors.find(c => c.constructorId === result.constructorId);
             
            /* Grid position */
            const gridPosition = result.grid || 20; /* Default to 20 if not available */
            
            /* Finishing position */
            const finishPosition = result.positionText === 'R' ? 21 : parseInt(result.position); /* Use 21 for DNF */
            
            const driverName = driver ? `${driver.forename} ${driver.surname}` : 'Unknown Driver';
            
            /* Try to get team color from OpenF1 API using driver number */
            let teamColor = null;
            try {
                if (driver && driver.number) {
                    const driverNumber = driver.number;
                    
                    /* Use the data we already have instead of making a new request */
                    if (f1Response.data && Array.isArray(f1Response.data) && f1Response.data.length > 0) {
                        for (let i = 0; i < f1Response.data.length; i++) {
                            if (f1Response.data[i].driver_number == driverNumber) {
                                teamColor = f1Response.data[i].team_colour;
                                if (teamColor && !teamColor.startsWith('#')) {
                                    teamColor = `#${teamColor}`;
                                }
                                break;
                            }
                        }
                    }
                }
            } catch (openF1Error) {
                console.warn(`Failed to get OpenF1 data for driver number ${driver?.number}:`, openF1Error.message);
            }
            
            return {
                driverName: driverName,
                driverShortName: driver ? (driver.code || `${driver.forename[0]}${driver.surname.substring(0, 3)}`).toUpperCase() : 'UNK',
                driverId: driver ? driver.driverId : null,
                teamId: constructor ? constructor.constructorRef : 'unknown',
                teamName: constructor ? constructor.name : 'Unknown Team',
                teamColor: teamColor || "#666666", /* Fallback color if API doesn't return one */
                gridPosition: gridPosition,
                finishPosition: finishPosition,
                status: result.status,
                positionChange: gridPosition - (result.positionText === 'R' ? 21 : parseInt(result.position))
            };
        }));

        /* Prepare nodes and links for the visualization */
        const nodes = [];
        const links = [];
        
        /* Create two nodes for each driver (start and finish) */
        driverPositions.forEach(dp => {
            /* Source node (Starting position) */
            nodes.push({
                id: `${dp.driverShortName}_start`,
                name: dp.driverShortName,
                fullName: dp.driverName,
                team: dp.teamName,
                teamColor: dp.teamColor,
                position: dp.gridPosition,
                type: 'start',
                sortKey: dp.gridPosition /* Sort by grid position */
            });
            
            /* Target node (Finishing position) */
            nodes.push({
                id: `${dp.driverShortName}_finish`,
                name: dp.driverShortName,
                fullName: dp.driverName,
                team: dp.teamName,
                teamColor: dp.teamColor,
                position: dp.finishPosition === 21 ? 'DNF' : dp.finishPosition,
                type: 'finish',
                sortKey: dp.finishPosition /* Sort by finish position */
            });
            
            /* Link from start to finish */
            links.push({
                source: `${dp.driverShortName}_start`,
                target: `${dp.driverShortName}_finish`,
                value: 1,
                team: dp.teamId,
                teamColor: dp.teamColor, 
                driverName: dp.driverName,
                positionChange: dp.positionChange
            });
        });

        /* Sort nodes by position */
        nodes.sort((a, b) => {
            if (a.type === b.type) {
                /* If same type, sort by position */
                return a.sortKey - b.sortKey;
            }
            /* Otherwise, keep start nodes and finish nodes grouped */
            return a.type === 'start' ? -1 : 1;
        });

        res.json({ nodes, links });
    } catch (error) {
        console.error('Error fetching driver positions:', error);
        res.status(500).json({ error: 'Failed to fetch driver positions' });
    }
});

/* Driver Details Endpoint */
app.get('/api/driver-details', async (req, res) => {
    const { driverName } = req.query;

    if (!driverName) {
        return res.status(400).json({ error: 'Driver name is required.' });
    }
    try {
        const driverSlug = driverName.toLowerCase().replace(/\s+/g, '-');
        const url = `https://www.formula1.com/en/drivers/${driverSlug}.html`;
        const { data } = await axios.get(url);
        
        const $ = cheerio.load(data);
        /* Target the specific grid container */
        const statsGrid = $('.grid.gap-x-normal.gap-y-xs.f1-grid');
        const stats = {};
        /* Extract all dt/dd pairs from the grid */
        statsGrid.find('dt').each((index, element) => {
            const label = $(element).text().trim();
            const value = $(element).next('dd').text().trim();
            
            /* Clean up the labels to use as keys */
            const key = label.toLowerCase()
                           .replace(/^team$/, 'team')
                           .replace(/^country$/, 'country')
                           .replace(/^podiums$/, 'podiums')
                           .replace(/^points$/, 'points')
                           .replace(/^world championships$/, 'worldChampionships')
                           .replace(/^highest race finish$/, 'highestFinish')
                           .replace(/^highest grid position$/, 'highestGrid')
                           .replace(/^date of birth$/, 'dateOfBirth')
                           .replace(/^place of birth$/, 'birthplace')
                           .replace(/^grands prix entered$/, 'grandsPrixEntered');

            stats[key] = value;
        });

        res.json(stats);
    } catch (error) {
        console.error('Error fetching driver details:', error.message);
        res.status(500).json({ error: 'Failed to fetch driver details.' });
    }
});

/* Next Race Endpoint */
app.get('/api/next-race', async (req, res) => {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const nextRace = await fetchNextRaceFromCalendar(currentYear);
        if (!nextRace) {
            return res.status(404).json({ error: 'No upcoming races found' });
        }
        return res.json(nextRace);
    } catch (error) {
        console.error('Error in /api/next-race:', error);
        res.status(500).json({ error: 'Failed to fetch next race' });
    }
});

/* Fetch Next Race From Calendar */
async function fetchNextRaceFromCalendar(season) {
    try {
        const url = `http://api.jolpi.ca/ergast/f1/${season}/races`;
        const { data } = await axios.get(url);
        
        if (!data?.MRData?.RaceTable?.Races || data.MRData.RaceTable.Races.length === 0) {
            throw new Error('No races found for season');
        }

        const races = data.MRData.RaceTable.Races.map(race => ({
            date: new Date(`${race.date}T${race.time || '00:00:00'}`),
            name: race.raceName,
            track: race.Circuit.circuitName,
            circuitId: race.Circuit.circuitId,
            season: parseInt(race.season)
        }));

        const now = new Date();
        return races.find(race => race.date > now);

    } catch (error) {
        console.error('Error fetching race calendar:', error);
        throw error;
    }
}

/* Top Three Drivers Endpoint */
app.get('/api/top-three', async (req, res) => {
    const { year, raceName } = req.query;

    if (!year || !raceName) {
        return res.status(400).json({ 
            error: 'Year and raceName are required query parameters.' 
        });
    }

    try {
        /* First check if we have this race in our local data store */
        const race = dataStore.races.find(r => 
            r.year === parseInt(year) && 
            r.name.toLowerCase().includes(raceName.toLowerCase().replace(/-/g, ' '))
        );

        if (race) {
            /* Use local data if available */
            const topThree = dataStore.results
                .filter(r => r.raceId === race.raceId)
                .sort((a, b) => parseInt(a.position) - parseInt(b.position))
                .slice(0, 3)
                .map(result => {
                    const driver = dataStore.drivers.find(d => d.driverId === result.driverId);
                    const constructor = dataStore.constructors.find(c => c.constructorId === result.constructorId);
                    return {
                        position: result.position,
                        name: driver ? `${driver.forename} ${driver.surname}` : 'Unknown Driver',
                        team: constructor?.name || 'Unknown Team',
                        time: result.time,
                        number: driver?.number || null 
                    };
                });

            return res.json({ topThree });
        }
        
        /* First, try to find the race in the F1 calendar via API */
        const calendarUrl = `http://api.jolpi.ca/ergast/f1/${year}/races.json`;
        const calendarResponse = await axios.get(calendarUrl);
        const calendarData = calendarResponse.data;
        if (calendarData.MRData?.RaceTable?.Races) {
            /* Find the race that matches the provided name */
            const races = calendarData.MRData.RaceTable.Races;
            const matchedRace = races.find(r => {
                const raceLower = r.raceName.toLowerCase();
                const circuitLower = r.Circuit.circuitName.toLowerCase();
                const localityLower = r.Circuit.Location.locality.toLowerCase();
                const nameToMatch = raceName.toLowerCase().replace(/-/g, ' ');
                
                /* Try various matching techniques */
                return raceLower.includes(nameToMatch) || 
                       nameToMatch.includes(raceLower) ||
                       circuitLower.includes(nameToMatch) ||
                       localityLower === nameToMatch;
            });
            
            if (matchedRace) {
                const round = matchedRace.round;
                const resultsUrl = `http://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`;
                const resultsResponse = await axios.get(resultsUrl);
                const resultsData = resultsResponse.data;
                
                if (resultsData.MRData?.RaceTable?.Races?.length > 0) {
                    const raceResults = resultsData.MRData.RaceTable.Races[0];
                    const topThree = raceResults.Results
                        .slice(0, 3)
                        .map(result => ({
                            position: result.position,
                            name: `${result.Driver.givenName} ${result.Driver.familyName}`,
                            team: result.Constructor.name,
                            time: result.Time?.time || '',
                            number: parseInt(result.Driver.permanentNumber) || null
                        }));
                    
                    return res.json({ topThree });
                }
            }
        }

        /* If all else fails, return an empty array with a message */
        return res.json({ 
            topThree: [],
            message: "Podium data not available for this race yet"
        });
    } catch (error) {
        console.error('Error fetching top three:', error);
        res.status(500).json({ 
            error: 'Failed to fetch podium data',
            topThree: [] 
        });
    }
});

/* Get Driver Headshot */
async function getDriverHeadshot(driverName) {
    try {
        // Format driver name for URL
        switch (driverName) {
            case "Alexander Albon":
                driverName = "Alex Albon";
                break;
            case "Guanyu Zhou":
                driverName = "Zhou Guanyu";
                break;
        }
        const formattedName = driverName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const url = `https://www.motorsport.com/driver/${formattedName}`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        /* Try multiple possible selectors for the image */
        let imageUrl = null;
        
        /* Look for the image element with more specific selectors */
        const imageElement = $('img[loading="eager"][class*="ms-item_img"]').first();
        if (imageElement.length) {
            imageUrl = imageElement.attr('src');
            if (imageUrl) return imageUrl;
        }

        /* Fallback: try to find any img within picture element */
        if (!imageUrl) {
            const picture = $('picture').first();
            if (picture.length) {
                const img = picture.find('img').first();
                if (img.length) {
                    imageUrl = img.attr('src');
                    if (imageUrl) return imageUrl;
                }

                /* Try to get srcset from source elements */
                const sources = picture.find('source');
                if (sources.length) {
                    sources.each((_, source) => {
                        const srcset = $(source).attr('srcset');
                        if (srcset) {
                            const srcsetParts = srcset.split(',');
                            const images = srcsetParts.map(part => {
                                const [url, width] = part.trim().split(' ');
                                return {
                                    url: url.trim(),
                                    width: parseInt(width || '0')
                                };
                            });
                            
                            /* Sort by width and get the largest image */
                            const largestImage = images.sort((a, b) => b.width - a.width)[0];
                            if (largestImage?.url) {
                                imageUrl = largestImage.url;
                                return false; 
                            }
                        }
                    });
                }
            }
        }

        return imageUrl;
    } catch (error) {
        console.warn(`Failed to fetch headshot for ${driverName}:`, error.message);
        return null;
    }
}

/* Fetch Drivers For Season */
async function fetchDriversForSeason(season) {
    try {
        let url = `http://api.jolpi.ca/ergast/f1/${season}/results.json`;
        let { data } = await axios.get(url);
    
        if (!data.MRData?.RaceTable?.Races || data.MRData.RaceTable.Races.length === 0) {
            url = `http://api.jolpi.ca/ergast/f1/${season-1}/results.json`;
            const response = await axios.get(url);
            data = response.data;
        }

        if (!data.MRData?.RaceTable?.Races || data.MRData.RaceTable.Races.length === 0) {
            return [];
        }
        const driversMap = new Map();
        
        /* Process drivers and get their headshots */
        const driversPromises = [];
        
        data.MRData.RaceTable.Races.forEach(race => {
            race.Results.forEach(result => {
                const driver = result.Driver;
                const constructor = result.Constructor;
                if (!driversMap.has(driver.driverId)) {
                    const driverName = `${driver.givenName} ${driver.familyName}`;
                    const driverData = {
                        name: driverName,
                        number: driver.permanentNumber,
                        driverId: driver.driverId,
                        teamName: constructor.name,
                        teamId: constructor.constructorId,
                    };
                    driversMap.set(driver.driverId, driverData);
                    /* Add promise to fetch headshot */
                    driversPromises.push(
                        getDriverHeadshot(driverName)
                            .then(headshot => {
                                if (headshot) {
                                    driverData.driverHeadshot = headshot;
                                }
                            })
                    );
                }
            });
        });
         
        /* Wait for all headshot requests to complete */
        await Promise.allSettled(driversPromises);
        
        return Array.from(driversMap.values());
    } catch (error) {
        console.error('Error in fetchDriversForSeason:', error);
        return [];
    }
}

/* Current Drivers Endpoint */
app.get('/api/current-drivers', async (req, res) => {
    const { season } = req.query;
    if (!season) {
        return res.status(400).json({ error: 'Season is required' });
    }
    try {
        const seasonYear = parseInt(season);
        const races = dataStore.races.filter(r => r.year === seasonYear);
        if (races.length === 0) {
            const drivers = await fetchDriversForSeason(seasonYear);
            return res.json(drivers);
        }

        const latestRace = races[races.length - 1];
        const results = dataStore.results.filter(r => r.raceId === latestRace.raceId);
        
        const driversPromises = [];
        const currentDrivers = await Promise.all(results.map(async result => {
            const constructor = dataStore.constructors.find(c => c.constructorId === result.constructorId);
            const driver = dataStore.drivers.find(d => d.driverId === result.driverId);
            const driverName = `${driver.forename} ${driver.surname}`;
            
            const driverData = {
                name: driverName,
                number: driver.number,
                driverId: driver.driverId,
                teamName: constructor.name,
                teamId: constructor.constructorId
            };
            
            /* Fetch headshot */
            const headshot = await getDriverHeadshot(driverName);
            if (headshot) {
                driverData.driverHeadshot = headshot;
            }
            
            return driverData;
        }));
        
        if (currentDrivers.length === 0) {
            const drivers = await fetchDriversForSeason(seasonYear);
            return res.json(drivers);
        }

        res.json(currentDrivers);
    } catch (error) {
        console.error('Error fetching current drivers:', error);
        res.status(500).json({ error: 'Failed to fetch current drivers' });
    }
});

/* Start the server */
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});