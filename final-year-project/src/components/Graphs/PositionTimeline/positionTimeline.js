import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './positionTimeline.css';

const PositionTimeline = ({ sessionKey, meetingKey, driverNumber }) => {
  const [positionData, setPositionData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPositionData = async () => {
      if (!sessionKey || !meetingKey || !driverNumber) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://api.openf1.org/v1/position?session_key=${sessionKey}&meeting_key=${meetingKey}&driver_number=${driverNumber}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch position data');
        }

        const data = await response.json();
        console.log(data);
        // Process the data to show time relative to race start
        const startTime = data[0]?.date || 0;
        const processedData = data.map(entry => ({
          time: Math.floor((entry.date - startTime) / 1000), // Convert to seconds from race start
          position: entry.position,
          formattedTime: formatTime(Math.floor((entry.date - startTime) / 1000))
        }));

        setPositionData(processedData);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching position data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositionData();
  }, [sessionKey, meetingKey, driverNumber]);

  // Helper function to format time as MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-sm">
          <p className="text-sm">Time: {payload[0].payload.formattedTime}</p>
          <p className="text-sm">Position: P{payload[0].payload.position}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="position-timeline-container">
      <h2 className="text-xl font-bold mb-4">Position Timeline</h2>
      
      {isLoading && (
        <div className="h-64 flex items-center justify-center">
          <p>Loading position data...</p>
        </div>
      )}

      {error && (
        <div className="h-64 flex items-center justify-center">
          <p className="text-red-500">Error: {error}</p>
        </div>
      )}

      {!isLoading && !error && positionData.length > 0 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={positionData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time"
                tickFormatter={formatTime}
                label={{ 
                  value: 'Race Time', 
                  position: 'insideBottom', 
                  offset: -5 
                }}
              />
              <YAxis 
                reversed
                domain={[1, 20]}
                label={{ 
                  value: 'Position', 
                  angle: -90, 
                  position: 'insideLeft',
                  offset: 10
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="stepAfter"
                dataKey="position"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!isLoading && !error && positionData.length === 0 && (
        <div className="h-64 flex items-center justify-center">
          <p>No position data available for this session</p>
        </div>
      )}
    </div>
  );
};

export default PositionTimeline;