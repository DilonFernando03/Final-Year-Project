import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faWind, faCloudRain, faTemperatureHigh, faCompass } from '@fortawesome/free-solid-svg-icons';
import './Weather.css';  

function Weather({ meetingKey, sessionKey }) {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* Fetch weather data on component mount */
  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const response = await fetch(`https://api.openf1.org/v1/weather?meeting_key=${meetingKey}&session_key=${sessionKey}`);
        if (!response.ok) {
          throw new Error('Failed to fetch weather data');
        }

        const data = await response.json();
        setWeatherData(data[1]);
        setLoading(false);
      } catch (error) {
        setError(error.message);
        setLoading(false);
      }
    };

    fetchWeatherData();
  }, [meetingKey, sessionKey]);

  /* Get appropriate weather icon based on rainfall amount */
  const getWeatherIcon = (rainfall_amount) => {
    if (rainfall_amount <= 0) {
      return <FontAwesomeIcon icon={faSun} className="weather-icon" />;
    } else if (rainfall_amount > 0) {
      return <FontAwesomeIcon icon={faCloudRain} className="weather-icon rain" />;
    }
  };

  /* Loading state component */
  const renderLoadingState = () => (
    <div className="weatherbox loading">
      <h3>Weather Conditions</h3>
      <div className="weather-info loading">
        <div className="weather-item shimmer">Loading data...</div>
      </div>
    </div>
  );
  
  /* Error state component */
  const renderErrorState = () => (
    <div className="weatherbox error">
      <h3>Weather Data</h3>
      <div className="weather-info">
        <div className="weather-item">Unable to load weather information</div>
      </div>
    </div>
  );
  
  /* Render loading or error states */
  if (loading) return renderLoadingState();
  if (error) return renderErrorState();
  
  return (
    <div className="weatherbox">
      {weatherData && (
        <>
          <h3>Race Weather Conditions</h3>
          <div className="weather-info">
            <div className="weather-item">
              <span>Track Temp</span>
              <span>
                {weatherData.track_temperature}°C
                <FontAwesomeIcon icon={faTemperatureHigh} />
              </span>
            </div>
            
            <div className="weather-item">
              <span>Wind Speed</span>
              <span>
                {weatherData.wind_speed} km/h
                <FontAwesomeIcon icon={faWind} className="weather-icon wind" />
              </span>
            </div>
            
            <div className="weather-item">
              <span>Direction</span>
              <span>
                {weatherData.wind_direction}°
                <FontAwesomeIcon icon={faCompass} />
              </span>
            </div>
            
            <div className="weather-item">
              <span>Condition</span>
              <span>{getWeatherIcon(weatherData.rainfall)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );  
}

export default Weather;