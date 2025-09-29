import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

interface VentumLogoProps extends Omit<SvgIconProps, 'children'> {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  variant?: 'light' | 'dark' | 'primary';
}

const VentumLogo: React.FC<VentumLogoProps> = ({ 
  size = 'medium', 
  showText = true, 
  variant = 'primary',
  ...props 
}) => {
  const dimensions = {
    small: { width: 120, height: 36, fontSize: 14, subFontSize: 8 },
    medium: { width: 160, height: 48, fontSize: 18, subFontSize: 10 },
    large: { width: 200, height: 60, fontSize: 22, subFontSize: 12 }
  };

  const colors = {
    primary: { main: '#1976d2', text: '#1976d2', subText: '#666', stroke: '#ffffff' },
    light: { main: '#ffffff', text: '#ffffff', subText: '#666666', stroke: '#333333' },
    dark: { main: '#333333', text: '#333333', subText: '#666666', stroke: '#ffffff' }
  };

  const { width, height, fontSize, subFontSize } = dimensions[size];
  const { main, text, subText, stroke } = colors[variant];

  return (
    <SvgIcon 
      {...props}
      viewBox={`0 0 ${width} ${height}`}
      sx={{ 
        width, 
        height, 
        ...props.sx 
      }}
    >
      {/* Background circle */}
      <circle 
        cx={height / 2} 
        cy={height / 2} 
        r={height / 2 - 2} 
        fill={main} 
        stroke={main} 
        strokeWidth="1"
      />
      
      {/* V symbol in the circle */}
      <path 
        d={`M${height / 2 - 8} ${height / 2 - 8} L${height / 2} ${height / 2 + 8} L${height / 2 + 8} ${height / 2 - 8}`}
        stroke={stroke}
        strokeWidth="2.5" 
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {showText && (
        <>
          {/* VENTUM text */}
          <text 
            x={height + 8} 
            y={height / 2 - 2} 
            fontFamily="Arial, sans-serif" 
            fontSize={fontSize} 
            fontWeight="bold" 
            fill={text}
          >
            VENTUM
          </text>
          
          {/* FRAMEWORK subtitle */}
          <text 
            x={height + 8} 
            y={height / 2 + 12} 
            fontFamily="Arial, sans-serif" 
            fontSize={subFontSize} 
            fill={subText}
            letterSpacing="1px"
          >
            FRAMEWORK
          </text>
        </>
      )}
    </SvgIcon>
  );
};

export default VentumLogo;