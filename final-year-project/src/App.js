import React from 'react';
import Navbar from './components/Navbar/Navbar';
import Dashboard from './components/General/Dashboard';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Navbar />
      <Dashboard />
    </div>
  );
}

export default App;
