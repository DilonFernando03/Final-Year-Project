import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';
import './driverRatings.css';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function DriverRatings({ driverNumber, selectedDrivers, driverColors }) {
  const [driverStats, setDriverStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartOptions, setChartOptions] = useState(null);
  const [driverNumbers, setDriverNumbers] = useState({});

  // Fetch driver numbers for selected drivers
  useEffect(() => {
    const fetchDriverNumbers = async () => {
      const numbers = { primary: driverNumber };
      for (const driver of selectedDrivers) {
        try {
          const response = await fetch(`https://api.openf1.org/v1/drivers?full_name=${driver}`);
          const data = await response.json();
          if (data && data[0]) {
            numbers[driver] = data[0].driver_number;
          }
        } catch (err) {
          console.error(`Error fetching number for ${driver}:`, err);
        }
      }
      setDriverNumbers(numbers);
    };

    if (driverNumber) {
      fetchDriverNumbers();
    }
  }, [selectedDrivers, driverNumber]);

  // Fetch ratings for all drivers
  useEffect(() => {
    const fetchDriverRatings = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://ratings-api.ea.com/v2/entities/f1-24-drivers-ratings');
        if (!response.ok) throw new Error('Failed to fetch driver ratings');
        
        const data = await response.json();
        const driversData = {};
        
        // Add primary driver
        if (driverNumber) {
          const primaryDriverData = data.docs.find(d => d.carNum === driverNumber);
          if (primaryDriverData) {
            driversData.primary = {
              name: primaryDriverData.name,
              experience: Math.min(primaryDriverData.experience || 0, 100),
              racecraft: Math.min(primaryDriverData.racecraft || 0, 100),
              awareness: Math.min(primaryDriverData.awareness || 0, 100),
              pace: Math.min(primaryDriverData.pace || 0, 100)
            };
          }
        }

        // Add selected drivers
        for (const [driver, number] of Object.entries(driverNumbers)) {
          if (driver === 'primary') continue;
          const driverData = data.docs.find(d => d.carNum === number);
          if (driverData) {
            driversData[driver] = {
              name: driverData.name,
              experience: Math.min(driverData.experience || 0, 100),
              racecraft: Math.min(driverData.racecraft || 0, 100),
              awareness: Math.min(driverData.awareness || 0, 100),
              pace: Math.min(driverData.pace || 0, 100)
            };
          }
        }

        setDriverStats(driversData);
      } catch (err) {
        console.error('Error fetching driver ratings:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (driverNumber) {
      fetchDriverRatings();
    }
  }, [driverNumbers]);

  // Update chart data when driver stats change
  useEffect(() => {
    if (!driverStats || Object.keys(driverStats).length === 0) return;

    const datasets = [];
    const allValues = [];

    // Add primary driver
    if (driverStats.primary) {
      datasets.push({
        label: driverStats.primary.name,
        data: [
          driverStats.primary.experience,
          driverStats.primary.racecraft,
          driverStats.primary.awareness,
          driverStats.primary.pace
        ],
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 2,
        fill: true
      });
      allValues.push(...datasets[0].data);
    }

    // Add selected drivers
    Object.entries(driverStats).forEach(([driver, stats]) => {
      if (driver === 'primary') return;
      const color = driverColors[driver];
      const rgba = `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.2)`;
      
      datasets.push({
        label: stats.name,
        data: [
          stats.experience,
          stats.racecraft,
          stats.awareness,
          stats.pace
        ],
        backgroundColor: rgba,
        borderColor: color,
        borderWidth: 2,
        fill: true
      });
      allValues.push(...datasets[datasets.length - 1].data);
    });

    // Calculate min and max values for the scale
    const minValue = Math.max(40, Math.floor(Math.min(...allValues) / 5) * 5); // Round down to nearest 5
    const maxValue = Math.min(100, Math.ceil(Math.max(...allValues) / 5) * 5); // Round up to nearest 5, cap at 100

    setChartData({
      labels: ['Experience', 'Racecraft', 'Awareness', 'Pace'],
      datasets
    });

    setChartOptions({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { 
            display: true, 
            color: 'rgb(161, 161, 161)'
          },
          grid: { 
            circular: true, 
            color: 'rgb(161, 161, 161)'
          },
          min: minValue,
          max: maxValue,
          ticks: {
            stepSize: 5,
            font: { 
              size: 10, 
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
            },
            backdropColor: 'transparent',
            callback: (value) => Math.min(value, 100) // Ensure values don't exceed 100
          },
          pointLabels: {
            font: { 
              size: 12, 
              weight: 'bold', 
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
            },
            padding: 20
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { 
              size: 12, 
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
            }
          }
        }
      }
    });
  }, [driverStats, driverColors]);

  return (
    <div className="ratings-container">
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">Error: {error}</div>}
      {!loading && !error && chartData && chartOptions && (
        <>
          <h2 className="ratings-title">Driver Stats</h2>
          <div className="ratings-content">
            <Radar data={chartData} options={chartOptions} />
          </div>
        </>
      )}
    </div>
  );
}

export default DriverRatings;