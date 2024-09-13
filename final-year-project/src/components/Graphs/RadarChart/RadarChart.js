import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

// Register the chart components
Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function RadarChart({ primaryDriver, secondaryDriver, sessionKey, meetingKey, lap }) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [secondaryDriverData, setSecondaryDriverData] = useState([]);
  const radarChartRef = useRef(null);

  // Fetch data for a driver
  const fetchData = useCallback(async (driver, setLapData) => {
    try {
      const driverNumber = getDriverNumber(driver);
      const response = await fetch(
        `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}&lap_number=${lap}`
      );
      const testData = await response.json();

      const processedLapData = testData.map((lap) => ({
        lap_s1: lap.duration_sector_1,
        lap_s2: lap.duration_sector_2,
        lap_s3: lap.duration_sector_3,
        lap_topSpeed: lap.st_speed,
        lap_number: lap.lap_number,
      }));
      console.log(processedLapData);
      setLapData(processedLapData);
    } catch (error) {
      console.error('Error fetching data:', error);
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
      ];
      const allTopSpeeds = [
        ...primaryDriverData.map((lap) => lap.lap_topSpeed),
      ];

      const sectorTimeMin = Math.min(...allSectorTimes);
      const sectorTimeMax = Math.max(...allSectorTimes);

      const topSpeedMin = Math.min(...allTopSpeeds);
      const topSpeedMax = Math.max(...allTopSpeeds);

      const chart = new Chart(radarChartRef.current, {
        type: 'radar',
        data: {
          labels: ['Sector 1 Time', 'Sector 2 Time', 'Sector 3 Time', 'Top Speed'],
          datasets: [
            {
              label: `${primaryDriver}'s Lap Data`,
              data: primaryDriverData.length > 0
                ? [primaryDriverData[0].lap_s1, primaryDriverData[0].lap_s2, primaryDriverData[0].lap_s3, primaryDriverData[0].lap_topSpeed / 10] // Scale top speed
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
                ? [secondaryDriverData[0].lap_s1, secondaryDriverData[0].lap_s2, secondaryDriverData[0].lap_s3, secondaryDriverData[0].lap_topSpeed / 10] // Scale top speed
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
          ].filter(Boolean), // Filter out null datasets
        },
        options: {
          scales: {
            r: {
              suggestedMin: Math.floor(sectorTimeMin) - 5, // Dynamically set min/max based on sector times
              suggestedMax: Math.ceil(sectorTimeMax) + 5,
              ticks: {
                callback: function (value, index) {
                  if (value > 100) {
                    return `${value * 10} km/h`; // Top speed scale
                  }
                  const minutes = Math.floor(value / 60);
                  const seconds = (value % 60).toFixed(1);
                  return `${minutes}:${seconds}`; // Sector times in mm:ss.s format
                },
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function (tooltipItem) {
                  const value = tooltipItem.raw;
                  if (tooltipItem.label.includes('Top Speed')) {
                    return `Top Speed: ${value * 10} km/h`; // Show top speed
                  } else {
                    const minutes = Math.floor(value / 60);
                    const seconds = (value % 60).toFixed(1);
                    return `Sector Time: ${minutes}:${seconds}`; // Show sector time
                  }
                },
              },
            },
          },
        },
      });

      // Cleanup the chart on unmount
      return () => {
        chart.destroy();
      };
    }
  }, [primaryDriverData, secondaryDriverData]);

  return (
    <div style={{ height: '400px', width: '400px' }}>
      <canvas ref={radarChartRef}></canvas>
    </div>
  );
}

// Function to map driver names to driver numbers
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
    'Esteban Ocon': 31,
    'Pierre Gasly': 10,
    'Kevin Magnussen': 20,
    'Nico Hulkenberg': 27,
    'Lance Stroll': 18,
    'Yuki Tsunoda': 22,
    'Daniel Ricciardo': 3,
    'Zhou Guanyu': 24,
    'Valtteri Bottas': 77,
    'Alex Albon': 23,
    'Franco Colapinto': 43,
  };
  return driverMap[driverName] || null;
};

export default RadarChart;
