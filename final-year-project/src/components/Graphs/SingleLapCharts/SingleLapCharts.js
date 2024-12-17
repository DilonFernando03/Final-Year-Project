import React, { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';
import Speedometer from './Speedometer';
import './SingleLapCharts.css';

function SingleLapCharts({ 
  primaryDriver, 
  sessionKey, 
  meetingKey, 
  lap, 
  availableLaps, 
  onLapChange,
  selectedDrivers = [],
  driverColors = {},
  externalButtons = false
}) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [selectedDriversData, setSelectedDriversData] = useState([]);
  const [driverInfoMap, setDriverInfoMap] = useState({});
  const [topSpeed, setTopSpeed] = useState(0);

  const formatDriverName = (name) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Fetch driver colors, names, and populate driverInfoMap
  const fetchDriverColors = useCallback(async () => {
    try {
      const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
      const data = await response.json();

      const infoMap = {};
      data.forEach((driver) => {
        const color = driver.team_colour.startsWith('#') ? driver.team_colour : `#${driver.team_colour}`;
        infoMap[driver.driver_number] = { name: driver.full_name, color };
      });

      setDriverInfoMap(infoMap);
    } catch (error) {
      console.error('Error fetching driver colors:', error);
    }
  }, [meetingKey, sessionKey]);

  // Define getDriverNumberFromAPI function to fetch driver number by name
  const getDriverNumberFromAPI = async (driverName) => {
    try {
      const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
      const data = await response.json();
      const driver = data.find((driver) => driver.full_name === driverName);
      return driver ? driver.driver_number : null;
    } catch (error) {
      console.error('Error fetching driver number:', error);
      return null;
    }
  };

  // Fetch lap data for the driver
  const fetchData = useCallback(async (driver) => {
    try {
      const driverNumber = await getDriverNumberFromAPI(driver);
      if (!driverNumber) return [];

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
  }, [meetingKey, sessionKey, lap, primaryDriver]);

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

  useEffect(() => {
    if (sessionKey && meetingKey) {
      fetchDriverColors();
    }
  }, [sessionKey, meetingKey, fetchDriverColors]);

  const renderBarCharts = () => {
    const allData = [...primaryDriverData, ...selectedDriversData];
    
    const driverNames = allData.map((d) => driverInfoMap[d.driver_num]?.name);
    const sector1Times = allData.map((d) => d.sector1);
    const sector2Times = allData.map((d) => d.sector2);
    const sector3Times = allData.map((d) => d.sector3);
    const colors = allData.map((d) => driverInfoMap[d.driver_num]?.color);

    const getAxisRange = (sectorTimes) => {
      const min = Math.min(...sectorTimes);
      const max = Math.max(...sectorTimes);
      const padding = (max - min) * 0.1;
      return [min - padding, max + padding];
    };

    const commonLayout = {
      width: 180, 
      height: 300,
      margin: {    
        l: 40,
        r: 10,
        t: 30,
        b: 40
      },
      font: {
        size: 10 
      },
      yaxis: {
        tickfont: { size: 9 }
      },
      xaxis: {
        tickfont: { size: 9 }
      }
    };

    return (
      <div className="sector-charts">
        <Plot
          data={[{
            x: driverNames,
            y: sector1Times,
            type: 'bar',
            marker: { color: colors }
          }]}
          layout={{ 
            ...commonLayout,
            title: { text: 'Sector 1', font: { size: 12 } },
            yaxis: { ...commonLayout.yaxis, range: getAxisRange(sector1Times) }
          }}
        />
        <Plot
          data={[{
            x: driverNames,
            y: sector2Times,
            type: 'bar',
            marker: { color: colors }
          }]}
          layout={{ 
            ...commonLayout,
            title: { text: 'Sector 2', font: { size: 12 } },
            yaxis: { ...commonLayout.yaxis, range: getAxisRange(sector2Times) }
          }}
        />
        <Plot
          data={[{
            x: driverNames,
            y: sector3Times,
            type: 'bar',
            marker: { color: colors }
          }]}
          layout={{ 
            ...commonLayout,
            title: { text: 'Sector 3', font: { size: 12 } },
            yaxis: { ...commonLayout.yaxis, range: getAxisRange(sector3Times) }
          }}
        />
      </div>
    );
  };

  return (
    <div className="chart-box">
      <h2>{formatDriverName(primaryDriver)} Lap Analysis</h2>
  
      <div style={{ marginBottom: '20px' }}>
        <select className="common-dropdown" onChange={(e) => onLapChange(e.target.value)} value={lap}>
          <option value="">Select a Lap</option>
          {availableLaps.map((lap, index) => (
            <option key={index} value={lap}>
              {lap}
            </option>
          ))}
        </select>
      </div>
  
      <div className="charts-container">
        {renderBarCharts()}
        <h2>Lap number {lap}</h2>
      </div>
    </div>
  );
}

export default SingleLapCharts;