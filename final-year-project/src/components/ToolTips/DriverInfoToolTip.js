import React, { useEffect, useState } from 'react';
import './DriverInfoToolTip.css';

const DriverInfoTipTool = ({ driverImage, driverName }) => {
  const [f1Details, setF1Details] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatName = (name) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const fetchF1Details = async () => {
      if (!driverName) return;
      
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/driver-details?driverName=${driverName}`);
        if (!response.ok) throw new Error('Failed to fetch driver details');
        
        const data = await response.json();
        setF1Details(data);
      } catch (err) {
        console.error('Error fetching F1 details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchF1Details();
  }, [driverName]);

  return (
    <div className="driver-image-wrapper">
      <img 
        src={driverImage} 
        alt={driverName} 
        className="driver-image"
      />
      <div className="driver-tooltip">
        <div className="tooltip-content">
          {loading ? (
            <span>Loading...</span>
          ) : error ? (
            <span>Error loading details</span>
          ) : (
            <>
              <div className="tooltip-header">
                <h3>{formatName(f1Details?.name || driverName)}</h3>
                <span className="team-name">{f1Details?.team}</span>
              </div>
              
              <div className="tooltip-stats">
                <div className="stat-item">
                  <span className="stat-label">Country: </span>
                  <span className="stat-value">{f1Details?.country}</span>
                </div>
                
                <div className="stat-item">
                  <span className="stat-label">Birth Date: </span>
                  <span className="stat-value">{f1Details?.dateOfBirth}</span>
                </div>
                
                <div className="stat-item">
                  <span className="stat-label">Birthplace: </span>
                  <span className="stat-value">{f1Details?.birthplace}</span>
                </div>
                
                <div className="stat-row">
                  <div className="stat-box">
                    <span className="stat-label">Podiums: </span>
                    <span className="stat-number">{f1Details?.podiums || '0'}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Points: </span>
                    <span className="stat-number">{f1Details?.points || '0'}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Championships: </span>
                    <span className="stat-number">{f1Details?.worldChampionships || '0'}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverInfoTipTool;