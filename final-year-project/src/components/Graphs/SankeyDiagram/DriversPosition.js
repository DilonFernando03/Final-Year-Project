import React, { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import './DriversPosition.css';
import { API_BASE_URL } from '../../../config';

function DriverPosition({ year, round, sessionKey }) {
  const [flowData, setFlowData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);

  /* Fetch driver position data */
  useEffect(() => {
    async function fetchDriverPositions() {
      if (!year || !round || !sessionKey) return;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/driver-positions?year=${year}&round=${round}&sessionKey=${sessionKey}`);
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
    fetchDriverPositions();
  }, [year, round, sessionKey]);

  /* Handle window resize */
  const handleResize = () => {
    if (svgRef.current && flowData) {
      renderDiagram();
    }
  };

  /* Render the position flow diagram */
  const renderDiagram = () => {
    if (!flowData || !flowData.nodes || !flowData.links || !svgRef.current) return;
    
    /* Clear previous content */
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }
    const svgHeight = 500;
    const svgWidth = 900;
    const padding = { top: 60, left: 80, right: 80, bottom: 40 };
    
    svgRef.current.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svgRef.current.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    
    /* Split nodes into start and finish groups */
    const startNodes = flowData.nodes.filter(n => n.type === 'start');
    const finishNodes = flowData.nodes.filter(n => n.type === 'finish');
     
    /* Calculate positions */
    const columnWidth = svgWidth - padding.left - padding.right;
    const leftX = padding.left;
    const rightX = padding.left + columnWidth;
    
    const startSpacing = (svgHeight - padding.top - padding.bottom) / startNodes.length;
    const finishSpacing = (svgHeight - padding.top - padding.bottom) / finishNodes.length;
    
    /* Create column headers */
    const headers = [
      { x: leftX, y: 30, text: 'START' },
      { x: rightX, y: 30, text: 'FINISH' }
    ];
    
    headers.forEach(header => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', header.x);
      text.setAttribute('y', header.y);
      text.setAttribute('class', 'position-column-label');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = header.text;
      svgRef.current.appendChild(text);
    });
    
    /* Add background position numbers */
    startNodes.forEach((node, index) => {
      const y = padding.top + index * startSpacing + startSpacing / 2;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', leftX - 30);
      text.setAttribute('y', y + 4);
      text.setAttribute('class', 'position-number');
      text.setAttribute('text-anchor', 'end');
      text.textContent = node.position;
      svgRef.current.appendChild(text);
    });
    
    finishNodes.forEach((node, index) => {
      const y = padding.top + index * finishSpacing + finishSpacing / 2;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', rightX + 30);
      text.setAttribute('y', y + 4);
      text.setAttribute('class', 'position-number');
      text.setAttribute('text-anchor', 'start');
      text.textContent = node.position;
      svgRef.current.appendChild(text);
    });
    
    /* Create node map for quick lookups */
    const nodeMap = {};
    flowData.nodes.forEach((node, index) => {
      nodeMap[node.id] = node;
    });
    
    /* Add start nodes */
    startNodes.forEach((node, index) => {
      const y = padding.top + index * startSpacing + startSpacing / 2;
      
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${leftX}, ${y})`);
      
      /* Determine the color to use - prefer OpenF1 color if available */
      const teamColor = node.teamColor || '#999999';
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', 14);
      circle.setAttribute('fill', teamColor);
      circle.setAttribute('class', 'driver-circle');
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', 0);
      text.setAttribute('y', 4);
      text.setAttribute('class', 'driver-code-text');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = node.name;
      
      /* Create title element for tooltip */
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${node.fullName} - ${node.team} - Start Position: ${node.position}`;
      
      /* Append elements */
      g.appendChild(circle);
      g.appendChild(text);
      g.appendChild(title);
      svgRef.current.appendChild(g);
      
      /* Store node position for links */
      node.x = leftX;
      node.y = y;
    });
    
    /* Add finish nodes */
    finishNodes.forEach((node, index) => {
      const y = padding.top + index * finishSpacing + finishSpacing / 2;
      
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${rightX}, ${y})`);
      
      /* Determine the color to use - prefer OpenF1 color if available */
      const teamColor = node.teamColor || '#999999';
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', 14);
      circle.setAttribute('fill', teamColor);
      circle.setAttribute('class', 'driver-circle');
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', 0);
      text.setAttribute('y', 4);
      text.setAttribute('class', 'driver-code-text');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = node.name;
      
      /* Create title element for tooltip */
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${node.fullName} - ${node.team} - Finish Position: ${node.position}`;
      
      /* Append elements */
      g.appendChild(circle);
      g.appendChild(text);
      g.appendChild(title);
      svgRef.current.appendChild(g);
      
      /* Store node position for links */
      node.x = rightX;
      node.y = y;
    });
    
    /* Draw links between start and finish positions */
    flowData.links.forEach(link => {
      const sourceNode = nodeMap[link.source];
      const targetNode = nodeMap[link.target];
      
      /* Skip if nodes not found */
      if (!sourceNode || !targetNode) return;
      
      /* Calculate path with adjusted control points for smoother curves */
      const path = `M ${sourceNode.x} ${sourceNode.y} 
                   C ${sourceNode.x + columnWidth / 2.5} ${sourceNode.y},
                     ${targetNode.x - columnWidth / 2.5} ${targetNode.y},
                     ${targetNode.x} ${targetNode.y}`;
      
      /* Create element */
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathElement.setAttribute('d', path);
      pathElement.setAttribute('class', 'driver-position-link');
      
      /* Determine the color to use - prefer OpenF1 color if available */
      const strokeColor = link.teamColor || '#999999';
                         
      pathElement.setAttribute('stroke', strokeColor);
      pathElement.setAttribute('opacity', '0.6');
      
      /* Create title element for tooltip */
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${link.driverName} - ${link.positionChange > 0 ? '+' + link.positionChange : link.positionChange} positions`;
      
      /* Append elements */
      g.appendChild(pathElement);
      g.appendChild(title);
      svgRef.current.appendChild(g);
    });
  };
  
  /* Update diagram on data changes and handle window resizing */
  useEffect(() => {
    renderDiagram();
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [flowData]);

  /* Conditional rendering based on loading/error states */
  if (loading) {
    return (
      <Card className="w-full h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-gray-500">Loading position data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-red-500">Error loading position data: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <CardTitle className="driver-position-title">Drivers Position Flow</CardTitle>
      </CardHeader>
      <CardContent className="h-full">
        <svg ref={svgRef} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"></svg>
      </CardContent>
    </Card>
  );
}

export default DriverPosition;