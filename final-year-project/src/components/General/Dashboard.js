import React, { useEffect, useState } from 'react';
import { YearDropdown, RaceDropdown, DriverDropdown, LapDropdown } from './Dropdown';
import LineChart from '../Graphs/LineChart/LineChart_';
import RadarChart from '../Graphs/RadarChart/RadarChart';
import './Dashboard.css'; // Import the CSS file for layout

function Dashboard() {
  const [primaryDriver, setPrimaryDriver] = useState(null);
  const [secondaryDriver, setSecondaryDriver] = useState('');
  const [year, setYear] = useState(null);
  const [race, setRace] = useState(null);
  const [lap, setLap] = useState(null);
  const [drivers, setDrivers] = useState([]); 

  const [sessionKey, setSessionKey] = useState(null);
  const [meetingKey, setMeetingKey] = useState(null);
  const [availableRaces, setAvailableRaces] = useState([]); 
  const [availableLaps, setAvailableLaps] = useState([]);  

  // Fetch races when the year is selected
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

  // Fetch laps when the session and meeting keys are available
  useEffect(() => {
    if (meetingKey && sessionKey) {
      const fetchLapsForRace = async () => {
        try {
          const response = await fetch(`https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}`);
          const data = await response.json();
          const lap_data = [...new Set(data.map(lap => lap.lap_number))]; // Unique lap numbers
          setAvailableLaps(lap_data);
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
      <h1>Visualize and Compare Driver Lap Times</h1>

      <div className="dropdown-wrapper">
        {/* Year Dropdown */}
        <YearDropdown onYearChange={setYear} label="Year: " />

        {/* Race Dropdown */}
        {year && (
          <RaceDropdown races={availableRaces} onRaceChange={setRace} label="Race: " />
        )}

        {/* Lap Dropdown */}
        {race && (
          <LapDropdown laps={availableLaps} onLapChange={setLap} label="Lap: " />
        )}
      </div>

      <div className="dropdown-wrapper">
        {/* Driver Dropdown for Primary Driver */}
        <DriverDropdown drivers={drivers} onDriverChange={setPrimaryDriver} label="Primary Driver:" />

        {/* Optional Driver Dropdown for Secondary Driver */}
        {primaryDriver && (
          <div className="secondary-dropdown">
            <DriverDropdown drivers={drivers} onDriverChange={setSecondaryDriver} label="Compare With (Optional):" />
          </div>
        )}
      </div>

      <div className="chart-container">
        {primaryDriver && sessionKey && meetingKey && (
          <>
            <div className="chart">
              <LineChart primaryDriver={primaryDriver} secondaryDriver={secondaryDriver} sessionKey={sessionKey} meetingKey={meetingKey} />
            </div>
            <div className="chart">
              <RadarChart primaryDriver={primaryDriver} secondaryDriver={secondaryDriver} lap={lap} sessionKey={sessionKey} meetingKey={meetingKey} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
