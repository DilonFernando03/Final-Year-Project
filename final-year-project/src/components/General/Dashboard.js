import React, { useState, useEffect } from 'react';
import { YearDropdown, RaceDropdown, DriverDropdown, LapDropdown } from './Dropdown';
import LineChart from '../Graphs/LineChart/LineChart_';
import RadarChart from '../Graphs/RadarChart/RadarChart';
import './Dashboard.css'; // Import the CSS file for layout

function Dashboard() {
  const [primaryDriver, setPrimaryDriver] = useState(null); // Store the selected primary driver
  const [secondaryDriver, setSecondaryDriver] = useState(''); // Store the selected secondary driver (optional)
  const [year, setYear] = useState(null);
  const [race, setRace] = useState(null);
  const [lap, setLap] = useState(null);
  const [drivers, setDrivers] = useState([]); // Store the list of available drivers

  const [sessionKey, setSessionKey] = useState(null);
  const [meetingKey, setMeetingKey] = useState(null);
  const [availableRaces, setAvailableRaces] = useState([]); // List of races based on year
  const [availableLaps, setAvailableLaps] = useState([]);   // List of laps based on selected race

  // Fetch available races based on the selected year
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

  // Fetch laps based on the selected race (meetingKey, sessionKey)
  useEffect(() => {
    if (meetingKey && sessionKey) {
      const fetchLapsForRace = async () => {
        try {
          const response = await fetch(`https://api.openf1.org/v1/Laps?meeting_key=${meetingKey}&session_key=${sessionKey}`);
          const data = await response.json();
          const lap_data = [...new Set(data.map(lap => lap.lap_number))]; // Get unique lap numbers
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

  // Fetch drivers based on session and meeting keys
  useEffect(() => {
    const fetchDriverData = async () => {
      if (meetingKey && sessionKey) {
        try {
          const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
          const data = await response.json();
          const driverData = data.map((driver) => driver.full_name); // Only fetch full_name
          setDrivers(driverData); // Set the drivers state with the fetched data
        } catch (error) {
          console.error('Error fetching driver data:', error);
        }
      }
    };
    fetchDriverData();
  }, [meetingKey, sessionKey]);

  return (
    <div className="dashboard-container">
      <h1>Visualize and Compare Driver Lap Times</h1>

      {/* Year Dropdown */}
      <YearDropdown 
        onYearChange={setYear} 
        label="Year: "
      />

      {/* Race Dropdown */}
      {year && (
        <RaceDropdown 
          races={availableRaces} // Pass dynamically loaded races
          onRaceChange={setRace}
          label="Race: "
        />
      )}

      {/* Lap Dropdown */}
      {race && (
        <LapDropdown 
          laps={availableLaps}  // Pass dynamically loaded laps
          onLapChange={setLap}
          label="Lap: "
        />
      )}

      {/* Driver Dropdown for Primary Driver */}
      <DriverDropdown 
        drivers={drivers} // Pass dynamically loaded drivers
        onDriverChange={setPrimaryDriver} 
        label="Primary Driver:" 
      />

      {/* Optional Driver Dropdown for Secondary Driver */}
      {primaryDriver && (
        <div>
          <DriverDropdown 
            drivers={drivers} // Pass same list of drivers
            onDriverChange={setSecondaryDriver} 
            label="Compare With (Second Driver - Optional):" 
          />
        </div>
      )}

      {/* Container for LineChart and RadarChart to display side-by-side */}
      <div className="chart-container">
        {primaryDriver && sessionKey && meetingKey && (
          <>
            {/* LineChart */}
            <div className="chart">
              <LineChart 
                primaryDriver={primaryDriver} 
                secondaryDriver={secondaryDriver} 
                sessionKey={sessionKey}
                meetingKey={meetingKey}
              />
            </div>

            {/* RadarChart */}
            <div className="chart-container">
              <RadarChart 
                primaryDriver={primaryDriver} 
                secondaryDriver={secondaryDriver}
                lap={lap}
                sessionKey={sessionKey}
                meetingKey={meetingKey} 
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
