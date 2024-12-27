import * as tf from '@tensorflow/tfjs';
import _ from 'lodash';

class Predictor {
  constructor() {
    this.model = null;
    this.driverEncoder = new Map();
    this.initialized = false;
    this.drivers = [];
    this.meetingKey = null;
    this.sessionKey = null;
  }

  async initialize(meetingKey, sessionKey) {
    this.meetingKey = meetingKey;
    this.sessionKey = sessionKey;

    if (!this.meetingKey || !this.sessionKey) {
      console.error('Meeting key and session key are required for initialization');
      return;
    }

    if (this.initialized && 
        this.currentMeetingKey === meetingKey && 
        this.currentSessionKey === sessionKey) {
      return;
    }

    // Initialize the model
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ 
          units: 64, 
          activation: 'relu', 
          inputShape: [10],
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ 
          units: 32, 
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }) 
        }),
        tf.layers.dense({ units: 20, activation: 'softmax' })
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Fetch and store driver names for the specific session and meeting
    try {
      const response = await fetch(
        `https://api.openf1.org/v1/drivers?meeting_key=${this.meetingKey}&session_key=${this.sessionKey}`
      );
      const data = await response.json();
      this.drivers = _.uniqBy(data, 'full_name').map(driver => driver.full_name);
      
      // Store current keys to check if we need to reinitialize
      this.currentMeetingKey = meetingKey;
      this.currentSessionKey = sessionKey;
    } catch (error) {
      console.error('Error fetching driver names:', error);
      this.drivers = [];
    }

    this.initialized = true;
  }

  preprocessRaceData(raceData) {
    return {
      qualifying: this.normalizeQualifying(raceData.qualifying_results),
      practice: this.normalizePractice(raceData.practice_data),
      weather: this.normalizeWeather(raceData.weather_conditions),
      historical: this.normalizeHistorical(raceData.historical_performance),
      current: this.normalizeCurrentForm(raceData.current_season_stats)
    };
  }

  normalizeQualifying(qualifyingData) {
    return qualifyingData.map(result => ({
      position: result.position / 20,
      gap_to_leader: this.normalizeTime(result.gap_to_leader),
      sector_times: this.normalizeSectorTimes(result.sector_times)
    }));
  }

  normalizePractice(practiceData) {
    const normalizedData = {};
    for (const [driverNumber, data] of Object.entries(practiceData)) {
      const validLapTimes = data.lap_times.filter(time => time > 0);
      if (validLapTimes.length > 0) {
        const avgTime = validLapTimes.reduce((a, b) => a + b, 0) / validLapTimes.length;
        normalizedData[driverNumber] = avgTime / Math.max(...validLapTimes);
      } else {
        normalizedData[driverNumber] = 0;
      }
    }
    return normalizedData;
  }

  normalizeWeather(weather) {
    return {
      temperature: (weather.temperature - 20) / 30,
      humidity: weather.humidity / 100,
      rain_probability: weather.rain_probability / 100,
      wind_speed: weather.wind_speed / 50
    };
  }

  normalizeHistorical(historicalData) {
    return historicalData.map(data => ({
      past_wins_ratio: data.past_wins / Math.max(...historicalData.map(d => d.past_wins || 1)),
      past_podiums_ratio: data.past_podiums / Math.max(...historicalData.map(d => d.past_podiums || 1)),
      track_performance: data.track_performance
    }));
  }

  normalizeCurrentForm(currentStats) {
    return currentStats.map(stats => ({
      points_ratio: stats.points / Math.max(...currentStats.map(d => d.points || 1)),
      wins_ratio: stats.wins / Math.max(...currentStats.map(d => d.wins || 1)),
      podiums_ratio: stats.podiums / Math.max(...currentStats.map(d => d.podiums || 1)),
      form: stats.form
    }));
  }

  normalizeTime(time) {
    if (!time) return 0;
    return time / 120; // assuming 120 seconds as max gap
  }

  normalizeSectorTimes(sectorTimes) {
    if (!sectorTimes || !Array.isArray(sectorTimes)) return [0, 0, 0];
    return sectorTimes.map(time => this.normalizeTime(time));
  }

  async predict(raceData) {
    await this.initialize(this.meetingKey, this.sessionKey);
    
    const processedData = this.preprocessRaceData(raceData);
    const features = tf.tidy(() => this.createFeatureTensor(processedData));
    
    const predictions = await this.model.predict(features).array();
    features.dispose();

    return this.formatPredictions(predictions[0]);
  }

  createFeatureTensor(processedData) {
    const features = [
      processedData.weather.temperature || 0,
      processedData.weather.humidity || 0,
      processedData.weather.rain_probability || 0,
      processedData.weather.wind_speed || 0,
      processedData.qualifying[0]?.position || 0,
      processedData.qualifying[0]?.gap_to_leader || 0,
      Object.values(processedData.practice)[0] || 0,
      processedData.historical[0]?.track_performance || 0,
      processedData.current[0]?.form || 0,
      processedData.current[0]?.points_ratio || 0
    ];

    if (features.length !== 10) {
      console.error('Feature tensor length mismatch:', features.length);
      while (features.length < 10) {
        features.push(0);
      }
    }

    return tf.tensor2d([features]);
  }

  formatPredictions(rawPredictions) {
    // First normalize the raw predictions
    const totalProb = _.sum(rawPredictions);
    let normalizedPredictions = rawPredictions.map(prob => prob / totalProb);

    // Apply exponential scaling to increase separation between top drivers
    normalizedPredictions = normalizedPredictions.map(prob => Math.pow(prob, 0.5));
    
    // Renormalize after scaling and adjust to realistic F1 win probabilities
    const totalAfterScaling = _.sum(normalizedPredictions);
    const scaledPredictions = normalizedPredictions.map(prob => {
      const scaledProb = (prob / totalAfterScaling);
      // Adjust probabilities to be more realistic for F1
      // Top drivers typically have 20-40% chance of winning
      return scaledProb * (scaledProb > 0.1 ? 2.5 : 1);
    });

    const top3 = _.chain(scaledPredictions)
      .map((prob, index) => ({
        driver: this.getDriverName(index),
        probability: prob,
        confidence: this.calculateConfidence(prob)
      }))
      .orderBy(['probability'], ['desc'])
      .take(3)
      .value();

    const factors = this.analyzeFactors(top3[0].driver);

    return {
      predictions: top3,
      factors,
      reliability: this.calculateReliability(top3[0].probability)
    };
  }

  calculateConfidence(probability) {
    console.log(probability)
    const confidenceThresholds = {
      HIGH: 0.25,    // 25% or higher chance - very likely for F1
      MEDIUM: 0.15,  // 15-25% chance - good chance
      LOW: 0         // Below 15% - lower chance
    };

    if (probability >= confidenceThresholds.HIGH) return 'HIGH';
    if (probability >= confidenceThresholds.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  calculateReliability(topProbability) {
    if (topProbability > 0.7) return 'High';
    if (topProbability > 0.4) return 'Medium';
    return 'Low';
  }

  getDriverName(index) {
    if (this.drivers.length > 0 && index < this.drivers.length) {
      return this.drivers[index];
    }
    return `Driver ${index + 1}`;
  }

  analyzeFactors(driver) {
    return {
      qualifying_performance: 'Strong qualifying position',
      practice_pace: 'Consistent practice sessions',
      track_history: 'Previous success at this circuit',
      current_form: 'Good recent performance'
    };
  }
}

export default Predictor;