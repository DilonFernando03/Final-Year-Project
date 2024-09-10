import React, { useRef, useEffect } from 'react';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

// Register the chart components
Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function RadarChart({ primaryDriver, secondaryDriver }) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [secondaryDriverData, setSecondaryDriverData] = useState([]);
  const radarChartRef = useRef(null);

  useEffect(() => {
    const fetchData = async (driver, setLapData) => {
      if (primaryDriver) {
        try {
          // Map the driver name to a driver number or use the selectedDriver directly if it matches the API
          const driverNumber = getDriverNumber(driver);
          const response = await fetch(
            `https://api.openf1.org/v1/Laps?meeting_key=1229&session_key=9472&driver_number=${driverNumber}`
          );
          const testData = await response.json();

          const processedLapData = testData.map((lap) => ({
            lap_s1: lap.duration_sector_1,
            lap_s2: lap.duration_sector_2,
            lap_s3: lap.duration_sector_3,
            lap_topSpeed: lap.st_speed,
            lap_number: lap.lap_number,
          }));

          setLapData(processedLapData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      }
    };

    // Fetch lap data for the primary driver
    fetchData(primaryDriver, setPrimaryDriverData);

    // Fetch lap data for the secondary driver if selected
    if (secondaryDriver) {
        fetchData(secondaryDriver, setSecondaryDriverData);
    } else {
        setSecondaryDriverData([]); // Reset secondary data if no driver is selected
    }
}, [primaryDriver, secondaryDriver]);
/*
useEffect(() => {
  if (primaryDriverData.length) {
      const chart = new Chart(chartRef.current, {
          type: 'radar',
          data: {
              labels: primaryDriverData.map('Top Speed', 'Sector 1', 'Sector 2', 'Sector 3'), // Assuming both drivers have the same lap numbers
              datasets: [
                  {
                      label: `${primaryDriver}'s Lap Times`,
                      data: primaryDriverData.map(lap => lap.lap_duration),
                      borderColor: 'blue',
                      borderWidth: 1,
                      fill: false
                  },
                  secondaryDriverData.length > 0 && {
                      label: `${secondaryDriver}'s Lap Times`,
                      data: secondaryDriverData.map(lap => lap.lap_duration),
                      borderColor: 'red',
                      borderWidth: 1,
                      fill: false
                  }
              ].filter(Boolean) // Filter out null datasets
          },
          options: {
              scales: {
                  y: {
                      beginAtZero: false,
                      ticks: {
                          callback: function (value) {
                            const minutes = Math.floor(value / 60);
                            const seconds = (value % 60).toFixed(1);
                            return `${minutes}:${seconds}`;
                          }
                        }
                      }
                    },
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: function(tooltipItem) {
                            const value = tooltipItem.raw; // Raw value (in seconds)
                            const minutes = Math.floor(value / 60);
                            const seconds = (value % 60).toFixed(1);
                            return `Lap Time: ${minutes}:${seconds}`;  // Tooltip shows lap time in mm:ss.s
                          }
                  }
              }
          }
      }
      });
  return (
    <div style={{ height: '400px', width: '400px' }}>
      <canvas ref={radarChartRef}></canvas>
    </div>
  );
  */
}

export default RadarChart;
