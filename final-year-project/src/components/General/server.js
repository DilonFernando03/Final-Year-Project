const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { Round } = require('@tensorflow/tfjs');

const app = express();
const PORT = 5000;

app.use(cors());

// Route for fetching top three drivers
app.get('/api/top-three', async (req, res) => {
    const { year, raceName } = req.query;

    if (!year || !raceName) {
        return res.status(400).json({ error: 'Year and raceName are required query parameters.' });
    }

    // Construct the pitwall URL
    const raceSlug = `${year}-${raceName.replace(/\s+/g, '-').toLowerCase()}-grand-prix`;
    const raceUrl = `https://pitwall.app/races/${raceSlug}`;

    try {
        const { data } = await axios.get(raceUrl);
        const $ = cheerio.load(data);

        const topThree = [];
        $('table tbody tr').slice(0, 3).each((index, element) => {
            const position = $(element).find('td:nth-child(1)').text().trim();
            const nameWithNumber = $(element).find('td:nth-child(2)').text().trim();
            const team = $(element).find('td:nth-child(3)').text().trim();
            const time = $(element).find('td:nth-child(4)').text().trim();
        
            // Extract the driver number (without the hash) and the name
            const numberMatch = nameWithNumber.match(/^#(\d+)\s*/);
            const number = numberMatch ? numberMatch[1] : null;
            const name = nameWithNumber.replace(/^#\d+\s*/, '');
        
            topThree.push({ position, name, team, time, number });
        });

        res.json({ topThree });
    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).json({ error: 'Failed to fetch race results.' });
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

// Winner predictor season schedule endpoint
app.get('/api/next-race', async (req, res) => {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        
        let nextRace = await fetchNextRaceFromCalendar(currentYear);
        
        if (!nextRace) {
            nextRace = await fetchNextRaceFromCalendar(currentYear + 1);
        }
 
        if (!nextRace) {
            return res.status(404).json({ error: 'No upcoming races found' });
        }
 
        res.json(nextRace);
    } catch (error) {
        console.error('Error in /api/next-race:', error);
        res.status(500).json({ error: 'Failed to fetch next race', details: error.message });
    }
});
 
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

// Current drivers endpoint
app.get('/api/current-drivers', async (req, res) => {
    const { season } = req.query;
    
    if (!season) {
        return res.status(400).json({ error: 'Season is required' });
    }

    try {
        const currentDrivers = await fetchDriversForSeason(parseInt(season));
        if (currentDrivers.length > 0) {
            return res.json(currentDrivers);
        }

        // Try previous season if current season has no drivers
        const previousSeasonDrivers = await fetchDriversForSeason(parseInt(season) - 1);
        if (previousSeasonDrivers.length > 0) {
            return res.json(previousSeasonDrivers);
        }

        throw new Error('No drivers found for current or previous season');
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ error: 'Failed to fetch drivers' });
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

// Season stats endpoint
app.get('/api/season-stats', async (req, res) => {
    const { driverId, season = new Date().getFullYear() } = req.query;
    if (!driverId) {
        return res.status(400).json({ error: 'Driver ID is required' });
    }

    async function getDriverStats(year) {
        const url = `http://api.jolpi.ca/ergast/f1/${year}/drivers/${driverId}/results.json`;
        const { data } = await axios.get(url);
        
        const races = data.MRData.RaceTable.Races;
        if (!races.length) return null;

        const results = races.map(race => ({
            position: parseInt(race.Results[0].position),
            points: parseFloat(race.Results[0].points),
            positionText: race.Results[0].positionText
        }));

        return {
            points: results.reduce((sum, race) => sum + race.points, 0),
            podiums: results.filter(race => race.position <= 3).length,
            wins: results.filter(race => race.position === 1).length,
            dnfs: results.filter(race => race.positionText === 'R').length,
            averageFinish: results.reduce((sum, race) => 
                sum + (race.positionText === 'R' ? 20 : race.position), 0) / results.length,
            recentResults: results.slice(-3).map(race => 
                race.positionText === 'R' ? 20 : race.position)
        };
    }

    try {
        let stats = await getDriverStats(season);
        
        if (!stats) {
            stats = await getDriverStats(season - 1);
            if (!stats) {
                return res.status(404).json({ error: 'No stats found for driver in current or previous season' });
            }
        }

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
        const currentYear = new Date().getFullYear();
        const startYear = Math.max(currentYear - 30, 1950);
        const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i);

        // Format the circuitId to match API format (remove hyphens)
        const formattedCircuitId = circuitId.replace(/-/g, '_');

        // Create array of promises for parallel execution
        const resultsPromises = years.map(year => 
            axios.get(`http://api.jolpi.ca/ergast/f1/${year}/drivers/${driverId}/results.json?limit=100`)
        );

        // Execute all API calls in parallel
        const results = await Promise.all(resultsPromises);

        let trackWins = 0;
        let trackPodiums = 0;
        let dnfs = 0;
        let recentResults = [];

        // Process all results
        results.forEach((response, index) => {
            const year = years[index];
            const races = response.data.MRData.RaceTable.Races;
            
            const circuitRaces = races.filter(race => 
                race.Circuit?.circuitId?.toLowerCase() === formattedCircuitId.toLowerCase()
            );

            circuitRaces.forEach(race => {
                const result = race.Results[0];
                const position = parseInt(result.position);

                if (position === 1) trackWins++;
                if (position <= 3) trackPodiums++;
                if (result.positionText === 'R') dnfs++;

                if (year > currentYear - 6) {
                    recentResults.push({
                        year,
                        position: result.positionText === 'R' ? 'DNF' : position
                    });
                }
            });
        });
        // Sort recent results by year (newest first) and take only the position
        recentResults = recentResults
            .sort((a, b) => b.year - a.year)
            .map(result => result.position);

        res.json({
            trackWins,
            trackPodiums,
            dnfs,
            recentResults
        });

    } catch (error) {
        console.error('Error fetching driver history:', error);
        res.status(500).json({ 
            error: 'Failed to fetch driver history',
            details: error.message 
        });
    }
});

// Team Position Flow endpoint
app.get('/api/team-positions', async (req, res) => {
    const { year, round } = req.query;
    
    if (!year || !round) {
        return res.status(400).json({ error: 'Year and round are required' });
    }

    try {
        const url = `http://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`;

        const { data } = await axios.get(url);
        
        // Access the results array correctly
        const raceResults = data.MRData.RaceTable.Races[0].Results;

        const teamPositions = raceResults.map(result => ({
            team: result.Constructor.constructorId,
            position: parseInt(result.position),
            driver: `${result.Driver.givenName} ${result.Driver.familyName}`
        }));


        // Group positions into ranges
        const positionRanges = {
            'Podium (1-3)': [1, 2, 3],
            'Top 5 (4-5)': [4, 5],
            'Points (6-10)': [6, 7, 8, 9, 10],
            'Outside Points (11-20)': Array.from({length: 10}, (_, i) => i + 11)
        };

        // Create nodes and links for Sankey diagram
        const nodes = [];
        
        // Add team nodes first
        const teams = [...new Set(teamPositions.map(tp => tp.team))];
        teams.forEach(team => {
            nodes.push({ name: team });
        });

        // Then add position range nodes
        Object.keys(positionRanges).forEach(range => {
            nodes.push({ name: range });
        });

        // Create links with source as team index and target as position range index
        const links = teamPositions.map(tp => {
            const teamIndex = teams.indexOf(tp.team);
            const positionRange = Object.entries(positionRanges).find(([_, positions]) => 
                positions.includes(tp.position)
            );
            const rangeIndex = teams.length + Object.keys(positionRanges).indexOf(positionRange[0]);
            
            return {
                source: teamIndex,
                target: rangeIndex,
                value: 1,
                driver: tp.driver
            };
        });

        const response = { nodes, links };
        res.json(response);
    } catch (error) {
        console.error('Error fetching team positions:', error);
        res.status(500).json({ 
            error: 'Failed to fetch team positions',
            details: error.message
        });
    }
});

// Race results endpoint
app.get('/api/race-results', async (req, res) => {
    const { driverId, year, round } = req.query;
    
    if (!driverId || !year) {
        return res.status(400).json({ error: 'Driver ID and year are required' });
    }

    try {
        const url = `http://api.jolpi.ca/ergast/f1/${year}/drivers/${driverId}/results.json`;
        const { data } = await axios.get(url);
        
        const races = data.MRData.RaceTable.Races;
        if (!races || races.length === 0) {
            return res.status(404).json({ error: 'No race results found' });
        }

        let raceResult;
        if (round) {
            // Find the specific race by round number
            const specificRace = races.find(race => race.round === round.toString());
            if (!specificRace) {
                return res.status(404).json({ error: 'Race round not found' });
            }
            raceResult = specificRace;
        }
        
        const result = raceResult.Results[0];
        res.json({
            position: result.position,
            positionText: result.positionText,
            points: result.points,

        });
    } catch (error) {
        console.error('Error fetching race results:', error);
        res.status(500).json({ error: 'Failed to fetch race results' });
    }
});

// Team stats endpoint
app.get('/api/team-stats', async (req, res) => {
    const { constructorId, year = new Date().getFullYear() } = req.query;
    
    if (!constructorId) {
        return res.status(400).json({ error: 'Constructor ID is required' });
    }

    try {
        const url = `http://api.jolpi.ca/ergast/f1/${year}/constructors/${constructorId}/results.json`;
        const { data } = await axios.get(url);
        
        const races = data.MRData.RaceTable.Races;
        if (!races.length) {
            return res.status(404).json({ error: 'No results found for team' });
        }

        const results = races.flatMap(race => race.Results);
        console.log(races)
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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});