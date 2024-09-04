import React, { useRef, useEffect, useState } from 'react';
import Chart from 'chart.js/auto'; // Import Chart.js
import './LineChart.css';

// Main Component
function LineChart() {
  const [lapData, setLapData] = useState([]); // State to store lap data
  const chartRef = useRef(null); // Create a ref for the canvas
  const driverNumbers = [1, 11, 44, 63, 4, 3]; // Array of driver numbers

  useEffect(() => {
    // Function to fetch data for all drivers
    const fetchData = async () => {
      try {
        // Array to hold fetch promises for all drivers
        const fetchPromises = driverNumbers.map(async (driverNumber) => {
          const response = await fetch(`https://api.openf1.org/v1/Laps?meeting_key=1229&session_key=9472&driver_number=${driverNumber}`);
          const testData = await response.json();
          
          // Process the data for each driver
          return testData.map(lap => ({
            lap_duration: lap.lap_duration,
            lap_number: lap.lap_number,
            driver_number: driverNumber  // Include driver number in the data
          }));
        });

        // Wait for all fetch requests to complete
        const allLapData = await Promise.all(fetchPromises);

        // Flatten the array of arrays into a single array
        const combinedLapData = allLapData.flat();

        // Set the combined lap data
        setLapData(combinedLapData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []); // Empty dependency array means this effect runs once after initial render

  useEffect(() => {
    let myChart;

    if (chartRef.current) {
      // Destroy the previous chart instance if it exists
      if (myChart) {
        myChart.destroy();
      }

      // Get unique lap numbers for labels (assuming all drivers have the same laps)
      const labels = [...new Set(lapData.map(lap => lap.lap_number))].sort((a, b) => a - b);

      // Create datasets for each driver
      const datasets = driverNumbers.map(driverNumber => {
        const driverLapData = lapData.filter(lap => lap.driver_number === driverNumber);
        const driverLapDurations = driverLapData.map(lap => lap.lap_duration);

        return {
          label: `Driver ${driverNumber}`, // Label for each driver's dataset
          data: driverLapDurations,
          borderWidth: 1,
          borderColor: getRandomColor(), // Function to generate a random color for each driver
        };
      });

      myChart = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: labels,  // Set the chart labels to lap numbers
          datasets: datasets,  // Set the chart data to multiple drivers' lap durations
        },
        options: {
          scales: {
            y: {
              beginAtZero: false,
            },
          },
        },
      });
    }

    return () => {
      if (myChart) {
        myChart.destroy();
      }
    };
  }, [lapData]);  // Re-run effect if lapData changes

  // Function to generate a random color
  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  return (
    <div>
      <canvas ref={chartRef}></canvas>
    </div>
  );
}

export default LineChart;
