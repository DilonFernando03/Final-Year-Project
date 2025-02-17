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
          inputShape: [15],
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
  try {
    const response = await fetch(`http://localhost:5000/api/team-stats?constructorId=${team}`);
    if (!response.ok) {
      console.warn(`Failed to fetch stats for team ${team}, using default values`);
      return this.getDefaultCarPerformance();
    }
    const stats = await response.json();
    // Normalize and calculate performance metrics
    return {
      reliability: stats.reliability || 0,
      performance: stats.performance || 0,
      podiums: Math.min(stats.podiums || 0), 
      averageFinish: Math.min(stats.averageFinish || 20, 20)
    };
  } catch (error) {
    console.error('Error getting car performance:', error);
    return this.getDefaultCarPerformance();
  }
}

// Add this helper method
getDefaultCarPerformance() {
  return {
      reliability: 0.75,
      performance: 0.70,
      podiums: 0,
      averageFinish: 10
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
        // Get all async data concurrently
        const [history, seasonStats, carPerf] = await Promise.all([
          this.getDriverHistory(driver, raceData.nextRace),
          this.getCurrentSeasonStats(driver),
          this.getCarPerformance(driver.teamId)
        ]);

        const driverFeatures = [
          // Historical Performance (5 features)
          Math.min(1, Math.max(0, history.trackWins / 10)),
          Math.min(1, Math.max(0, history.trackPodiums / 20)),
          Math.min(1, Math.max(0, (20 - history.avgFinishPosition) / 20)),
          Math.min(1, Math.max(0, 1 - history.dnfRate)),
          Math.min(1, Math.max(0, this.calculateMomentum(history.recentForm))),
        
          // Current Season Form (6 features)
          Math.min(1, Math.max(0, seasonStats.points / 500)),
          Math.min(1, Math.max(0, seasonStats.podiums / 20)),
          Math.min(1, Math.max(0, seasonStats.wins / 10)),
          Math.min(1, Math.max(0, seasonStats.dnfs / 20)),
          Math.min(1, Math.max(0, (20 - seasonStats.averageFinish) / 20)),
          Math.min(1, Math.max(0, seasonStats.momentum)),
        
          // Car Performance (4 features)
          Math.min(1, Math.max(0, carPerf.reliability)),
          Math.min(1, Math.max(0, carPerf.performance)),
          Math.min(1, Math.max(0, carPerf.podiums / 25)),
          Math.min(1, Math.max(0, (20 - carPerf.averageFinish) / 20))
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
        team: this.drivers[index]?.teamName || 'Unknown Team',
        probability: prob
      }))
      .orderBy(['probability'], ['desc'])
      .take(3)
      .value();
    return {
      predictions: top3,
      reliability: this.calculateReliability(top3[0].probability)
    };
  }
  calculateReliability(topProbability) {
    if (topProbability > 0.8) return 'Very High';
    if (topProbability > 0.6) return 'High';
    if (topProbability > 0.4) return 'Medium';
    if (topProbability > 0.2) return 'Low';
    return 'Very Low';
  }
}

export default Predictor;