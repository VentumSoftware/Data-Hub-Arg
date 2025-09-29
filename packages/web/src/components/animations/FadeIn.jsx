import React, { useEffect, useRef } from "react";
import { motion, useInView, useAnimation } from "framer-motion";

const FadeInScaleAnimation = ({ children, width = "100%" }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, {});
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) controls.start("visible");
  }, [isInView]);

  return (
    <div ref={ref} style={{ width, overflow: "hidden" }}>
      <motion.div
        variants={{
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1 },
        }}
        initial="hidden"
        animate={controls}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
};
const FadeInAnimation = ({ 
  children, 
  width = "100%", 
  delay = 0, // Retraso inicial
  staggerDelay = 0, // Retraso adicional para stagger
  duration = 0.6, 
  ease = "easeOut",
  threshold = 0.1, // Umbral de visibilidad
  direction = "up", // Dirección de la animación
  distance = 20 // Distancia del movimiento
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { threshold });
  const controls = useAnimation();

  // Configuraciones de dirección
  const directionVariants = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: { x: 0, y: 0 }
  };

  useEffect(() => {
    if (isInView) {
      const startAnimation = async () => {
        await controls.start("visible");
      };
      startAnimation();
    }
  }, [isInView, controls]);

  return (
    <div ref={ref} style={{ width, overflow: "hidden" }}>
      <motion.div
        variants={{
          hidden: { 
            opacity: 0,
            ...directionVariants[direction]
          },
          visible: { 
            opacity: 1,
            x: 0,
            y: 0,
            transition: {
              duration: duration,
              ease: ease,
              delay: delay + staggerDelay
            }
          }
        }}
        initial="hidden"
        animate={controls}
      >
        {children}
      </motion.div>
    </div>
  );
};
export {FadeInScaleAnimation, FadeInAnimation};
