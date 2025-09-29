import React, { useEffect, useRef } from "react";
import { motion, useInView, useAnimation } from "framer-motion";

const SlideInAnimation = ({ children, direction = "left", width = "100%" }) => {
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
          hidden: { opacity: 0, x: direction === "left" ? -100 : 100 },
          visible: { opacity: 1, x: 0 },
        }}
        initial="hidden"
        animate={controls}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export {SlideInAnimation};