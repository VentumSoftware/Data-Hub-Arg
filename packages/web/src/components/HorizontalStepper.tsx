import { useState, Fragment, ReactNode } from 'react';
import { Box, Button, Stepper, Step, StepLabel, Typography } from '@mui/material';

type StepItem = {
  label: string;
  component: ReactNode;
  validation: boolean;
  errorMessage?: string;
};

type HorizontalStepperProps = {
  steps: StepItem[];
  onSubmit: () => void;
};

export default function HorizontalStepper({ steps, onSubmit }: HorizontalStepperProps) {
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    const currentStep = steps[activeStep];
    if (!currentStep.validation) {
      setError(currentStep.errorMessage || 'Paso no válido');
      return;
    }
    setError('');
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep}>
        {steps.map((step, index) => {
          const { label } = step;

          return (
            <Step key={`step-${index}-${label}`}>
              <StepLabel>{label}</StepLabel>
            </Step>
          );
        })}
      </Stepper>

      <Fragment>
        {steps[activeStep].component}
        {error && (
          <Typography color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
          <Button
            color="inherit"
            disabled={activeStep === 0}
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            Atrás
          </Button>
          <Box sx={{ flex: '1 1 auto' }} />
          <Button
            onClick={() => {
              activeStep === steps.length - 1 ? onSubmit() : handleNext();
            }}
          >
            {activeStep === steps.length - 1 ? 'Enviar' : 'Siguiente'}
          </Button>
        </Box>
      </Fragment>
    </Box>
  );
}
