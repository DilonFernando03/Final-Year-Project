import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Loader2, TrendingUp, Award, Clock } from 'lucide-react';
import Predictor from '../../lib/predictor';
import './predictor.css';

const WinnerPredictor = () => {
  const [nextRace, setNextRace] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentDrivers, setCurrentDrivers] = useState([]);
  const [driverStats, setDriverStats] = useState({});
  const [error, setError] = useState(null);
  const predictor = useRef(null);

  /* Initialize the predictor with race and driver data on component mount */
  useEffect(() => {
    const initializePredictor = async () => {
      try {
        setError(null);
        setLoading(true);

        /* Fetch next race information */
        const raceResponse = await fetch('http://localhost:5000/api/next-race');
        if (!raceResponse.ok) throw new Error('Failed to fetch next race data');
        const raceData = await raceResponse.json();
        setNextRace(raceData);

        /* Fetch current drivers for the season */
        const driversResponse = await fetch(
          `http://localhost:5000/api/current-drivers?season=${raceData.season}`
        );
        if (!driversResponse.ok) throw new Error('Failed to fetch drivers');
        const driversData = await driversResponse.json();
        setCurrentDrivers(driversData);
        
        /* Initialize the predictor */
        predictor.current = new Predictor();
        await predictor.current.initialize(driversData);
      } catch (error) {
        console.error('Initialization error:', error);
        setError(`Failed to initialize: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    initializePredictor();
  }, []);

  /* Generate prediction for the next race */
  const makePrediction = async () => {
    if (!predictor.current?.initialized || !nextRace || !currentDrivers.length) {
      setError('Required race data is not available');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      /* Gather statistics for each driver */
      const stats = {};
      for (const driver of currentDrivers) {
        const [history, seasonStats] = await Promise.all([
          predictor.current.getDriverHistory(driver, nextRace),
          predictor.current.getCurrentSeasonStats(driver)
        ]);
        stats[driver.name] = { history, seasonStats };
      }
      setDriverStats(stats);
      
      /* Generate the prediction */
      const predictionResult = await predictor.current.predict({ nextRace });
      setPrediction(predictionResult);
    } catch (error) {
      console.error('Prediction error:', error);
      setError('Failed to generate prediction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* Get driver headshot image URL */
  const getDriverHeadshot = (driverName) => {
    const driver = currentDrivers.find(d => d.name === driverName);
    return driver?.driverHeadshot || '/api/placeholder/64/64';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold predictor-header">
          Race Winner Prediction: {nextRace?.name} {nextRace?.season}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}
          
          <Button
            onClick={makePrediction}
            disabled={!predictor.current?.initialized || loading || !currentDrivers.length}
            className="w-full bg-black hover:bg-gray-800 text-white"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Analyzing Race Data...</span>
              </div>
            ) : (
              'Predict Winner'
            )}
          </Button>

          {prediction && (
            <div className="predicted-section">
              <h3 className="font-semibold text-lg mb-4">Top 3 Predictions:</h3>
              <div className="predictions-container">
                {prediction.predictions?.map((pred, index) => {
                  const stats = driverStats[pred.driver];
                  const driverHeadshot = getDriverHeadshot(pred.driver);
                  return (
                    <div key={index} className="driver-prediction">
                      <div className="prediction-header">
                        <img 
                          src={driverHeadshot}
                          alt={pred.driver}
                          className="driver-headshot"
                        />
                        <div className="driver-info">
                          <div className="driver-name">
                            {index + 1}. {pred.driver}
                          </div>
                          <div className="driver-team">
                            Team: {pred.team}
                          </div>
                          <div className="win-chance">
                            {(pred.probability * 100).toFixed(1)}% chance
                          </div>
                        </div>
                      </div>

                      <div className="stats-section">
                        <div className="stats-row">
                          <div className="stats-column track-history">
                            <div className="stats-header">
                              <Award className="w-4 h-4" />
                              <span>Track History</span>
                            </div>
                            <div>Avg Finish: {stats.history.avgFinishPosition.toFixed(1)}</div>
                            <div>Wins: {stats.history.trackWins}</div>
                            <div>Podiums: {stats.history.trackPodiums}</div>
                          </div>
                          
                          <div className="stats-column current-form">
                            <div className="stats-header">
                              <TrendingUp className="w-4 h-4" />
                              <span>Current Form</span>
                            </div>
                            <div>Points: {stats.seasonStats.points}</div>
                            <div>Momentum: {(stats.seasonStats.momentum * 100).toFixed(1)}%</div>
                            <div>Wins: {stats.seasonStats.wins}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!prediction && !loading && nextRace && (
            <p className="text-sm text-gray-400 text-center">
              Click the button above to get race winner predictions for {nextRace.name}.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WinnerPredictor;