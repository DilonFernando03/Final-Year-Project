import React, { useEffect, useState } from 'react';
import "./TopThree.css";

function TopDrivers({ year, raceName }) {
  const [topDrivers, setTopDrivers] = useState([]);

  useEffect(() => {
    const fetchTopThreeDrivers = async () => {
      try {
        const modifiedRaceName = mapRaceNameToPitwall(raceName);
        const response = await fetch(`http://localhost:5000/api/top-three?year=${year}&raceName=${modifiedRaceName}`);
        const data = await response.json();

        const enrichedDrivers = await Promise.all(
          data.topThree.map(async (driver) => {
            try {
              const driverDetailsResponse = await fetch(`https://api.openf1.org/v1/drivers?driver_number=${driver.number}`);
              const driverDetailsData = await driverDetailsResponse.json();

              const driverInfo = driverDetailsData[0];
              return {
                ...driver,
                image: driverInfo.headshot_url,
                color: driverInfo.team_colour.startsWith('#') ? driverInfo.team_colour : `#${driverInfo.team_colour}`,
                name: driver.name.toUpperCase(),
              };
            } catch (error) {
              console.error(`Error fetching details for driver ${driver.name}:`, error);
              return { ...driver, image: null, color: '#CCC', name: driver.name.toUpperCase() };
            }
          })
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
        <div key={index} className="driver-tile" style={{ backgroundColor: driver.color }}>
          {driver.image ? <img src={driver.image} alt={`${driver.name}`} className="driver-photo" /> : null}
          <div className="driver-info">
            <div className="driver-position">P{driver.position}</div>
            <div>{driver.name}</div>
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

  return raceNameMapping[raceName] || raceName; // Default to the input name if no mapping exists
};

export default TopDrivers;
