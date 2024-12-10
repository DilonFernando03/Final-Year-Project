import React, { useEffect, useState, useCallback } from 'react';
import ApexCharts from 'apexcharts';

function Stints({ sessionKey, meetingKey, primaryDriver }) {
  const [driverStints, setDriverStints] = useState([]);
  const [chart, setChart] = useState(null);

  const getDriverNumberFromAPI = useCallback(async (driverName) => {
    try {
      const response = await fetch(
        `https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`
      );
      const data = await response.json();
      const driver = data.find((driver) => driver.full_name === driverName);
      return driver ? driver.driver_number : null;
    } catch (error) {
      console.error('Error fetching driver number:', error);
      return null;
    }
  }, [meetingKey, sessionKey]);

  useEffect(() => {
    const fetchDriverStints = async () => {
      if (!sessionKey || !meetingKey || !primaryDriver) return;

      const driverNum = await getDriverNumberFromAPI(primaryDriver);

      if (!driverNum) {
        console.error(`Driver number not found for ${primaryDriver}`);
        return;
      }

      try {
        const response = await fetch(
          `https://api.openf1.org/v1/stints?meeting_key=${meetingKey}&session_key=${sessionKey}`
        );
        const data = await response.json();
        const filteredStints = data.filter(
          (stint) => stint.driver_number === driverNum
        );
        setDriverStints(filteredStints);
      } catch (error) {
        console.error('Error fetching stints data:', error);
      }
    };

    fetchDriverStints();
  }, [sessionKey, meetingKey, primaryDriver, getDriverNumberFromAPI]);

  useEffect(() => {
    if (driverStints.length > 0) {
      const seriesData = driverStints.map((stint, index) => {
        // Add letter for the tire compound
        const compoundLetter = stint.compound === 'SOFT' ? 'S' :
                               stint.compound === 'MEDIUM' ? 'M' :
                               stint.compound === 'HARD' ? 'H' :
                               stint.compound === 'WET' ? 'W' :
                               stint.compound === 'INTERMEDIATE' ? 'I' :
                               'U'; // Unknown or other tires
        return {
          x: `Stint ${index + 1}`,
          y: [stint.lap_start, stint.lap_end],
          fillColor: stint.compound === 'SOFT' ? '#FF4D4D' :
                     stint.compound === 'MEDIUM' ? '#FFD700' :
                     stint.compound === 'HARD' ? '#808080' :
                     stint.compound === 'WET' ? '#00008B' : 
                     stint.compound === 'INTERMEDIATE' ? '#006400' : '#B0B0B0', 
          label: compoundLetter, 
        };
      });

      const options = {
        series: [{ data: seriesData }],
        chart: {
          height: 300,
          type: 'rangeBar',
        },
        plotOptions: {
          bar: {
            horizontal: true,
            dataLabels: {
              position: 'center', // Center the label
            },
          },
        },
        colors: ['#FF4D4D', '#FFD700', '#808080', '#0000FF', '#00FF00', '#B0B0B0'],
        title: {
          text: `Pit Strategy for ${primaryDriver}`,
          align: 'center',
        },
        xaxis: {
          title: { text: 'Lap Numbers' },
        },
        yaxis: {
          title: { text: 'Stints' },
        },
        dataLabels: {
          enabled: true,
          style: {
            fontSize: '14px',
            fontWeight: 'bold',
            colors: ['#ffffff'], // Ensure good contrast with bar colors
          },
          formatter: (val, opts) => {
            return opts.w.config.series[opts.seriesIndex].data[opts.dataPointIndex].label;
          },
        },
      };

      // Destroy previous chart if exists
      if (chart) {
        chart.destroy();
      }

      const newChart = new ApexCharts(document.querySelector("#chart"), options);
      newChart.render();
      setChart(newChart);
    }
  }, [driverStints]);

  return <div id="chart" style={{ width: '400%' }} />; // Full width container
}

export default Stints;
