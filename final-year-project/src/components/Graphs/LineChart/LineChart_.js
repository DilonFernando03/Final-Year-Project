import React, { useEffect, useRef, useState, useCallback } from 'react';
import Chart from 'chart.js/auto';
import './LineChart.css';

function LineChart({ primaryDriver, sessionKey, meetingKey }) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]); // Track selected drivers
  const [selectedDriversData, setSelectedDriversData] = useState([]); // Store lap data for selected drivers
  const [drivers, setDrivers] = useState([]); // Store all drivers
  const chartRef = useRef(null);

  // Helper function to capitalize the first letter of each word
  const formatDriverName = (name) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const toggleDriverSelection = (driver) => {
    setSelectedDrivers((prevSelected) =>
      prevSelected.includes(driver)
        ? prevSelected.filter(d => d !== driver)
        : [...prevSelected, driver]
    );
  };

  // Fetch all drivers' data
  useEffect(() => {
    const fetchDriverData = async () => {
      if (sessionKey && meetingKey) {
        try {
          const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
          const data = await response.json();
          const driverData = data.map((driver) => driver.full_name);
          setDrivers(driverData);  // Store driver names
        } catch (error) {
          console.error('Error fetching driver data:', error);
        }
      }
    };

    fetchDriverData();
  }, [sessionKey, meetingKey]);

  // Fetch lap data for a specific driver
  const fetchData = useCallback(async (driver) => {
    try {
      const fetchDriverNumber = async (driver, meetingKey, sessionKey) => {
        const driverNumber = await getDriverNumber(driver, meetingKey, sessionKey);
        return driverNumber;
      };
      const driverNumber = await fetchDriverNumber(driver, meetingKey, sessionKey);
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

  // Fetch lap data for primary driver and selected drivers
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
          borderColor: 'blue',
          borderWidth: 2,
        },
        ...selectedDrivers.map((driver, index) => {
          const lapData = selectedDriversData[index] || []; 
          return {
            label: `${driver}'s Lap Times`,
            data: lapData.map((lap) => lap.lap_duration),
            borderColor: getRandomColor(),
            borderWidth: 2,
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

      return () => {
        chart.destroy();
      };
    }
  }, [primaryDriverData, selectedDriversData, primaryDriver]);

  return (
    <div className="chart-box" style={{ height: '100%', width: '100%' }}>
      <h2>{formatDriverName(primaryDriver)} Lap Chart</h2>

      {/* Buttons to toggle driver selection */}
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

      <canvas ref={chartRef}></canvas>
    </div>
  );
}

// Helper function to get the driver number by making API call
const getDriverNumber = async (driverName, meetingKey, sessionKey) => {
  try {
    const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}&full_name=${driverName}`);
    const data = await response.json();
    const driverNum = data[0].driver_number;

    return driverNum;
  } catch (error) {
    console.error('Error fetching driver number:', error);
    return null;
  }
};

export default LineChart;
