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
            const number = numberMatch ? numberMatch[1] : null; // Extract the number
            const name = nameWithNumber.replace(/^#\d+\s*/, ''); // Remove the number from the name
        
            topThree.push({ position, name, team, time, number });
        });

        res.json({ topThree });
    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).json({ error: 'Failed to fetch race results.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
