import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2 } from 'lucide-react';

const processPracticeData = (practiceData) => {
  return practiceData.reduce((acc, lap) => {
    if (!acc[lap.driver_number]) {
      acc[lap.driver_number] = {
        lap_times: [],
        average_time: 0
      };
    }
    acc[lap.driver_number].lap_times.push(lap.lap_time);
    acc[lap.driver_number].average_time = 
      acc[lap.driver_number].lap_times.reduce((a, b) => a + b, 0) / 
      acc[lap.driver_number].lap_times.length;
    return acc;
  }, {});
};

const WinnerPredictor = () => {
  const [nextRace, setNextRace] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentDrivers, setCurrentDrivers] = useState([]);
  const [sessionKey, setSessionKey] = useState(null);
  const [meetingKey, setMeetingKey] = useState(null);

  useEffect(() => {
    const fetchNextRace = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/next-race');
        const data = await response.json();
        setNextRace(data);

        // Fetch session and meeting keys for the current season
        if (data?.season) {
          const keysResponse = await fetch(
            `https://api.openf1.org/v1/sessions?year=${data.season}&session_name=Race`
          );
          const keysData = await keysResponse.json();
          if (keysData && keysData.length > 0) {
            setSessionKey(keysData[0].session_key);
            setMeetingKey(keysData[0].meeting_key);
          }
        }
      } catch (error) {
        console.error('Error fetching next race:', error);
      }
    };
    fetchNextRace();
  }, []);

  // Fetch current drivers when session and meeting keys are available
  useEffect(() => {
    const fetchCurrentDrivers = async () => {
      if (meetingKey && sessionKey) {
        try {
          const response = await fetch(
            `https://api.openf1.org/v1/drivers?meeting_key=${meetingKey}&session_key=${sessionKey}`
          );
          const data = await response.json();
          const driverNames = data.map(driver => driver.full_name);
          setCurrentDrivers(driverNames);
        } catch (error) {
          console.error('Error fetching current drivers:', error);
        }
      }
    };
    fetchCurrentDrivers();
  }, [meetingKey, sessionKey]);

  const fetchHistoricalData = async (driverName) => {
    try {
      const response = await fetch(`http://localhost:5000/api/driver-details?driverName=${encodeURIComponent(driverName)}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching data for ${driverName}:`, error);
      return null;
    }
  };

  const makePrediction = async () => {
    console.log('Button clicked');
    console.log('Current state:', {
      nextRace,
      currentDrivers,
      sessionKey,
      meetingKey
    });

    if (!nextRace || currentDrivers.length === 0) {
      console.log('Prediction cancelled - missing required data:', {
        hasNextRace: !!nextRace,
        driversCount: currentDrivers.length
      });
      return;
    }
    
    setLoading(true);
    try {
      // Get data for all current drivers
      const driverStats = await Promise.all(currentDrivers.map(driver => fetchHistoricalData(driver)));
      
      // Calculate prediction probabilities based on historical performance
      const predictions = driverStats
        .map((stats, index) => {
          if (!stats) return null;
          
          // Create a weighted score based on various factors
          const championshipWeight = parseInt(stats.worldChampionships || 0) * 0.3;
          const podiumWeight = parseInt(stats.podiums || 0) * 0.2;
          const recentFormWeight = Math.random() * 0.3; // Replace with actual recent form calculation
          const trackHistoryWeight = Math.random() * 0.2; // Replace with actual track history
          
          const totalScore = championshipWeight + podiumWeight + recentFormWeight + trackHistoryWeight;
          
          return {
            driver: currentDrivers[index],
            probability: totalScore,
            confidence: stats.points > 200 ? 'High' : stats.points > 100 ? 'Medium' : 'Low'
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3)
        .map(pred => ({
          ...pred,
          probability: pred.probability / 2 // Normalize to reasonable percentage
        }));

      setPrediction({
        predictions,
        factors: {
          track_conditions: 'Optimal',
          historical_performance: `${(predictions[0]?.probability * 100).toFixed(1)}%`,
          championship_form: predictions[0]?.confidence,
          track_history: 'Strong'
        },
        reliability: predictions[0]?.confidence
      });

    } catch (error) {
      console.error('Prediction error:', error);
    }
    setLoading(false);
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
          <Button
            onClick={() => {
              console.log('Button clicked - initial handler');
              makePrediction();
            }}
            disabled={!nextRace || loading || currentDrivers.length === 0}
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

          {!prediction && !loading && (
            <p className="text-sm text-gray-500 text-center">
              Click the button above to get race winner predictions for {nextRace?.name}.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WinnerPredictor;