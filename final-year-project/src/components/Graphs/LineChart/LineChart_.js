import React, { useRef, useEffect, useState } from 'react';
import Chart from 'chart.js/auto';

function LineChart({ primaryDriver, secondaryDriver }) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [secondaryDriverData, setSecondaryDriverData] = useState([]);
  const chartRef = useRef(null);

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
            lap_duration: lap.lap_duration,
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

    useEffect(() => {
        if (primaryDriverData.length) {
            const chart = new Chart(chartRef.current, {
                type: 'line',
                data: {
                    labels: primaryDriverData.map(lap => lap.lap_number), // Assuming both drivers have the same lap numbers
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
