const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const Papa = require('papaparse');
const path = require('path');
const app = express();

// Use port from environment variable with fallback to 5000
const PORT = process.env.PORT || 5000;

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

async function initializeDataStore() {
    console.log('Initializing data store with empty arrays');
    // The dataStore is already initialized with empty arrays
}

/* Initialize data on server start */
(async () => {
    try {
        await initializeDataStore();
        console.log('Data store initialized successfully');
    } catch (error) {
        console.error('Failed to initialize data store:', error);
    }
})();

/* Podium Cache Endpoints */
// Check cache
app.post('/api/check-podium-cache', express.json(), (req, res) => {
    try {
      const { year, raceName } = req.body;
      
      if (!year || !raceName) {
        return res.json({ cached: false });
      }
      
      const cacheKey = `${year}-${raceName}`;
      
      // Look for this race in the cached podium data
      const cachedData = dataStore.podiumCache.find(item => 
        item.cacheKey === cacheKey
      );
      
      if (cachedData) {
        return res.json(cachedData.data);
      } else {
        return res.json({ cached: false });
      }
    } catch (error) {
      console.error('Error in check-podium-cache:', error);
      return res.json({ cached: false });
    }
  });
  
  // Save to cache
  app.post('/api/save-podium-cache', express.json(), (req, res) => {
    try {
      const { year, raceName, data } = req.body;
      
      if (!year || !raceName || !data) {
        return res.json({ success: false, error: 'Missing required parameters' });
      }
      
      const cacheKey = `${year}-${raceName}`;
      
      // Remove any existing entry for this race
      dataStore.podiumCache = dataStore.podiumCache.filter(item => 
        item.cacheKey !== cacheKey
      );
      
      // Add the new data to the cache
      dataStore.podiumCache.push({
        cacheKey,
        data,
        timestamp: new Date().toISOString()
      });
      
      return res.json({ success: true });
    } catch (error) {
      console.error('Error in save-podium-cache:', error);
      return res.json({ success: false, error: error.message });
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

/* OpenF1 API Proxy */
app.use('/api/openf1-proxy', async (req, res) => {
    try {
      const apiUrl = `https://api.openf1.org/v1${req.url}`;
      console.log(`Proxying request to: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        timeout: 10000,
        headers: req.headers,
      });
      
      res.json(response.data);
    } catch (error) {
      console.error('Error proxying OpenF1 API:', error.message);
      
      if (error.response) {
        /* Forward the status code and response from the API */
        res.status(error.response.status).json({
          error: `API Error: ${error.response.status}`,
          message: error.response.data
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to fetch data from OpenF1 API',
          message: error.message
        });
      }
    }
  });

/* Driver History Endpoint */
app.get('/api/driver-history', async (req, res) => {
    const {driverId, driverNum, circuitId } = req.query;
    if (!driverId || !driverNum || !circuitId) {
        return res.status(400).json({ error: 'Driver Number and circuit ID are required' });
    }
    try {
        // Since we don't have local data, we'll return a default response
        return res.status(404).json({ 
            error: 'Driver not found',
            trackWins: 0,
            trackPodiums: 0,
            dnfs: 0,
            recentResults: []
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
        /* Try API since we don't have local data */
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
        /* Fetch from API since we don't have local data */
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
        /* Use API since we don't have local data */
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
        const drivers = await fetchDriversForSeason(seasonYear);
        return res.json(drivers);
    } catch (error) {
        console.error('Error fetching current drivers:', error);
        res.status(500).json({ error: 'Failed to fetch current drivers' });
    }
});

// Add a basic health check endpoint
app.get('/', (req, res) => {
  res.send('F1 API Server is running');
});

/* Start the server */
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});