import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

// Register the chart components
Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function RadarChart({ primaryDriver, secondaryDriver, sessionKey, meetingKey, lap }) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [secondaryDriverData, setSecondaryDriverData] = useState([]);
  const radarChartRef = useRef(null);

  // Function to fetch driver number from API
  const getDriverNumberFromAPI = async (driverName) => {
    try {
      const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
      const data = await response.json();

      // Find the driver based on the full name
      const driver = data.find((driver) => driver.full_name === driverName);

      // Return the driver number if the driver is found, otherwise return null
      return driver ? driver.driver_number : null;
    } catch (error) {
      console.error('Error fetching driver number:', error);
      return null;
    }
  };

  // Fetch data for a driver
  const fetchData = useCallback(async (driver, setLapData) => {
    try {
      const driverNumber = await getDriverNumberFromAPI(driver);
      if (!driverNumber) {
        console.error(`Driver number not found for ${driver}`);
        return;
      }

      const response = await fetch(
        `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}&lap_number=${lap}`
      );
      const testData = await response.json();

      const processedLapData = testData.map((lap) => ({
        lap_s1: lap.duration_sector_1,
        lap_s2: lap.duration_sector_2,
        lap_s3: lap.duration_sector_3,
        lap_number: lap.lap_number,
      }));

      setLapData(processedLapData);
    } catch (error) {
      console.error('Error fetching lap data:', error);
    }
  }, [sessionKey, meetingKey, lap]);

  useEffect(() => {
    if (primaryDriver) {
      fetchData(primaryDriver, setPrimaryDriverData);
    }
    if (secondaryDriver) {
      fetchData(secondaryDriver, setSecondaryDriverData);
    }
  }, [primaryDriver, secondaryDriver, sessionKey, meetingKey, lap, fetchData]);

  useEffect(() => {
    if (primaryDriverData.length > 0 || secondaryDriverData.length > 0) {
      const allSectorTimes = [
        ...primaryDriverData.map((lap) => [lap.lap_s1, lap.lap_s2, lap.lap_s3]).flat(),
        ...secondaryDriverData.map((lap) => [lap.lap_s1, lap.lap_s2, lap.lap_s3]).flat()
      ];

      // Compute min and max sector times across both drivers
      const sectorTimeMin = Math.min(...allSectorTimes);
      const sectorTimeMax = Math.max(...allSectorTimes);

      const chart = new Chart(radarChartRef.current, {
        type: 'radar',
        data: {
          labels: ['Sector 1 Time', 'Sector 2 Time', 'Sector 3 Time'],
          datasets: [
            {
              label: `${primaryDriver}'s Lap Data`,
              data: primaryDriverData.length > 0
                ? [primaryDriverData[0].lap_s1, primaryDriverData[0].lap_s2, primaryDriverData[0].lap_s3]
                : [],
              borderColor: 'blue',
              borderWidth: 1,
              fill: true,
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              pointBackgroundColor: 'rgb(54, 162, 235)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgb(54, 162, 235)',
            },
            secondaryDriverData.length > 0 && {
              label: `${secondaryDriver}'s Lap Data`,
              data: secondaryDriverData.length > 0
                ? [secondaryDriverData[0].lap_s1, secondaryDriverData[0].lap_s2, secondaryDriverData[0].lap_s3]
                : [],
              borderColor: 'red',
              borderWidth: 1,
              fill: true,
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              pointBackgroundColor: 'rgb(255, 99, 132)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgb(255, 99, 132)',
            },
          ].filter(Boolean),
        },
        options: {
          scales: {
            r: {
              suggestedMin: Math.floor(sectorTimeMin) - 1,
              suggestedMax: Math.ceil(sectorTimeMax) + 1, 
              ticks: {
                callback: function (value) {
                  const minutes = Math.floor(value / 60);
                  const seconds = (value % 60).toFixed(1);
                  return `${minutes}:${seconds}`;
                },
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function (tooltipItem) {
                  const value = tooltipItem.raw;
                  const minutes = Math.floor(value / 60);
                  const seconds = (value % 60).toFixed(1);
                  return `Sector Time: ${minutes}:${seconds}`; // Show sector time
                },
              },
            },
          },
        },
      });
      return () => {
        chart.destroy();
      };
    }
  }, [primaryDriverData, secondaryDriverData]);

  return (
    <div className="chart-box" style={{ height: '100%', width: '100%' }}>
      <h2>{primaryDriver} {secondaryDriver ? `vs ${secondaryDriver}` : ''}</h2>
      <div style={{ height: '400px', width: '400px' }}>
        <canvas ref={radarChartRef}></canvas>
      </div>
    </div>
  );
  
}

export default RadarChart;
