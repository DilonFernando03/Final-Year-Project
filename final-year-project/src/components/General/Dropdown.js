// Dropdown.js

import React from 'react';

function DriverDropdown({ onDriverChange }) {
  const drivers = [
    'Max Verstappen',
    'Sergio Perez',
    'Lewis Hamilton',
    'George Russell',
    'Charles Leclerc',
    'Carlos Sainz',
    'Lando Norris',
    'Oscar Piastri',
    'Fernando Alonso',
    'Lance Stroll',
    'Esteban Ocon',
    'Pierre Gasly',
    'Yuki Tsunoda',
    'Daniel Ricciardo',
    'Alexander Albon',
    'Franco Colapinto',
    'Zhou Guanyu',
    'Valtteri Bottas',
  ];

  const handleChange = (event) => {
    const selectedDriver = event.target.value;
    onDriverChange(selectedDriver);
  };

  return (
    <div className="dropdown-container">
      <label htmlFor="driver">Select a Driver:</label>
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

function RaceDropdown({ races, onRaceChange }) {
  const handleChange = (event) => {
    const selectedRace = event.target.value;
    onRaceChange(selectedRace);
  };

  return (
    <div className="dropdown-container">
      <label htmlFor="race">Select a Race:</label>
      <select className="common-dropdown" onChange={handleChange}>
        <option value="">Select a Race</option>
        {races.map((race, index) => (
          <option key={index} value={race}>
            {race}
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
      <label htmlFor="year">Select a Year:</label>
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

function LapDropdown({ laps, onLapChange }) {
  const handleChange = (event) => {
    const selectedLap = event.target.value;
    onLapChange(selectedLap);
  };

  return (
    <div className="dropdown-container">
      <label htmlFor="lap">Select a Lap:</label>
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
