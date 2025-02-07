import * as tf from '@tensorflow/tfjs';
import _ from 'lodash';

class Predictor {
  constructor() {
    this.model = null;
    this.initialized = false;
    this.drivers = [];
  }

  async initialize(drivers) {
    if (!drivers || !Array.isArray(drivers)) {
      throw new Error('Drivers data is required and must be an array');
    }

    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ 
          units: 128, 
          activation: 'relu', 
          inputShape: [20],
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ 
          units: 64, 
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }) 
        }),
        tf.layers.dense({ 
          units: 32, 
          activation: 'relu' 
        }),
        tf.layers.dense({ units: drivers.length, activation: 'softmax' })
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.drivers = drivers;
    this.initialized = true;
  }

  async getDriverHistory(driver, nextRace) {
    if (!nextRace || !nextRace.circuitId) {
        console.warn('No circuit information provided for driver history');
        return this.getDefaultHistory();
    }

    try {
        // Ensure driverId is treated as a number
        const driverNum = parseInt(driver.number);
        if (isNaN(driverNum)) {
            console.warn(`Invalid driver ID: ${driver.driverId}`);
            return this.getDefaultHistory();
        }
        const response = await fetch(
            `http://localhost:5000/api/driver-history?` + 
            `driverId=${encodeURIComponent(driver.driverId)}&` +
            `driverNum=${encodeURIComponent(driverNum)}&` +
            `circuitId=${encodeURIComponent(nextRace.circuitId)}`
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch history for ${driver.name}`);
        }
        
        const data = await response.json();
        return {
            trackWins: data.trackWins || 0,
            trackPodiums: data.trackPodiums || 0,
            recentForm: this.processRecentResults(data.recentResults || []),
            avgFinishPosition: this.calculateAverageFinish(data.recentResults || []),
            dnfRate: data.dnfs / (data.recentResults?.length || 1)
        };
    } catch (error) {
        console.error('Driver history error:', error);
        return this.getDefaultHistory();
    }
}

async getCurrentSeasonStats(driver) {
    try {
        // Ensure driverId is treated as a number
        const driverId = driver.driverId;
        if (!driverId) {
            console.warn(`Invalid driver ID: ${driver.driverId}`);
            return this.getDefaultSeasonStats();
        }

        const response = await fetch(
            `http://localhost:5000/api/season-stats?driverId=${encodeURIComponent(driverId)}`
        );
        if (!response.ok) throw new Error(`Failed to fetch stats for ${driver.name}`);
        
        const data = await response.json();
        return {
            points: data.points || 0,
            podiums: data.podiums || 0,
            wins: data.wins || 0,
            dnfs: data.dnfs || 0,
            averageFinish: data.averageFinish || 10,
            momentum: this.calculateMomentum(data.recentResults || [])
        };
    } catch (error) {
        console.error('Season stats error:', error);
        return this.getDefaultSeasonStats();
    }
}

getDefaultSeasonStats() {
    return {
        points: 0,
        podiums: 0,
        wins: 0,
        dnfs: 0,
        averageFinish: 10,
        momentum: 0
    };
}

  async getCarPerformance(team) {
    const teamIds = {
      'Red Bull': 'red_bull',
      'Mercedes': 'mercedes',
      'Ferrari': 'ferrari',
      'McLaren': 'mclaren',
      'Aston Martin': 'aston_martin',
      'Alpine': 'alpine',
      'Williams': 'williams',
      'AlphaTauri': 'alphatauri',
      'Alfa Romeo': 'alfa',
      'Haas': 'haas'
    };

    try {
      const constructorId = teamIds[team];
      if (!constructorId) {
        throw new Error('Team not found');
      }

      const response = await fetch(`http://localhost:5000/api/team-stats?constructorId=${constructorId}`);
      if (!response.ok) throw new Error('Failed to fetch team stats');
      
      const stats = await response.json();
      console.log(stats)
      return {
        reliability: stats.reliability,
        speed: stats.performance,
        cornering: Math.min(0.9, stats.performance * 1.1),
        tires: Math.min(0.9, (stats.performance + stats.reliability) / 2)
      };
    } catch (error) {
      console.error('Error getting car performance:', error);
      return {
        reliability: 0.75,
        speed: 0.70,
        cornering: 0.70,
        tires: 0.70
      };
    }}

  getCircuitFactors(trackName) {
    const circuits = {
      'Monaco': {
        overtakingDifficulty: 0.9,
        trackLength: 3.337,
        corners: { slow: 8, medium: 4, fast: 2 },
        tireDegradation: 0.6
      },
      'Monza': {
        overtakingDifficulty: 0.4,
        trackLength: 5.793,
        corners: { slow: 2, medium: 4, fast: 5 },
        tireDegradation: 0.7
      },
      'Silverstone': {
        overtakingDifficulty: 0.5,
        trackLength: 5.891,
        corners: { slow: 2, medium: 4, fast: 8 },
        tireDegradation: 0.8
      },
      'Spa': {
        overtakingDifficulty: 0.4,
        trackLength: 7.004,
        corners: { slow: 3, medium: 5, fast: 11 },
        tireDegradation: 0.75
      }
    };
    
    return circuits[trackName] || {
      overtakingDifficulty: 0.6,
      trackLength: 5.0,
      corners: { slow: 4, medium: 6, fast: 4 },
      tireDegradation: 0.7
    };
  }


  processRecentResults(results) {
    return results.map(result => result === 'DNF' ? 20 : result).slice(-5);
  }

  calculateAverageFinish(results) {
    const validResults = results.filter(pos => pos !== 'DNF').map(pos => parseInt(pos));
    return validResults.length ? _.mean(validResults) : 10;
  }

  calculateMomentum(recentResults) {
    if (!recentResults.length) return 0;
    const weights = [0.4, 0.3, 0.2, 0.07, 0.03];
    return _.sum(recentResults.slice(-5).map((result, i) => 
      (21 - (result === 'DNF' ? 20 : result)) * weights[i]
    )) / 20;
  }

  async predict(raceData = {}) {
    if (!this.initialized || !this.drivers.length) {
      throw new Error('Predictor not properly initialized');
    }

    try {
      const features = [];
      for (const driver of this.drivers) {
        const history = await this.getDriverHistory(driver, raceData.nextRace);
        const seasonStats = await this.getCurrentSeasonStats(driver);
        const carPerf = this.getCarPerformance(driver.team);
        const circuitFactors = this.getCircuitFactors(raceData.nextRace?.trackName);


        const driverFeatures = [
          // Historical Performance (5 features)
          history.trackWins / 10,
          history.trackPodiums / 20,
          (20 - history.avgFinishPosition) / 20,
          1 - history.dnfRate,
          this.calculateMomentum(history.recentForm),

          // Current Season Form (5 features)
          seasonStats.points / 400,
          seasonStats.podiums / 20,
          seasonStats.wins / 10,
          (20 - seasonStats.averageFinish) / 20,
          seasonStats.momentum,

          // Car Performance (4 features)
          carPerf.reliability,
          carPerf.speed,
          carPerf.cornering,
          carPerf.tires,

          // Circuit Specific (3 features)
          1 - circuitFactors.overtakingDifficulty,
          circuitFactors.corners.fast / 15,
          1 - circuitFactors.tireDegradation
        ];

        features.push(driverFeatures);
      }

      const tensorFeatures = tf.tidy(() => tf.tensor2d(features));
      const predictions = await this.model.predict(tensorFeatures).array();
      tensorFeatures.dispose();

      return this.formatPredictions(predictions[0]);
    } catch (error) {
      console.error('Prediction error:', error);
      throw error;
    }
  }

  formatPredictions(rawPredictions) {
    const totalProb = _.sum(rawPredictions);
    const normalizedPredictions = rawPredictions.map(prob => prob / totalProb);
    
    const top3 = _.chain(normalizedPredictions)
      .map((prob, index) => ({
        driver: this.drivers[index]?.name || `Driver ${index + 1}`,
        probability: prob,
        confidence: this.calculateConfidence(prob)
      }))
      .orderBy(['probability'], ['desc'])
      .take(3)
      .value();
    console.log(top3)
    return {
      predictions: top3,
      factors: this.analyzeFactors(),
      reliability: this.calculateReliability(top3[0].probability)
    };
  }

  calculateConfidence(probability) {
    const thresholds = {
      VERY_HIGH: 0.35,
      HIGH: 0.25,
      MEDIUM: 0.15,
      LOW: 0.08,
      VERY_LOW: 0
    };

    if (probability >= thresholds.VERY_HIGH) return 'VERY_HIGH';
    if (probability >= thresholds.HIGH) return 'HIGH';
    if (probability >= thresholds.MEDIUM) return 'MEDIUM';
    if (probability >= thresholds.LOW) return 'LOW';
    return 'VERY_LOW';
  }

  calculateReliability(topProbability) {
    if (topProbability > 0.8) return 'Very High';
    if (topProbability > 0.6) return 'High';
    if (topProbability > 0.4) return 'Medium';
    if (topProbability > 0.2) return 'Low';
    return 'Very Low';
  }

  analyzeFactors() {
    return {
      historical_performance: 'Based on previous results at this track',
      track_specific: 'Historical performance at this circuit',
      current_form: 'Recent race performances and momentum',
      car_performance: 'Current car capabilities and reliability',
      weather_adaptation: 'Performance in forecasted conditions',
      circuit_suitability: 'Track characteristics vs driving style'
    };
  }
}

export default Predictor;