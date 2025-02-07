import React, { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';
import './stints.css';

function Stints({ sessionKey, meetingKey }) {
  const [allDriverStints, setAllDriverStints] = useState({});
  const [allDrivers, setAllDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchWithRetry = async (url, retries = 5, baseDelay = 2000) => {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 429) {
            // Exponential backoff for rate limiting
            const waitTime = baseDelay * Math.pow(2, i);
            await delay(waitTime);
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        lastError = error;
        if (i === retries - 1) break;
        
        // Exponential backoff for all errors
        const waitTime = baseDelay * Math.pow(2, i);
        await delay(waitTime);
      }
    }
    throw lastError;
  };

  // Fetch all drivers first with improved error handling
  useEffect(() => {
    const fetchDrivers = async () => {
      if (!sessionKey || !meetingKey) return;
      
      try {
        setIsLoading(true);
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
        setError('Failed to fetch drivers data');
      }
    };

    fetchDrivers();
  }, [sessionKey, meetingKey]);

  // Fetch stints for each driver with chunking and rate limiting
  useEffect(() => {
    const fetchAllStints = async () => {
      if (!allDrivers.length) return;

      const newStints = {};
      const chunks = [];
      const chunkSize = 5; // Process 5 drivers at a time
      
      // Split drivers into chunks
      for (let i = 0; i < allDrivers.length; i += chunkSize) {
        chunks.push(allDrivers.slice(i, i + chunkSize));
      }
      
      try {
        // Process each chunk with delay between chunks
        for (const chunk of chunks) {
          await Promise.all(chunk.map(async (driver) => {
            try {
              const stintsData = await fetchWithRetry(
                `https://api.openf1.org/v1/stints?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driver.number}`
              );
              
              if (stintsData && stintsData.length > 0) {
                newStints[driver.name] = stintsData;
              }
            } catch (error) {
              console.error(`Error fetching stints for ${driver.name}:`, error);
            }
          }));
          
          // Delay between chunks to avoid rate limiting
          await delay(2000);
        }
        
        setAllDriverStints(newStints);
      } catch (error) {
        console.error('Error fetching stints:', error);
        setError('Failed to fetch stint data');
      } finally {
        setIsLoading(false);
      }
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

    const MIN_HEIGHT_PER_DRIVER = 20; // Minimum height per driver
    const numDrivers = driversWithData.length;
    const calculatedHeight = Math.max(500, numDrivers * MIN_HEIGHT_PER_DRIVER); // Ensure minimum height
    const maxBarWidth = 10;

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
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: 'white'
        }
      },
      xaxis: {
        title: {
          text: 'Lap Numbers',
          font: {
            size: 12,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: 'white'
          }
        },
        range: [0, xAxisMax],
        showgrid: true,
        gridcolor: '#333333',
        zeroline: false,
        dtick: 5,
        color: 'white'
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
          size: 12,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: 'white'
        }
      },
      plot_bgcolor: 'black',
      paper_bgcolor: '#131313',
      height: calculatedHeight,
      autosize: true,
      margin: {
        l: 150, // Left margin for driver names
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
      responsive: true,
      scrollZoom: false // Disable scroll zoom to prevent accidental zooming
    };

    return (
      <Plot
        data={data}
        layout={layout}
        config={config}
        className="stint-plot"
        style={{
          width: '100%',
          height: '100%',
          minHeight: calculatedHeight
        }}
      />
    );
  };

  return (
    <div className="stints-container" style={{
      width: '100%',
      height: 'auto',
      minHeight: '500px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgb(19, 19, 19)',
      padding: '1rem',
      position: 'relative'
    }}>
      {renderPlot()}
    </div>
  );
}

export default Stints;