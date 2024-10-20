import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faWind, faCloudRain } from '@fortawesome/free-solid-svg-icons';
import './Weather.css';  

function Weather({ meetingKey, sessionKey }) {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch weather data from the API
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

  const getWeatherIcon = (rainfall_amount) => {
    if (rainfall_amount <= 0) {
      return <FontAwesomeIcon icon={faSun} />;
    } else if (rainfall_amount > 0) {
      return <FontAwesomeIcon icon={faCloudRain} />;
    }
  };
  

  return (
    <div className="weatherbox">
      {weatherData ? (
        <>
          <h3>Race Weather Conditions</h3>
          <div className="weather-info">
            <div className="weather-item">
              <span>Temperature: {weatherData.track_temperature}°C</span>
            </div>
            <div className="weather-item">
              <span>Wind Speed: {weatherData.wind_speed} km/h</span>
            </div>
            <div className="weather-item">
              <span>Wind Direction: {weatherData.wind_direction}°</span>
            </div>
            <div className="weather-item">
              <span>Condition: {getWeatherIcon(weatherData.rainfall)}</span>
              
            </div>
          </div>
        </>
      ) : (
        <p>Loading weather data...</p>
      )}
    </div>
  );
}

export default Weather;
