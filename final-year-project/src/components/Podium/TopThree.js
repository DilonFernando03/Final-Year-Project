import React, { useEffect, useState } from 'react';
import "./TopThree.css";

function TopDrivers({ year, raceName }) {
  const [topDrivers, setTopDrivers] = useState([]);
  const checkCache = async (driverNumber, year) => {
    try {
      
      const response = await fetch('http://localhost:5000/api/check-podium-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverNumber,
          year
        })
      });

      const data = await response.json();
      return data.cached ? data.driverInfo : null;
    } catch (error) {
      console.error('Error checking cache:', error);
      return null;
    }
  };

  const saveToCache = async (driverInfo) => {
    try {
      await fetch('http://localhost:5000/api/save-podium-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(driverInfo)
      });
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

  const getDriverDetails = async (driver, year) => {
    if (!driver.number) {
      return { 
        ...driver, 
        image: null, 
        color: '#CCC', 
        name: driver.name.toUpperCase() 
      };
    }
    if (driver.number == 33){
      driver.number = 1;
    }

    // First check the cache
    const cachedData = await checkCache(driver.number, year);
    if (cachedData) {
      console.log('Using cached data for driver:', driver.name);
      return {
        ...driver,
        image: cachedData.headshot_url,
        color: cachedData.team_colour.startsWith('#') ? 
          cachedData.team_colour : 
          `#${cachedData.team_colour}`,
        name: driver.name.toUpperCase(),
      };
    }

    // If not in cache, fetch from API
    try {
      const driverDetailsResponse = await fetch(
        `https://api.openf1.org/v1/drivers?driver_number=${driver.number}`
      );
      const driverDetailsData = await driverDetailsResponse.json();

      if (!driverDetailsData || !driverDetailsData[0]) {
        throw new Error('No driver data returned from API');
      }

      const driverInfo = driverDetailsData[0];

      // Save to cache
      await saveToCache({
        driver_number: driver.number,
        year: year,
        headshot_url: driverInfo.headshot_url,
        team_colour: driverInfo.team_colour,
        full_name: driverInfo.full_name
      });

      return {
        ...driver,
        image: driverInfo.headshot_url,
        color: driverInfo.team_colour.startsWith('#') ? 
          driverInfo.team_colour : 
          `#${driverInfo.team_colour}`,
        name: driver.name.toUpperCase(),
      };
    } catch (error) {
      console.error(`Error fetching details for driver ${driver.name}:`, error);
      return { 
        ...driver, 
        image: null, 
        color: '#CCC', 
        name: driver.name.toUpperCase() 
      };
    }
  };

  useEffect(() => {
    const fetchTopThreeDrivers = async () => {
      try {
        // First get top three from server
        const modifiedRaceName = mapRaceNameToPitwall(raceName);
        const response = await fetch(
          `http://localhost:5000/api/top-three?year=${year}&raceName=${modifiedRaceName}`
        );
        const data = await response.json();

        // Then enrich with driver details (from cache or API)
        const enrichedDrivers = await Promise.all(
          data.topThree.map(driver => getDriverDetails(driver, year))
        );

        setTopDrivers(enrichedDrivers);
      } catch (error) {
        console.error("Error fetching top three drivers:", error);
      }
    };

    if (year && raceName) {
      fetchTopThreeDrivers();
    }
  }, [year, raceName]);

  return (
    <div className="tiles-container">
      {topDrivers.map((driver, index) => (
        <div 
          key={index} 
          className="driver-tile" 
          style={{ backgroundColor: driver.color }}
          data-position={driver.position}
        >
          {driver.image && (
            <img 
              src={driver.image} 
              alt={`${driver.name}`} 
              className="driver-photo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          <div className="driver-info">
            <div className="driver-position">P{driver.position}</div>
            <div className="driver-name">{driver.name}</div>
            <div className="delta-time">{driver.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const mapRaceNameToPitwall = (raceName) => {
  const raceNameMapping = {
    "Sakhir": "bahrain",
    "Jeddah": "saudi-arabian",
    "Melbourne": "australian",
    "Suzuka": "japanese",
    "Shanghai": "chinese",
    "Miami": "miami",
    "Imola": "emilia-romagna",
    "Monaco": "monaco",
    "Montréal": "canadian",
    "Barcelona": "spanish",
    "Spielberg": "austrian",
    "Silverstone": "british",
    "Budapest": "hungarian",
    "Spa-Francorchamps": "belgian",
    "Zandvoort": "dutch",
    "Monza": "italian",
    "Baku": "azerbaijan",
    "Marina Bay": "singapore",
    "Austin": "united-states",
    "Mexico City": "mexican",
    "São Paulo": "sao-paulo",
    "Las Vegas": "las-vegas",
    "Lusail": "qatar",
    "Yas Island": "abu-dhabi"
  };

  return raceNameMapping[raceName] || raceName;
};

export default TopDrivers;