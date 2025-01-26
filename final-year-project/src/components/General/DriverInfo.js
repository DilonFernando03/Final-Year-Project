import React, { useEffect, useState } from 'react';

function DriverRaceInfo({ sessionKey, meetingKey, driverNumber, year, round }) {
  const [raceResult, setRaceResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchDriverInfo = async () => {
      if (!sessionKey || !meetingKey || !driverNumber || !year || !round) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Handle Max Verstappen's number change
        if (driverNumber == 1) {
          driverNumber = 33;
        }

        // First get current drivers to map driver number to driverId
        const driversResponse = await fetch(
          `http://localhost:5000/api/current-drivers?season=${year}`
        );
        if (!driversResponse.ok) {
          if (driversResponse.status === 429 && retryCount < 3) {
            // If rate limited, wait and retry
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              fetchDriverInfo();
            }, Math.pow(2, retryCount) * 1000); // Exponential backoff
            return;
          }
          throw new Error(`Failed to fetch drivers: ${driversResponse.statusText}`);
        }
        
        const driversData = await driversResponse.json();
        
        // Find the driver with matching number
        const driver = driversData.find(d => d.number === driverNumber.toString());
        if (!driver) {
          throw new Error('Driver not found in current season');
        }

        // Fetch race results using driverId and year
        const resultsResponse = await fetch(
          `http://localhost:5000/api/race-results?driverId=${encodeURIComponent(driver.driverId)}&year=${year}&round=${round}`
        );
        if (!resultsResponse.ok) {
          throw new Error(`Failed to fetch results: ${resultsResponse.statusText}`);
        }
        
        const resultsData = await resultsResponse.json();
        setRaceResult(resultsData);
        setRetryCount(0); // Reset retry count on success
      } catch (error) {
        console.error('Error fetching driver info:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDriverInfo();
  }, [sessionKey, meetingKey, driverNumber, year, round, retryCount]);

  if (loading) {
    return <div className="driver-race-info-loading">
      Loading...{retryCount > 0 ? ` (Retry ${retryCount}/3)` : ''}
    </div>;
  }

  if (error) {
    return <div className="driver-race-info-error">Error: {error}</div>;
  }

  if (!raceResult) return null;

  return (
    <div className="driver-race-info">
      {raceResult && (
        <>
          <div className="race-stat">
            <span className="race-stat-label">Position:</span>
            <span className="race-stat-value">
              {raceResult.positionText === 'R' ? 'DNF' : `P${raceResult.position}`}
            </span>
          </div>
          <div className="race-stat">
            <span className="race-stat-label">Points:</span>
            <span className="race-stat-value">{raceResult.points}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default DriverRaceInfo;