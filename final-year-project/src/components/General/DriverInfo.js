import React, { useEffect, useState } from 'react';

function DriverRaceInfo({ sessionKey, meetingKey, driverNumber }) {
  const [raceInfo, setRaceInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRaceInfo = async () => {
      if (!sessionKey || !meetingKey || !driverNumber) return;
      
      setLoading(true);
      try {
        const response = await fetch(
          `http://localhost:5000/api/season-stats?driverId=${encodeURIComponent(driverNumber)}`
        );
        const data = await response.json();
        console.log(data)
        if (data && data.length > 0) {
          setRaceInfo({
            position: data[0].position,
            points: data[0].points
          });
          console.log(raceInfo)
        }
      } catch (error) {
        console.error('Error fetching race info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRaceInfo();
  }, [sessionKey, meetingKey, driverNumber]);

  if (loading) {
    return <div className="driver-race-info-loading">Loading...</div>;
  }

  if (!raceInfo) return null;

  return (
    <div className="driver-race-info">
      <div className="race-stat">
        <span className="race-stat-label">Position:</span>
        <span className="race-stat-value">P{raceInfo.position}</span>
      </div>
      <div className="race-stat">
        <span className="race-stat-label">Points:</span>
        <span className="race-stat-value">{raceInfo.points}</span>
      </div>
    </div>
  );
}

export default DriverRaceInfo;