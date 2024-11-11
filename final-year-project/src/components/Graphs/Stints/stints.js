import React, { useEffect, useState } from 'react';

function Stints({ sessionKey, meetingKey }) {
  const [stintsData, setStintsData] = useState([]);

  useEffect(() => {
    const fetchStintsData = async () => {
      try {
        const response = await fetch(`https://api.openf1.org/v1/stints?meeting_key=${meetingKey}&session_key=${sessionKey}`);
        const data = await response.json();
        
        // Organize data to include stint duration, compound type, and lap range
        const formattedStintsData = data.map(stint => ({
          driverNumber: stint.driver_number,
          compound: stint.compound,
          stintNumber: stint.stint_number,
          lapRange: `${stint.lap_start}-${stint.lap_end}`,
          duration: stint.lap_end - stint.lap_start + 1
        }));
        
        setStintsData(formattedStintsData);
      } catch (error) {
        console.error('Error fetching stints data:', error);
      }
    };

    if (sessionKey && meetingKey) {
      fetchStintsData();
    }
  }, [sessionKey, meetingKey]);

  return (
    <div className="stints-container">
      <h2>Driver Tire Stints</h2>
      {stintsData.map((stint, index) => (
        <div key={index} className="stint-info">
          <p><strong>Driver:</strong> {stint.driverNumber}</p>
          <p><strong>Compound:</strong> {stint.compound}</p>
          <p><strong>Stint Duration:</strong> {stint.duration} laps</p>
          <p><strong>Laps:</strong> {stint.lapRange}</p>
        </div>
      ))}
    </div>
  );
}

export default Stints;
