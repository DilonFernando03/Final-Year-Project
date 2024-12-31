import React, { useEffect, useState, useRef } from 'react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';
import './driverRatings.css';

// Register Chart.js components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

function DriverRatings({ driverNumber }) {
  const [driverStats, setDriverStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartOptions, setChartOptions] = useState(null);

  // Fetch driver data
  useEffect(() => {
    const fetchDriverRatings = async () => {
      if (!driverNumber) return;

      try {
        setLoading(true);
        const response = await fetch('https://ratings-api.ea.com/v2/entities/f1-24-drivers-ratings');
        if (!response.ok) {
          throw new Error('Failed to fetch driver ratings');
        }
        const data = await response.json();
        let driverArr = data.docs;
        const driverData = driverArr.find(driver => 
          driver.carNum === driverNumber
        );
        if (driverData) {
          setDriverStats({
            name:driverData.name || "no - name",
            experience: driverData.experience || 0,
            racecraft: driverData.racecraft || 0,
            awareness: driverData.awareness || 0,
            pace: driverData.pace || 0
          });
        }
      } catch (err) {
        console.error('Error fetching driver ratings:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDriverRatings();
  }, [driverNumber]);

  // Update chart data and options when driverStats changes
  useEffect(() => {
    if (!driverStats) return;

    const values = [
        driverStats.experience,
        driverStats.racecraft,
        driverStats.awareness,
        driverStats.pace
    ];
    
    const lowestValue = Math.min(...values);
    const highestValue = Math.max(...values);
    const min = Math.floor(lowestValue) - 5;
    const max = Math.ceil(highestValue) + 5;

    console.log('Min:', min, 'Max:', max, 'Values:', values);

    // Update chart data
    setChartData({
      labels: ['Experience', 'Racecraft', 'Awareness', 'Pace'],
      datasets: [
        {
          label: `${driverStats.name} Ratings`,
          data: [
            driverStats.experience,
            driverStats.racecraft,
            driverStats.awareness,
            driverStats.pace
          ],
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 2,
          fill: true
        }
      ]
    });

    // Update chart options
    setChartOptions({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            display: true,
            color: 'rgba(0, 0, 0, 0.1)'
          },
          grid: {
            circular: true,
            color: 'rgba(0, 0, 0, 0.1)'
          },
          min: min,
          max: max,
          ticks: {
            stepSize: 5,
            font: {
              size: 10,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            },
            backdropColor: 'transparent'
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
  }, [driverStats, driverNumber]);

  return (
    <div className="ratings-container">
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">Error: {error}</div>}
      {!loading && !error && chartData && chartOptions && (
        <div className="ratings-content">
          <Radar data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}

export default DriverRatings;