import React, { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';
import './stints.css';

function Stints({ sessionKey, meetingKey, primaryDriver }) {
  const [driverStints, setDriverStints] = useState([]);

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

  const renderPlot = () => {
    if (driverStints.length === 0) return null;

    const maxLap = Math.max(...driverStints.map(stint => stint.lap_end));
    const xAxisMax = Math.ceil(maxLap * 1.05);

    const data = driverStints.map((stint, index) => {
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

      // Create bar and text traces
      const bar = {
        type: 'scatter',
        mode: 'lines',
        x: [stint.lap_start, stint.lap_end],
        y: [(index + 1), (index + 1)],
        line: {
          color: color,
          width: 20
        },
        hoverinfo: 'text',
        hovertext: `Stint ${index + 1}<br>Laps: ${stint.lap_start} - ${stint.lap_end}<br>Compound: ${stint.compound}`,
        showlegend: false
      };

      const text = {
        type: 'scatter',
        mode: 'text',
        x: [(stint.lap_start + stint.lap_end) / 2], // Center position
        y: [index + 1],
        text: [compoundLetter],
        textfont: {
          size: 14,
          color: 'white',
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        hoverinfo: 'none',
        showlegend: false
      };

      return [bar, text];
    }).flat();

    const layout = {
      title: {
        text: `Pit Strategy for ${primaryDriver}`,
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
        title: {
          text: 'Stints',
          font: {
            size: 12,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          standoff: 20
        },
        ticktext: driverStints.map((_, i) => `Stint ${i + 1}`),
        tickvals: driverStints.map((_, i) => i + 1),
        range: [0.5, driverStints.length + 0.5],
        showgrid: true,
        gridcolor: '#E5E5E5',
        zeroline: false
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'white',
      height: 200,
      margin: {
        l: 80,
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