import {
  TechnologyEntry,
  TechRadarSnapshot,
  TechRadarConfig,
  RadarVisualizationData,
  TechRadarRing,
  TechRadarQuadrant,
} from '../types';
import { AnalyticsTracker } from '@nexus/analytics';
import * as d3 from 'd3';
import { createCanvas } from 'canvas';
import * as fs from 'fs/promises';
import * as path from 'path';

export class RadarGenerator {
  private analytics: AnalyticsTracker;
  private config: TechRadarConfig;

  constructor(config: TechRadarConfig) {
    this.config = config;
    this.analytics = new AnalyticsTracker();
  }

  /**
   * Generate radar visualization data
   */
  async generateVisualizationData(snapshot: TechRadarSnapshot): Promise<RadarVisualizationData> {
    try {
      const { width, height } = this.config.visualization;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) / 2 - 50;

      // Define ring radii
      const ringRadii = {
        adopt: maxRadius * 0.25,
        trial: maxRadius * 0.5,
        assess: maxRadius * 0.75,
        hold: maxRadius,
      };

      // Define quadrant angles (in radians)
      const quadrantAngles = {
        'languages-frameworks': { start: 0, end: Math.PI / 2 },
        'tools': { start: Math.PI / 2, end: Math.PI },
        'platforms': { start: Math.PI, end: 3 * Math.PI / 2 },
        'techniques': { start: 3 * Math.PI / 2, end: 2 * Math.PI },
      };

      const quadrants = Object.keys(quadrantAngles).map(quadrantKey => {
        const quadrant = quadrantKey as TechRadarQuadrant;
        const quadrantTechnologies = snapshot.technologies.filter(tech => tech.quadrant === quadrant);
        
        const technologies = quadrantTechnologies.map(tech => {
          const position = this.calculateTechnologyPosition(
            tech,
            quadrantAngles[quadrant],
            ringRadii,
            centerX,
            centerY
          );

          return {
            id: tech.id,
            name: tech.name,
            ring: tech.ring,
            movement: tech.movement,
            x: position.x,
            y: position.y,
          };
        });

        return {
          name: this.config.quadrants[quadrant].name,
          technologies,
        };
      });

      const rings = Object.entries(this.config.rings).map(([ringKey, ringConfig]) => {
        const config = ringConfig as { name: string; color: string; description: string };
        return {
          name: config.name,
          radius: ringRadii[ringKey as TechRadarRing],
          color: config.color,
        };
      });

      const visualizationData: RadarVisualizationData = {
        quadrants,
        rings,
        metadata: {
          title: snapshot.title,
          date: snapshot.date.toISOString(),
          version: snapshot.version,
        },
      };

      await this.analytics.track('radar.visualization.generated', {
        snapshotId: snapshot.id,
        technologiesCount: snapshot.technologies.length,
        quadrantsCount: quadrants.length,
      });

      return visualizationData;
    } catch (error) {
      await this.analytics.track('radar.visualization.error', {
        snapshotId: snapshot.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate SVG radar chart
   */
  async generateSVG(snapshot: TechRadarSnapshot): Promise<string> {
    try {
      const visualizationData = await this.generateVisualizationData(snapshot);
      const { width, height } = this.config.visualization;
      const centerX = width / 2;
      const centerY = height / 2;

      let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
      
      // Add styles
      svg += `
        <defs>
          <style>
            .ring { fill: none; stroke: #ccc; stroke-width: 1; }
            .quadrant-line { stroke: #ccc; stroke-width: 1; }
            .technology-dot { r: 6; cursor: pointer; }
            .technology-label { font-family: Arial, sans-serif; font-size: 10px; fill: #333; }
            .ring-label { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; fill: #666; }
            .quadrant-label { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #333; }
            .title { font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; fill: #333; }
            .subtitle { font-family: Arial, sans-serif; font-size: 12px; fill: #666; }
          </style>
        </defs>
      `;

      // Add background
      svg += `<rect width="${width}" height="${height}" fill="white"/>`;

      // Draw rings
      visualizationData.rings.forEach(ring => {
        svg += `<circle cx="${centerX}" cy="${centerY}" r="${ring.radius}" class="ring"/>`;
      });

      // Draw quadrant lines
      svg += `<line x1="${centerX}" y1="0" x2="${centerX}" y2="${height}" class="quadrant-line"/>`;
      svg += `<line x1="0" y1="${centerY}" x2="${width}" y2="${centerY}" class="quadrant-line"/>`;

      // Add ring labels
      visualizationData.rings.forEach((ring, index) => {
        const labelX = centerX + ring.radius - 10;
        const labelY = centerY - 5;
        svg += `<text x="${labelX}" y="${labelY}" class="ring-label">${ring.name}</text>`;
      });

      // Add quadrant labels
      const quadrantLabelPositions = [
        { x: centerX + 20, y: 30, text: this.config.quadrants['languages-frameworks'].name },
        { x: 20, y: 30, text: this.config.quadrants.tools.name },
        { x: 20, y: centerY + 20, text: this.config.quadrants.platforms.name },
        { x: centerX + 20, y: centerY + 20, text: this.config.quadrants.techniques.name },
      ];

      quadrantLabelPositions.forEach(pos => {
        svg += `<text x="${pos.x}" y="${pos.y}" class="quadrant-label">${pos.text}</text>`;
      });

      // Add technologies
      visualizationData.quadrants.forEach((quadrant, quadrantIndex) => {
        quadrant.technologies.forEach(tech => {
          const color = this.config.rings[tech.ring].color;
          const movementSymbol = this.getMovementSymbol(tech.movement);
          
          svg += `<circle cx="${tech.x}" cy="${tech.y}" class="technology-dot" fill="${color}" title="${tech.name}"/>`;
          
          if (movementSymbol) {
            svg += `<text x="${tech.x + 8}" y="${tech.y + 3}" class="technology-label">${movementSymbol}</text>`;
          }
          
          if (this.config.visualization.showLabels) {
            svg += `<text x="${tech.x + 10}" y="${tech.y + 3}" class="technology-label">${tech.name}</text>`;
          }
        });
      });

      // Add title and metadata
      svg += `<text x="${width / 2}" y="30" text-anchor="middle" class="title">${visualizationData.metadata.title}</text>`;
      svg += `<text x="${width / 2}" y="50" text-anchor="middle" class="subtitle">Generated on ${new Date(visualizationData.metadata.date).toLocaleDateString()}</text>`;

      // Add legend if enabled
      if (this.config.visualization.showLegend) {
        svg += this.generateLegend(visualizationData);
      }

      svg += '</svg>';

      await this.analytics.track('radar.svg.generated', {
        snapshotId: snapshot.id,
        size: svg.length,
      });

      return svg;
    } catch (error) {
      await this.analytics.track('radar.svg.error', {
        snapshotId: snapshot.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate PNG radar chart
   */
  async generatePNG(snapshot: TechRadarSnapshot, outputPath: string): Promise<void> {
    try {
      const { width, height } = this.config.visualization;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Set background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);

      const visualizationData = await this.generateVisualizationData(snapshot);
      const centerX = width / 2;
      const centerY = height / 2;

      // Draw rings
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      visualizationData.rings.forEach(ring => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, ring.radius, 0, 2 * Math.PI);
        ctx.stroke();
      });

      // Draw quadrant lines
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Draw technologies
      visualizationData.quadrants.forEach(quadrant => {
        quadrant.technologies.forEach(tech => {
          const color = this.config.rings[tech.ring].color;
          
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(tech.x, tech.y, 6, 0, 2 * Math.PI);
          ctx.fill();

          // Add movement indicator
          const movementSymbol = this.getMovementSymbol(tech.movement);
          if (movementSymbol) {
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.fillText(movementSymbol, tech.x + 8, tech.y + 3);
          }

          // Add label if enabled
          if (this.config.visualization.showLabels) {
            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.fillText(tech.name, tech.x + 10, tech.y + 3);
          }
        });
      });

      // Add title
      ctx.fillStyle = '#333';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(visualizationData.metadata.title, width / 2, 30);

      ctx.font = '12px Arial';
      ctx.fillText(`Generated on ${new Date(visualizationData.metadata.date).toLocaleDateString()}`, width / 2, 50);

      // Save to file
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(outputPath, buffer);

      await this.analytics.track('radar.png.generated', {
        snapshotId: snapshot.id,
        outputPath,
        fileSize: buffer.length,
      });
    } catch (error) {
      await this.analytics.track('radar.png.error', {
        snapshotId: snapshot.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate HTML radar chart with interactivity
   */
  async generateHTML(snapshot: TechRadarSnapshot): Promise<string> {
    try {
      const visualizationData = await this.generateVisualizationData(snapshot);
      const svg = await this.generateSVG(snapshot);

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${visualizationData.metadata.title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .radar-container {
            display: flex;
            gap: 30px;
        }
        .radar-chart {
            flex: 1;
        }
        .sidebar {
            width: 300px;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
        }
        .technology-list {
            margin-bottom: 20px;
        }
        .technology-item {
            padding: 8px;
            margin: 4px 0;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .technology-item:hover {
            background-color: #e9ecef;
        }
        .ring-adopt { border-left: 4px solid ${this.config.rings.adopt.color}; }
        .ring-trial { border-left: 4px solid ${this.config.rings.trial.color}; }
        .ring-assess { border-left: 4px solid ${this.config.rings.assess.color}; }
        .ring-hold { border-left: 4px solid ${this.config.rings.hold.color}; }
        .movement-in::after { content: ' ↗'; color: green; }
        .movement-out::after { content: ' ↘'; color: red; }
        .stats {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .stat-item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
        }
        .tooltip {
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${visualizationData.metadata.title}</h1>
            <p>Generated on ${new Date(visualizationData.metadata.date).toLocaleDateString()}</p>
        </div>
        
        <div class="radar-container">
            <div class="radar-chart">
                ${svg}
            </div>
            
            <div class="sidebar">
                ${this.generateTechnologyList(visualizationData)}
                ${this.generateStats(snapshot)}
            </div>
        </div>
    </div>
    
    <div class="tooltip" id="tooltip"></div>
    
    <script>
        ${this.generateInteractivityScript(visualizationData)}
    </script>
</body>
</html>`;

      await this.analytics.track('radar.html.generated', {
        snapshotId: snapshot.id,
        size: html.length,
      });

      return html;
    } catch (error) {
      await this.analytics.track('radar.html.error', {
        snapshotId: snapshot.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private calculateTechnologyPosition(
    technology: TechnologyEntry,
    quadrantAngles: { start: number; end: number },
    ringRadii: Record<TechRadarRing, number>,
    centerX: number,
    centerY: number
  ): { x: number; y: number } {
    const ringRadius = ringRadii[technology.ring as TechRadarRing];
    const innerRadius = this.getInnerRadius(technology.ring as TechRadarRing, ringRadii);
    
    // Random position within the ring and quadrant
    const angle = quadrantAngles.start + Math.random() * (quadrantAngles.end - quadrantAngles.start);
    const radius = innerRadius + Math.random() * (ringRadius - innerRadius);
    
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    return { x, y };
  }

  private getInnerRadius(ring: TechRadarRing, ringRadii: Record<TechRadarRing, number>): number {
    switch (ring) {
      case 'adopt': return 0;
      case 'trial': return ringRadii.adopt;
      case 'assess': return ringRadii.trial;
      case 'hold': return ringRadii.assess;
      default: return 0;
    }
  }

  private getMovementSymbol(movement: 'in' | 'out' | 'no-change'): string {
    switch (movement) {
      case 'in': return '↗';
      case 'out': return '↘';
      case 'no-change': return '';
      default: return '';
    }
  }

  private generateLegend(visualizationData: RadarVisualizationData): string {
    const legendX = 20;
    const legendY = visualizationData.rings.length * 30 + 100;
    
    let legend = `<g class="legend">`;
    legend += `<text x="${legendX}" y="${legendY}" class="ring-label">Rings:</text>`;
    
    visualizationData.rings.forEach((ring, index) => {
      const y = legendY + 20 + (index * 20);
      legend += `<circle cx="${legendX + 10}" cy="${y}" r="6" fill="${ring.color}"/>`;
      legend += `<text x="${legendX + 25}" y="${y + 4}" class="technology-label">${ring.name}</text>`;
    });
    
    legend += `</g>`;
    return legend;
  }

  private generateTechnologyList(visualizationData: RadarVisualizationData): string {
    let html = '';
    
    visualizationData.quadrants.forEach(quadrant => {
      if (quadrant.technologies.length > 0) {
        html += `<div class="technology-list">`;
        html += `<h3>${quadrant.name}</h3>`;
        
        quadrant.technologies.forEach(tech => {
          html += `<div class="technology-item ring-${tech.ring} movement-${tech.movement}" data-tech-id="${tech.id}">`;
          html += `${tech.name}`;
          html += `</div>`;
        });
        
        html += `</div>`;
      }
    });
    
    return html;
  }

  private generateStats(snapshot: TechRadarSnapshot): string {
    return `
      <div class="stats">
        <h3>Statistics</h3>
        <div class="stat-item">
          <span>Total Technologies:</span>
          <span>${snapshot.summary.totalTechnologies}</span>
        </div>
        <div class="stat-item">
          <span>Adopt:</span>
          <span>${snapshot.summary.byRing.adopt || 0}</span>
        </div>
        <div class="stat-item">
          <span>Trial:</span>
          <span>${snapshot.summary.byRing.trial || 0}</span>
        </div>
        <div class="stat-item">
          <span>Assess:</span>
          <span>${snapshot.summary.byRing.assess || 0}</span>
        </div>
        <div class="stat-item">
          <span>Hold:</span>
          <span>${snapshot.summary.byRing.hold || 0}</span>
        </div>
        <div class="stat-item">
          <span>New Technologies:</span>
          <span>${snapshot.summary.newTechnologies}</span>
        </div>
        <div class="stat-item">
          <span>Deprecated:</span>
          <span>${snapshot.summary.deprecatedTechnologies}</span>
        </div>
      </div>
    `;
  }

  private generateInteractivityScript(visualizationData: RadarVisualizationData): string {
    return `
      // Add hover effects and tooltips
      document.querySelectorAll('.technology-dot').forEach(dot => {
        dot.addEventListener('mouseenter', function(e) {
          const tooltip = document.getElementById('tooltip');
          tooltip.style.display = 'block';
          tooltip.textContent = this.getAttribute('title');
          tooltip.style.left = e.pageX + 10 + 'px';
          tooltip.style.top = e.pageY - 30 + 'px';
        });
        
        dot.addEventListener('mouseleave', function() {
          document.getElementById('tooltip').style.display = 'none';
        });
        
        dot.addEventListener('mousemove', function(e) {
          const tooltip = document.getElementById('tooltip');
          tooltip.style.left = e.pageX + 10 + 'px';
          tooltip.style.top = e.pageY - 30 + 'px';
        });
      });
      
      // Highlight technology on sidebar click
      document.querySelectorAll('.technology-item').forEach(item => {
        item.addEventListener('click', function() {
          const techId = this.getAttribute('data-tech-id');
          // Find and highlight the corresponding dot
          document.querySelectorAll('.technology-dot').forEach(dot => {
            if (dot.getAttribute('data-tech-id') === techId) {
              dot.style.stroke = '#000';
              dot.style.strokeWidth = '2';
              setTimeout(() => {
                dot.style.stroke = '';
                dot.style.strokeWidth = '';
              }, 2000);
            }
          });
        });
      });
    `;
  }
}
