import React, { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';
import './SingleLapCharts.css';

function SingleLapCharts({ primaryDriver, sessionKey, meetingKey, lap, availableLaps, onLapChange }) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [selectedDriversData, setSelectedDriversData] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const formatDriverName = (name) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const toggleDriverSelection = (driver) => {
    setSelectedDrivers((prevSelected) =>
      prevSelected.includes(driver)
        ? prevSelected.filter(d => d !== driver)
        : [...prevSelected, driver]
    );
  };

  const getDriverNumberFromAPI = useCallback(async (driverName) => {
    try {
      const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
      const data = await response.json();
      const driver = data.find((driver) => driver.full_name === driverName);
      return driver ? driver.driver_number : null;
    } catch (error) {
      console.error('Error fetching driver number:', error);
      return null;
    }
  }, [meetingKey, sessionKey]);

  const fetchData = useCallback(async (driver) => {
    try {
      const driverNumber = await getDriverNumberFromAPI(driver);
      if (!driverNumber) {
        console.error(`Driver number not found for ${driver}`);
        return [];
      }

      const response = await fetch(
        `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}&lap_number=${lap}`
      );
      const testData = await response.json();

      return testData.map((lap) => ({
        driver: driver,
        sector1: lap.duration_sector_1,
        sector2: lap.duration_sector_2,
        sector3: lap.duration_sector_3
      }));
    } catch (error) {
      console.error('Error fetching lap data:', error);
      return [];
    }
  }, [meetingKey, sessionKey, lap, getDriverNumberFromAPI]);

  useEffect(() => {
    if (primaryDriver) {
      fetchData(primaryDriver).then(data => setPrimaryDriverData(data));
    }
  }, [primaryDriver, fetchData]);

  useEffect(() => {
    if (selectedDrivers.length > 0) {
      const fetchLapDataForSelected = async () => {
        const allSelectedDriversData = await Promise.all(selectedDrivers.map(driver => fetchData(driver)));
        setSelectedDriversData(allSelectedDriversData.flat());
      };
      fetchLapDataForSelected();
    } else {
      setSelectedDriversData([]);
    }
  }, [selectedDrivers, fetchData]);

  const plotParallelCoordinates = () => {
    const allData = [...primaryDriverData, ...selectedDriversData];
    const drivers = allData.map((d) => d.driver);
    const sector1 = allData.map((d) => d.sector1);
    const sector2 = allData.map((d) => d.sector2);
    const sector3 = allData.map((d) => d.sector3);

    return (
      <Plot
        data={[
          {
            type: 'parcoords',
            line: {
              color: drivers,
              colorscale: 'Viridis',
            },
            dimensions: [
              {
                range: [Math.min(...sector1), Math.max(...sector1)],
                label: 'Sector 1 Time',
                values: sector1,
              },
              {
                range: [Math.min(...sector2), Math.max(...sector2)],
                label: 'Sector 2 Time',
                values: sector2,
              },
              {
                range: [Math.min(...sector3), Math.max(...sector3)],
                label: 'Sector 3 Time',
                values: sector3,
              }
            ]
          }
        ]}
        layout={{ width: 800, height: 400, title: 'Driver Sector Times Comparison' }}
      />
    );
  };

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
        const data = await response.json();
        setDrivers(data.map(driver => driver.full_name));
      } catch (error) {
        console.error('Error fetching drivers:', error);
      }
    };

    if (sessionKey && meetingKey) {
      fetchDrivers();
    }
  }, [sessionKey, meetingKey]);

  return (
    <div className="chart-box" style={{ height: '100%', width: '100%', border: '1px solid #ccc', padding: '20px', borderRadius: '10px' }}>
      <h2>{formatDriverName(primaryDriver)} Lap Analysis</h2>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="lap">Select a Lap:</label>
        <select className="common-dropdown" onChange={(e) => onLapChange(e.target.value)} value={lap}>
          <option value="">Select a Lap</option>
          {availableLaps.map((lap, index) => (
            <option key={index} value={lap}>
              {lap}
            </option>
          ))}
        </select>
      </div>

      <div className="mini-buttons-container">
        {drivers.map((driver) => (
          <button
            key={driver}
            className={`mini-button ${selectedDrivers.includes(driver) ? 'selected' : ''}`}
            onClick={() => toggleDriverSelection(driver)}
          >
            {driver}
          </button>
        ))}
      </div>

      <div className="charts-container">
        {plotParallelCoordinates()}
      </div>
    </div>
  );
}

export default SingleLapCharts;
