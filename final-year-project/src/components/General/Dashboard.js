import React, { useState } from 'react';
import DriverDropdown from './DriverDropdown_';
import LineChart from '../Graphs/LineChart/LineChart_';

function Dashboard() {
  const [primaryDriver, setPrimaryDriver] = useState(null);
  const [secondaryDriver, setSecondaryDriver] = useState('');

  return (
        <div>
            <h1>Visualize and Compare Driver Lap Times</h1>

            {/* First Driver Dropdown */}
            <DriverDropdown 
                onDriverChange={setPrimaryDriver} 
                label="Primary Driver:" 
            />

            {/* Optional Second Driver Dropdown */}
            {primaryDriver && (
                <div>
                    <DriverDropdown 
                        onDriverChange={setSecondaryDriver} 
                        label="Compare With (Second Driver - Optional):" 
                    />
                </div>
            )}

            {/* Pass both drivers to the LineChart */}
            {primaryDriver && (
                <LineChart 
                    primaryDriver={primaryDriver} 
                    secondaryDriver={secondaryDriver} // Optional: can be an empty string if not selected
                />
            )}
        </div>
    );
}

export default Dashboard;