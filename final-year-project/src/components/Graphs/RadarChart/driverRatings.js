import React, { useEffect, useState, useRef } from 'react';
import './driverRatings.css';

/* Generic default values for any driver not found in the API or defaults */
const GENERIC_DEFAULT = {
  experience: 70,
  racecraft: 75,
  awareness: 75,
  pace: 75
};

function DriverRatings({ driverNumber, selectedDrivers, driverColors }) {
  const [driverStats, setDriverStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverNumbers, setDriverNumbers] = useState({});
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (window.Plotly) return;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.plot.ly/plotly-2.26.0.min.js';
    script.async = true;
    
    script.onload = () => {
      console.log('Plotly loaded successfully');
    };
    
    script.onerror = () => {
      console.error('Failed to load Plotly from CDN');
      setError('Failed to load chart library');
    };
    
    document.body.appendChild(script);
    
    return () => {
      /* Clean up */
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  /* Fetch driver numbers for selected drivers */
  useEffect(() => {
    const fetchDriverNumbers = async () => {
      const numbers = { primary: driverNumber };
      for (const driver of selectedDrivers) {
        try {
          const response = await fetch(`https://api.openf1.org/v1/drivers?full_name=${driver}`);
          const data = await response.json();
          if (data && data[0]) {
            numbers[driver] = data[0].driver_number;
          } else {
            /* If driver number not found, assign a placeholder */
            numbers[driver] = `placeholder-${driver.replace(/\s+/g, '')}`;
          }
        } catch (err) {
          console.error(`Error fetching number for ${driver}:`, err);
          numbers[driver] = `placeholder-${driver.replace(/\s+/g, '')}`;
        }
      }
      setDriverNumbers(numbers);
    };

    if (driverNumber) {
      fetchDriverNumbers();
    }
  }, [selectedDrivers, driverNumber]);

  /* Fetch ratings for all drivers */
  useEffect(() => {
    const fetchDriverRatings = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://ratings-api.ea.com/v2/entities/f1-24-drivers-ratings');
        if (!response.ok) throw new Error('Failed to fetch driver ratings');
        
        const data = await response.json();
        const driversData = {};
        
        /* Add primary driver */
        if (driverNumber) {
          const primaryDriverData = data.docs.find(d => d.carNum === driverNumber);
          if (primaryDriverData) {
            /* Use API data if available */
            driversData.primary = {
              name: primaryDriverData.name,
              experience: Math.min(primaryDriverData.experience || 0, 100),
              racecraft: Math.min(primaryDriverData.racecraft || 0, 100),
              awareness: Math.min(primaryDriverData.awareness || 0, 100),
              pace: Math.min(primaryDriverData.pace || 0, 100)
            };
          } else {
            /* Use generic default for primary driver */
            const primaryDriverName = Object.keys(driverNumbers).find(key => key === 'primary');
            driversData.primary = {
              name: primaryDriverName || "Primary Driver",
              ...GENERIC_DEFAULT
            };
          }
        }

        /* Add selected drivers */
        for (const [driver, number] of Object.entries(driverNumbers)) {
          if (driver === 'primary') continue;
          
          /* First try to get from API */
          const driverData = data.docs.find(d => d.carNum === number);
          if (driverData) {
            driversData[driver] = {
              name: driverData.name,
              experience: Math.min(driverData.experience || 0, 100),
              racecraft: Math.min(driverData.racecraft || 0, 100),
              awareness: Math.min(driverData.awareness || 0, 100),
              pace: Math.min(driverData.pace || 0, 100)
            };
          } else {
            /* Use generic default for all missing drivers */
            driversData[driver] = {
              name: driver,
              ...GENERIC_DEFAULT
            };
          }
        }

        setDriverStats(driversData);
      } catch (err) {
        console.error('Error fetching driver ratings:', err);
        setError(err.message);
      
        const fallbackData = {};
        
        /* Add primary driver from defaults */
        if (driverNumber) {
          const primaryDriverName = Object.entries(driverNumbers).find(([key, value]) => value === driverNumber)?.[0];
          fallbackData.primary = { 
            name: primaryDriverName || "Primary Driver", 
            ...GENERIC_DEFAULT 
          };
        }
        
        /* Add selected drivers from defaults */
        for (const driver of selectedDrivers) {
          fallbackData[driver] = { 
            name: driver, 
            ...GENERIC_DEFAULT
          };
        }
        
        setDriverStats(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    if (driverNumber) {
      fetchDriverRatings();
    }
  }, [driverNumbers]);

  /* Create or update the Plotly radar chart */
  useEffect(() => {
    if (!chartRef.current || !driverStats || Object.keys(driverStats).length === 0 || !window.Plotly) {
      return;
    }

    /* Define the categories for the radar chart */
    const categories = ['Experience', 'Racecraft', 'Awareness', 'Pace'];
    
    /* Prepare the data */
    const plotData = [];
    const allValues = [];
    
    /* Add primary driver */
    if (driverStats.primary) {
      const primaryData = [
        driverStats.primary.experience,
        driverStats.primary.racecraft,
        driverStats.primary.awareness,
        driverStats.primary.pace
      ];
      
      plotData.push({
        type: 'scatterpolar',
        r: [...primaryData, primaryData[0]],
        theta: [...categories, categories[0]],
        fill: 'toself',
        name: driverStats.primary.name,
        line: {
          color: 'rgb(54, 162, 235)',
          width: 2
        },
        fillcolor: 'rgba(54, 162, 235, 0.2)'
      });
      
      allValues.push(...primaryData);
    }
    
    /* Add selected drivers */
    Object.entries(driverStats).forEach(([driver, stats]) => {
      if (driver === 'primary') return;
      
      const driverData = [
        stats.experience,
        stats.racecraft,
        stats.awareness,
        stats.pace
      ];
      
      const color = driverColors[driver] || '#888888'; 
      const rgba = `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.2)`;
      
      plotData.push({
        type: 'scatterpolar',
        r: [...driverData, driverData[0]],
        theta: [...categories, categories[0]],
        fill: 'toself',
        name: stats.name,
        line: {
          color: color,
          width: 2
        },
        fillcolor: rgba
      });
      
      allValues.push(...driverData);
    });
    
    /* Calculate min and max values for the scale */
    const minValue = Math.max(40, Math.floor(Math.min(...allValues) / 5) * 5); 
    const maxValue = Math.min(100, Math.ceil(Math.max(...allValues) / 5) * 5);
    
    /* Define the layout for the radar chart */
    const layout = {
      polar: {
        radialaxis: {
          visible: true,
          range: [minValue, maxValue],
          tickfont: {
            size: 10,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: 'rgb(161, 161, 161)'
          },
          gridcolor: 'rgb(161, 161, 161)',
          bgcolor: 'rgb(19, 19, 19)'
        },
        angularaxis: {
          direction: 'clockwise',
          tickfont: {
            size: 12,
            weight: 'bold',
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: 'white'
          },
          gridcolor: 'rgb(161, 161, 161)'
        },
        gridshape: 'circular',
        bgcolor: 'rgb(19, 19, 19)'
      },
      showlegend: true,
      legend: {
        orientation: 'h',
        y: -0.2,
        font: {
          size: 12,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: 'white'
        }
      },
      margin: {
        l: 50,
        r: 50,
        t: 20,
        b: 50
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: {
        color: 'white'
      },
      autosize: true
    };
    
    /* Create the Plotly chart */
    window.Plotly.newPlot(chartRef.current, plotData, layout, {
      responsive: true,
      displayModeBar: false
    });
    
    /* Clean up function */
    return () => {
      if (window.Plotly && chartRef.current) {
        window.Plotly.purge(chartRef.current);
      }
    };
  }, [driverStats, driverColors]);

  return (
    <div className="ratings-container">
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">Error: {error}</div>}
      {!loading && !error && Object.keys(driverStats).length > 0 && (
        <>
          <h2 className="ratings-title">Driver Stats</h2>
          <div className="ratings-content">
            <div ref={chartRef} className="rating-plot"></div>
          </div>
        </>
      )}
    </div>
  );
}

export default DriverRatings;