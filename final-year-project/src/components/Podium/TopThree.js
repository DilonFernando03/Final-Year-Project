import React, { useEffect, useState } from 'react';
import "./TopThree.css";

function TopDrivers({ sessionKey, meetingKey }) {
  const [topDrivers, setTopDrivers] = useState([]);

  useEffect(() => {
    const fetchTopDrivers = async () => {
      try {
        // Fetch the session data to get the end of race date
        const sessionResponse = await fetch(`https://api.openf1.org/v1/sessions?meeting_key=${meetingKey}&session_key=${sessionKey}`);
        const sessionData = await sessionResponse.json();
        const endRace = sessionData[0]?.date_end;
        const formattedEndRace = endRace?.split("T")[0]; // Extracts date only if the time part is an issue

        if (!formattedEndRace) {
          console.error("No end race date found.");
          return;
        }

        // Fetch intervals data to get the top 3 drivers based on position at end of race
        const intervalsResponse = await fetch(`https://api.openf1.org/v1/intervals?meeting_key=${meetingKey}&session_key=${sessionKey}&date=${formattedEndRace}`);
        const intervalsData = await intervalsResponse.json();
        const top3Drivers = intervalsData
          .sort((a, b) => a.position - b.position)
          .slice(0, 3);

        // Fetch driver details for top 3 drivers based on driver_number
        const driverResponse = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
        const driverData = await driverResponse.json();

        // Map top 3 drivers with additional details from driver data
        const detailedTop3Drivers = top3Drivers.map((driver) => {
          const driverDetails = driverData.find(d => d.driver_number === driver.driver_number);
          return {
            ...driver,
            name: driverDetails ? driverDetails.full_name : "Unknown",
            teamColor: driverDetails ? (driverDetails.team_colour.startsWith('#') ? driverDetails.team_colour : `#${driverDetails.team_colour}`) : "#000",
            photoUrl: driverDetails ? driverDetails.headshot_url : "",
            position: driver.position,
            deltaToLeader: driver.position === 1 ? "Leader" : driver.delta_to_leader
          };
        });

        setTopDrivers(detailedTop3Drivers);
      } catch (error) {
        console.error("Error fetching top 3 drivers:", error);
      }
    };

    if (sessionKey && meetingKey) {
      fetchTopDrivers();
    }
  }, [sessionKey, meetingKey]);

  return (
    <div className="tiles-container">
      {topDrivers.map((driver, index) => (
        <div key={index} className="driver-tile" style={{ backgroundColor: driver.teamColor }}>
          <img src={driver.photoUrl} alt={`${driver.name} photo`} className="driver-photo" />
          <div className="driver-info">
            <div className="driver-position">Position: {driver.position}</div>
            <div>{driver.name}</div>
            <div className="delta-time">{driver.deltaToLeader}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TopDrivers;
