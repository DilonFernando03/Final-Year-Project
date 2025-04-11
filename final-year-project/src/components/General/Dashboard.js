import React, { useEffect, useState, useRef } from 'react';
import { YearDropdown, RaceDropdown, DriverDropdown } from './Dropdown';
import CombinedCharts from '../Graphs/CombinedCharts/combinedCharts';
import Weather from '../Weather/Weather';
import TopDrivers from '../Podium/TopThree';
import './Dashboard.css';
import WinnerPredictor from '../Predictor/winnerPredictor';
import Stints from '../Graphs/Stints/stints';
import DriverInfoTipTool from '../ToolTips/DriverInfoToolTip';
import DriverRaceInfo from './DriverInfo';
import DriverRatings from '../Graphs/RadarChart/driverRatings';
import DriverPosition from '../Graphs/SankeyDiagram/DriversPosition';
import TrackMap from './TrackMap';

/* Dashboard Component */
function Dashboard() {
  // Primary state variables
  const [primaryDriver, setPrimaryDriver] = useState(null);
  const [driverNumber, setDriverNumber] = useState('');
  const [year, setYear] = useState(null);
  const [race, setRace] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);
  const [lap, setLap] = useState(null);
  
  /* Data collections */
  const [drivers, setDrivers] = useState([]);
  const [availableRaces, setAvailableRaces] = useState([]);
  const [availableLaps, setAvailableLaps] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [driverColors, setDriverColors] = useState({});
  
  /* API keys and session identifiers */
  const [sessionKey, setSessionKey] = useState(null);
  const [meetingKey, setMeetingKey] = useState(null);
  
  /* UI display elements */ 
  const [driverImage, setDriverImage] = useState('');
  const [driverColour, setDriverColour] = useState('');
  const [meetingOfficialName, setMeetingOfficialName] = useState('');
  
  /* Refs for scrolling */
  const predictorRef = useRef(null);

  /* Resets all dashboard state to default values */
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
    setSelectedDrivers([]);
    setDriverColors({});
    setSelectedRound(null);
  };

  /* Updates race selection and associated round */
  const handleRaceChange = (raceLocation) => {
     /* Reset dependent selections when race changes */
    setPrimaryDriver(null);
    setLap(null);
    setDrivers([]);
    setAvailableLaps([]);
    setSessionKey(null);
    setMeetingKey(null);
    setDriverImage('');
    setDriverColour('');
    setDriverNumber('');
    setMeetingOfficialName('');
    setSelectedDrivers([]);
    setDriverColors({});
    const selectedRace = availableRaces.find(r => r.location === raceLocation);
    if (selectedRace) {
      setRace(raceLocation);
      setSelectedRound(selectedRace.round);
    }
  };

  /* Fetch available races when year changes */
  useEffect(() => {
    if (year) {
      const fetchRacesForYear = async () => {
        try {
          const response = await fetch(`https://api.openf1.org/v1/sessions?year=${year}&session_name=Race`);
          const data = await response.json();
          const racetrack_data = data.map((track, index) => ({
            location: track.location,
            round: index + 1
          }));
          setAvailableRaces(racetrack_data);
        } catch (error) {
          console.error('Error fetching races:', error);
        }
      };
      fetchRacesForYear();
    }
  }, [year]);

  /* Fetch driver details when primary driver and session key are available */
  useEffect(() => {
    if (primaryDriver && sessionKey) {
      const fetchDriverDetails = async () => {
        try {
          const response = await fetch(`https://api.openf1.org/v1/drivers?full_name=${primaryDriver}&session_key=${sessionKey}`);
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
  }, [primaryDriver, sessionKey]);

  /* Fetch available laps when meeting and session keys are available */
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

  /* Fetch session and meeting keys when year and race are selected */
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

  /* Fetch driver data when meeting and session keys are available */
  useEffect(() => {
    if (meetingKey && sessionKey) {
      const fetchDriverData = async () => {
        try {
          console.log(meetingKey, sessionKey)
          const response = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`);
          const data = await response.json();
          const driverData = data.map((driver) => driver.full_name);
          console.log(driverData)
          const colors = {};
          data.forEach(driver => {
            colors[driver.full_name] = driver.team_colour.startsWith('#') ? driver.team_colour : `#${driver.team_colour}`;
          });
          setDrivers(driverData);
          setDriverColors(colors);
        } catch (error) {
          console.error('Error fetching driver data:', error);
        }
      };
      fetchDriverData();
    }
  }, [meetingKey, sessionKey]);

  /* Fetch meeting official name when meeting key and race are available */
  useEffect(() => {
    const fetchMeetingOfficialName = async () => {
      if (meetingKey && race) {
        try {
          const response = await fetch(`https://api.openf1.org/v1/meetings?meeting_key=${meetingKey}`);
          const data = await response.json();
          console.log(data)
          const officialName = data[0].meeting_official_name;
          setMeetingOfficialName(officialName);
        } catch (error) {
          console.error('Error fetching meeting official name:', error);
        }
      }
    };
    fetchMeetingOfficialName();
  }, [meetingKey, race]);

  /* Check if all required selections are complete */
  const allSelectionsComplete = year && race && primaryDriver;

  return (
    <div className="dashboard-container">
      {/* Dashboard Header */}
      <div className="bg-black w-full py-4 px-8 text-white flex items-center justify-center">
        <h1 className="text-3xl font-bold text-white">
          F1 Data Visualizations<i className="fa-solid fa-flag-checkered text-white text-3xl"></i>
        </h1>
      </div>

      <header>
        {/* Meeting Title */}
        {meetingOfficialName && (
          <h1 className="meeting-title" style={{color:" rgb(255, 255, 255)"}}>{meetingOfficialName}</h1>
        )}
        
        <div className="controls-container">
            {/* Selection Controls */}
            <div className="controls-row">
            <YearDropdown 
            onYearChange={(newYear) => { 
              resetDashboard(); 
              setYear(newYear);
            }} 
          />
          <RaceDropdown 
            races={availableRaces}
            onRaceChange={handleRaceChange}
            disabled={!year} 
          />
          <DriverDropdown 
            drivers={drivers} 
            onDriverChange={(driver) => {
              setLap(null);
              setDriverImage('');
              setDriverColour('');
              setDriverNumber('');
              setPrimaryDriver(driver);
              setSelectedDrivers([]);
            }} 
            disabled={!year || !race} 
          />
            </div>

            
            {/* Top Three Drivers Display and Track Map */}
            {allSelectionsComplete && (
              <div className="flex-container">
                <div className="podium-container">
                  <TopDrivers year={year} raceName={race} />
                </div>
                <TrackMap raceName={race} />
              </div>
            )}

            {/* Weather Information */}
            {allSelectionsComplete && (
              <div className="weather">
                <Weather meetingKey={meetingKey} sessionKey={sessionKey} />
              </div>
            )}
          </div>
      </header>

      {/* Main Dashboard Content */}
      {allSelectionsComplete && (
        <div className="dashboard-grid">
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
                {driverNumber && (
                  <DriverRaceInfo
                    sessionKey={sessionKey}
                    meetingKey={meetingKey}
                    driverNumber={driverNumber}
                    year={year}
                    round={selectedRound}
                  />
                )}
              </div>
            )}

            {/* Charts and Visualizations */}
            {primaryDriver && sessionKey && meetingKey && (
              <div className="charts-grid">
                {/* Combined Charts Section */}
                <div className="dashboard-card combined-charts">
                  <CombinedCharts 
                    primaryDriver={primaryDriver}
                    sessionKey={sessionKey}
                    meetingKey={meetingKey}
                    lap={lap}
                    availableLaps={availableLaps}
                    onLapChange={setLap}
                    selectedDrivers={selectedDrivers}        
                    setSelectedDrivers={setSelectedDrivers}  
                    driverColors={driverColors}
                  />
                </div>
                
                {/* Stints and Driver Ratings Section */}
                <div className="charts-row">
                  <div className="dashboard-card charts-card">
                    <Stints 
                      sessionKey={sessionKey} 
                      meetingKey={meetingKey} 
                    />
                  </div>
                  <div className="dashboard-card charts-card">
                    <DriverRatings 
                      driverNumber={driverNumber}
                      selectedDrivers={selectedDrivers}
                      driverColors={driverColors}
                    />
                  </div>
                </div>

                {/* Driver Position Flow Section */}
                <div className="dashboard-card charts-card">
                  <DriverPosition 
                    year={year}
                    round={selectedRound}
                    sessionKey={sessionKey}
                  />
                </div>

                {/* Winner Predictor Section */}
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