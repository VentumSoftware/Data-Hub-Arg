// src/components/AnimatedTextFlipY.jsx
import { motion } from 'framer-motion';
import { Box } from '@mui/material';

export  function AnimatedTextFlipY({
  text,
  color = 'primary.main',
  hoverColor = 'secondary.main',
  fontSize = '1rem',
  fontWeight = 500,
  sx = {},
  width = '50vw',
}) {
  const containerVariants = {
    rest: {},
    hover: {},
  };

  const topTextVariants = {
    rest: { rotateX: 0, opacity: 1 },
    hover: {
      rotateX: -90,
      opacity: 0,
      transition: { duration: 0.3, ease: 'easeInOut' },
    },
  };

  const bottomTextVariants = {
    rest: { rotateX: 90, opacity: 0 },
    hover: {
      rotateX: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: 'easeInOut', delay: 0.1 },
    },
  };

  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      animate="rest"
      variants={containerVariants}
      style={{ display: 'inline-block', perspective: '1000px', width }}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'inline-block',
          height: '1em',
          ...sx,
        }}
      >
        {/* Texto original */}
        <motion.div
          variants={topTextVariants}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transformOrigin: 'bottom',
            color,
            fontSize,
            fontWeight,
            width: '100%',
            textAlign: 'inherit',
          }}
        >
          {text}
        </motion.div>

        {/* Texto hover */}
        <motion.div
          variants={bottomTextVariants}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transformOrigin: 'top',
            color: hoverColor,
            fontSize,
            fontWeight,
            width: '100%',
            textAlign: 'inherit',
          }}
        >
          {text}
        </motion.div>
      </Box>
    </motion.div>
  );
}
