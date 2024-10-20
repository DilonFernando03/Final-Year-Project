import React from 'react';
import ReactSpeedometer from "react-d3-speedometer";

function Speedometer({ topSpeed }) {
  return (
    <div style={{ width: '300px', height: '300px', margin: '20px auto' }}>
      <ReactSpeedometer
        value={topSpeed}
        minValue={0}
        maxValue={400} // You can set the max value based on the expected maximum speed
        needleColor="red"
        startColor="green"
        segments={10}
        endColor="blue"
        textColor="#000"
        currentValueText="Top Speed: ${value} km/h"
      />
    </div>
  );
}

export default Speedometer;
