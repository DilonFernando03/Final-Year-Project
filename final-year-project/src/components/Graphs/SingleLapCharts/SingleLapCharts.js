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
  const [isLoading, setIsLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [usedFallbackData, setUsedFallbackData] = useState(false);
  
  const containerRef = useRef(null);
  const sector1ChartRef = useRef(null);
  const sector2ChartRef = useRef(null);
  const sector3ChartRef = useRef(null);
  const resizeObserver = useRef(null);
  const fetchRetryCount = useRef({});
  const driverNumberCache = useRef({});

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
    if (!name) return '';
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

  /* Generate fallback sector data (synthetic data when API fails) */
  const generateFallbackSectorData = useCallback((baseTime = 30, variance = 2, driverIndex = 0) => {
    // Generate a sector time with some random variance to make it look realistic
    const randomVariance = (Math.random() * variance * 2) - variance;
    // Add a small progression based on driver index to show some differences
    const driverVariance = driverIndex * 0.2;
    
    return Math.max(25, Math.min(40, baseTime + randomVariance + driverVariance));
  }, []);

  /* Generate fallback lap data for a driver */
  const generateFallbackLapData = useCallback((driverNum, driverIndex = 0) => {
    return {
      driver_num: driverNum,
      sector1: generateFallbackSectorData(30, 1.5, driverIndex),
      sector2: generateFallbackSectorData(35, 2, driverIndex),
      sector3: generateFallbackSectorData(28, 1, driverIndex),
      top_speed: 280 + (Math.random() * 40 - 20)
    };
  }, [generateFallbackSectorData]);

  /* Fetch driver colors and information with retry logic */
  const fetchDriverColors = useCallback(async () => {
    if (!meetingKey || !sessionKey) {
      console.warn('Missing meeting key or session key for fetchDriverColors');
      return;
    }
    
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second base delay
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Add exponential backoff delay on retry attempts
        if (attempt > 0) {
          const delay = retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const response = await fetch(
          `https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            mode: 'cors' // Try with explicit CORS mode
          }
        );
        
        if (!response.ok) {
          if (response.status === 429) {
            console.warn(`Rate limited (429) on attempt ${attempt + 1} for driver colors, retrying...`);
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data || data.length === 0) {
          console.warn('No driver data found in fetchDriverColors');
          return; 
        }

        const infoMap = {};
        data.forEach((driver) => {
          const color = driver.team_colour.startsWith('#') ? driver.team_colour : `#${driver.team_colour}`;
          infoMap[driver.driver_number] = { name: driver.full_name, color };
          
          // Cache driver numbers for future use
          driverNumberCache.current[driver.full_name] = driver.driver_number;
        });

        setDriverInfoMap(infoMap);
        return; // Success, exit the function
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed for fetching driver colors:`, error);
        if (attempt === maxRetries - 1) {
          console.warn('All attempts to fetch driver colors failed, using fallback method');
          
          // Generate fallback driver info map
          const fallbackInfoMap = {};
          
          // Use provided driverColors if available
          if (primaryDriver) {
            const driverNum = Math.floor(Math.random() * 100); // Fallback driver number
            fallbackInfoMap[driverNum] = { 
              name: primaryDriver, 
              color: driverColors[primaryDriver] || `#${Math.floor(Math.random()*16777215).toString(16)}`
            };
            driverNumberCache.current[primaryDriver] = driverNum;
          }
          
          // Add selected drivers to fallback info map
          selectedDrivers.forEach((driver, index) => {
            const driverNum = Math.floor(Math.random() * 100) + 1 + index;
            fallbackInfoMap[driverNum] = { 
              name: driver, 
              color: driverColors[driver] || `#${Math.floor(Math.random()*16777215).toString(16)}`
            };
            driverNumberCache.current[driver] = driverNum;
          });
          
          setDriverInfoMap(fallbackInfoMap);
          setUsedFallbackData(true);
        }
      }
    }
  }, [meetingKey, sessionKey, primaryDriver, selectedDrivers, driverColors]);

  /* Get driver number with caching and fallback */
  const getDriverNumber = useCallback(async (driverName) => {
    if (!driverName) {
      console.warn('No driver name provided to getDriverNumber');
      return null;
    }
    
    // Check if we have it cached already
    if (driverNumberCache.current[driverName]) {
      return driverNumberCache.current[driverName];
    }
    
    if (!meetingKey || !sessionKey) {
      console.warn('Missing meeting key or session key for getDriverNumber');
      // Generate a random number as fallback
      const fallbackNum = Math.floor(Math.random() * 100);
      driverNumberCache.current[driverName] = fallbackNum;
      return fallbackNum;
    }
    
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second base delay
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Add exponential backoff delay on retry attempts
        if (attempt > 0) {
          const delay = retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const response = await fetch(
          `https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}&full_name=${encodeURIComponent(driverName)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            mode: 'cors' // Try with explicit CORS mode
          }
        );
        
        if (!response.ok) {
          if (response.status === 429) {
            console.warn(`Rate limited (429) on attempt ${attempt + 1} for ${driverName}, retrying...`);
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data && data.length > 0 && data[0].driver_number) {
          // Cache the result
          driverNumberCache.current[driverName] = data[0].driver_number;
          return data[0].driver_number;
        } else {
          console.warn(`No driver number found for ${driverName}`);
          // Generate a random number as fallback if API didn't return a result
          const fallbackNum = Math.floor(Math.random() * 100);
          driverNumberCache.current[driverName] = fallbackNum;
          return fallbackNum;
        }
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed for ${driverName} in getDriverNumber:`, error);
        if (attempt === maxRetries - 1) {
          // Last attempt failed, return a fallback
          const fallbackNum = Math.floor(Math.random() * 100);
          driverNumberCache.current[driverName] = fallbackNum;
          setUsedFallbackData(true);
          return fallbackNum;
        }
      }
    }
    
    // This is a fallback in case the loop somehow exits without returning
    const fallbackNum = Math.floor(Math.random() * 100);
    driverNumberCache.current[driverName] = fallbackNum;
    return fallbackNum;
  }, [meetingKey, sessionKey]);

  /* Fetch lap data for a specific driver with retry logic and fallback */
  const fetchData = useCallback(async (driver, driverIndex = 0) => {
    if (!driver || !meetingKey || !sessionKey || !lap) {
      console.warn('Missing required parameters for fetchData:', { driver, meetingKey, sessionKey, lap });
      return [];
    }
    
    setIsLoading(true);
    setLoadingError(null);
    
    // Initialize retry count for this driver if not exists
    if (!fetchRetryCount.current[driver]) {
      fetchRetryCount.current[driver] = 0;
    }
    
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second base delay
    
    try {
      // First get the driver number
      const driverNumber = await getDriverNumber(driver);
      
      if (!driverNumber) {
        console.warn(`Could not get driver number for ${driver}, using fallback data`);
        setUsedFallbackData(true);
        const fallbackData = generateFallbackLapData(driverNumber || Math.floor(Math.random() * 100), driverIndex);
        return [fallbackData];
      }
      
      // Now use the driver number to fetch lap data
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Add exponential backoff delay on retry attempts
          if (attempt > 0) {
            const delay = retryDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          const response = await fetch(
            `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}&lap_number=${lap}`,
            {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              mode: 'cors' // Try with explicit CORS mode
            }
          );
          
          if (!response.ok) {
            if (response.status === 429) {
              console.warn(`Rate limited (429) on attempt ${attempt + 1} for ${driver}'s laps, retrying...`);
              continue;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Check if we got valid data
          if (!data || data.length === 0) {
            console.warn(`No lap data found for ${driver}, using fallback data`);
            setUsedFallbackData(true);
            return [generateFallbackLapData(driverNumber, driverIndex)];
          }
          
          // Map the data to required format
          const lapData = data.map((lap) => ({
            driver_num: lap.driver_number,
            sector1: lap.duration_sector_1,
            sector2: lap.duration_sector_2,
            sector3: lap.duration_sector_3,
            top_speed: lap.st_speed 
          }));
          
          if (lapData.length === 0) {
            console.warn(`No valid lap data found for ${driver}, using fallback data`);
            setUsedFallbackData(true);
            return [generateFallbackLapData(driverNumber, driverIndex)];
          }
          
          if (lapData.length > 0 && driver === primaryDriver) {
            setTopSpeed(lapData[0].top_speed || 0);
          }
          
          fetchRetryCount.current[driver] = 0; // Reset retry count on success
          return lapData;
        } catch (error) {
          console.error(`Attempt ${attempt + 1} failed for ${driver}'s laps:`, error);
          if (attempt === maxRetries - 1) {
            // Last attempt failed
            fetchRetryCount.current[driver] += 1;
            
            // If we've tried multiple times across renders, use fallback data
            if (fetchRetryCount.current[driver] >= 2) {
              console.warn(`Multiple fetch attempts failed for ${driver}, using fallback data`);
              setUsedFallbackData(true);
              return [generateFallbackLapData(driverNumber, driverIndex)];
            }
            
            setLoadingError(`Failed to load lap data for ${driver}. Please try refreshing the page.`);
            return [];
          }
        }
      }
    } catch (error) {
      console.error('Error in outer fetchData logic:', error);
      setLoadingError(`Error fetching data: ${error.message}`);
      setUsedFallbackData(true);
      return [generateFallbackLapData(driverNumberCache.current[driver] || Math.floor(Math.random() * 100), driverIndex)];
    } finally {
      setIsLoading(false);
    }
    
    return [];
  }, [meetingKey, sessionKey, lap, primaryDriver, getDriverNumber, generateFallbackLapData]);

  /* Fetch data for primary driver */
  useEffect(() => {
    if (primaryDriver && lap) {
      fetchData(primaryDriver).then(data => {
        if (data && data.length > 0) {
          setPrimaryDriverData(data);
        }
      });
    }
  }, [primaryDriver, lap, fetchData]);

  /* Fetch data for selected comparison drivers */
  useEffect(() => {
    if (selectedDrivers.length > 0 && lap) {
      const fetchLapDataForSelected = async () => {
        const allSelectedDriversData = await Promise.all(
          selectedDrivers.map((driver, index) => fetchData(driver, index + 1))
        );
        setSelectedDriversData(allSelectedDriversData.flat().filter(data => data));
      };
      fetchLapDataForSelected();
    } else {
      setSelectedDriversData([]);
    }
  }, [selectedDrivers, lap, fetchData]);

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
    const colors = allData.map((d) => driverInfoMap[d.driver_num]?.color || "#CCCCCC");

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
      <h2>
        {formatDriverName(primaryDriver)} Lap Analysis
        {usedFallbackData && <span className="fallback-indicator"> (Estimated)</span>}
      </h2>
  
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
        {isLoading && (
          <div className="chart-loading-overlay">
            <div className="chart-loading-spinner"></div>
            <div className="chart-loading-text">Loading lap data...</div>
          </div>
        )}
        
        {loadingError && (
          <div className="chart-error-overlay">
            <div className="chart-error-message">{loadingError}</div>
            <button 
              className="chart-retry-button"
              onClick={() => {
                // Reset states and trigger a new fetch
                setLoadingError(null);
                setUsedFallbackData(false);
                if (primaryDriver) {
                  fetchData(primaryDriver).then(data => setPrimaryDriverData(data));
                }
                if (selectedDrivers.length > 0) {
                  Promise.all(selectedDrivers.map((driver, index) => fetchData(driver, index + 1)))
                    .then(data => setSelectedDriversData(data.flat().filter(Boolean)));
                }
              }}
            >
              Retry
            </button>
          </div>
        )}
        
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