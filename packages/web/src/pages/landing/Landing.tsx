import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Stack,
  Divider
} from '@mui/material';
import {
  QueryStats,
  AutoGraph,
  Functions,
  Sync,
  GitHub, TrendingUp, CheckCircle, Update, Security, ArrowForwardIos,
  Launch,
  ArrowForward
} from '@mui/icons-material';
import VentumLogo from '../../components/VentumLogo';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useThemeContext } from '../../ThemeContext';
import { styled, useTheme } from '@mui/material/styles';
import { FadeInAnimation, SlideInAnimation, AnimatedBorder, RevealAnimation } from '../../components/animations/index';
import { i } from 'mathjs';
const MaterialUISwitch = styled(Switch)(({ theme }) => ({
  width: 62,
  height: 34,
  padding: 7,
  '& .MuiSwitch-switchBase': {
    margin: 0,
    padding: 0,
    top: '50%',
    transform: 'translateX(6px) translateY(-50%)',
    '&.Mui-checked': {
      color: 'background.default',
      transform: 'translateX(35px) translateY(-50%)',
      '& .MuiSwitch-thumb:before': {
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="15" width="15" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
          '#fff',
        )}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`,
      },
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: '#aab4be',
        ...theme.applyStyles('dark', {
          backgroundColor: '#8796A5',
        }),
      },
    },
  },
  '& .MuiSwitch-thumb': {
    backgroundColor: 'background.default',
    width: 20, // Reducido de 22 a 20
    height: 20, // Reducido de 22 a 20
    '&::before': {
      content: "''",
      position: 'absolute',
      width: '100%',
      height: '100%',
      left: 0,
      top: 0,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="15" width="15" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
        '#090909ff',
      )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`,
    },
    ...theme.applyStyles('dark', {
      backgroundColor: 'background.default',
    }),
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: '#aab4be',
    borderRadius: 20 / 2,
    height: 20, // Añadido para controlar la altura del track
    ...theme.applyStyles('dark', {
      backgroundColor: '#8796A5',
    }),
  },
}));
const Landing: React.FC = () => {
  const { toggleColorMode, mode } = useThemeContext();
  const navigate = useNavigate();
  const theme = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const handleScroll = () => {
      // Detecta si se ha scrolleado más de 10px
      const scrolled = container.scrollTop > 10;
      setIsScrolled(scrolled);
    };

    // Agrega el event listener al contenedor
    container.addEventListener('scroll', handleScroll);

    // Limpia el event listener cuando el componente se desmonta
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const features = [
    {
      icon: <QueryStats />,
      title: 'Índices',
      description: 'Principales indicadores actualizados en tiempo real para tomar decisiones informadas.',
      link: '/indices/historico'
    },
    {
      icon: <AutoGraph />,
      title: 'Proyecciones',
      description: 'Proyecciones de precios y volatilidades futuras.',
      link: '/indices/proyecciones'
    },
    {
      icon: <Functions />,
      title: 'Funciones',
      description: 'Funciones personalizadas para optimizar tus estrategias de inversión.',
      link: '/indices/funciones'
    },
    {
      icon: <Sync />,
      title: 'Conversor',
      description: 'Conversor de divisas y monedas para facilitar tus operaciones.',
      link: '/indices/conversor'
    }
  ];
  return (
    <Box ref={containerRef} sx={{
      height: '100%', display: 'flex', flexDirection: 'column', width: '100%', overflow: 'auto', backgroundColor: 'background.default',
      // Fondo de Puntos
      backgroundImage: `radial-gradient(circle at 1px 1px, ${theme.palette.primary.light} 1px, transparent 0)`,
      backgroundSize: '40px 40px'
    }}>
      {/* Header */}
      <Box sx={{
        backgroundColor: isScrolled ? 'background.default' : 'transparent',
        //borderBottom: isScrolled ? `1px solid ${theme.palette.divider}` : 'none',
        position: 'fixed',
        top: 0,
        zIndex: 10,
        width: '100%',
        transition: 'all 0.3s ease-in-out' // Agrega una transición suave
      }}>

        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 2, px: 3

        }}>
          <VentumLogo onClick={() => navigate('/')} size="medium" />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="text"
              startIcon={<GitHub />}
              href="https://github.com/your-username/ventum-framework"
              target="_blank"
              sx={{ display: { xs: 'none', sm: 'flex' }, textTransform: 'none' }}
            >
              GitHub
            </Button>
            <FormControlLabel

              control={<MaterialUISwitch sx={{ m: 1 }} checked={mode === 'dark'} onChange={toggleColorMode} />}
              label=""
            />
          </Box>
        </Box>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{
        pt: 18, pb: 6,
        //backgroundColor: 'background.default',
        // Fondo de Puntos
        // backgroundImage: `radial-gradient(circle at 1px 1px, ${theme.palette.primary.light} 1px, transparent 0)`,
        // backgroundSize: '30px 30px'

        //Fondo Cuadricula redondeada
        //       backgroundImage: `
        //   linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
        //   linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
        // `,
        // backgroundSize: '70px 70px'

      }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <FadeInAnimation><Typography
            variant="h1"
            component="h1"
            sx={{
              fontWeight: 'bold',
              color: 'text.primary',
              mb: 2,
              fontSize: { xs: '2.5rem', md: '3.5rem' }
            }}
          >
            Tableros de Indicadores
            <Box component="span" sx={{ color: 'primary.main', display: 'block' }}>

              Para Todos
            </Box>
          </Typography>
          </FadeInAnimation>
          <FadeInAnimation delay={0.3}><Typography
            variant="h6"
            sx={{
              color: 'text.secondary',
              mb: 4,
              maxWidth: '600px',
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            Compartimos los indicadores que utilizamos en nuestros proyectos junto con herramientas de proyección y conversión de monedas.
          </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'center' }}
            >
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/indices/historico')}
                endIcon={<ArrowForward />}
                sx={{ px: 4, py: 1.5, textTransform: 'none', borderRadius: '10px' }}
              >
                Ver
              </Button>
            </Stack>
          </FadeInAnimation>
        </Box>

        {/* Features Grid */}
        <Box sx={{
          mt: 4,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' }, // Columna en móvil, fila en desktop
          flexWrap: 'wrap', // Permite que las cards se envuelvan
          alignItems: 'stretch',
          gap: 6 // Espacio entre cards
        }}>
          {features.map((feature, index) => (
            <Box
              key={'card-indexes-' + index}
              sx={{
                width: { xs: '100%', sm: 'calc(50% - 24px)' }, // 100% en móvil, 50% menos gap en desktop
                minWidth: { xs: '100%', sm: 'calc(50% - 24px)' },
                minHeight: '100%',
              }}
            >

              <Card
                sx={{
                  width: '100%',
                  height: '100%',
                  // height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 0
                  },
                  boxShadow: 0,
                  cursor: 'pointer'
                }}
                onClick={() => navigate(feature.link)}
              >
                <FadeInAnimation delay={index * 0.2}><CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box sx={{
                    display: 'inline-flex',
                    p: 2,
                    boxShadow: `4px 4px 4px ${mode === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)'}`,
                    borderRadius: '50%',
                    backgroundColor: 'primary.light',
                    color: 'primary.contrastText',
                    mb: 2
                  }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" component="h3" sx={{ mb: 1, fontWeight: 'bold' }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>


                </CardContent>
                </FadeInAnimation>
              </Card>

            </Box>
          ))}
        </Box>
      </Container>
      <Divider sx={{ mb: 4, width: '50%', mx: 'auto' }} />


      {/* Indexes Stack Section */}
      <Box sx={{ backgroundColor: 'background.default', py: 8 }}>
        <Container maxWidth="lg" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

          <Box sx={{ textAlign: 'center' }}>
            <FadeInAnimation>
              <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', mb: 2 }}>
                Indicadores con actualización diaria
              </Typography>
            </FadeInAnimation>
            <FadeInAnimation delay={0.2}>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto' }}>
                Monitoreá los principales indicadores económicos actualizados al instante
              </Typography>
            </FadeInAnimation>
          </Box>

          <Grid container spacing={4} sx={{ justifyContent: 'center' }}>
            <Grid xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Dolar Oficial
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Compra - Venta
                </Typography>
              </Box>
            </Grid>
            <Grid xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Dolar MEP
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Compra - Venta
                </Typography>
              </Box>
            </Grid>
            <Grid xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  CAC
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Lag de 2 meses
                </Typography>
              </Box>
            </Grid>
            <Grid xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  UVA
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Actualización diaria
                </Typography>
              </Box>
            </Grid>
            <Grid xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  CPI
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Inflación EEUU
                </Typography>
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="text"
              onClick={() => navigate('/indices/historico')}
              endIcon={<TrendingUp />}
              sx={{ textTransform: 'none' }}
            >
              <AnimatedBorder>Ver todos los indicadores</AnimatedBorder>
            </Button>
          </Box>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ backgroundColor: 'background.paper', color: 'text.primary', py: 8 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <FadeInAnimation>
              <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', mb: 2 }}>
                Datos Confiables, Decisiones Inteligentes
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto' }}>
                Plataforma limpia y enfocada en los datos, sin distracciones. Perfecto para:
              </Typography>
            </FadeInAnimation>
          </Box>

          <Grid container spacing={4} alignItems="center" justifyContent="center">

            <Box sx={{
              mt: 4,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' }, // Columna en móvil, fila en desktop
              flexWrap: 'wrap', // Permite que las cards se envuelvan
              alignItems: 'stretch',
              width: { xs: '100%', sm: 'calc(60%)' },
              gap: 6, // Espacio entre cards
              px: { xs: 5, sm: 0 }
            }}>
              
              {[
                'Inversores particulares',
                'Analistas financieros',
                'Estudiantes de economía',
                'Empresas importadoras/exportadoras'
              ].map((item, idx) => (
                <Box
                  key={'card-indexes-' + idx}
                  sx={{
                    width: { xs: '100%', sm: 'calc(50% - 24px)' }, // 100% en móvil, 50% menos gap en desktop
                    minWidth: { xs: '100%', sm: 'calc(50% - 24px)' },
                    minHeight: '100%', display: 'flex', alignItems: 'center',  flexDirection: 'row',
                     transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 0
                  },
                  }}
                >
                  <ArrowForwardIos sx={{ fontSize: 16, color: 'primary.main', mr: 2 }} />
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}

            </Box>
          </Grid>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ backgroundColor: 'background.paper', py: 4 }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: 'flex',
            // justifyContent: 'space-between',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: { xs: 'column' },
            gap: 2
          }}>
            <VentumLogo variant={mode === 'dark' ? 'light' : 'dark'} onClick={() => navigate('/')} size="medium" />
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              © {new Date().getFullYear()} Ventum Framework. Built for developers, by developers.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;