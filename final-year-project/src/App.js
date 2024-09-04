import React from 'react';
import Navbar from './components/Navbar/Navbar';
import LineChart from './components/Graphs/LineCharts/LineChart_';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <>
    <Navbar />
      <Routes>
        <Route path='/' element={<LineChart/>}/>
      </Routes>
    </>
  );
}

export default App;