import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import './TeamPosition.css';
import { data } from '@tensorflow/tfjs';

function TeamPosition({ year, round }) {
  const [flowData, setFlowData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const teamColors = {
    'red_bull': '#3671C6',
    'ferrari': '#F91536',
    'mercedes': '#6CD3BF',
    'mclaren': '#F58020',
    'aston_martin': '#358C75',
    'alpine': '#2293D1',
    'williams': '#37BEDD',
    'rb': '#5E8FAA',
    'sauber': '#C92D4B',
    'haas': '#B6BABD'
  };

  useEffect(() => {
    async function fetchTeamPositions() {
      if (!year || !round) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`http://localhost:5000/api/team-positions?year=${year}&round=${round}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.nodes || !data.links) {
          throw new Error('Invalid data format received from server');
        }
        setFlowData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTeamPositions();
  }, [year, round]);

  const renderSankeyDiagram = () => {
    if (!flowData || !flowData.nodes || !flowData.links) return null;

    const teamCount = 10;
    const svgHeight = 100;
    const svgWidth = 900;
    const nodeWidth = 120;
    const padding = 15;
    
    const teamSpacing = (svgHeight - 2 * padding) / (teamCount - 1);
    
    return (
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {flowData.links.map((link, index) => {
          const sourceNode = flowData.nodes[link.source];
          const targetNode = flowData.nodes[link.target];
          
          const sourceY = padding + (link.source * teamSpacing);
          const targetY = padding + ((link.target - teamCount) * teamSpacing);
          
          const path = `M ${nodeWidth} ${sourceY} 
                       C ${(svgWidth - nodeWidth) / 2} ${sourceY},
                         ${(svgWidth - nodeWidth) / 2} ${targetY},
                         ${svgWidth - nodeWidth} ${targetY}`;
          
          return (
            <g key={`link-${index}`}>
              <path 
                d={path} 
                className="team-position-link"
                stroke={teamColors[sourceNode.name] || '#999999'}
              />
              <title>{link.driver}</title>
            </g>
          );
        })}
        
        {flowData.nodes.slice(0, teamCount).map((node, index) => (
          <g key={`team-${index}`} transform={`translate(0, ${padding + index * teamSpacing})`}>
            <text
              x={padding}
              y="5"
              textAnchor="start"
              className="team-position-text"
            >
              {node.name}
            </text>
          </g>
        ))}

        {flowData.nodes.slice(teamCount).map((node, index) => (
          <g key={`range-${index}`} transform={`translate(${svgWidth - nodeWidth}, ${padding + index * teamSpacing})`}>
            <text
              x={0}
              y="5"
              textAnchor="start"
              className="position-range-text"
            >
              {node.name}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  if (loading) {
    return (
      <Card className="w-full h-80">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-gray-500">Loading position data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-80">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-red-500">Error loading position data: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-80">
      <CardHeader>
        <CardTitle className="team-position-title">Race Positions</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {renderSankeyDiagram()}
      </CardContent>
    </Card>
  );
}

export default TeamPosition;