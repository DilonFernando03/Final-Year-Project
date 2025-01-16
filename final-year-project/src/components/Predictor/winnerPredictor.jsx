import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import Predictor from '../../lib/predictor';

const WinnerPredictor = () => {
  const [nextRace, setNextRace] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentDrivers, setCurrentDrivers] = useState([]);
  const [error, setError] = useState(null);
  const predictor = useRef(null);

  useEffect(() => {
    const initializePredictor = async () => {
      try {
        setError(null);
        setLoading(true);

        // Fetch next race data
        const raceResponse = await fetch('http://localhost:5000/api/next-race');
        if (!raceResponse.ok) {
          throw new Error(`Failed to fetch next race data: ${raceResponse.statusText}`);
        }
        const raceData = await raceResponse.json();
        
        // Add circuit ID to race data
        const enhancedRaceData = {
          ...raceData,
          circuitId: raceData.track.toLowerCase()
            .replace(/\s+circuit$/i, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
        };
        setNextRace(enhancedRaceData);

        // Fetch current drivers using race season
        const driversResponse = await fetch(
          `http://localhost:5000/api/current-drivers?season=${raceData.season}`
        );
        if (!driversResponse.ok) {
          throw new Error(`Failed to fetch drivers: ${driversResponse.statusText}`);
        }
        const driversData = await driversResponse.json();
        
        if (!driversData || !driversData.length) {
          throw new Error('No drivers data available');
        }

        setCurrentDrivers(driversData);

        // Initialize predictor with drivers
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

  const makePrediction = async () => {
    if (!predictor.current?.initialized || !nextRace || !currentDrivers.length) {
      setError('Required race data is not available');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const predictionResult = await predictor.current.predict({
        nextRace,
        weather: nextRace.weather || {}
      });
      setPrediction(predictionResult);
    } catch (error) {
      console.error('Prediction error:', error);
      setError('Failed to generate prediction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
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
            className="w-full bg-black hover:bg-gray-800"
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
            <div className="mt-6 space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Top 3 Predictions:</h3>
                {prediction.predictions?.map((pred, index) => (
                  <div 
                    key={index} 
                    className={`flex justify-between items-center p-3 rounded-lg ${
                      index === 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                    }`}
                  >
                    <div>
                      <span className="font-medium">{index + 1}. {pred.driver}</span>
                      <div className="text-sm text-gray-600">
                        Confidence: {pred.confidence}
                      </div>
                    </div>
                    <span className="text-lg font-semibold">
                      {(pred.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <h4 className="font-semibold mb-2">Key Factors:</h4>
                <div className="space-y-2">
                  {Object.entries(prediction.factors || {}).map(([factor, value]) => (
                    <div key={factor} className="text-sm">
                      <span className="font-medium">
                        {factor.replace(/_/g, ' ').toUpperCase()}:
                      </span>
                      <span className="ml-2 text-gray-600">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {prediction.reliability && (
                <div className="mt-3 text-sm text-gray-500">
                  Prediction reliability: {prediction.reliability}
                </div>
              )}
            </div>
          )}

          {!prediction && !loading && nextRace && (
            <p className="text-sm text-gray-500 text-center">
              Click the button above to get race winner predictions for {nextRace.name}.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WinnerPredictor;