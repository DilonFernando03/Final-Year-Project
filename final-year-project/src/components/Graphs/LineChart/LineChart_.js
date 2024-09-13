import React, { useEffect, useRef, useState, useCallback } from 'react';
import Chart from 'chart.js/auto';

function LineChart({ primaryDriver, secondaryDriver, sessionKey, meetingKey }) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [secondaryDriverData, setSecondaryDriverData] = useState([]);
  const chartRef = useRef(null);

  // useCallback to prevent unnecessary re-creation of the fetchData function
  const fetchData = useCallback(async (driver, setLapData) => {
    try {
      const driverNumber = getDriverNumber(driver); // You need to implement this function
      const response = await fetch(
        `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}`
      );
      const testData = await response.json();

      /*Log fetched data for debugging
      console.log(`Lap Data for ${driver}:`, testData);*/

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

  return <canvas ref={chartRef}></canvas>;
}




const getDriverNumber = (driverName) => {
  const driverMap = {
    'Max Verstappen': 1,
    'Lewis Hamilton': 44,
    'Charles Leclerc': 16,
    'Sergio Perez': 11,
    'Carlos Sainz': 55,
    'Oscar Piastri': 81,
    'Lando Norris': 4,
    'George Russell': 63,
    'Fernando Alonso': 14,
    'Lance Stroll': 18,
    'Yuki Tsunoda': 22,
    'Daniel Ricciardo': 3,
    'Zhou Guanyu': 24,
    'Valterri Bottas': 77,
    'Alex Albon': 23,
    'Franco Colapinto': 43
  };
  return driverMap[driverName] || null;
};

export default LineChart;
