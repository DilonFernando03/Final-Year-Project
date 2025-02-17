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

// Global data store
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

// Load CSV data function
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

        console.log('All CSV files loaded successfully');
    } catch (error) {
        console.error('Error loading CSV files:', error);
        throw error;
    }
}

// Loading podium data
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
            console.log('Podium cache loaded successfully');
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Create empty cache file if it doesn't exist
                const headers = 'driver_number,year,headshot_url,team_colour,full_name\n';
                await fs.writeFile(podiumCachePath, headers);
                console.log('Created new podium cache file');
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

// Initialize data loading on server start
(async () => {
    try {
        await loadCSVData();
        await loadPodiumCache();
    } catch (error) {
        console.error('Failed to initialize data store:', error);
    }
})();

// Helper function to get driver by ID
function getDriverById(driverId) {
    return dataStore.drivers.find(d => d.driverId === parseInt(driverId));
}

// Helper function to get race results
function getRaceResults(year, round = null) {
    const race = dataStore.races.find(r => 
        r.year === parseInt(year) && (!round || r.round === parseInt(round))
    );
    
    if (!race) return null;
    
    const results = dataStore.results.filter(r => r.raceId === race.raceId);
    return { race, results };
}

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

        // Check if record already exists
        const existingIndex = dataStore.podiumCache.findIndex(record => 
            record.driver_number === newRecord.driver_number && 
            record.year === newRecord.year
        );

        if (existingIndex === -1) {
            // Add new record
            dataStore.podiumCache.push(newRecord);
            
            // Write updated data to CSV
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


// Season stats endpoint
app.get('/api/season-stats', async (req, res) => {
    const { driverId, season = new Date().getFullYear() } = req.query;
    
    if (!driverId) {
        return res.status(400).json({ error: 'Driver ID is required' });
    }

    try {
        // Get races for the season
        const races = dataStore.races.filter(r => r.year === parseInt(season));
        if (races.length === 0) {
            // Fallback to API if no local data
            const url = `http://api.jolpi.ca/ergast/f1/${season}/drivers/${driverId}/results.json`;
            const { data } = await axios.get(url);
            return res.json(data);
        }

        const results = [];
        for (const race of races) {
            const raceResult = dataStore.results.find(r => 
                r.raceId === race.raceId && r.driverId === parseInt(driverId)
            );
            if (raceResult) {
                results.push({
                    position: parseInt(raceResult.position) || 20,
                    points: parseFloat(raceResult.points),
                    positionText: raceResult.positionText
                });
            }
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'No results found for driver in this season' });
        }

        const stats = {
            points: results.reduce((sum, race) => sum + race.points, 0),
            podiums: results.filter(race => race.position <= 3).length,
            wins: results.filter(race => race.position === 1).length,
            dnfs: results.filter(race => race.positionText === 'R').length,
            averageFinish: results.reduce((sum, race) => 
                sum + (race.positionText === 'R' ? 20 : race.position), 0) / results.length,
            recentResults: results.slice(-3).map(race => 
                race.positionText === 'R' ? 20 : race.position)
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching season stats:', error);
        res.status(500).json({ error: 'Failed to fetch season stats' });
    }
});

app.get('/api/driver-history', async (req, res) => {
    const {driverId, driverNum, circuitId } = req.query;
    if (!driverId || !driverNum || !circuitId) {
        return res.status(400).json({ error: 'Driver Number and circuit ID are required' });
    }
    try {
        // First attempt to get data from local dataset
        const circuit = dataStore.circuits.find(c => 
            c.circuitRef.toLowerCase() === circuitId.replace(/-/g, '_').toLowerCase()
        );

        if (!circuit) {
            console.warn(`Circuit not found in local data: ${circuitId}`);
            throw new Error('Circuit not found in local data');
        }

        // Get all races for this circuit
        const allRaces = dataStore.races.filter(r => r.circuitId === circuit.circuitId);
        
        if (allRaces.length === 0) {
            console.warn(`No races found for circuit: ${circuitId}`);
            throw new Error('No races found for circuit');
        }

        // Find driver with more flexible matching
        const driver = dataStore.drivers.find(d => {
            // First try exact number match
            if (d.number === parseInt(driverNum)) return true;
            
            // Then try matching by driverId/driverRef
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

        // Process local data
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

                if (race.year > currentYear - 6) {
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

// Team stats endpoint
app.get('/api/team-stats', async (req, res) => {
    const { constructorId, year = new Date().getFullYear() } = req.query;
    
    if (!constructorId) {
        return res.status(400).json({ error: 'Constructor ID is required' });
    }

    try {
        // Fetch team results from API
        let url = `http://api.jolpi.ca/ergast/f1/${year}/constructors/${constructorId}/results.json`;
        let { data } = await axios.get(url);

        // If no races in current season, try previous season
        if (!data.MRData?.RaceTable?.Races || data.MRData.RaceTable.Races.length === 0) {
            url = `http://api.jolpi.ca/ergast/f1/${year-1}/constructors/${constructorId}/results.json`;
            const response = await axios.get(url);
            data = response.data;
        }

        // If still no data, return error
        if (!data.MRData?.RaceTable?.Races || data.MRData.RaceTable.Races.length === 0) {
            return res.status(404).json({ error: 'No results found for team' });
        }

        // Process all results across all races
        const allResults = data.MRData.RaceTable.Races.reduce((acc, race) => {
            return acc.concat(race.Results);
        }, []);

        if (allResults.length === 0) {
            return res.status(404).json({ error: 'No results found for team' });
        }

        // Calculate statistics
        const stats = {
            totalPoints: allResults.reduce((sum, result) => sum + parseInt(result.points), 0),
            wins: allResults.filter(result => result.position === "1").length,
            podiums: allResults.filter(result => parseInt(result.position) <= 3).length,
            dnfs: allResults.filter(result => result.status === "Retired" || result.status.includes("Lap")).length,
            averageFinish: allResults.reduce((sum, result) => {
                const position = result.status === "Finished" ? 
                    parseInt(result.position) : 
                    20; // DNF or other issues
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

// Race results endpoint
app.get('/api/race-results', async (req, res) => {
    const { driverId, year, round } = req.query;
    
    if (!driverId || !year) {
        return res.status(400).json({ error: 'Driver ID and year are required' });
    }

    try {
        const race = dataStore.races.find(r => 
            r.year === parseInt(year) && (!round || r.round === parseInt(round))
        );


        if (!race) {
            const url = `http://api.jolpi.ca/ergast/f1/${year}/drivers/${driverId}/results.json`;
            const { data } = await axios.get(url);
            return res.json(data);
        }

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

// Team Position Flow endpoint
app.get('/api/team-positions', async (req, res) => {
    const { year, round } = req.query;
    
    if (!year || !round) {
        return res.status(400).json({ error: 'Year and round are required' });
    }

    try {
        const race = dataStore.races.find(r => 
            r.year === parseInt(year) && r.round === parseInt(round)
        );

        if (!race) {
            const url = `http://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`;
            const { data } = await axios.get(url);
            return res.json(data);
        }

        const raceResults = dataStore.results.filter(r => r.raceId === race.raceId)
            .map(result => {
                const constructor = dataStore.constructors.find(c => c.constructorId === result.constructorId);
                const driver = dataStore.drivers.find(d => d.driverId === result.driverId);
                return {
                    team: constructor?.constructorRef || 'unknown',
                    position: parseInt(result.position) || 20,
                    driver: driver ? `${driver.forename} ${driver.surname}` : 'Unknown Driver'
                };
            });

        const positionRanges = {
            'Podium (1-3)': [1, 2, 3],
            'Top 5 (4-5)': [4, 5],
            'Points (6-10)': [6, 7, 8, 9, 10],
            'Outside Points (11-20)': Array.from({length: 10}, (_, i) => i + 11)
        };

        const teams = [...new Set(raceResults.map(r => r.team))];
        const nodes = [
            ...teams.map(team => ({ name: team })),
            ...Object.keys(positionRanges).map(range => ({ name: range }))
        ];

        const links = raceResults.map(result => {
            const teamIndex = teams.indexOf(result.team);
            const positionRange = Object.entries(positionRanges).find(([_, positions]) => 
                positions.includes(result.position)
            );
            const rangeIndex = teams.length + Object.keys(positionRanges).indexOf(positionRange[0]);
            
            return {
                source: teamIndex,
                target: rangeIndex,
                value: 1,
                driver: result.driver
            };
        });

        res.json({ nodes, links });
    } catch (error) {
        console.error('Error fetching team positions:', error);
        res.status(500).json({ error: 'Failed to fetch team positions' });
    }
});



// Driver details endpoint
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

        // Target the specific grid container
        const statsGrid = $('.grid.gap-x-normal.gap-y-xs.f1-grid');
        const stats = {};

        // Extract all dt/dd pairs from the grid
        statsGrid.find('dt').each((index, element) => {
            const label = $(element).text().trim();
            const value = $(element).next('dd').text().trim();
            
            // Clean up the labels to use as keys
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

// Next race endpoint
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

// Current drivers endpoint
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

// Top three drivers endpoint
app.get('/api/top-three', async (req, res) => {
    const { year, raceName } = req.query;

    if (!year || !raceName) {
        return res.status(400).json({ 
            error: 'Year and raceName are required query parameters.' 
        });
    }

    try {
        const race = dataStore.races.find(r => 
            r.year === parseInt(year) && 
            r.name.toLowerCase().includes(raceName.toLowerCase().replace(/-/g, ' '))
        );

        if (!race) {
            // Fallback to web scraping
            const raceSlug = `${year}-${raceName.replace(/\s+/g, '-').toLowerCase()}-grand-prix`;
            const raceUrl = `https://pitwall.app/races/${raceSlug}`;
            const { data } = await axios.get(raceUrl);
            const $ = cheerio.load(data);
        
            const topThree = [];
            
            // Find the race results table
            const resultsTable = $('.race-results-table');
            
            // Get top 3 rows from the table
            resultsTable.find('tr').slice(1, 4).each((index, element) => {
                const position = $(element).find('.position').text().trim();
                const driverName = $(element).find('.driver-name').text().trim();
                const teamName = $(element).find('.constructor-name').text().trim();
                const timeElement = $(element).find('.time');
                const time = timeElement.length ? timeElement.text().trim() : '';

                // Try to find driver number from the driver element
                const driverNumberMatch = $(element)
                    .find('.driver-number')
                    .text()
                    .trim()
                    .match(/\d+/);
                const number = driverNumberMatch ? parseInt(driverNumberMatch[0]) : null;
                
                // Format data consistently with our database response
                topThree.push({
                    position: position,
                    name: driverName,
                    team: teamName,
                    time: time,
                    number: number
                });
            });
            
            // If no results found from scraping, try alternate table structure
            if (topThree.length === 0) {
                $('.results-summary .driver-result').slice(0, 3).each((index, element) => {
                    const position = (index + 1).toString();
                    const driverName = $(element).find('.driver-name').text().trim();
                    const teamName = $(element).find('.team-name').text().trim();
                    const timeElement = $(element).find('.time-gap');
                    const time = timeElement.length ? timeElement.text().trim() : '';
                    
                    // Try to find driver number
                    const driverNumberMatch = $(element)
                        .find('.driver-number')
                        .text()
                        .trim()
                        .match(/\d+/);
                    const number = driverNumberMatch ? parseInt(driverNumberMatch[0]) : null;
        
                    topThree.push({
                        position: position,
                        name: driverName,
                        team: teamName,
                        time: time,
                        number: number
                    });
                });
            }
            
            // Log what we found for debugging
            console.log('Scraped top three:', topThree);
            
            // If we still have no results, try one more alternate structure
            if (topThree.length === 0) {
                $('.podium-results .podium-position').each((index, element) => {
                    const position = (index + 1).toString();
                    const driverName = $(element).find('.driver-name').text().trim();
                    const teamName = $(element).find('.team-name').text().trim();
                    const timeElement = $(element).find('.finishing-time');
                    const time = timeElement.length ? timeElement.text().trim() : '';
                    
                    const driverNumberMatch = $(element)
                        .find('.driver-number')
                        .text()
                        .trim()
                        .match(/\d+/);
                    const number = driverNumberMatch ? parseInt(driverNumberMatch[0]) : null;
        
                    topThree.push({
                        position: position,
                        name: driverName,
                        team: teamName,
                        time: time,
                        number: number
                    });
                });
            }
        
            return res.json({ topThree });
        }

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
                    number: driver?.number || null // Ensure driver number is included
                };
            });

        res.json({ topThree });
    } catch (error) {
        console.error('Error fetching top three:', error);
        res.status(500).json({ error: 'Failed to fetch top three drivers' });
    }
});

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

        // Try multiple possible selectors for the image
        let imageUrl = null;
        
        // Look for the image element with more specific selectors
        const imageElement = $('img[loading="eager"][class*="ms-item_img"]').first();
        if (imageElement.length) {
            imageUrl = imageElement.attr('src');
            if (imageUrl) return imageUrl;
        }

        // Fallback: try to find any img within picture element
        if (!imageUrl) {
            const picture = $('picture').first();
            if (picture.length) {
                const img = picture.find('img').first();
                if (img.length) {
                    imageUrl = img.attr('src');
                    if (imageUrl) return imageUrl;
                }

                // Try to get srcset from source elements
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
                            
                            // Sort by width and get the largest image
                            const largestImage = images.sort((a, b) => b.width - a.width)[0];
                            if (largestImage?.url) {
                                imageUrl = largestImage.url;
                                return false; // break each loop
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
        
        // Process drivers and get their headshots
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
                        teamId: constructor.constructorId
                    };
                    driversMap.set(driver.driverId, driverData);
                    
                    // Add promise to fetch headshot
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
        
        // Wait for all headshot requests to complete
        await Promise.allSettled(driversPromises);
        
        return Array.from(driversMap.values());
    } catch (error) {
        console.error('Error in fetchDriversForSeason:', error);
        return [];
    }
}

// The current drivers endpoint
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
            
            // Fetch headshot
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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});