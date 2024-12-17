import React, { useEffect, useRef, useState, useCallback } from 'react';
import Chart from 'chart.js/auto';
import './LineChart.css';

function LineChart({ 
  primaryDriver, 
  sessionKey, 
  meetingKey,
  selectedDrivers = [],
  driverColors = {},
  externalButtons = false
}) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [selectedDriversData, setSelectedDriversData] = useState([]);
  const chartRef = useRef(null);

  const formatDriverName = (name) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const fetchData = useCallback(async (driver) => {
    try {
      const driverNumber = await getDriverNumber(driver, meetingKey, sessionKey);
      const response = await fetch(
        `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}`
      );
      const testData = await response.json();

      return testData.map((lap) => ({
        lap_duration: lap.lap_duration,
        lap_number: lap.lap_number,
      }));
    } catch (error) {
      console.error('Error fetching lap data:', error);
      return [];
    }
  }, [meetingKey, sessionKey]);

  useEffect(() => {
    if (primaryDriver) {
      fetchData(primaryDriver).then(data => setPrimaryDriverData(data));
    }
    if (selectedDrivers.length > 0) {
      const fetchLapDataForSelected = async () => {
        const allSelectedDriversData = await Promise.all(selectedDrivers.map(driver => fetchData(driver)));
        setSelectedDriversData(allSelectedDriversData);
      };
      fetchLapDataForSelected();
    }
  }, [primaryDriver, selectedDrivers, fetchData]);

  useEffect(() => {
    if (primaryDriverData.length > 0 || selectedDriversData.length > 0) {
      const ctx = chartRef.current.getContext('2d');
      
      const datasets = [
        {
          label: `${primaryDriver}'s Lap Times`,
          data: primaryDriverData.map((lap) => lap.lap_duration),
          borderColor: driverColors[primaryDriver] || 'blue',
          borderWidth: 2,
          pointRadius: 1,
        },
        ...selectedDrivers.map((driver, index) => {
          const lapData = selectedDriversData[index] || [];
          return {
            label: `${driver}'s Lap Times`,
            data: lapData.map((lap) => lap.lap_duration),
            borderColor: driverColors[driver],
            borderWidth: 2,
            pointRadius: 1,
          };
        })
      ].filter(Boolean);

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: primaryDriverData.map((lap) => lap.lap_number),
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index',
          },
          scales: {
            y: {
              beginAtZero: false,
              ticks: {
                callback: function(value) {
                  const minutes = Math.floor(value / 60);
                  const seconds = (value % 60).toFixed(2);
                  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                },
                font: {
                  size: 10
                }
              },
              title: {
                display: true,
                text: 'Lap Times',
                font: {
                  size: 11,
                  weight: 'normal'
                }
              },
              grid: {
                color: 'rgba(0,0,0,0.1)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Lap Number',
                font: {
                  size: 11,
                  weight: 'normal'
                }
              },
              ticks: {
                font: {
                  size: 10
                }
              },
              grid: {
                color: 'rgba(0,0,0,0.1)'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(tooltipItem) {
                  const value = tooltipItem.raw;
                  const minutes = Math.floor(value / 60);
                  const seconds = (value % 60).toFixed(2);
                  return `${tooltipItem.dataset.label}: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
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
  }, [primaryDriverData, selectedDriversData, primaryDriver, driverColors, selectedDrivers]);

  return (
    <div className="line-chart-container">
      <div className="line-chart-header">
        <h2 className="line-chart-title">{formatDriverName(primaryDriver)} Lap Times</h2>
      </div>
      
      <div className="line-chart-content">
        <div className="canvas-container">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
}

const getDriverNumber = async (driverName, meetingKey, sessionKey) => {
  try {
    const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}&full_name=${driverName}`);
    const data = await response.json();
    return data[0].driver_number;
  } catch (error) {
    console.error('Error fetching driver number:', error);
    return null;
  }
};

export default LineChart;