import React, { useState, useEffect } from 'react';
import LineChart from '../LineChart/LineChart_';
import SingleLapCharts from '../SingleLapCharts/SingleLapCharts';
import './combinedCharts.css';

function CombinedCharts({ 
  primaryDriver, sessionKey, meetingKey, lap, availableLaps, onLapChange, selectedDrivers, setSelectedDrivers, driverColors 
}) {
  const [drivers, setDrivers] = useState([]);
  const MAX_DRIVERS = 3;

  /* Fetch all available drivers for the session */
  useEffect(() => {
    const fetchDriverData = async () => {
      if (sessionKey && meetingKey) {
        try {
          const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
          const data = await response.json();
          
          /* Filter out the primary driver and map to names */
          const driverData = data
            .map((driver) => driver.full_name)
            .filter(name => name !== primaryDriver);

          setDrivers(driverData);
        } catch (error) {
          console.error('Error fetching driver data:', error);
        }
      }
    };

    fetchDriverData();
  }, [sessionKey, meetingKey, primaryDriver]);

  /* Handle driver selection toggling with MAX_DRIVERS limit */
  const toggleDriverSelection = (driver) => {
    setSelectedDrivers((prevSelected) => {
      if (prevSelected.includes(driver)) {
        return prevSelected.filter(d => d !== driver);
      }
      if (prevSelected.length >= MAX_DRIVERS) {
        return prevSelected;
      }
      return [...prevSelected, driver];
    });
  };

  /* Format driver name with proper capitalization */
  const formatDriverName = (name) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="combined-charts-container">
      {/* Shared Driver Selection Controls */}
      <div className="shared-controls">
        <h3 className="driver-selection-heading">Select drivers to visualize against {primaryDriver} (up to 3 drivers)</h3>
        <div className="mini-buttons-container">
          {drivers.map((driver) => (
            <button
              key={driver}
              className={`mini-button ${selectedDrivers.includes(driver) ? 'selected' : ''}`}
              style={{
                backgroundColor: selectedDrivers.includes(driver) ? driverColors[driver] : 'black',
                color: selectedDrivers.includes(driver) ? 'white' : driverColors[driver],
                opacity: selectedDrivers.length >= MAX_DRIVERS && !selectedDrivers.includes(driver) ? 0.5 : 1,
                cursor: selectedDrivers.length >= MAX_DRIVERS && !selectedDrivers.includes(driver) ? 'not-allowed' : 'pointer'
              }}
              onClick={() => toggleDriverSelection(driver)}
              disabled={selectedDrivers.length >= MAX_DRIVERS && !selectedDrivers.includes(driver)}
            >
              {formatDriverName(driver)}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Container */}
      <div className="charts-row">
        <div className="chart-column">
          <LineChart 
            primaryDriver={primaryDriver}
            sessionKey={sessionKey}
            meetingKey={meetingKey}
            selectedDrivers={selectedDrivers}
            driverColors={driverColors}
            externalButtons={true}
          />
        </div>
        <div className="chart-column">
          <SingleLapCharts
            primaryDriver={primaryDriver}
            sessionKey={sessionKey}
            meetingKey={meetingKey}
            lap={lap}
            availableLaps={availableLaps}
            onLapChange={onLapChange}
            selectedDrivers={selectedDrivers}
            driverColors={driverColors}
            externalButtons={true}
          />
        </div>
      </div>
    </div>
  );
}

export default CombinedCharts;