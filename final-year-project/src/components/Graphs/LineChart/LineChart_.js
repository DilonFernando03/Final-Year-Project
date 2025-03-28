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
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const containerRef = useRef(null);
  const resizeObserver = useRef(null);
  const isInitialRender = useRef(true);

  /* Format driver name with proper capitalization */
  const formatDriverName = (name) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  /* Fetch lap data for a specific driver */
  const fetchData = useCallback(async (driver) => {
    try {
      const driverNumber = await getDriverNumber(driver, meetingKey, sessionKey);
      const response = await fetch(
        `https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}&driver_number=${driverNumber}`
      );
      const data = await response.json();

      /* Filter and clean data to remove outliers */
      return data
        .filter(lap => 
          /* Only include valid lap times between 1-3 mins */
          lap.lap_duration >= 60 && 
          lap.lap_duration <= 180 && 
          lap.lap_number > 0
        )
        .map((lap) => ({
          lap_duration: lap.lap_duration,
          lap_number: lap.lap_number,
        }))
        .sort((a, b) => a.lap_number - b.lap_number);
    } catch (error) {
      console.error('Error fetching lap data:', error);
      return [];
    }
  }, [meetingKey, sessionKey]);

  /* Fetch data for primary and selected drivers */
  useEffect(() => {
    if (primaryDriver) {
      fetchData(primaryDriver).then(data => setPrimaryDriverData(data));
    }
    if (selectedDrivers.length > 0) {
      const fetchLapDataForSelected = async () => {
        const allSelectedDriversData = await Promise.all(selectedDrivers.map(driver => fetchData(driver)));
        setSelectedDriversData(allSelectedDriversData);
      };
      fetchLapDataForSelected();
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
        ctx.scale(dpr, dpr);
        
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
        const lapData = selectedDriversData[index] || [];
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
      })
    ].filter(Boolean);

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
        <h2 className="line-chart-title">{formatDriverName(primaryDriver)} Lap Times</h2>
      </div>
      
      <div className="line-chart-content">
        <div className="canvas-container">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
}


 /* Helper function to fetch a driver's number from the API */
const getDriverNumber = async (driverName, meetingKey, sessionKey) => {
  try {
    const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}&full_name=${driverName}`);
    const data = await response.json();
    return data[0].driver_number;
  } catch (error) {
    console.error('Error fetching driver number:', error);
    return null;
  }
};

export default LineChart;