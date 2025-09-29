import React, { useEffect, useState, useRef } from "react";
import { motion, useInView, useAnimation, useAnimate } from "framer-motion"

const RevealAnimation = ({ children, width = '100%', colorSlider = null, delay }) => {
    const ref = useRef(null)
    const isInView = useInView(ref, {})
    const mainControls = useAnimation()
    const slideControls = useAnimation()
    
    useEffect(() => { 
        if (isInView) { 
            mainControls.start("visible"); 
            slideControls.start("visible") 
        } 
    }, [isInView])
    
    return (
        <div ref={ref} style={{ position: 'relative', width, overflow: 'hidden' }}>
            <motion.div
                variants={{ 
                    hidden: { opacity: 0, y: 75 }, 
                    visible: { 
                        opacity: 1, 
                        y: 0,
                        transition: {
                            type: "spring",
                            damping: 10, // Controla el rebote (valores más bajos = más rebote)
                            stiffness: 90, // Controla la rigidez del spring
                            mass: 0.9, // Controla la masa del objeto
                            velocity: 0 // Velocidad inicial
                        }
                    } 
                }}
                initial='hidden'
                animate={mainControls}
                transition={{ duration: 0.7, delay: delay || 0.25 }}
            >
                {children}
            </motion.div>

            <motion.div
                variants={{ 
                    hidden: { left: 0 }, 
                    visible: { 
                        left: '100%',
                        transition: {
                            type: "spring",
                            damping: 12,
                            stiffness: 80
                        }
                    } 
                }}
                initial='hidden'
                animate={slideControls}
                style={{
                    position: "absolute",
                    top: 4,
                    bottom: 4,
                    left: 0,
                    right: 0,
                    background: colorSlider,
                    zIndex: 20,
                }}
            />
        </div>
    )
}


export {RevealAnimation};


{/* <RevealAnimation children={<Typography children={"Alcanzá tu mejor versión"} variant="label-large" color="content-dark-secondary  />}/>  */}