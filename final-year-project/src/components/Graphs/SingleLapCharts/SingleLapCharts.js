import React, { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';
import Speedometer from './Speedometer';
import './SingleLapCharts.css';

function SingleLapCharts({ primaryDriver, sessionKey, meetingKey, lap, availableLaps, onLapChange }) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [selectedDriversData, setSelectedDriversData] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverColors, setDriverColors] = useState({});
  const [driverInfoMap, setDriverInfoMap] = useState({}); // Add this line to initialize driverInfoMap
  const [topSpeed, setTopSpeed] = useState(0);

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

  const fetchDriverColors = useCallback(async () => {
    try {
      const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
      const data = await response.json();

      const colors = {};
      const driverInfo = {};

      data.forEach((driver) => {
        const color = driver.team_colour.startsWith('#') ? driver.team_colour : `#${driver.team_colour}`;
        colors[driver.driver_number] = color;
        driverInfo[driver.driver_number] = { name: driver.full_name, color };
      });

      setDriverColors(colors);
      setDrivers(data.map(driver => driver.full_name));
      setDriverInfoMap(driverInfo); // Use setDriverInfoMap here to update the state
    } catch (error) {
      console.error('Error fetching driver colors:', error);
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
      const lapData = testData.map((lap) => ({
        driver_num: lap.driver_number,
        sector1: lap.duration_sector_1,
        sector2: lap.duration_sector_2,
        sector3: lap.duration_sector_3,
        top_speed: lap.st_speed 
      }));

      if (lapData.length > 0 && driver === primaryDriver) {
        setTopSpeed(lapData[0].top_speed);
      }

      return lapData;
    } catch (error) {
      console.error('Error fetching lap data:', error);
      return [];
    }
  }, [meetingKey, sessionKey, lap, getDriverNumberFromAPI, primaryDriver]);

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

  const renderBarCharts = () => {
    const allData = [...primaryDriverData, ...selectedDriversData];
    
    const driverNames = allData.map((d) => driverInfoMap[d.driver_num]?.name);
    const sector1Times = allData.map((d) => d.sector1);
    const sector2Times = allData.map((d) => d.sector2);
    const sector3Times = allData.map((d) => d.sector3);
    const colors = allData.map((d) => driverInfoMap[d.driver_num]?.color);

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
        <Plot
          data={[{
            x: driverNames,
            y: sector1Times,
            type: 'bar',
            marker: { color: colors }
          }]}
          layout={{ title: 'Sector 1 Times', width: 250, height: 400 }}
        />
        <Plot
          data={[{
            x: driverNames,
            y: sector2Times,
            type: 'bar',
            marker: { color: colors }
          }]}
          layout={{ title: 'Sector 2 Times', width: 250, height: 400 }}
        />
        <Plot
          data={[{
            x: driverNames,
            y: sector3Times,
            type: 'bar',
            marker: { color: colors }
          }]}
          layout={{ title: 'Sector 3 Times', width: 250, height: 400 }}
        />
      </div>
    );
  };

  useEffect(() => {
    if (sessionKey && meetingKey) {
      fetchDriverColors();
    }
  }, [sessionKey, meetingKey, fetchDriverColors]);

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
            style={{
              backgroundColor: selectedDrivers.includes(driver) ? driverColors[driver] : 'lightgray',
              color: selectedDrivers.includes(driver) ? 'white' : 'black'
            }}
            onClick={() => toggleDriverSelection(driver)}
          >
            {driver}
          </button>
        ))}
      </div>

      {/* Render bar charts of sector analysis */}
      <div className="charts-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        {renderBarCharts()}
        
        {/* Conditionally render Speedometer */}
        {lap && (
          <div className="speedometer-container" style={{ marginLeft: '10px' }}>  
            <Speedometer topSpeed={topSpeed} />
          </div>
        )}
      </div>
    </div>
  );
}

export default SingleLapCharts;
