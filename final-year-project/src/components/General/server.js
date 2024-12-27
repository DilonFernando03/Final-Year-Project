const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

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
        console.log(`Fetching data from ${raceUrl}`);
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

        console.log(`Fetching driver data from ${url}`);
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
        console.log('Current year:', currentYear);
        
        console.log('Attempting to fetch current season races...');
        let nextRace = await fetchNextRaceFromCalendar(currentYear);
        console.log('Current season next race:', nextRace);
        
        if (!nextRace) {
            console.log('No races found in current season, checking next year...');
            nextRace = await fetchNextRaceFromCalendar(currentYear + 1);
            console.log('Next season race:', nextRace);
        }
 
        if (!nextRace) {
            console.log('No upcoming races found in either season');
            return res.status(404).json({ error: 'No upcoming races found' });
        }
 
        console.log('Returning next race:', nextRace);
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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});