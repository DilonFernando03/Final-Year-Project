const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { Round } = require('@tensorflow/tfjs');
const Papa = require('papaparse');
const fs = require('fs').promises;

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
    status: []
};

// Load CSV data function
async function loadCSVData() {
    try {
        const basePath = 'C:/Users/Gamer X/Documents/Github/Final-Year-Project/final-year-project/src/dataset';
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
            status: `${basePath}/status.csv`
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

// Initialize data loading on server start
(async () => {
    try {
        await loadCSVData();
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

// Modified endpoints to use local data first

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
            // Process API data...
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

// Driver history endpoint
app.get('/api/driver-history', async (req, res) => {
    const { driverId, circuitId } = req.query;
    if (!driverId || !circuitId) {
        return res.status(400).json({ error: 'Driver ID and circuit ID are required' });
    }

    try {
        const circuit = dataStore.circuits.find(c => 
            c.circuitRef.toLowerCase() === circuitId.replace(/-/g, '_').toLowerCase()
        );

        if (!circuit) {
            return res.status(404).json({ error: 'Circuit not found' });
        }

        const races = dataStore.races.filter(r => r.circuitId === circuit.circuitId);
        let trackWins = 0;
        let trackPodiums = 0;
        let dnfs = 0;
        const recentResults = [];

        for (const race of races) {
            const result = dataStore.results.find(r => 
                r.raceId === race.raceId && r.driverId === parseInt(driverId)
            );

            if (result) {
                const position = parseInt(result.position) || 20;
                if (position === 1) trackWins++;
                if (position <= 3) trackPodiums++;
                if (result.positionText === 'R') dnfs++;

                if (race.year > new Date().getFullYear() - 6) {
                    recentResults.push({
                        year: race.year,
                        position: result.positionText === 'R' ? 'DNF' : position
                    });
                }
            }
        }

        res.json({
            trackWins,
            trackPodiums,
            dnfs,
            recentResults: recentResults
                .sort((a, b) => b.year - a.year)
                .map(result => result.position)
        });

    } catch (error) {
        console.error('Error fetching driver history:', error);
        res.status(500).json({ 
            error: 'Failed to fetch driver history',
            details: error.message 
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
        const constructor = dataStore.constructors.find(c => 
            c.constructorRef.toLowerCase() === constructorId.toLowerCase()
        );

        if (!constructor) {
            // Fallback to API
            const url = `http://api.jolpi.ca/ergast/f1/${year}/constructors/${constructorId}/results.json`;
            const { data } = await axios.get(url);
            return res.json(data);
        }

        const races = dataStore.races.filter(r => r.year === parseInt(year));
        const results = [];

        for (const race of races) {
            const raceResults = dataStore.results.filter(r => 
                r.raceId === race.raceId && r.constructorId === constructor.constructorId
            );
            results.push(...raceResults);
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'No results found for team' });
        }

        const stats = {
            totalPoints: results.reduce((sum, result) => sum + parseFloat(result.points), 0),
            wins: results.filter(result => result.position === '1').length,
            podiums: results.filter(result => parseInt(result.position) <= 3).length,
            dnfs: results.filter(result => result.positionText === 'R').length,
            averageFinish: results.reduce((sum, result) => 
                sum + (result.positionText === 'R' ? 20 : parseInt(result.position)), 0) / results.length,
            reliability: 1 - (results.filter(result => result.positionText === 'R').length / (results.length * 2)),
            performance: results.reduce((sum, result) => 
                sum + (21 - (result.positionText === 'R' ? 20 : parseInt(result.position))), 0) / (results.length * 20)
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

async function fetchDriversForSeason(season) {
    const url = `http://api.jolpi.ca/ergast/f1/${season}/drivers.json`;
    const { data } = await axios.get(url);
    
    if (!data.MRData?.DriverTable?.Drivers) {
        return [];
    }

    return data.MRData.DriverTable.Drivers.map(driver => ({
        name: `${driver.givenName} ${driver.familyName}`,
        number: driver.permanentNumber,
        driverId: driver.driverId
    }));
}

// Current drivers endpoint
async function fetchNextRaceFromCalendar(season) {
    const url = `https://racingnews365.com/formula-1-calendar-${season}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
    const races = [];
    $('.table__text--date').each((_, element) => {
        const dateText = $(element).find('.table__text--primary').text().trim();
        const row = $(element).closest('tr');
        const raceName = row.find('.table__text--primary strong').text().trim();
        const trackName = row.find('.table__text--secondary').first().text().trim();
        
        if (dateText && raceName) {
            const [day, month] = dateText.split(' ');
            const date = new Date(`${month} ${day}, ${season}`);
            races.push({
                date,
                name: raceName,
                track: trackName,
                season
            });
        }
    });

    const now = new Date();
    return races.find(race => race.date > now);
}

// Next race endpoint
app.get('/api/next-race', async (req, res) => {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // Find next race in current year
        const currentYearRaces = dataStore.races
            .filter(race => race.year === currentYear)
            .map(race => ({
                date: new Date(`${race.date} ${race.time || '00:00:00'}`),
                name: race.name,
                track: dataStore.circuits.find(c => c.circuitId === race.circuitId)?.name || 'Unknown Track',
                season: race.year
            }))
            .find(race => race.date > now);

        if (currentYearRaces) {
            return res.json(currentYearRaces);
        }

        // Fallback to next year
        const nextYearRaces = dataStore.races
            .filter(race => race.year === currentYear + 1)
            .map(race => ({
                date: new Date(`${race.date} ${race.time || '00:00:00'}`),
                name: race.name,
                track: dataStore.circuits.find(c => c.circuitId === race.circuitId)?.name || 'Unknown Track',
                season: race.year
            }))
            .sort((a, b) => a.date - b.date)[0];

        if (nextYearRaces) {
            return res.json(nextYearRaces);
        }

        // If no local data, fallback to API
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

// Top three drivers endpoint
app.get('/api/top-three', async (req, res) => {
    const { year, raceName } = req.query;

    if (!year || !raceName) {
        return res.status(400).json({ error: 'Year and raceName are required query parameters.' });
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
            // Rest of the original web scraping code...
            return res.json({ topThree: [] }); // Replace with actual scraped data
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
                    number: driver?.number
                };
            });

        res.json({ topThree });
    } catch (error) {
        console.error('Error fetching top three:', error);
        res.status(500).json({ error: 'Failed to fetch top three drivers' });
    }
});

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
        
        const currentDrivers = results.map(result => {
            const driver = dataStore.drivers.find(d => d.driverId === result.driverId);
            return {
                name: `${driver.forename} ${driver.surname}`,
                number: driver.number,
                driverId: driver.driverId
            };
        });

        if (currentDrivers.length === 0) {
            const drivers = await fetchDriversForSeason(seasonYear - 1);
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