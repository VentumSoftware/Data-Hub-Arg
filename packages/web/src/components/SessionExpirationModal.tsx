import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    LinearProgress,
    IconButton,
} from '@mui/material';
import { Warning, Timer, Logout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface SessionExpirationModalProps {
    open: boolean;
    secondsRemaining: number;
    onExtendSession: () => Promise<void>;
    onLogout: () => void;
}

const SessionExpirationModal: React.FC<SessionExpirationModalProps> = ({
    open,
    secondsRemaining: initialSeconds,
    onExtendSession,
    onLogout,
}) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const [isExtending, setIsExtending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        setSeconds(initialSeconds);
        setError(null); // Clear error when modal opens/reopens
    }, [initialSeconds, open]);

    useEffect(() => {
        if (!open || seconds <= 0) return;

        const interval = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    // Time's up - force logout
                    onLogout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [open, seconds, onLogout]);

    const handleExtendSession = async () => {
        setIsExtending(true);
        setError(null);
        try {
            await onExtendSession();
            // Success - modal should close from parent component
        } catch (error) {
            console.error('Failed to extend session:', error);
            setError(error instanceof Error ? error.message : 'Error al extender la sesión');
        } finally {
            setIsExtending(false);
        }
    };

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const progressValue = (seconds / 60) * 100;
    const isUrgent = seconds <= 20;
    const isCritical = seconds <= 10;

    return (
        <Dialog
            open={open}
            onClose={() => {}} // Prevent closing by clicking outside
            disableEscapeKeyDown // Prevent closing with ESC key
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderTop: `4px solid ${isCritical ? 'error.main' : isUrgent ? 'warning.main' : 'primary.main'}`,
                }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                bgcolor: isCritical ? 'error.light' : isUrgent ? 'warning.light' : 'background.paper',
                color: isCritical || isUrgent ? 'white' : 'text.primary'
            }}>
                <Warning sx={{ 
                    color: isCritical ? 'error.contrastText' : isUrgent ? 'warning.contrastText' : 'warning.main',
                    animation: isCritical ? 'pulse 1s infinite' : undefined,
                    '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.5 },
                        '100%': { opacity: 1 },
                    }
                }} />
                Su sesión está por expirar
            </DialogTitle>
            
            <DialogContent sx={{ pt: 3, pb: 4 }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Timer sx={{ 
                        fontSize: 64, 
                        color: isCritical ? 'error.main' : isUrgent ? 'warning.main' : 'primary.main',
                        mb: 2 
                    }} />
                    
                    <Typography 
                        variant="h2" 
                        sx={{ 
                            fontWeight: 700,
                            color: isCritical ? 'error.main' : isUrgent ? 'warning.main' : 'text.primary',
                            mb: 1
                        }}
                    >
                        {formatTime(seconds)}
                    </Typography>
                    
                    <Typography variant="body1" color="text.secondary">
                        Su sesión expirará en {seconds} segundo{seconds !== 1 ? 's' : ''}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Haga clic en "Continuar trabajando" para extender su sesión
                    </Typography>

                    {error && (
                        <Typography 
                            variant="body2" 
                            color="error" 
                            sx={{ 
                                mt: 2, 
                                p: 2, 
                                bgcolor: 'error.light',
                                borderRadius: 1,
                                fontWeight: 500
                            }}
                        >
                            {error}
                        </Typography>
                    )}
                </Box>

                <LinearProgress 
                    variant="determinate" 
                    value={progressValue} 
                    sx={{ 
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                            bgcolor: isCritical ? 'error.main' : isUrgent ? 'warning.main' : 'primary.main',
                            transition: 'all 0.3s ease'
                        }
                    }}
                />
            </DialogContent>
            
            <DialogActions sx={{ 
                px: 3, 
                pb: 2,
                gap: 1,
                justifyContent: 'space-between' 
            }}>
                <Button
                    onClick={onLogout}
                    startIcon={<Logout />}
                    color="inherit"
                    variant="outlined"
                    disabled={isExtending}
                >
                    Cerrar sesión
                </Button>
                
                <Button
                    onClick={handleExtendSession}
                    variant="contained"
                    color={isCritical ? 'error' : isUrgent ? 'warning' : 'primary'}
                    size="large"
                    disabled={isExtending || seconds <= 0}
                    sx={{ 
                        minWidth: 200,
                        fontWeight: 600,
                        animation: isCritical ? 'shake 0.5s infinite' : undefined,
                        '@keyframes shake': {
                            '0%, 100%': { transform: 'translateX(0)' },
                            '25%': { transform: 'translateX(-5px)' },
                            '75%': { transform: 'translateX(5px)' },
                        }
                    }}
                >
                    {isExtending ? 'Extendiendo...' : 'Continuar trabajando'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SessionExpirationModal;