import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  useTheme,
  IconButton,
  Stack
} from '@mui/material';
import {
  Code,
  Security,
  Speed,
  CloudDone,
  GitHub,
  Launch,
  ArrowForward
} from '@mui/icons-material';
import VentumLogo from '../../components/VentumLogo';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const features = [
    {
      icon: <Code />,
      title: 'Full-Stack Ready',
      description: 'Complete NestJS backend with React frontend, TypeScript throughout, and modern tooling setup.'
    },
    {
      icon: <Security />,
      title: 'Authentication Built-In',
      description: 'Google OAuth integration, session management, and role-based permissions system included.'
    },
    {
      icon: <Speed />,
      title: 'Fast Development',
      description: 'One-command setup with Docker Compose. Database migrations, seeding, and CDC audit trails ready.'
    },
    {
      icon: <CloudDone />,
      title: 'Production Ready',
      description: 'GitHub Actions CI/CD, multi-environment deployments, and comprehensive monitoring setup.'
    }
  ];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'grey.50' }}>
      {/* Header */}
      <Box sx={{
        backgroundColor: 'white',
        boxShadow: 1,
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 2
          }}>
            <VentumLogo size="medium" />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<GitHub />}
                href="https://github.com/your-username/ventum-framework"
                target="_blank"
                sx={{ display: { xs: 'none', sm: 'flex' } }}
              >
                GitHub
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/sign-in')}
                endIcon={<Launch />}
              >
                Get Started
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: 8, pb: 6, backgroundColor: 'grey.500' }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 'bold',
              color: 'text.primary',
              mb: 2,
              fontSize: { xs: '2.5rem', md: '3.5rem' }
            }}
          >
            Modern Web Development
            <Box component="span" sx={{ color: 'primary.main', display: 'block' }}>
              Made Simple
            </Box>
          </Typography>
          <Typography
            variant="h5"
            sx={{
              color: 'text.secondary',
              mb: 4,
              maxWidth: '600px',
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            A production-ready full-stack framework with authentication,
            permissions, file management, and deployment automation built-in.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'center' }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/sign-in')}
              endIcon={<ArrowForward />}
              sx={{ px: 4, py: 1.5 }}
            >
              Sign-In
            </Button>

          </Stack>
        </Box>

        {/* Features Grid */}
        <Grid container spacing={4} sx={{ mt: 4 }}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={12} md={12} key={index}>
              <Card
                sx={{
                  width: '100%',
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box sx={{
                    display: 'inline-flex',
                    p: 2,
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
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Tech Stack Section */}
      <Box sx={{ backgroundColor: 'grey.700', py: 8 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            component="h2"
            sx={{ textAlign: 'center', mb: 2, fontWeight: 'bold' }}
          >
            Built with Modern Technologiesssssss
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              mb: 6,
              maxWidth: '800px',
              mx: 'auto'
            }}
          >
            Enterprise-grade stack with TypeScript, Docker, PostgreSQL, and industry best practices
          </Typography>

          <Grid container spacing={4} sx={{ justifyContent: 'center' }}>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  NestJS
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Backend API
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  React
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Frontend UI
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  PostgreSQL
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Database
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Docker
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Containers
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  TypeScript
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Type Safety
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ backgroundColor: 'primary.main', color: 'grey.100', py: 8 }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography variant="h4" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
            Ready to Build Something Amazing?
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
            Get started with Ventum Framework and accelerate your development process.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/sign-in')}
            sx={{
              backgroundColor: 'white',
              color: 'primary.main',
              px: 4,
              py: 1.5,
              '&:hover': {
                backgroundColor: 'grey.100'
              }
            }}
            endIcon={<ArrowForward />}
          >
            Get Started Now
          </Button>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ backgroundColor: 'grey.900', color: 'white', py: 4 }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2
          }}>
            <VentumLogo variant="light" size="small" />
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              © 2024 Ventum Framework. Built for developers, by developers.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;