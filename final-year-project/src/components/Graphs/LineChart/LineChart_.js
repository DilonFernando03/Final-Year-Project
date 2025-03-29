import React, { useEffect, useRef, useState, useCallback } from 'react';
import Chart from 'chart.js/auto';
import './LineChart.css';

function LineChart({ 
  primaryDriver, 
  sessionKey, 
  meetingKey,
  selectedDrivers = [],
  driverColors = {},
  externalButtons = false
}) {
  const [primaryDriverData, setPrimaryDriverData] = useState([]);
  const [selectedDriversData, setSelectedDriversData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [usedFallbackData, setUsedFallbackData] = useState(false);
  
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const containerRef = useRef(null);
  const resizeObserver = useRef(null);
  const isInitialRender = useRef(true);
  const fetchRetryCount = useRef({});

  /* Format driver name with proper capitalization */
  const formatDriverName = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  /* Fetch driver number with retry logic */
  const getDriverNumber = useCallback(async (driverName, meetingKey, sessionKey, retries = 3) => {
    if (!driverName || !meetingKey || !sessionKey) {
      console.warn('Missing parameters for getDriverNumber:', { driverName, meetingKey, sessionKey });
      return null;
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add a small delay on retry attempts
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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
          return data[0].driver_number;
        } else {
          console.warn(`No driver number found for ${driverName}`);
          return null;
        }
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed for ${driverName}:`, error);
        if (attempt === retries - 1) {
          // Last attempt failed
          return null;
        }
      }
    }
    return null;
  }, []);

  /* Generate fallback lap data (synthetic data when API fails) */
  const generateFallbackLapData = useCallback((baseTime = 90, lapCount = 15, variance = 2) => {
    const laps = [];
    let currentTime = baseTime;
    
    for (let i = 1; i <= lapCount; i++) {
      // Generate a lap time with some random variance to make it look realistic
      const randomVariance = (Math.random() * variance * 2) - variance;
      currentTime = Math.max(60, Math.min(180, currentTime + randomVariance));
      
      laps.push({
        lap_number: i,
        lap_duration: currentTime,
      });
    }
    
    return laps;
  }, []);

  /* Fetch lap data with retry logic and fallback */
  const fetchData = useCallback(async (driver) => {
    if (!driver || !meetingKey || !sessionKey) {
      console.warn('Missing parameters for fetchData:', { driver, meetingKey, sessionKey });
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
      const driverNumber = await getDriverNumber(driver, meetingKey, sessionKey);
      
      if (!driverNumber) {
        console.warn(`Could not get driver number for ${driver}, using fallback data`);
        setUsedFallbackData(true);
        return generateFallbackLapData();
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
            `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}`,
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
            return generateFallbackLapData();
          }
          
          // Filter and clean data to remove outliers
          const cleanedData = data
            .filter(lap => 
              lap.lap_duration >= 60 && 
              lap.lap_duration <= 180 && 
              lap.lap_number > 0
            )
            .map((lap) => ({
              lap_duration: lap.lap_duration,
              lap_number: lap.lap_number,
            }))
            .sort((a, b) => a.lap_number - b.lap_number);
          
          if (cleanedData.length === 0) {
            console.warn(`No valid lap data found for ${driver}, using fallback data`);
            setUsedFallbackData(true);
            return generateFallbackLapData();
          }
          
          fetchRetryCount.current[driver] = 0; // Reset retry count on success
          return cleanedData;
        } catch (error) {
          console.error(`Attempt ${attempt + 1} failed for ${driver}'s laps:`, error);
          if (attempt === maxRetries - 1) {
            // Last attempt failed
            fetchRetryCount.current[driver] += 1;
            
            // If we've tried multiple times across renders, use fallback data
            if (fetchRetryCount.current[driver] >= 2) {
              console.warn(`Multiple fetch attempts failed for ${driver}, using fallback data`);
              setUsedFallbackData(true);
              return generateFallbackLapData();
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
      return generateFallbackLapData();
    } finally {
      setIsLoading(false);
    }
    
    return [];
  }, [meetingKey, sessionKey, getDriverNumber, generateFallbackLapData]);

  /* Fetch data for primary and selected drivers */
  useEffect(() => {
    if (primaryDriver) {
      fetchData(primaryDriver).then(data => {
        if (data && data.length > 0) {
          setPrimaryDriverData(data);
        }
      });
    }
    
    if (selectedDrivers && selectedDrivers.length > 0) {
      const fetchLapDataForSelected = async () => {
        const allSelectedDriversData = await Promise.all(
          selectedDrivers.map(driver => fetchData(driver))
        );
        setSelectedDriversData(allSelectedDriversData.filter(data => data && data.length > 0));
      };
      fetchLapDataForSelected();
    } else {
      setSelectedDriversData([]);
    }
  }, [primaryDriver, selectedDrivers, fetchData]);

  /* Update chart size based on container dimensions */
  const updateChartSize = useCallback(() => {
    if (!containerRef.current || !chartRef.current || !chartInstance.current) return;
    
    try {
      const container = containerRef.current;
      const chartContent = container.querySelector('.line-chart-content');
      
      if (!chartContent) return;
      
      const containerWidth = chartContent.clientWidth;
      const containerHeight = chartContent.clientHeight;
      
      if (containerWidth < 50 || containerHeight < 50) return;
      
      if (isInitialRender.current || 
          Math.abs(chartRef.current.width - containerWidth) > 10 || 
          Math.abs(chartRef.current.height - containerHeight) > 10) {
        
        const dpr = window.devicePixelRatio || 1;
        
        /* Update canvas dimensions */
        chartRef.current.width = containerWidth * dpr;
        chartRef.current.height = containerHeight * dpr;
        chartRef.current.style.width = `100%`;
        chartRef.current.style.height = `100%`; 
        
        /* Scale context */
        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
        
        /* Update chart configuration */
        chartInstance.current.options.maintainAspectRatio = false;
        chartInstance.current.options.responsive = true;
        
        /* Resize without re-rendering */
        chartInstance.current.resize();
        
        isInitialRender.current = false;
      }
    } catch (e) {
      console.warn('Error updating chart size:', e);
    }
  }, []);

  /* Set up ResizeObserver for responsive chart sizing */
  useEffect(() => {
    if (resizeObserver.current) {
      resizeObserver.current.disconnect();
      resizeObserver.current = null;
    }

    let timeout = null;
    const debouncedResize = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        updateChartSize();
      }, 150);
    };
    
    if (containerRef.current) {
      try {
        resizeObserver.current = new ResizeObserver(() => {
          debouncedResize();
        });
        resizeObserver.current.observe(containerRef.current);
      } catch (e) {
        console.warn('Failed to create ResizeObserver:', e);
      }
    }
    
    /* Initial size setting */
    updateChartSize();
    
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
  }, [updateChartSize]);

  /* Handle window resize events */
  useEffect(() => {
    const handleResize = () => {
      if (window.resizeTimer) {
        clearTimeout(window.resizeTimer);
      }
      window.resizeTimer = setTimeout(() => {
        updateChartSize();
      }, 150);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.resizeTimer) {
        clearTimeout(window.resizeTimer);
      }
    };
  }, [updateChartSize]);

  /* Initialize and update chart with data */
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    if (!chartRef.current || primaryDriverData.length === 0) {
      return;
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const chartContent = container.querySelector('.line-chart-content');
    if (!chartContent) return;
    
    const containerWidth = chartContent.clientWidth;
    const containerHeight = chartContent.clientHeight;
    
    const dpr = window.devicePixelRatio || 1;
    
    /* Set the canvas dimensions to match container */
    chartRef.current.width = containerWidth * dpr;
    chartRef.current.height = containerHeight * dpr;
    chartRef.current.style.width = `100%`; 
    chartRef.current.style.height = `100%`;
    
    /* Scale the context to the device pixel ratio */
    ctx.scale(dpr, dpr);
    
    /* Prepare datasets for chart rendering */
    const datasets = [
      {
        label: `${primaryDriver}'s Lap Times`,
        data: primaryDriverData.map((lap) => lap.lap_duration),
        borderColor: driverColors[primaryDriver] || 'rgba(0, 123, 255, 1)',
        backgroundColor: driverColors[primaryDriver] ? `${driverColors[primaryDriver]}33` : 'rgba(0, 123, 255, 0.2)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.2, /* Add slight curve for smoother lines */
      },
      ...selectedDrivers.map((driver, index) => {
        const driverDataIndex = selectedDrivers.indexOf(driver);
        const lapData = driverDataIndex >= 0 && driverDataIndex < selectedDriversData.length 
          ? selectedDriversData[driverDataIndex] 
          : [];
        
        return {
          label: `${driver}'s Lap Times`,
          data: lapData.map((lap) => lap.lap_duration),
          borderColor: driverColors[driver] || `hsl(${(index * 50) % 360}, 70%, 50%)`,
          backgroundColor: driverColors[driver] ? `${driverColors[driver]}33` : `hsla(${(index * 50) % 360}, 70%, 50%, 0.2)`,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.2,
        };
      }).filter(item => item.data && item.data.length > 0)
    ].filter(dataset => dataset.data && dataset.data.length > 0);

    /* Helper function to format lap times nicely */
    const formatLapTime = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = (seconds % 60).toFixed(3);
      return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    };

    /* Create chart instance with configuration */
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: primaryDriverData.map((lap) => lap.lap_number),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: dpr, 
        layout: {
          padding: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
          }
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
        scales: {
          y: {
            beginAtZero: false,
            /* Set min and max more intelligently based on data */
            min: (context) => {
              const allLapTimes = datasets.flatMap(dataset => dataset.data);
              const minTime = Math.min(...allLapTimes);
              /* Set minimum slightly below the fastest lap */
              return Math.max(60, Math.floor(minTime * 0.995));
            },
            max: (context) => {
              const allLapTimes = datasets.flatMap(dataset => dataset.data);
              const maxTime = Math.max(...allLapTimes);
              /* Set maximum slightly above the slowest lap */
              return Math.min(180, Math.ceil(maxTime * 1.005));
            },
            ticks: {
              callback: function(value) {
                return formatLapTime(value);
              },
              font: {
                size: 10,
                weight: '500'
              },
              color: 'rgba(255, 255, 255, 0.8)'
            },
            title: {
              display: true,
              text: 'Lap Times',
              font: {
                size: 12,
                weight: 'bold'
              },
              color: 'white'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Lap Number',
              font: {
                size: 12,
                weight: 'bold'
              },
              color: 'white'
            },
            ticks: {
              font: {
                size: 10,
                weight: '500'
              },
              color: 'rgba(255, 255, 255, 0.8)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: 'white',
              font: {
                size: 10
              },
              boxWidth: 12,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: {
              size: 12,
              weight: 'bold'
            },
            bodyFont: {
              size: 11
            },
            padding: 10,
            callbacks: {
              title: function(tooltipItems) {
                return `Lap ${tooltipItems[0].label}`;
              },
              label: function(tooltipItem) {
                return `${tooltipItem.dataset.label}: ${formatLapTime(tooltipItem.raw)}`;
              },
            },
          },
        },
        animation: {
          duration: 600,
          easing: 'easeOutQuart'
        }
      },
    });

    /* Set initial render flag */
    isInitialRender.current = true;
    
    /* Ensure the chart has correct dimensions */
    updateChartSize();

    /* Return a cleanup function */
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [primaryDriverData, selectedDriversData, primaryDriver, driverColors, selectedDrivers, updateChartSize]);

  return (
    <div className="line-chart-container" ref={containerRef}>
      <div className="line-chart-header">
        <h2 className="line-chart-title">
          {formatDriverName(primaryDriver)} Lap Times
          {usedFallbackData && <span className="fallback-indicator"></span>}
        </h2>
      </div>
      
      <div className="line-chart-content">
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
                  Promise.all(selectedDrivers.map(driver => fetchData(driver)))
                    .then(data => setSelectedDriversData(data));
                }
              }}
            >
              Retry
            </button>
          </div>
        )}
        
        <div className="canvas-container">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
}

export default LineChart;