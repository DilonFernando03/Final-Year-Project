import React, { useState, useEffect } from 'react';

// Function to dynamically import track images
const importTrackImage = (raceName) => {
  try {
    // Try to dynamically import the image based on race name
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
    
    // Reset error state when raceName changes
    setImageError(false);
    
    // Try to import the track image
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
              // Fallback to a simple placeholder
              e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150' viewBox='0 0 200 150'%3E%3Crect fill='%23666666' width='200' height='150'/%3E%3Ctext fill='%23ffffff' font-family='Arial' font-size='14' x='100' y='75' text-anchor='middle'%3E" + raceName + " Circuit%3C/text%3E%3C/svg%3E";
            }}
          />
        ) : (
          // Simple text placeholder if image fails to load
          <div 
            className="track-map-image" 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100px',
              backgroundColor: '#333',
              color: 'white',
              borderRadius: '4px',
              padding: '10px',
              textAlign: 'center',
              fontSize: '14px'
            }}
          >
            {raceName} Circuit
          </div>
        )}
      </div>
    </div>
  );
}

export default TrackMap;