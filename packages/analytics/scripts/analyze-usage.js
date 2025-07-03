#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { format, subDays, parseISO } = require('date-fns');

/**
 * Analytics Usage Analyzer
 * Analyzes product analytics data to understand feature usage and user behavior
 */
class AnalyticsUsageAnalyzer {
  constructor() {
    this.configPath = path.join(__dirname, '../configs/analytics-config.yaml');
    this.outputDir = path.join(__dirname, '../reports');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Analyze feature usage patterns
   */
  async analyzeFeatureUsage(options = {}) {
    const {
      days = 30,
      minUsage = 10,
      includeChurn = true
    } = options;

    console.log(`Analyzing feature usage for the last ${days} days...`);

    // Simulate feature usage data (in real implementation, this would query PostHog/Mixpanel)
    const featureUsageData = this.generateMockFeatureData(days);
    
    const analysis = {
      metadata: {
        analysisId: `feature-usage-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        period: {
          days,
          start: subDays(new Date(), days).toISOString(),
          end: new Date().toISOString()
        }
      },
      summary: {
        totalFeatures: 0,
        activeFeatures: 0,
        underutilizedFeatures: 0,
        trendingFeatures: 0,
        decliningFeatures: 0
      },
      features: [],
      insights: [],
      recommendations: []
    };

    // Analyze each feature
    for (const [featureName, data] of Object.entries(featureUsageData)) {
      const featureAnalysis = this.analyzeFeature(featureName, data, minUsage);
      analysis.features.push(featureAnalysis);
      
      // Update summary
      analysis.summary.totalFeatures++;
      if (featureAnalysis.isActive) analysis.summary.activeFeatures++;
      if (featureAnalysis.isUnderutilized) analysis.summary.underutilizedFeatures++;
      if (featureAnalysis.trend === 'growing') analysis.summary.trendingFeatures++;
      if (featureAnalysis.trend === 'declining') analysis.summary.decliningFeatures++;
    }

    // Generate insights
    analysis.insights = this.generateInsights(analysis.features);
    
    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis.features);

    // Save analysis
    const outputPath = path.join(this.outputDir, `feature-usage-analysis-${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
    
    console.log(`\n📊 Feature Usage Analysis:`);
    console.log(`   Total Features: ${analysis.summary.totalFeatures}`);
    console.log(`   Active Features: ${analysis.summary.activeFeatures}`);
    console.log(`   Trending Features: ${analysis.summary.trendingFeatures}`);
    console.log(`   Declining Features: ${analysis.summary.decliningFeatures}`);
    console.log(`   Underutilized Features: ${analysis.summary.underutilizedFeatures}`);
    console.log(`\n📄 Analysis saved to: ${outputPath}`);

    return analysis;
  }

  /**
   * Analyze user behavior patterns
   */
  async analyzeUserBehavior(options = {}) {
    const {
      days = 30,
      segmentBy = 'plan'
    } = options;

    console.log(`Analyzing user behavior patterns for the last ${days} days...`);

    // Simulate user behavior data
    const userBehaviorData = this.generateMockUserData(days);
    
    const analysis = {
      metadata: {
        analysisId: `user-behavior-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        period: { days }
      },
      summary: {
        totalUsers: userBehaviorData.length,
        activeUsers: 0,
        powerUsers: 0,
        atRiskUsers: 0,
        averageSessionDuration: 0,
        averageFeaturesUsed: 0
      },
      segments: {},
      cohorts: {},
      journeys: [],
      insights: []
    };

    // Analyze user segments
    const segments = this.segmentUsers(userBehaviorData, segmentBy);
    analysis.segments = segments;

    // Analyze cohorts
    analysis.cohorts = this.analyzeCohorts(userBehaviorData);

    // Analyze user journeys
    analysis.journeys = this.analyzeUserJourneys(userBehaviorData);

    // Calculate summary metrics
    analysis.summary.activeUsers = userBehaviorData.filter(u => u.lastActive >= 7).length;
    analysis.summary.powerUsers = userBehaviorData.filter(u => u.sessionsPerWeek >= 5).length;
    analysis.summary.atRiskUsers = userBehaviorData.filter(u => u.lastActive >= 14).length;
    analysis.summary.averageSessionDuration = userBehaviorData.reduce((sum, u) => sum + u.avgSessionDuration, 0) / userBehaviorData.length;
    analysis.summary.averageFeaturesUsed = userBehaviorData.reduce((sum, u) => sum + u.featuresUsed, 0) / userBehaviorData.length;

    // Generate insights
    analysis.insights = this.generateUserInsights(analysis);

    // Save analysis
    const outputPath = path.join(this.outputDir, `user-behavior-analysis-${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
    
    console.log(`\n👥 User Behavior Analysis:`);
    console.log(`   Total Users: ${analysis.summary.totalUsers}`);
    console.log(`   Active Users: ${analysis.summary.activeUsers}`);
    console.log(`   Power Users: ${analysis.summary.powerUsers}`);
    console.log(`   At Risk Users: ${analysis.summary.atRiskUsers}`);
    console.log(`   Avg Session Duration: ${Math.round(analysis.summary.averageSessionDuration)}min`);
    console.log(`\n📄 Analysis saved to: ${outputPath}`);

    return analysis;
  }

  /**
   * Analyze conversion funnels
   */
  async analyzeFunnels(options = {}) {
    const { days = 30 } = options;

    console.log(`Analyzing conversion funnels for the last ${days} days...`);

    // Simulate funnel data
    const funnelData = this.generateMockFunnelData(days);
    
    const analysis = {
      metadata: {
        analysisId: `funnel-analysis-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        period: { days }
      },
      funnels: [],
      insights: [],
      recommendations: []
    };

    // Analyze each funnel
    for (const [funnelName, data] of Object.entries(funnelData)) {
      const funnelAnalysis = this.analyzeFunnel(funnelName, data);
      analysis.funnels.push(funnelAnalysis);
    }

    // Generate insights and recommendations
    analysis.insights = this.generateFunnelInsights(analysis.funnels);
    analysis.recommendations = this.generateFunnelRecommendations(analysis.funnels);

    // Save analysis
    const outputPath = path.join(this.outputDir, `funnel-analysis-${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
    
    console.log(`\n🔄 Funnel Analysis:`);
    analysis.funnels.forEach(funnel => {
      console.log(`   ${funnel.name}: ${funnel.overallConversion.toFixed(1)}% conversion`);
    });
    console.log(`\n📄 Analysis saved to: ${outputPath}`);

    return analysis;
  }

  // Private helper methods

  generateMockFeatureData(days) {
    const features = [
      'authentication', 'dashboard', 'api_management', 'secret_management',
      'design_system', 'monitoring', 'user_settings', 'integrations',
      'notifications', 'search', 'export', 'collaboration'
    ];

    const data = {};
    
    features.forEach(feature => {
      const baseUsage = Math.floor(Math.random() * 1000) + 100;
      const trend = Math.random() > 0.5 ? 1 : -1;
      
      data[feature] = {
        totalUsage: baseUsage,
        uniqueUsers: Math.floor(baseUsage * 0.7),
        dailyUsage: Array.from({ length: days }, (_, i) => {
          const trendFactor = 1 + (trend * 0.02 * i);
          return Math.floor((baseUsage / days) * trendFactor * (0.8 + Math.random() * 0.4));
        }),
        userSegments: {
          free: Math.floor(baseUsage * 0.6),
          pro: Math.floor(baseUsage * 0.3),
          enterprise: Math.floor(baseUsage * 0.1)
        },
        completionRate: 0.6 + Math.random() * 0.3,
        errorRate: Math.random() * 0.05,
        avgTimeSpent: 30 + Math.random() * 120 // seconds
      };
    });

    return data;
  }

  generateMockUserData(days) {
    const users = [];
    const userCount = 1000 + Math.floor(Math.random() * 500);
    
    for (let i = 0; i < userCount; i++) {
      const plan = Math.random() > 0.8 ? 'enterprise' : Math.random() > 0.5 ? 'pro' : 'free';
      const signupDaysAgo = Math.floor(Math.random() * 365);
      const lastActive = Math.floor(Math.random() * 30);
      
      users.push({
        id: `user_${i}`,
        plan,
        signupDaysAgo,
        lastActive,
        totalSessions: Math.floor(Math.random() * 100) + 1,
        sessionsPerWeek: Math.floor(Math.random() * 10),
        avgSessionDuration: 5 + Math.random() * 60, // minutes
        featuresUsed: Math.floor(Math.random() * 12) + 1,
        apiCallsPerDay: plan === 'enterprise' ? Math.floor(Math.random() * 1000) : 
                       plan === 'pro' ? Math.floor(Math.random() * 100) : 
                       Math.floor(Math.random() * 10),
        conversionEvents: Math.floor(Math.random() * 5),
        errorEvents: Math.floor(Math.random() * 3)
      });
    }
    
    return users;
  }

  generateMockFunnelData(days) {
    return {
      user_onboarding: {
        steps: ['signup_started', 'email_verified', 'profile_completed', 'first_login', 'dashboard_viewed', 'first_feature_used'],
        data: [1000, 850, 720, 680, 620, 450]
      },
      feature_adoption: {
        steps: ['feature_discovered', 'feature_clicked', 'feature_configured', 'feature_used', 'feature_mastered'],
        data: [800, 600, 400, 300, 150]
      },
      api_integration: {
        steps: ['api_docs_viewed', 'api_key_generated', 'first_api_call', 'successful_integration', 'production_usage'],
        data: [500, 350, 280, 220, 180]
      }
    };
  }

  analyzeFeature(name, data, minUsage) {
    const isActive = data.totalUsage >= minUsage;
    const isUnderutilized = data.totalUsage < minUsage || data.completionRate < 0.5;
    
    // Calculate trend
    const firstHalf = data.dailyUsage.slice(0, Math.floor(data.dailyUsage.length / 2));
    const secondHalf = data.dailyUsage.slice(Math.floor(data.dailyUsage.length / 2));
    const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    let trend = 'stable';
    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
    if (changePercent > 10) trend = 'growing';
    else if (changePercent < -10) trend = 'declining';

    return {
      name,
      isActive,
      isUnderutilized,
      trend,
      changePercent: Math.round(changePercent),
      metrics: {
        totalUsage: data.totalUsage,
        uniqueUsers: data.uniqueUsers,
        completionRate: Math.round(data.completionRate * 100),
        errorRate: Math.round(data.errorRate * 100),
        avgTimeSpent: Math.round(data.avgTimeSpent)
      },
      segments: data.userSegments
    };
  }

  segmentUsers(users, segmentBy) {
    const segments = {};
    
    users.forEach(user => {
      const segmentKey = user[segmentBy];
      if (!segments[segmentKey]) {
        segments[segmentKey] = [];
      }
      segments[segmentKey].push(user);
    });

    // Calculate segment metrics
    Object.keys(segments).forEach(key => {
      const segmentUsers = segments[key];
      segments[key] = {
        count: segmentUsers.length,
        avgSessionDuration: segmentUsers.reduce((sum, u) => sum + u.avgSessionDuration, 0) / segmentUsers.length,
        avgFeaturesUsed: segmentUsers.reduce((sum, u) => sum + u.featuresUsed, 0) / segmentUsers.length,
        avgApiCalls: segmentUsers.reduce((sum, u) => sum + u.apiCallsPerDay, 0) / segmentUsers.length,
        activeUsers: segmentUsers.filter(u => u.lastActive <= 7).length,
        powerUsers: segmentUsers.filter(u => u.sessionsPerWeek >= 5).length
      };
    });

    return segments;
  }

  analyzeCohorts(users) {
    // Group users by signup month
    const cohorts = {};
    
    users.forEach(user => {
      const cohortMonth = Math.floor(user.signupDaysAgo / 30);
      const cohortKey = `month_${cohortMonth}`;
      
      if (!cohorts[cohortKey]) {
        cohorts[cohortKey] = [];
      }
      cohorts[cohortKey].push(user);
    });

    // Calculate retention for each cohort
    Object.keys(cohorts).forEach(key => {
      const cohortUsers = cohorts[key];
      const totalUsers = cohortUsers.length;
      const activeUsers = cohortUsers.filter(u => u.lastActive <= 7).length;
      const retentionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
      
      cohorts[key] = {
        totalUsers,
        activeUsers,
        retentionRate: Math.round(retentionRate),
        avgLifetimeValue: cohortUsers.reduce((sum, u) => sum + u.totalSessions, 0) / totalUsers
      };
    });

    return cohorts;
  }

  analyzeUserJourneys(users) {
    // Simulate common user journeys
    const journeys = [
      {
        name: 'New User Activation',
        steps: ['signup', 'email_verify', 'first_login', 'dashboard_view', 'feature_use'],
        completionRate: 65,
        avgTimeToComplete: '2.5 days',
        dropoffPoints: ['email_verify', 'feature_use']
      },
      {
        name: 'Feature Discovery',
        steps: ['dashboard_view', 'menu_explore', 'feature_click', 'feature_use', 'feature_master'],
        completionRate: 45,
        avgTimeToComplete: '1.2 weeks',
        dropoffPoints: ['feature_click', 'feature_master']
      },
      {
        name: 'API Integration',
        steps: ['docs_view', 'key_generate', 'first_call', 'integration', 'production'],
        completionRate: 72,
        avgTimeToComplete: '3.1 days',
        dropoffPoints: ['first_call']
      }
    ];

    return journeys;
  }

  analyzeFunnel(name, data) {
    const steps = data.steps;
    const stepData = data.data;
    
    const conversions = [];
    for (let i = 1; i < stepData.length; i++) {
      const conversionRate = (stepData[i] / stepData[i - 1]) * 100;
      conversions.push({
        from: steps[i - 1],
        to: steps[i],
        rate: Math.round(conversionRate * 10) / 10,
        dropoff: stepData[i - 1] - stepData[i]
      });
    }

    const overallConversion = (stepData[stepData.length - 1] / stepData[0]) * 100;

    return {
      name,
      steps: steps.map((step, i) => ({
        name: step,
        users: stepData[i],
        conversionFromPrevious: i > 0 ? conversions[i - 1].rate : 100
      })),
      conversions,
      overallConversion: Math.round(overallConversion * 10) / 10,
      totalDropoff: stepData[0] - stepData[stepData.length - 1]
    };
  }

  generateInsights(features) {
    const insights = [];
    
    // Top performing features
    const topFeatures = features
      .filter(f => f.isActive)
      .sort((a, b) => b.metrics.totalUsage - a.metrics.totalUsage)
      .slice(0, 3);
    
    insights.push({
      type: 'success',
      title: 'Top Performing Features',
      description: `${topFeatures.map(f => f.name).join(', ')} are your most used features`,
      data: topFeatures.map(f => ({ name: f.name, usage: f.metrics.totalUsage }))
    });

    // Declining features
    const decliningFeatures = features.filter(f => f.trend === 'declining');
    if (decliningFeatures.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Declining Feature Usage',
        description: `${decliningFeatures.length} features showing declining usage trends`,
        data: decliningFeatures.map(f => ({ name: f.name, change: f.changePercent }))
      });
    }

    // High error rate features
    const highErrorFeatures = features.filter(f => f.metrics.errorRate > 5);
    if (highErrorFeatures.length > 0) {
      insights.push({
        type: 'error',
        title: 'High Error Rate Features',
        description: `${highErrorFeatures.length} features have error rates above 5%`,
        data: highErrorFeatures.map(f => ({ name: f.name, errorRate: f.metrics.errorRate }))
      });
    }

    return insights;
  }

  generateRecommendations(features) {
    const recommendations = [];
    
    // Underutilized features
    const underutilized = features.filter(f => f.isUnderutilized);
    if (underutilized.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'feature_optimization',
        title: 'Improve Underutilized Features',
        description: `${underutilized.length} features are underutilized and may need UX improvements or better discovery`,
        actions: [
          'Conduct user research on underutilized features',
          'Improve feature discoverability in UI',
          'Add onboarding flows for complex features',
          'Consider feature consolidation or removal'
        ],
        features: underutilized.map(f => f.name)
      });
    }

    // Declining features
    const declining = features.filter(f => f.trend === 'declining');
    if (declining.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'retention',
        title: 'Address Declining Feature Usage',
        description: `${declining.length} features showing negative usage trends`,
        actions: [
          'Investigate reasons for declining usage',
          'Survey users about feature satisfaction',
          'Consider feature updates or improvements',
          'Monitor for competitive alternatives'
        ],
        features: declining.map(f => f.name)
      });
    }

    return recommendations;
  }

  generateUserInsights(analysis) {
    const insights = [];
    
    // User engagement
    const engagementRate = (analysis.summary.activeUsers / analysis.summary.totalUsers) * 100;
    insights.push({
      type: engagementRate > 70 ? 'success' : engagementRate > 50 ? 'warning' : 'error',
      title: 'User Engagement',
      description: `${Math.round(engagementRate)}% of users are actively engaged`,
      metric: engagementRate
    });

    // Power user ratio
    const powerUserRate = (analysis.summary.powerUsers / analysis.summary.totalUsers) * 100;
    insights.push({
      type: powerUserRate > 20 ? 'success' : 'info',
      title: 'Power User Adoption',
      description: `${Math.round(powerUserRate)}% of users are power users (5+ sessions/week)`,
      metric: powerUserRate
    });

    // At-risk users
    const atRiskRate = (analysis.summary.atRiskUsers / analysis.summary.totalUsers) * 100;
    if (atRiskRate > 15) {
      insights.push({
        type: 'warning',
        title: 'User Retention Risk',
        description: `${Math.round(atRiskRate)}% of users haven't been active in 2+ weeks`,
        metric: atRiskRate
      });
    }

    return insights;
  }

  generateFunnelInsights(funnels) {
    const insights = [];
    
    funnels.forEach(funnel => {
      // Find biggest dropoff point
      const biggestDropoff = funnel.conversions.reduce((max, conv) => 
        conv.dropoff > max.dropoff ? conv : max
      );
      
      insights.push({
        type: 'info',
        title: `${funnel.name} - Biggest Dropoff`,
        description: `${biggestDropoff.dropoff} users drop off between ${biggestDropoff.from} and ${biggestDropoff.to}`,
        funnel: funnel.name,
        dropoffPoint: biggestDropoff
      });
    });

    return insights;
  }

  generateFunnelRecommendations(funnels) {
    const recommendations = [];
    
    funnels.forEach(funnel => {
      if (funnel.overallConversion < 50) {
        recommendations.push({
          priority: 'high',
          category: 'conversion_optimization',
          title: `Optimize ${funnel.name} Funnel`,
          description: `Only ${funnel.overallConversion}% conversion rate - significant improvement opportunity`,
          actions: [
            'A/B test key funnel steps',
            'Reduce friction in conversion process',
            'Add progress indicators',
            'Implement exit-intent surveys'
          ],
          funnel: funnel.name
        });
      }
    });

    return recommendations;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'features';
  
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    
    if (key === 'days') {
      options[key] = parseInt(value);
    } else {
      options[key] = value;
    }
  }

  const analyzer = new AnalyticsUsageAnalyzer();
  
  switch (command) {
    case 'features':
      analyzer.analyzeFeatureUsage(options);
      break;
    case 'users':
      analyzer.analyzeUserBehavior(options);
      break;
    case 'funnels':
      analyzer.analyzeFunnels(options);
      break;
    case 'all':
      Promise.all([
        analyzer.analyzeFeatureUsage(options),
        analyzer.analyzeUserBehavior(options),
        analyzer.analyzeFunnels(options)
      ]).then(() => {
        console.log('\n🎉 All analyses completed!');
      });
      break;
    default:
      console.log('Usage: node analyze-usage.js [features|users|funnels|all] [--days 30]');
  }
}

module.exports = AnalyticsUsageAnalyzer;
