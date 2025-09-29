// src/components/AnimatedBorder.jsx
import React from 'react';
import { Box } from '@mui/material';

export const AnimatedBorder = ({
  children,
  direction = 'bottom',
  color = 'primary.main',
  size = '100%',
  thickness = '2px',
}) => {
  const isHorizontal = direction === 'top' || direction === 'bottom';

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-block',
        width: 'fit-content',
        '&:hover .animated-border': {
          transform: 'scale(1)',
        },
      }}
    >
      {children}
      <Box
        className="animated-border"
        sx={{
          position: 'absolute',
          transition: 'transform 0.3s ease',
          transform: 'scale(0)',
          transformOrigin:
            direction === 'bottom'
              ? 'left bottom'
              : direction === 'top'
              ? 'left top'
              : direction === 'left'
              ? 'top left'
              : 'top right',
          backgroundColor: color,
          ...(isHorizontal
            ? {
                [direction]: 0,
                left: 0,
                width: size,
                height: thickness,
              }
            : {
                [direction]: 0,
                top: 0,
                height: size,
                width: thickness,
              }),
        }}
      />
    </Box>
  );
};

