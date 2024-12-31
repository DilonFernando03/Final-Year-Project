import React, { useEffect, useState, useRef } from 'react';
import { YearDropdown, RaceDropdown, DriverDropdown } from './Dropdown';
import CombinedCharts from '../Graphs/CombinedCharts/combinedCharts';
import Weather from '../Weather/Weather';
import TopDrivers from '../Podium/TopThree';
import './Dashboard.css';
import WinnerPredictor from '../Predictor/winnerPredictor';
import Stints from '../Graphs/Stints/stints';
import DriverInfoTipTool from '../ToolTips/DriverInfoToolTip';
import PositionTimeline from '../Graphs/PositionTimeline/positionTimeline';
import DriverRatings from '../Graphs/RadarChart/driverRatings';

function Dashboard() {
  const [primaryDriver, setPrimaryDriver] = useState(null);
  const [driverNumber, setDriverNumber] = useState('');
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
  const [meetingOfficialName, setMeetingOfficialName] = useState('');
  
  // Ref for scrolling to predictor section
  const predictorRef = useRef(null);

  // Function to reset dashboard when year changes
  const resetDashboard = () => {
    setRace(null);
    setPrimaryDriver(null);
    setLap(null);
    setDrivers([]);
    setAvailableRaces([]);
    setAvailableLaps([]);
    setSessionKey(null);
    setMeetingKey(null);
    setDriverImage('');
    setDriverColour('');
    setDriverNumber('');
    setMeetingOfficialName('');
  };

  // Fetch races when year is selected
  useEffect(() => {
    if (year) {
      const fetchRacesForYear = async () => {
        try {
          const response = await fetch(`https://api.openf1.org/v1/sessions?year=${year}&session_name=Race`);
          const data = await response.json();
          const racetrack_data = data.map((track) => track.location);
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
          let driverNumber = data[0].driver_number;
          if (!driverColour.startsWith('#')) {
            driverColour = `#${driverColour}`;
          }

          setDriverImage(driverImageUrl);
          setDriverColour(driverColour);
          setDriverNumber(driverNumber);
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
          const lap_data = [...new Set(data.map(lap => lap.lap_number))];
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
          const response = await fetch(`https://api.openf1.org/v1/sessions?year=${year}&location=${race}&session_name=Race`);
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
          setDrivers(driverData);
        } catch (error) {
          console.error('Error fetching driver data:', error);
        }
      };
      fetchDriverData();
    }
  }, [meetingKey, sessionKey]);

  // Fetch the official meeting name when meetingKey and race are available
  useEffect(() => {
    const fetchMeetingOfficialName = async () => {
      if (meetingKey && race) {
        try {
          const response = await fetch(`https://api.openf1.org/v1/meetings?meeting_key=${meetingKey}`);
          const data = await response.json();
          const officialName = data[0].meeting_official_name;
          setMeetingOfficialName(officialName);
        } catch (error) {
          console.error('Error fetching meeting official name:', error);
        }
      }
    };
    fetchMeetingOfficialName();
  }, [meetingKey, race]);

  const scrollToPredictor = () => {
    predictorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="bg-black w-full py-4 px-8 text-white flex items-center justify-center">
        <h1 className="text-3xl font-bold text-white">
          F1 Data Dashboard<i className="fa-solid fa-flag-checkered text-white text-3xl"></i>
        </h1>
      </div>

      {/* Header Section */}
      <header>
        {meetingOfficialName && (
          <h1 className="meeting-title">{meetingOfficialName}</h1>
        )}
        
        <div className="controls-row">
          <YearDropdown 
            onYearChange={(newYear) => { setYear(newYear); resetDashboard(); }} 
          />
          <RaceDropdown 
            races={availableRaces} 
            onRaceChange={setRace} 
            disabled={!year} 
          />
          <DriverDropdown 
            drivers={drivers} 
            onDriverChange={setPrimaryDriver} 
            disabled={!year || !race} 
          />
        </div>
      </header>

      {/* Main Dashboard Grid */}
      {race && primaryDriver && (
        <div className="dashboard-grid">
          {/* Info Panel */}
          <aside className="info-panel">
            <div className="dashboard-card">
              <Weather meetingKey={meetingKey} sessionKey={sessionKey} />
            </div>
            <div className="dashboard-card" style={{height:'200%'}}>
              <TopDrivers year={year} raceName={race} />
            </div>
          </aside>

          {/* Main Content */}
          <main className="main-content">
            {/* Driver Header */}
            {driverImage && (
              <div 
                className="driver-header"
                style={{ borderLeft: `4px solid ${driverColour}` }}
              >
                <DriverInfoTipTool 
                  driverImage={driverImage}
                  driverName={primaryDriver}
                />
                <h2 className="driver-name">{primaryDriver}</h2>
              </div>
            )}

            {/* Charts */}
            {primaryDriver && sessionKey && meetingKey && (
              <div className="charts-grid">
                <div className="dashboard-card combined-charts">
                  <CombinedCharts 
                    primaryDriver={primaryDriver}
                    sessionKey={sessionKey}
                    meetingKey={meetingKey}
                    lap={lap}
                    availableLaps={availableLaps}
                    onLapChange={setLap}
                  />
                </div>
                
                {/* Stints and Ratings Row */}
                <div className="charts-row">
                  <div className="dashboard-card charts-card">
                    <Stints 
                      sessionKey={sessionKey} 
                      meetingKey={meetingKey} 
                      primaryDriver={primaryDriver}
                    />
                  </div>
                  <div className="dashboard-card charts-card">
                    <DriverRatings driverNumber={driverNumber} />
                  </div>
                </div>

                {/* Winner Predictor */}
                <div className="dashboard-card charts-card" ref={predictorRef}>
                  <WinnerPredictor 
                    sessionKey={sessionKey}
                    meetingKey={meetingKey}
                  />
                </div>
              </div>
            )}
                      </main>
                    </div>
                  )}
                </div>
              );
}

export default Dashboard;