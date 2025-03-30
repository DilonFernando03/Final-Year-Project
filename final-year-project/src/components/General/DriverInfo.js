import React, { useEffect, useState } from 'react';
import './DriverInfo.css';
import { API_BASE_URL } from '../../config';

function DriverRaceInfo({ driverNumber, year, round }) {
  /* Component state */
  const [raceResult, setRaceResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  /* Fetch driver race info when dependencies change */
  useEffect(() => {
    const fetchDriverInfo = async () => {
      /* Exit early if required props aren't available */
      if (!driverNumber || !year || !round) return;
      
      setLoading(true);
      setError(null);
      
      try {
        /* Handle known driver number mappings */
        if (driverNumber == 1) {
          driverNumber = 33;
        }
        else if (driverNumber == 40) {
          driverNumber = 30;
        }

        /* First get current drivers to map driver number to driverId */
        const driversResponse = await fetch(
          `${API_BASE_URL}/api/current-drivers?season=${year}`
        );
        if (!driversResponse.ok) {
          /* Implement exponential backoff for rate limiting */
          if (driversResponse.status === 429 && retryCount < 3) {
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              fetchDriverInfo();
            }, Math.pow(2, retryCount) * 1000); 
            return;
          }
          throw new Error(`Failed to fetch drivers: ${driversResponse.statusText}`);
        }
        
        const driversData = await driversResponse.json();
        
        /* Find the driver with matching number */
        const driver = driversData.find(d => Number(d.number) === driverNumber);
        if (!driver) {
          throw new Error('Driver not found in current season');
        }
        
        /* Fetch race results using driverId and year */
        const resultsResponse = await fetch(
          `${API_BASE_URL}/api/race-results?driverId=${encodeURIComponent(driver.driverId)}&year=${year}&round=${round}`
        );
        if (!resultsResponse.ok) {
          throw new Error(`Failed to fetch results: ${resultsResponse.statusText}`);
        }
        
        const resultsData = await resultsResponse.json();
        setRaceResult(resultsData);
        setRetryCount(0); /* Reset retry count on success */
      } catch (error) {
        console.error('Error fetching driver info:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDriverInfo();
  }, [driverNumber, year, round, retryCount]);

  // Loading state
  if (loading) {
    return <div className="driver-race-info-loading">
      <div className="loading-spinner-small"></div>
      <span>Loading...{retryCount > 0 ? ` (Retry ${retryCount}/3)` : ''}</span>
    </div>;
  }
 
  /* Error state */
  if (error) {
    return <div className="driver-race-info-error">Error: {error}</div>;
  }

  /* No data state */
  if (!raceResult) return null;

  /* Render race result */
  return (
    <div className="driver-race-info-inline">
      {raceResult && (
        <>
          <div className="race-stat">
            <span className="race-stat-label">Position:</span>
            <span className="race-stat-value position-value">
              {raceResult.positionText === 'R' ? 'DNF' : `P${raceResult.position}`}
            </span>
          </div>
          <div className="race-stat">
            <span className="race-stat-label">Points:</span>
            <span className="race-stat-value points-value">{raceResult.points}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default DriverRaceInfo;