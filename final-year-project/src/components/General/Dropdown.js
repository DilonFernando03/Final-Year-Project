import './Dropdown.css';
import React from 'react';



function RaceDropdown({ races, onRaceChange }) {
  const handleChange = (event) => {
    const selectedRace = event.target.value;
    onRaceChange(selectedRace);
  };

  return (
    <div className="dropdown-container">
      <label htmlFor="race"></label>
      <i class="fa-solid fa-flag-checkered"></i>
      <select className="common-dropdown" onChange={handleChange}>
        <option value="">Select a Race</option>
        {races.map((race, index) => (
          <option key={index} value={race.location}>
            Round {race.round} - {race.location}
          </option>
        ))}
      </select>
    </div>
  );
}

function YearDropdown({ onYearChange }) {
  const years = [2023, 2024];

  const handleChange = (event) => {
    const selectedYear = event.target.value;
    onYearChange(selectedYear);
  };

  return (
    <div className="dropdown-container">
      <label htmlFor="year"></label>
      <i class="fa-solid fa-calendar-days"></i>
      <select className="common-dropdown" onChange={handleChange}>
        <option value="">Select a Year</option>
        {years.map((year, index) => (
          <option key={index} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

function DriverDropdown({ drivers, onDriverChange }) {
  const handleChange = (event) => {
    const selectedDriver = event.target.value;
    onDriverChange(selectedDriver);
  };

  return (
    <div className="dropdown-container">
      <label htmlFor="driver"></label>
      <i className="fa-solid fa-car-side dropdown-icon"></i>
      <select className="common-dropdown" onChange={handleChange}>
        <option value="">Select a Driver</option>
        {drivers.map((driver, index) => (
          <option key={index} value={driver}>
            {driver}
          </option>
        ))}
      </select>
    </div>
  );
}

function LapDropdown({ laps, onLapChange }) {
  const handleChange = (event) => {
    const selectedLap = event.target.value;
    onLapChange(selectedLap);
  };

  return (
    <div className="dropdown-container">
      <label htmlFor="lap"></label>
      <select className="common-dropdown" onChange={handleChange}>
        <option value="">Select a Lap</option>
        {laps.map((lap, index) => (
          <option key={index} value={lap}>
            {lap}
          </option>
        ))}
      </select>
    </div>
  );

}


export { YearDropdown, RaceDropdown, LapDropdown, DriverDropdown};
