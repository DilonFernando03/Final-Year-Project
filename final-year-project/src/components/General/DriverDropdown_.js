import React from 'react';

function DriverDropdown({ onDriverChange }) {
  const drivers = [
        'Max Verstappen',    // Red Bull Racing
        'Sergio Perez',      // Red Bull Racing
        'Lewis Hamilton',    // Mercedes-AMG Petronas
        'George Russell',    // Mercedes-AMG Petronas
        'Charles Leclerc',   // Scuderia Ferrari
        'Carlos Sainz',      // Scuderia Ferrari
        'Lando Norris',      // McLaren
        'Oscar Piastri',     // McLaren
        'Fernando Alonso',   // Aston Martin
        'Lance Stroll',      // Aston Martin
        'Esteban Ocon',      // Alpine
        'Pierre Gasly',      // Alpine
        'Yuki Tsunoda',      // VCARB
        'Daniel Ricciardo',  // VCARB
        'Alexander Albon',   // Williams
        'Franco Colapinto',  // Williams
        'Zhou Guanyu',       // Stake
        'Valtteri Bottas',   // Stake
  ];

  const handleChange = (event) => {
    const selectedDriver = event.target.value;
    onDriverChange(selectedDriver); // Pass the selected driver to the parent component
  };

  return (
    <select onChange={handleChange}>
      <option value="">Select a Driver</option>
      {drivers.map((driver, index) => (
        <option key={index} value={driver}>
          {driver}
        </option>
      ))}
    </select>
  );
}

export default DriverDropdown;
