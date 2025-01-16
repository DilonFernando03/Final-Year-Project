import React, { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';
import './stints.css';

function Stints({ sessionKey, meetingKey }) {
  const [allDriverStints, setAllDriverStints] = useState({});
  const [allDrivers, setAllDrivers] = useState([]);

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchWithRetry = async (url, retries = 3, baseDelay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 429) {
            await delay(baseDelay * Math.pow(2, i));
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        await delay(baseDelay * Math.pow(2, i));
      }
    }
  };

  // Fetch all drivers first
  useEffect(() => {
    const fetchDrivers = async () => {
      if (!sessionKey || !meetingKey) return;
      
      try {
        const response = await fetchWithRetry(
          `https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`
        );
        
        const drivers = response.map(driver => ({
          name: driver.full_name,
          number: driver.driver_number
        }));
        
        setAllDrivers(drivers);
      } catch (error) {
        console.error('Error fetching drivers:', error);
      }
    };

    fetchDrivers();
  }, [sessionKey, meetingKey]);

  // Fetch stints for each driver
  useEffect(() => {
    const fetchAllStints = async () => {
      if (!allDrivers.length) return;

      const newStints = {};
      
      for (const driver of allDrivers) {
        try {
          await delay(500); // Rate limiting
          const stintsData = await fetchWithRetry(
            `https://api.openf1.org/v1/stints?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driver.number}`
          );
          
          if (stintsData && stintsData.length > 0) {
            newStints[driver.name] = stintsData;
          }
        } catch (error) {
          console.error(`Error fetching stints for ${driver.name}:`, error);
        }
      }

      setAllDriverStints(newStints);
    };

    fetchAllStints();
  }, [allDrivers, meetingKey, sessionKey]);

  const renderPlot = () => {
    if (Object.keys(allDriverStints).length === 0) return null;

    const driversWithData = Object.keys(allDriverStints);
    const maxLap = Math.max(
      ...driversWithData.flatMap(driver => 
        allDriverStints[driver].map(stint => stint.lap_end)
      )
    );
    const xAxisMax = Math.ceil(maxLap * 1.05);

    const MAX_CHART_HEIGHT = 600; // Increased for more drivers
    const numDrivers = driversWithData.length;
    const maxBarWidth = Math.max(10, Math.min(20, Math.floor(MAX_CHART_HEIGHT / numDrivers)));
    const chartHeight = Math.min(MAX_CHART_HEIGHT, Math.max(120, 30 * numDrivers));

    const data = driversWithData.flatMap((driverName, driverIndex) => {
      const driverStints = allDriverStints[driverName] || [];
      
      return driverStints.flatMap((stint) => {
        const compoundLetter = stint.compound === 'SOFT' ? 'S' :
                             stint.compound === 'MEDIUM' ? 'M' :
                             stint.compound === 'HARD' ? 'H' :
                             stint.compound === 'WET' ? 'W' :
                             stint.compound === 'INTERMEDIATE' ? 'I' :
                             'U';

        const color = stint.compound === 'SOFT' ? '#FF4D4D' :
                     stint.compound === 'MEDIUM' ? '#FFD700' :
                     stint.compound === 'HARD' ? '#808080' :
                     stint.compound === 'WET' ? '#00008B' : 
                     stint.compound === 'INTERMEDIATE' ? '#006400' : '#B0B0B0';

        const yPosition = driversWithData.length - driverIndex;

        const bar = {
          type: 'scatter',
          mode: 'lines',
          x: [stint.lap_start, stint.lap_end],
          y: [yPosition, yPosition],
          line: {
            color: color,
            width: maxBarWidth
          },
          hoverinfo: 'text',
          hovertext: `${driverName}<br>Laps: ${stint.lap_start} - ${stint.lap_end}<br>Compound: ${stint.compound}`,
          showlegend: false
        };

        const text = {
          type: 'scatter',
          mode: 'text',
          x: [(stint.lap_start + stint.lap_end) / 2],
          y: [yPosition],
          text: [compoundLetter],
          textfont: {
            size: Math.min(12, maxBarWidth - 4),
            color: 'white',
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          hoverinfo: 'none',
          showlegend: false
        };

        return [bar, text];
      });
    });

    const layout = {
      title: {
        text: 'Pit Strategy - All Drivers',
        font: {
          size: 16,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      },
      xaxis: {
        title: {
          text: 'Lap Numbers',
          font: {
            size: 12,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }
        },
        range: [0, xAxisMax],
        showgrid: true,
        gridcolor: '#E5E5E5',
        zeroline: false,
        dtick: 9
      },
      yaxis: {
        showticklabels: true,
        ticktext: driversWithData,
        tickvals: driversWithData.map((_, i) => driversWithData.length - i),
        range: [0.5, driversWithData.length + 0.5],
        showgrid: false,
        zeroline: false,
        fixedrange: true,
        tickfont: {
          size: Math.min(12, maxBarWidth - 2),
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'white',
      height: chartHeight,
      margin: {
        l: 150, // Increased left margin for longer driver names
        r: 20,
        t: 40,
        b: 40
      },
      showlegend: false,
      hoverlabel: {
        bgcolor: 'white',
        font: { 
          size: 12,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      }
    };

    const config = {
      displayModeBar: false,
      responsive: true
    };

    return (
      <Plot
        data={data}
        layout={layout}
        config={config}
        className="stint-plot"
        style={{ maxHeight: MAX_CHART_HEIGHT }}
      />
    );
  };

  return (
    <div className="stints-container">
      {renderPlot()}
    </div>
  );
}

export default Stints;