import React, { useEffect, useRef, useState, useCallback } from 'react';
import Chart from 'chart.js/auto';

function LineChart({ primaryDriver, secondaryDriver, sessionKey, meetingKey }) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [secondaryDriverData, setSecondaryDriverData] = useState([]);
  const chartRef = useRef(null);

  // useCallback to prevent unnecessary re-creation of the fetchData function
  const fetchData = useCallback(async (driver, setLapData) => {
    try {
      const fetchDriverNumber = async (driver, meetingKey, sessionKey) => {
        const driverNumber = await getDriverNumber(driver, meetingKey, sessionKey);
        return driverNumber;
      };
      // Await the fetchDriverNumber call to get the driver number
      const driverNumber = await fetchDriverNumber(driver, meetingKey, sessionKey);
      console.log('Driver Number:', driverNumber); // Log the actual driver number
      const response = await fetch(
        `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}`
      );
      const testData = await response.json()
      console.log(testData);

      const processedLapData = testData.map((lap) => ({
        lap_duration: lap.lap_duration,
        lap_number: lap.lap_number
      }));

      setLapData(processedLapData);
    } catch (error) {
      console.error('Error fetching lap data:', error);
    }
  }, [sessionKey, meetingKey]);

  useEffect(() => {
    if (primaryDriver) {
      fetchData(primaryDriver, setPrimaryDriverData);
    }
    if (secondaryDriver) {
      fetchData(secondaryDriver, setSecondaryDriverData);
    }
  }, [primaryDriver, secondaryDriver, sessionKey, meetingKey, fetchData]);

  useEffect(() => {
    if (primaryDriverData.length > 0) {
      const ctx = chartRef.current.getContext('2d');
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: primaryDriverData.map((lap) => lap.lap_number),
          datasets: [
            {
              label: `${primaryDriver}'s Lap Times`,
              data: primaryDriverData.map((lap) => lap.lap_duration),
              borderColor: 'blue',
              borderWidth: 2,
            },
            secondaryDriver && secondaryDriverData.length > 0
              ? {
                  label: `${secondaryDriver}'s Lap Times`,
                  data: secondaryDriverData.map((lap) => lap.lap_duration),
                  borderColor: 'red',
                  borderWidth: 2,
                }
              : null,
          ].filter(Boolean),
        },
        options: {
          scales: {
            y: {
              beginAtZero: false,
              ticks: {
                callback: function(value) {
                  const minutes = Math.floor(value / 60);
                  const seconds = (value % 60).toFixed(2);
                  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                },
              },
              title: {
                display: true,
                text: 'Lap Times',
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(tooltipItem) {
                  const value = tooltipItem.raw;
                  const minutes = Math.floor(value / 60);
                  const seconds = (value % 60).toFixed(2);
                  return `Lap Time: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;  
                },
              },
            },
          },
        },
      });

      // Cleanup the chart when the component unmounts or dependencies change
      return () => {
        chart.destroy();
      };
    }
  }, [primaryDriverData, secondaryDriverData, primaryDriver, secondaryDriver]);

  return (
    <div className="chart-box" style={{ height: '100%', width: '100%' }}>
      <h2>{primaryDriver} vs {secondaryDriver ? secondaryDriver : 'Lap Times'}</h2>
      <canvas ref={chartRef}></canvas>
    </div>
  );
  
}




const getDriverNumber = async (driverName, meetingKey, sessionKey) => {
  try {
    // Fetch driver data from the API
    const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}&full_name=${driverName}`);
    const data = await response.json();
    console.log(data);
    // Find the driver based on the full name
    const driverNum = data[0].driver_number;

    // Return the driver number if the driver is found, otherwise return null
    return driverNum;

  } catch (error) {
    console.error('Error fetching driver number:', error);
    return null;
  }
};


export default LineChart;
