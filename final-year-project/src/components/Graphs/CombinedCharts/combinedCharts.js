import React, { useState, useEffect } from 'react';
import LineChart from '../LineChart/LineChart_';
import SingleLapCharts from '../SingleLapCharts/SingleLapCharts';
import './combinedCharts.css';

function CombinedCharts({ 
  primaryDriver,sessionKey, meetingKey, lap, availableLaps, onLapChange,selectedDrivers, setSelectedDrivers, driverColors }) {
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    const fetchDriverData = async () => {
      if (sessionKey && meetingKey) {
        try {
          const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
          const data = await response.json();
          
          const driverData = data.map((driver) => driver.full_name);
          const colors = {};
          data.forEach(driver => {
            colors[driver.full_name] = driver.team_colour.startsWith('#') ? driver.team_colour : `#${driver.team_colour}`;
          });

          setDrivers(driverData);
        } catch (error) {
          console.error('Error fetching driver data:', error);
        }
      }
    };

    fetchDriverData();
  }, [sessionKey, meetingKey]);

  const toggleDriverSelection = (driver) => {
    setSelectedDrivers((prevSelected) =>
      prevSelected.includes(driver)
        ? prevSelected.filter(d => d !== driver)
        : [...prevSelected, driver]
    );
  };

  const formatDriverName = (name) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="combined-charts-container">
      {/* Shared Driver Selection Buttons */}
      <div className="shared-controls">
        <div className="mini-buttons-container">
          {drivers
            .filter(driver => driver !== primaryDriver)
            .map((driver) => (
              <button
                key={driver}
                className={`mini-button ${selectedDrivers.includes(driver) ? 'selected' : ''}`}
                style={{
                  backgroundColor: selectedDrivers.includes(driver) ? driverColors[driver] : 'black',
                  color: selectedDrivers.includes(driver) ? 'white' : driverColors[driver]
                }}
                onClick={() => toggleDriverSelection(driver)}
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