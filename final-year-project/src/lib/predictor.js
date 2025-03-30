import * as tf from '@tensorflow/tfjs';
import _ from 'lodash';
import { API_BASE_URL } from '../config';
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

    // Store drivers but we won't use the neural network approach
    // until we have training data
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
            `${API_BASE_URL}/api/driver-history?` + 
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
  
  getDefaultHistory() {
    return {
        trackWins: 0,
        trackPodiums: 0,
        recentForm: [20, 20, 20, 20, 20],
        avgFinishPosition: 10,
        dnfRate: 0.1
    };
  }

  async getCurrentSeasonStats(driver) {
    try {
        // Ensure driverId is valid
        const driverId = driver.driverId;
        if (!driverId) {
            console.warn(`Invalid driver ID: ${driver.driverId}`);
            return this.getDefaultSeasonStats();
        }

        const response = await fetch(
            `${API_BASE_URL}/api/season-stats?driverId=${encodeURIComponent(driverId)}`
        );
        if (!response.ok) throw new Error(`Failed to fetch stats for ${driver.name}`);
        
        const data = await response.json();
        
        return {
            points: data.points || 0,
            podiums: data.podiums || 0,
            wins: data.wins || 0,
            dnfs: data.dnfs || 0,
            averageFinish: data.averageFinish || 10,
            momentum: this.calculateMomentum(data.recentResults || []),
            recentResults: data.recentResults || []
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
        momentum: 0,
        recentResults: []
    };
  }

  async getCarPerformance(team) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/team-stats?constructorId=${team}`);
      if (!response.ok) {
        console.warn(`Failed to fetch stats for team ${team}, using default values`);
        return this.getDefaultCarPerformance();
      }
      const stats = await response.json();
      // Normalize and calculate performance metrics
      return {
        reliability: stats.reliability || 0,
        performance: stats.performance || 0,
        podiums: stats.podiums || 0, 
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
      // Collect all driver data to calculate heuristic-based predictions
      const driverScores = [];
      
      for (const driver of this.drivers) {
        // Get all async data concurrently
        const [history, seasonStats, carPerf] = await Promise.all([
          this.getDriverHistory(driver, raceData.nextRace),
          this.getCurrentSeasonStats(driver),
          this.getCarPerformance(driver.teamId)
        ]);
        
        // Calculate a score based on various factors (heuristic approach)
        const score = this.calculateDriverScore(history, seasonStats, carPerf);
        
        driverScores.push({
          driver: driver.name,
          team: driver.teamName,
          score: score,
          stats: { history, seasonStats, carPerf }
        });
      }
      
      // Sort by score and calculate probabilities
      driverScores.sort((a, b) => b.score - a.score);
      
      const temperature = 0.3;
      
      // Calculate probabilities using softmax with temperature
      const totalScore = _.sum(driverScores.map(d => Math.exp(d.score / temperature)));
      driverScores.forEach(driver => {
        driver.probability = Math.exp(driver.score / temperature) / totalScore;
      });
      
      const top3 = driverScores.slice(0, 3);
      
      return {
        predictions: top3.map(driver => ({
          driver: driver.driver,
          team: driver.team,
          probability: driver.probability
        })),
        reliability: this.calculateReliability(top3[0].probability)
      };
    } catch (error) {
      console.error('Prediction error:', error);
      throw error;
    }
  }
  
  calculateDriverScore(history, seasonStats, carPerf) {
    const categoryWeights = {
      trackHistory: 0.10,
      currentForm: 0.60,
      carPerformance: 0.30
    };
    
    const weights = {
      // Historical performance at this track
      trackWins: 0.40,
      trackPodiums: 0.35,
      trackAvgFinish: 0.35,
      trackDNFRate: -0.10,
      
      // Current season form
      points: 0.10,        // Season points
      podiums: 0.15,        // Season podiums
      wins: 0.40,           // Season wins
      recentForm: 0.25,     // Recent race results
      seasonAvgFinish: 0.10, // Season average finish
      
      // Car performance
      carReliability: 0.30,
      carPerformance: 0.50,
      teamPodiums: 0.20
    };
    
    // Track history score
    const trackHistory = {
      wins: Math.min(1, history.trackWins / 5),
      podiums: Math.min(1, history.trackPodiums / 10),
      avgFinish: (20 - Math.min(history.avgFinishPosition, 20)) / 20,
      reliability: Math.max(0, 1 - history.dnfRate)
    };
    
    const trackScore = 
      weights.trackWins * trackHistory.wins +
      weights.trackPodiums * trackHistory.podiums +
      weights.trackAvgFinish * trackHistory.avgFinish +
      weights.trackDNFRate * trackHistory.reliability;
    
    // Current form score
    const form = {
      points: Math.min(1, seasonStats.points / 400),
      podiums: Math.min(1, seasonStats.podiums / 10),
      wins: Math.min(1, seasonStats.wins / 5),
      momentum: Math.min(1, seasonStats.momentum),
      avgFinish: (20 - Math.min(seasonStats.averageFinish, 20)) / 20
    };
    
    const formScore = 
      weights.points * form.points +
      weights.podiums * form.podiums +
      weights.wins * form.wins +
      weights.recentForm * form.momentum +
      weights.seasonAvgFinish * form.avgFinish;
    
    // Car performance score
    const car = {
      reliability: Math.min(1, carPerf.reliability),
      performance: Math.min(1, carPerf.performance),
      podiums: Math.min(1, carPerf.podiums / 20)
    };
    
    const carScore = 
      weights.carReliability * car.reliability +
      weights.carPerformance * car.performance +
      weights.teamPodiums * car.podiums;
    
    // Apply category weights to get final score (0-1 scale)
    const totalScore = 
      categoryWeights.trackHistory * trackScore +
      categoryWeights.currentForm * formScore +
      categoryWeights.carPerformance * carScore;
    
    return totalScore;
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