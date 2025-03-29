import React, { useState, useEffect } from 'react';

/* Function to dynamically import track images */
const importTrackImage = (raceName) => {
  try {
    return require(`../../images/Track Maps/${raceName}.png`);
  } catch (error) {
    console.error(`Error importing track image for ${raceName}:`, error);
    return null;
  }
};

function TrackMap({ raceName }) {
  const [trackImage, setTrackImage] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!raceName) return;
    
    /* Reset error state when raceName changes */
    setImageError(false);
    
    /* Try to import the track image */
    const image = importTrackImage(raceName);
    setTrackImage(image);
  }, [raceName]);

  if (!raceName) return null;

  return (
    <div className="track-map-wrapper">
      <div className="track-map-container">
        <h3 className="track-title">Circuit Map</h3>
        {!imageError && trackImage ? (
          <img 
            src={trackImage} 
            alt={`${raceName} Track Map`} 
            className="track-map-image"
            onError={(e) => {
              console.log(`Could not load track map for: ${raceName}`);
              setImageError(true);
              e.target.onerror = null;
              /* Fallback to a simple placeholder with transparent background */
              e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='180' viewBox='0 0 240 180'%3E%3Crect fill='rgba(0,0,0,0.1)' width='240' height='180' rx='5'/%3E%3Ctext fill='%23ffffff' font-family='Arial' font-size='16' x='120' y='90' text-anchor='middle' dominant-baseline='middle' style='text-shadow: 1px 1px 2px rgba(0,0,0,0.7);'%3E" + raceName + " Circuit%3C/text%3E%3C/svg%3E";
            }}
          />
        ) : (
          /* Transparent placeholder if image fails to load */
          <div 
            className="track-map-image" 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '160px',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(2px)',
              color: 'white',
              borderRadius: '4px',
              padding: '10px',
              textAlign: 'center',
              fontSize: '16px',
              textShadow: '1px 1px 3px rgba(0, 0, 0, 0.7)'
            }}
          >
            {raceName} Track Map
          </div>
        )}
      </div>
    </div>
  );
}

export default TrackMap;