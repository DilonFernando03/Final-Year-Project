import React, { useEffect, useState, useRef } from 'react';
import Plot from 'react-plotly.js';
import './stints.css';

function Stints({ sessionKey, meetingKey }) {
  const [allDriverStints, setAllDriverStints] = useState({});
  const [allDrivers, setAllDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlightedDriver, setHighlightedDriver] = useState(null);
  const [filterCompound, setFilterCompound] = useState(null);
  const [showLapTimes, setShowLapTimes] = useState(false);
  const [lapTimeData, setLapTimeData] = useState({});
  const containerRef = useRef(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  /* Helper function to add delay between API calls */
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /* Add resize observer to track container dimensions */
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  /* Fetch with retry logic for API calls */
  const fetchWithRetry = async (url, retries = 5, baseDelay = 2000) => {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 429) {
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
        const waitTime = baseDelay * Math.pow(2, i);
        await delay(waitTime);
      }
    }
    throw lastError;
  };

  /* Fetch drivers list */
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
          number: driver.driver_number,
          team_color: getTeamColor(driver.team_name) // Add team colors
        }));
        
        setAllDrivers(drivers);
      } catch (error) {
        console.error('Error fetching drivers:', error);
        setError('Failed to fetch drivers data');
      }
    };

    fetchDrivers();
  }, [sessionKey, meetingKey]);

  /* Get team colors for better visualization */
  const getTeamColor = (teamName) => {
    const teamColors = {
      'Red Bull Racing': '#0600EF',
      'Mercedes': '#00D2BE',
      'Ferrari': '#DC0000',
      'McLaren': '#FF8700',
      'Aston Martin': '#006F62',
      'Alpine': '#0090FF',
      'Williams': '#005AFF',
      'AlphaTauri': '#2B4562',
      'Alfa Romeo': '#900000',
      'Haas F1 Team': '#FFFFFF'
    };
    
    return teamColors[teamName] || '#CCCCCC';
  };

  /* Get compound colors with better contrast */
  const getCompoundColor = (compound) => {
    const compoundColors = {
      'SOFT': '#FF0000',
      'MEDIUM': '#FFC700',
      'HARD': '#FFFFFF',
      'INTERMEDIATE': '#00C800',
      'WET': '#0000FF'
    };
    
    return compoundColors[compound] || '#B0B0B0';
  };

  /* Fetch stint data for all drivers */
  useEffect(() => {
    const fetchAllStints = async () => {
      if (!allDrivers.length) return;

      const newStints = {};
      const chunks = [];
      const chunkSize = 5;
      
      /* Divide drivers into chunks to avoid API rate limits */
      for (let i = 0; i < allDrivers.length; i += chunkSize) {
        chunks.push(allDrivers.slice(i, i + chunkSize));
      }
      
      try {
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
          await delay(200); /* Add delay between chunks to avoid rate limiting */
        }
        
        setAllDriverStints(newStints);
        
        /* Optional: Fetch lap times if enabled */
        if (showLapTimes) {
          fetchLapTimes();
        }
      } catch (error) {
        console.error('Error fetching stints:', error);
        setError('Failed to fetch stint data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllStints();
  }, [allDrivers, meetingKey, sessionKey, showLapTimes]);

  /* Fetch lap times if that feature is enabled */
  const fetchLapTimes = async () => {
    if (!allDrivers.length) return;
    
    const newLapTimes = {};
    
    try {
      for (const driver of allDrivers) {
        const lapTimeData = await fetchWithRetry(
          `https://api.openf1.org/v1/laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driver.number}`
        );
        
        if (lapTimeData && lapTimeData.length > 0) {
          newLapTimes[driver.name] = lapTimeData;
        }
        
        await delay(200); // Add delay to avoid rate limiting
      }
      
      setLapTimeData(newLapTimes);
    } catch (error) {
      console.error('Error fetching lap times:', error);
    }
  };

  /* Create plotly visualization of stint data */
  const renderPlot = () => {
    if (Object.keys(allDriverStints).length === 0) return null;

    let driversWithData = Object.keys(allDriverStints);
    
    /* Apply filtering if needed */
    if (highlightedDriver) {
      driversWithData = driversWithData.sort((a, b) => 
        a === highlightedDriver ? -1 : b === highlightedDriver ? 1 : 0
      );
    }
     
    /* Find maximum lap for scale */
    const maxLap = Math.max(
      ...driversWithData.flatMap(driver => 
        allDriverStints[driver].map(stint => stint.lap_end)
      )
    );
    const xAxisMax = Math.ceil(maxLap * 1.05);

    /* Calculate height based on container and number of drivers */
    const MIN_HEIGHT_PER_DRIVER = 25; // Increased for better readability
    const numDrivers = driversWithData.length;
    const availableHeight = containerDimensions.height || 500;
    const calculatedHeight = Math.min(
      availableHeight,
      Math.max(500, numDrivers * MIN_HEIGHT_PER_DRIVER)
    );
    
    const maxBarWidth = 14; // Increased for better visibility

    /* Prepare data for main stint plot */
    const data = driversWithData.flatMap((driverName, driverIndex) => {
      const driverStints = allDriverStints[driverName] || [];
      const isHighlighted = highlightedDriver === driverName;
      const opacity = highlightedDriver ? (isHighlighted ? 1 : 0.4) : 1;
      
      const yPosition = driversWithData.length - driverIndex;
      
      /* Get driver team color for the y-axis labels */
      const driverInfo = allDrivers.find(d => d.name === driverName);
      const driverColor = driverInfo ? driverInfo.team_color : '#CCCCCC';
      
      /* Filter by compound if needed */
      const filteredStints = filterCompound 
        ? driverStints.filter(stint => stint.compound === filterCompound)
        : driverStints;
      
      return filteredStints.flatMap((stint) => {
        /* Get compound info */
        const compoundLetter = stint.compound === 'SOFT' ? 'S' :
                             stint.compound === 'MEDIUM' ? 'M' :
                             stint.compound === 'HARD' ? 'H' :
                             stint.compound === 'WET' ? 'W' :
                             stint.compound === 'INTERMEDIATE' ? 'I' :
                             'U';

        /* Get color based on compound with better contrast */
        const color = getCompoundColor(stint.compound);
        const textColor = stint.compound === 'HARD' ? '#000000' : '#FFFFFF';

        /* Create stint duration bar */
        const stintBar = {
          type: 'scatter',
          mode: 'lines',
          x: [stint.lap_start, stint.lap_end],
          y: [yPosition, yPosition],
          line: {
            color: color,
            width: maxBarWidth
          },
          opacity: opacity,
          hoverinfo: 'text',
          hovertext: `${driverName}<br>Laps: ${stint.lap_start} - ${stint.lap_end}<br>Compound: ${stint.compound}<br>Stint Length: ${stint.lap_end - stint.lap_start + 1} laps`,
          showlegend: false
        };
        
        /* Create tire compound indicator with better visibility */
        const compoundIndicator = {
          type: 'scatter',
          mode: 'text',
          x: [(stint.lap_start + stint.lap_end) / 2],
          y: [yPosition],
          text: [compoundLetter],
          textfont: {
            size: Math.min(14, maxBarWidth - 2),
            color: textColor,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          opacity: opacity,
          hoverinfo: 'none',
          showlegend: false
        };
        
        /* Create lap time overlay if feature is enabled */
        let lapTimeTrace = null;
        if (showLapTimes && lapTimeData[driverName]) {
          const stintLapTimes = lapTimeData[driverName].filter(
            lap => lap.lap_number >= stint.lap_start && lap.lap_number <= stint.lap_end
          );
          
          if (stintLapTimes.length > 0) {
            lapTimeTrace = {
              type: 'scatter',
              mode: 'markers',
              x: stintLapTimes.map(lap => lap.lap_number),
              y: stintLapTimes.map(() => yPosition + 0.3),
              marker: {
                size: 5,
                color: stintLapTimes.map(lap => {
                  // Color dots based on lap time delta
                  const lapTime = lap.lap_time;
                  // Logic to determine if lap is fast/slow relative to others
                  return lapTime < 90 ? '#00FF00' : lapTime > 100 ? '#FF0000' : '#FFFF00';
                })
              },
              opacity: opacity * 0.8,
              hoverinfo: 'text',
              hovertext: stintLapTimes.map(lap => 
                `Lap ${lap.lap_number}: ${formatLapTime(lap.lap_time)}`
              ),
              showlegend: false
            };
          }
        }
        
        return lapTimeTrace 
          ? [stintBar, compoundIndicator, lapTimeTrace] 
          : [stintBar, compoundIndicator];
      });
    });

    /* Add compound legend */
    const compounds = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];
    const legendItems = compounds.map((compound, index) => {
      return {
        type: 'scatter',
        mode: 'markers',
        x: [null],
        y: [null],
        marker: {
          size: 12,
          color: getCompoundColor(compound),
          symbol: 'square'
        },
        name: compound,
        showlegend: true
      };
    });
    
    /* Format lap time for display */
    function formatLapTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = (seconds % 60).toFixed(3);
      return `${minutes}:${remainingSeconds.padStart(6, '0')}`;
    }

    /* Layout configuration with better styling */
    const layout = {
      title: {
        text: 'Pit Strategy - All Drivers',
        font: {
          size: 18,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: 'white'
        }
      },
      xaxis: {
        title: {
          text: 'Lap Numbers',
          font: {
            size: 14,
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
        showgrid: true,
        gridcolor: 'rgba(60, 60, 60, 0.3)',
        zeroline: false,
        fixedrange: true,
        tickfont: {
          size: 13,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: driversWithData.map(driver => {
            const driverInfo = allDrivers.find(d => d.name === driver);
            return driverInfo ? driverInfo.team_color : 'white';
          })
        }
      },
      plot_bgcolor: '#1a1a1a',
      paper_bgcolor: '#131313',
      height: calculatedHeight,
      autosize: true,
      margin: {
        l: 160,
        r: 30,
        t: 50,
        b: 80  // Increased bottom margin for controls
      },
      showlegend: true,
      legend: {
        orientation: 'h',
        y: -0.2,  // Moved legend down further
        x: 0.5,
        xanchor: 'center',
        font: {
          color: 'white',
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        bgcolor: 'rgba(0,0,0,0.5)'
      },
      hoverlabel: {
        bgcolor: '#2a2a2a',
        bordercolor: '#444',
        font: { 
          size: 12,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: 'white'
        }
      },
      annotations: [
        {
          x: 0,
          y: 0,
          xref: 'paper',
          yref: 'paper',
          text: 'Data: OpenF1 API',
          showarrow: false,
          font: {
            size: 10,
            color: '#888'
          },
          align: 'left',
          xanchor: 'left',
          yanchor: 'bottom',
          x: 0,
          y: -0.3  /* Moved down to avoid overlap with controls */
        }
      ]
    };

    /* Plotly configuration with more interactivity */
    const config = {
      displayModeBar: true,
      displaylogo: false,
      responsive: true,
      scrollZoom: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    };

    /* Add all data to plot, including legend items */
    return (
      <Plot
        data={[...data, ...legendItems]}
        layout={layout}
        config={config}
        style={{
          width: '100%',
          height: '100%'
        }}
        onHover={(data) => {
          if (data.points && data.points[0]) {
            const pointData = data.points[0];
            const hovertext = pointData.hovertext || '';
            const driverName = hovertext.split('<br>')[0];
            if (driverName && Object.keys(allDriverStints).includes(driverName)) {
              setHighlightedDriver(driverName);
            }
          }
        }}
        onUnhover={() => {
          setHighlightedDriver(null);
        }}
        onClick={(data) => {
          /* Handle click on legend to filter by compound */
          if (data.points && data.points[0] && data.points[0].data.name) {
            const compound = data.points[0].data.name;
            setFilterCompound(filterCompound === compound ? null : compound);
          }
        }}
      />
    );
  };

  /* Control panel component for additional features */
  const ControlPanel = () => (
    <div className="stints-control-panel">
      <div className="control-section">
        <label>
          <input
            type="checkbox"
            checked={showLapTimes}
            onChange={() => setShowLapTimes(!showLapTimes)}
          />
          Show Lap Time Indicators
        </label>
      </div>
      
      <div className="control-section">
        <button onClick={() => setFilterCompound(null)}>
          Show All Compounds
        </button>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="stints-container" style={{ width: '100%', height: '100%' }}>
      {isLoading ? (
        <div className="loading-indicator">Loading stint data...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          {renderPlot()}
          <ControlPanel />
        </>
      )}
    </div>
  );
}

export default Stints;