import React, { useEffect, useState, useCallback, useRef } from 'react';
import Plotly from 'plotly.js-dist';
import './SingleLapCharts.css';

function SingleLapCharts({ 
  primaryDriver, 
  sessionKey, 
  meetingKey, 
  lap, 
  availableLaps, 
  onLapChange,
  selectedDrivers = [],
  driverColors = {},
  externalButtons = false
}) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [selectedDriversData, setSelectedDriversData] = useState([]);
  const [driverInfoMap, setDriverInfoMap] = useState({});
  const [topSpeed, setTopSpeed] = useState(0);
  
  const containerRef = useRef(null);
  const sector1ChartRef = useRef(null);
  const sector2ChartRef = useRef(null);
  const sector3ChartRef = useRef(null);
  const resizeObserver = useRef(null);

  /* Auto-select a lap when component loads if no lap is selected */
  useEffect(() => {
    if (!lap && availableLaps && availableLaps.length > 0) {
      const defaultLap = availableLaps.includes('5') ? '5' : 
                        availableLaps[Math.floor(Math.random() * availableLaps.length)];
      onLapChange(defaultLap);
    }
  }, [availableLaps, lap, onLapChange]);

  /* Format driver name with proper capitalization */
  const formatDriverName = (name) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  /* Abbreviate driver name for chart display */
  const abbreviateDriverName = (name) => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length === 1) return name;
    
    if (name.length <= 10) return name;
    
    const firstInitial = parts[0][0];
    const lastName = parts[parts.length - 1];
    return `${firstInitial}. ${lastName}`;
  };

  /* Fetch driver colors and information */
  const fetchDriverColors = useCallback(async () => {
    try {
      const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
      const data = await response.json();

      const infoMap = {};
      data.forEach((driver) => {
        const color = driver.team_colour.startsWith('#') ? driver.team_colour : `#${driver.team_colour}`;
        infoMap[driver.driver_number] = { name: driver.full_name, color };
      });

      setDriverInfoMap(infoMap);
    } catch (error) {
      console.error('Error fetching driver colors:', error);
    }
  }, [meetingKey, sessionKey]);

  /* Get driver number by name from API */
  const getDriverNumberFromAPI = async (driverName) => {
    try {
      const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
      const data = await response.json();
      const driver = data.find((driver) => driver.full_name === driverName);
      return driver ? driver.driver_number : null;
    } catch (error) {
      console.error('Error fetching driver number:', error);
      return null;
    }
  };

  /* Fetch lap data for a specific driver */
  const fetchData = useCallback(async (driver) => {
    try {
      const driverNumber = await getDriverNumberFromAPI(driver);
      if (!driverNumber) return [];

      const response = await fetch(
        `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}&lap_number=${lap}`
      );
      const testData = await response.json();

      const lapData = testData.map((lap) => ({
        driver_num: lap.driver_number,
        sector1: lap.duration_sector_1,
        sector2: lap.duration_sector_2,
        sector3: lap.duration_sector_3,
        top_speed: lap.st_speed 
      }));

      if (lapData.length > 0 && driver === primaryDriver) {
        setTopSpeed(lapData[0].top_speed);
      }

      return lapData;
    } catch (error) {
      console.error('Error fetching lap data:', error);
      return [];
    }
  }, [meetingKey, sessionKey, lap, primaryDriver]);

  /* Fetch data for primary driver */
  useEffect(() => {
    if (primaryDriver) {
      fetchData(primaryDriver).then(data => setPrimaryDriverData(data));
    }
  }, [primaryDriver, fetchData]);

  /* Fetch data for selected comparison drivers */
  useEffect(() => {
    if (selectedDrivers.length > 0) {
      const fetchLapDataForSelected = async () => {
        const allSelectedDriversData = await Promise.all(selectedDrivers.map(driver => fetchData(driver)));
        setSelectedDriversData(allSelectedDriversData.flat());
      };
      fetchLapDataForSelected();
    } else {
      setSelectedDriversData([]);
    }
  }, [selectedDrivers, fetchData]);

  /* Fetch driver colors on session change */
  useEffect(() => {
    if (sessionKey && meetingKey) {
      fetchDriverColors();
    }
  }, [sessionKey, meetingKey, fetchDriverColors]);

  /* Update chart sizes based on container dimensions */
  const updateChartSizes = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    
    try {
      const container = containerRef.current;
      const sectorContainer = container.querySelector('.sector-charts');
      if (!sectorContainer) return;
      
      const containerWidth = sectorContainer.offsetWidth;
      const containerHeight = sectorContainer.offsetHeight;
      
      if (containerWidth < 50 || containerHeight < 50) return;
      
      /* Calculate sizes for each sector chart */
      const sectorWidth = Math.floor((containerWidth / 3) - 20); // Subtract padding
      const sectorHeight = containerHeight - 20; // Subtract padding
      
      /* Only update if dimensions have changed significantly */
      if (sector1ChartRef.current) {
        const currentLayout = sector1ChartRef.current.layout || {};
        const currentWidth = currentLayout.width || 0;
        const currentHeight = currentLayout.height || 0;

        if (Math.abs(currentWidth - sectorWidth) > 10 || Math.abs(currentHeight - sectorHeight) > 10) {
          Plotly.relayout(sector1ChartRef.current, { width: sectorWidth, height: sectorHeight });
        }
      }
      
      if (sector2ChartRef.current) {
        const currentLayout = sector2ChartRef.current.layout || {};
        const currentWidth = currentLayout.width || 0;
        const currentHeight = currentLayout.height || 0;
        
        if (Math.abs(currentWidth - sectorWidth) > 10 || Math.abs(currentHeight - sectorHeight) > 10) {
          Plotly.relayout(sector2ChartRef.current, { width: sectorWidth, height: sectorHeight });
        }
      }
      
      if (sector3ChartRef.current) {
        const currentLayout = sector3ChartRef.current.layout || {};
        const currentWidth = currentLayout.width || 0;
        const currentHeight = currentLayout.height || 0;
        
        if (Math.abs(currentWidth - sectorWidth) > 10 || Math.abs(currentHeight - sectorHeight) > 10) {
          Plotly.relayout(sector3ChartRef.current, { width: sectorWidth, height: sectorHeight });
        }
      }
    } catch (e) {
      console.warn('Failed to update chart sizes:', e);
    }
  }, []);

  /* Set up ResizeObserver for responsive chart sizing */
  useEffect(() => {
    /* Cleanup any existing observer first */
    if (resizeObserver.current) {
      resizeObserver.current.disconnect();
      resizeObserver.current = null;
    }
    
    /* Debounce function to prevent excessive updates */
    let timeout = null;
    const debouncedResize = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        updateChartSizes();
      }, 100);
    };
    
    /* Create new observer if container exists */
    if (containerRef.current) {
      try {
        resizeObserver.current = new ResizeObserver(() => {
          /* Use debounced function to prevent excessive updates */
          debouncedResize();
        });
        resizeObserver.current.observe(containerRef.current);
      } catch (e) {
        console.warn('Failed to create ResizeObserver:', e);
      }
    }
    
    /* Cleanup function */
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (resizeObserver.current) {
        try {
          resizeObserver.current.disconnect();
        } catch (e) {
          console.warn('Failed to disconnect ResizeObserver:', e);
        }
        resizeObserver.current = null;
      }
    };
  }, [updateChartSizes]);

  /* Handle window resize events */
  useEffect(() => {
    window.addEventListener('resize', updateChartSizes);
    return () => window.removeEventListener('resize', updateChartSizes);
  }, [updateChartSizes]);

  /* Initialize and update sector charts */
  useEffect(() => {
    const allData = [...primaryDriverData, ...selectedDriversData];
    if (allData.length === 0 || !sector1ChartRef.current || !sector2ChartRef.current || !sector3ChartRef.current) {
      return;
    }
    
    /* Get container dimensions for responsive sizing */
    const container = containerRef.current;
    let chartWidth = 180;
    let chartHeight = 300;
    
    if (container) {
      const sectorContainer = container.querySelector('.sector-charts');
      if (sectorContainer) {
        const containerWidth = sectorContainer.offsetWidth;
        const containerHeight = sectorContainer.offsetHeight;
        /* Only set dimensions if container has reasonable size */
        if (containerWidth > 50 && containerHeight > 50) {
          chartWidth = Math.floor((containerWidth / 3) - 20); 
          chartHeight = containerHeight - 20; 
        }
      }
    }
    
    /* Generate a unique numeric index for drivers */
    const driverIndices = allData.map((_, index) => index + 1);
    
    /* Map the driver names for tooltips */
    const driverNames = allData.map((d) => {
      const fullName = driverInfoMap[d.driver_num]?.name || '';
      return fullName;
    });
    
    /* Use short driver codes (3 letters) */
    const driverCodes = allData.map((d) => {
      const fullName = driverInfoMap[d.driver_num]?.name || '';
      /* Extract first 3 letters of last name, or do a custom abbreviation */
      const parts = fullName.split(' ');
      if (parts.length > 1) {
        const lastName = parts[parts.length - 1].toUpperCase();
        return lastName.substring(0, 3);
      }
      return fullName.substring(0, 3).toUpperCase();
    });
    
    const sector1Times = allData.map((d) => d.sector1);
    const sector2Times = allData.map((d) => d.sector2);
    const sector3Times = allData.map((d) => d.sector3);
    const colors = allData.map((d) => driverInfoMap[d.driver_num]?.color);

    /* Helper function to calculate appropriate y-axis range */
    const getAxisRange = (sectorTimes) => {
      if (!sectorTimes || sectorTimes.length === 0) {
        return [0, 1];
      }
      const validTimes = sectorTimes.filter(time => time !== undefined && time !== null);
      if (validTimes.length === 0) {
        return [0, 1];
      }
      const min = Math.min(...validTimes);
      const max = Math.max(...validTimes);
      const padding = (max - min) * 0.1;
      return [min - padding, max + padding];
    };

    /* Common layout settings for all sector charts */
    const commonLayout = {
      width: chartWidth, 
      height: chartHeight,
      margin: {    
        l: 40,
        r: 10,
        t: 30,
        b: 50
      },
      paper_bgcolor: 'black',
      plot_bgcolor: 'black',
      font: {
        size: 10,
        color: 'white'
      },
      yaxis: {
        tickfont: { size: 9, color: 'white' },
        gridcolor: '#333'
      },
      xaxis: {
        tickfont: { size: 11, color: 'white', family: 'Arial, sans-serif' },
        gridcolor: '#333',
        tickangle: 0,
        tickmode: 'array',
        tickvals: driverIndices,
        ticktext: driverCodes
      },
      hovermode: 'closest'
    };

    /* Sector 1 Chart */
    const sector1Data = [{
      x: driverIndices,
      y: sector1Times,
      type: 'bar',
      marker: { color: colors },
      hovertemplate: 'Sector 1: %{y} sec<extra></extra>'
    }];
    const sector1Layout = { 
      ...commonLayout,
      title: { text: 'Sector 1', font: { size: 12 } },
      yaxis: { ...commonLayout.yaxis, range: getAxisRange(sector1Times) }
    };

    /* Sector 2 Chart */
    const sector2Data = [{
      x: driverIndices,
      y: sector2Times,
      type: 'bar',
      marker: { color: colors },
      hovertemplate: 'Sector 2: %{y} sec<extra></extra>'
    }];
    const sector2Layout = { 
      ...commonLayout,
      title: { text: 'Sector 2', font: { size: 12 } },
      yaxis: { ...commonLayout.yaxis, range: getAxisRange(sector2Times) }
    };

    /* Sector 3 Chart */
    const sector3Data = [{
      x: driverIndices,
      y: sector3Times,
      type: 'bar',
      marker: { color: colors },
      hovertemplate: 'Sector 3: %{y} sec<extra></extra>'
    }];
    const sector3Layout = { 
      ...commonLayout,
      title: { text: 'Sector 3', font: { size: 12 } },
      yaxis: { ...commonLayout.yaxis, range: getAxisRange(sector3Times) }
    };

    /* Create or update charts with responsive sizing */
    if (sector1ChartRef.current) {
      try {
        Plotly.newPlot(sector1ChartRef.current, sector1Data, sector1Layout, {
          responsive: true,
          displayModeBar: false
        });
      } catch (e) {
        console.warn('Failed to plot sector1 chart:', e);
      }
    }
    
    if (sector2ChartRef.current) {
      try {
        Plotly.newPlot(sector2ChartRef.current, sector2Data, sector2Layout, {
          responsive: true,
          displayModeBar: false
        });
      } catch (e) {
        console.warn('Failed to plot sector2 chart:', e);
      }
    }
    
    if (sector3ChartRef.current) {
      try {
        Plotly.newPlot(sector3ChartRef.current, sector3Data, sector3Layout, {
          responsive: true,
          displayModeBar: false
        });
      } catch (e) {
        console.warn('Failed to plot sector3 chart:', e);
      }
    }

    /* Resize after short delay for proper layout */
    const resizeTimer = setTimeout(() => {
      updateChartSizes();
    }, 300);

    /* Clean up function with null checks */
    return () => {
      clearTimeout(resizeTimer);
      
      if (sector1ChartRef.current) {
        try {
          Plotly.purge(sector1ChartRef.current);
        } catch (e) {
          console.warn('Failed to purge sector1 chart:', e);
        }
      }
      if (sector2ChartRef.current) {
        try {
          Plotly.purge(sector2ChartRef.current);
        } catch (e) {
          console.warn('Failed to purge sector2 chart:', e);
        }
      }
      if (sector3ChartRef.current) {
        try {
          Plotly.purge(sector3ChartRef.current);
        } catch (e) {
          console.warn('Failed to purge sector3 chart:', e);
        }
      }
    };
  }, [primaryDriverData, selectedDriversData, driverInfoMap, updateChartSizes]);

  return (
    <div className="chart-box" ref={containerRef}>
      <h2>{formatDriverName(primaryDriver)} Lap Analysis</h2>
  
      <div style={{ marginBottom: '20px' }}>
        <select className="common-dropdown" onChange={(e) => onLapChange(e.target.value)} value={lap || ''}>
          <option value="">Select a Lap</option>
          {availableLaps.map((lapNumber, index) => (
            <option key={index} value={lapNumber}>
              {lapNumber}
            </option>
          ))}
        </select>
      </div>
  
      <div className="charts-container">
        <div className="sector-charts">
          <div ref={sector1ChartRef} className="sector-chart"></div>
          <div ref={sector2ChartRef} className="sector-chart"></div>
          <div ref={sector3ChartRef} className="sector-chart"></div>
        </div>
        {lap && <h2>Lap number {lap}</h2>}
      </div>
    </div>
  );
}

export default SingleLapCharts;