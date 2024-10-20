import React, { useEffect, useState } from 'react';
import { YearDropdown, RaceDropdown, DriverDropdown } from './Dropdown';
import LineChart from '../Graphs/LineChart/LineChart_';
import SingeLapCharts from '../Graphs/SingleLapCharts/SingleLapCharts';
import Weather from '../Weather/Weather';
import './Dashboard.css'; // Import the CSS file for layout

function Dashboard() {
  const [primaryDriver, setPrimaryDriver] = useState(null);
  const [year, setYear] = useState(null);
  const [race, setRace] = useState(null);
  const [lap, setLap] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [availableRaces, setAvailableRaces] = useState([]);
  const [availableLaps, setAvailableLaps] = useState([]);
  const [sessionKey, setSessionKey] = useState(null);
  const [meetingKey, setMeetingKey] = useState(null);
  const [driverImage, setDriverImage] = useState('');
  const [driverColour, setDriverColour] = useState('');

  // Fetch races when year is selected
  useEffect(() => {
    if (year) {
      const fetchRacesForYear = async () => {
        try {
          const response = await fetch(`https://api.openf1.org/v1/sessions?year=${year}&session_name=Race`);
          const data = await response.json();
          const racetrack_data = data.map((track) => track.country_name);
          setAvailableRaces(racetrack_data);
        } catch (error) {
          console.error('Error fetching races:', error);
        }
      };
      fetchRacesForYear();
    }
  }, [year]);

  // Fetch driver image and team color when the primary driver is selected
  useEffect(() => {
    if (primaryDriver) {
      const fetchDriverDetails = async () => {
        try {
          const response = await fetch(`https://api.openf1.org/v1/drivers?full_name=${primaryDriver}`);
          const data = await response.json();
          const driverImageUrl = data[0].headshot_url;
          let driverColour = data[0].team_colour;

          if (!driverColour.startsWith('#')) {
            driverColour = `#${driverColour}`;
          }

          setDriverImage(driverImageUrl);
          setDriverColour(driverColour); // Set the team color with proper formatting
        } catch (error) {
          console.error('Error fetching driver details:', error);
        }
      };
      fetchDriverDetails();
    }
  }, [primaryDriver]);

  // Fetch laps when sessionKey and meetingKey are available
  useEffect(() => {
    if (meetingKey && sessionKey) {
      const fetchLapsForRace = async () => {
        try {
          const response = await fetch(`https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}`);
          const data = await response.json();
          const lap_data = [...new Set(data.map(lap => lap.lap_number))]; // Unique lap numbers
          setAvailableLaps(lap_data); // <--- Ensure availableLaps is set here
        } catch (error) {
          console.error('Error fetching laps:', error);
        }
      };
      fetchLapsForRace();
    }
  }, [meetingKey, sessionKey]);

  // Fetch session_key and meeting_key based on year and race
  useEffect(() => {
    const fetchKeys = async () => {
      if (year && race) {
        try {
          const response = await fetch(`https://api.openf1.org/v1/sessions?year=${year}&country_name=${race}&session_name=Race`);
          const data = await response.json();
          if (data && data.length > 0 && data[0].session_key && data[0].meeting_key) {
            setSessionKey(data[0].session_key);
            setMeetingKey(data[0].meeting_key);
          } else {
            console.error('API did not return valid session_key or meeting_key');
          }
        } catch (error) {
          console.error('Error fetching session and meeting keys:', error);
        }
      }
    };
    fetchKeys();
  }, [year, race]);

  // Fetch driver names when session and meeting keys are available
  useEffect(() => {
    if (meetingKey && sessionKey) {
      const fetchDriverData = async () => {
        try {
          const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
          const data = await response.json();
          const driverData = data.map((driver) => driver.full_name);
          setDrivers(driverData);  // Store driver names
        } catch (error) {
          console.error('Error fetching driver data:', error);
        }
      };
      fetchDriverData();
    }
  }, [meetingKey, sessionKey]);

  return (
    <div className="dashboard-container">

      <div className="dropdown-row">
        {/* Year Dropdown */}
        <YearDropdown onYearChange={setYear} label="Year: " />

        {/* Race Dropdown */}
        <RaceDropdown races={availableRaces} onRaceChange={setRace} label="Race: " disabled={!year} />

        {/* Driver Dropdown for Primary Driver */}
        <DriverDropdown drivers={drivers} onDriverChange={setPrimaryDriver} label="Primary Driver:" disabled={!year || !race} />
      </div>

      {/* Add the WeatherBox component, passing the meetingKey */}
      <Weather meetingKey={meetingKey} sessionKey={sessionKey}/>

       {/* Conditionally display the driver's image and bordered box */}
       {primaryDriver && (
        <div className="driver-image-wrapper" style={{ backgroundColor: driverColour }}>
          {driverImage && (
            <img src={driverImage} alt={`${primaryDriver}`} className="driver-image" />
          )}
        </div>
      )}

      <div className="chart-container">
        {primaryDriver && sessionKey && meetingKey && (
          <>
            <div className="chart">
              <LineChart primaryDriver={primaryDriver} sessionKey={sessionKey} meetingKey={meetingKey} />
            </div>
            <div className="chart">
              <SingeLapCharts
                primaryDriver={primaryDriver}
                lap={lap}
                onLapChange={setLap}
                sessionKey={sessionKey}
                meetingKey={meetingKey}
                availableLaps={availableLaps}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
