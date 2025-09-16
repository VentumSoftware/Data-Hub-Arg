import { useState, useEffect, MouseEvent, useRef, useMemo, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { AppDispatch, RootState } from '../../store';
import { logOut } from '../../store/reducers/authSlice';
import { setPath, toggleDrawer } from '../../store/reducers/navSlice';
import { useNavigate, Outlet, useLocation, Routes, Route } from 'react-router-dom';
import { me } from "../../store/reducers/authSlice";

import {
  AppBar, Avatar, Box, Button, CssBaseline, Divider, Drawer as MuiDrawer, IconButton, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, MenuItem, Menu, Toolbar, Tooltip, Typography
} from '@mui/material';
import { Menu as MenuIcon, ChevronRight, ChevronLeft, DarkMode, LightMode, Notifications, Person, Folder, Security } from '@mui/icons-material';
import { useThemeContext } from '../../ThemeContext';
import { styled, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { stringToUrlFormat, getContrastColor } from "../../lib";
import { BarLoaderSpinner } from '../../components';
import SessionExpirationModal from '../../components/SessionExpirationModal';
import { useSessionMonitor } from '../../hooks/useSessionMonitor';
import { setSessionExpiration } from '../../utils/sessionStorage';
const { VITE_API_URL } = import.meta.env;
const { VITE_TEMPLATE_URL } = import.meta.env

const sidebarOptions = [
  { label: 'Usuarios', icon: <Person />, content: <Button />, path: '/dashboard/usuarios' },
  { label: 'Roles', icon: <Security />, content: <Button />, path: '/dashboard/roles' },
  { label: 'Archivos', icon: <Folder />, content: <Button />, path: '/dashboard/files' },
];
const MainDrawer = ({ children }: any) => {
  const navigate = useNavigate();
  const { toggleColorMode, mode } = useThemeContext();
  const dispatch: AppDispatch = useDispatch();
  const drawerWidth = 240;
  const topBarHeight = '64px';
  const openedMixin = (theme: any) => ({
    width: drawerWidth,
    transition: theme.transitions.create('width', { easing: theme.transitions.easing.sharp, duration: theme.transitions.duration.enteringScreen }),
    overflowX: 'hidden',
  });

  const closedMixin = (theme: any) => ({
    transition: theme.transitions.create('width', { easing: theme.transitions.easing.sharp, duration: theme.transitions.duration.leavingScreen }),
    overflowX: 'hidden',
    width: `calc(${theme.spacing(7)} + 1px)`,
    [theme.breakpoints.up('sm')]: { width: `calc(${theme.spacing(8)} + 1px)` },
  });

  const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', ...theme.mixins.toolbar
  }));

  const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }: any) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && { ...openedMixin(theme), '& .MuiDrawer-paper': openedMixin(theme) }),
    ...(!open && { ...closedMixin(theme), '& .MuiDrawer-paper': closedMixin(theme) }),
  }));

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const pathname = useLocation().pathname;

  const isDrawerOpen = useSelector((state: RootState) => state.nav.drawerOpen);
  const [mobileOpen, setMobileOpen] = useState(false); // para responsive

  const toggleDrawerDashboard = () => {
    if (isDesktop) dispatch(toggleDrawer(!isDrawerOpen));
    else setMobileOpen((prev) => !prev);
  };

  const drawerContent = (
    <>
      {/* <DrawerHeader>
          <IconButton onClick={toggleDrawer}>
            {theme.direction === 'rtl' ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>
        </DrawerHeader> */}
      <Divider />
      <List sx={{ paddingTop: isDesktop ? 0 : topBarHeight }}>
        {sidebarOptions.map((option, i) => {

          const NestedItem = ({ label, icon, path, childs, short }: any) => {
            const [openSubmenu, setOpenSubmenu] = useState(false);
            const handleClick = () => setOpenSubmenu(!openSubmenu);

            return <ListItem disablePadding sx={{ display: 'block' }}>
              <Tooltip children={<ListItemButton onClick={handleClick} sx={{ justifyContent: isDrawerOpen ? 'initial' : 'center' }} >
                <ListItemIcon sx={{ justifyContent: 'center', mr: isDrawerOpen ? 3 : 'auto' }}>
                  {option?.icon}
                </ListItemIcon>
                <ListItemText primary={label} sx={{ opacity: isDrawerOpen || !isDesktop ? 1 : 0 }} />
                {option?.open ? (isDrawerOpen ? <ExpandLess /> : <ExpandMore />) : null}
              </ListItemButton>} title={label} />

              <Collapse in={openSubmenu} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {childs?.map((child: any, childIndex: number) => {
                    const isActive = pathname === option.path;
                    const title = child?.label;
                    const shortTitle = child?.short || title.split(' ').map((w: string) => w[0].toUpperCase()).join('').slice(0, 3);
                    return <Tooltip title={isDrawerOpen ? null : title} key={childIndex}>
                      <ListItemButton
                        sx={{ pl: isDrawerOpen ? 6 : 2, backgroundColor: theme.palette.background.paperSecondary }}
                        key={childIndex}
                        onClick={() => navigate(`${child?.path}`)}>
                        <ListItemText primary={isDrawerOpen ? title : shortTitle} sx={{ opacity: isDrawerOpen || !isDesktop ? 1 : 1, color: isActive ? theme.palette.primary.main : null }} />
                      </ListItemButton>
                    </Tooltip>
                  })}
                </List>
              </Collapse>
            </ListItem>
          };

          const SimpleItem = ({ label, icon, path }: any) => {
            const isActive = pathname.startsWith(path);
            return <ListItem disablePadding sx={{ display: 'block' }} onClick={() => navigate(`${path}`)}>
              <Tooltip children={<ListItemButton sx={{ justifyContent: isDrawerOpen ? 'initial' : 'center' }}>
                <ListItemIcon sx={{ justifyContent: 'center', mr: isDrawerOpen ? 3 : 'auto', color: isActive ? theme.palette.primary.main : null }}>
                  {icon}
                </ListItemIcon>
                <ListItemText primary={label} sx={{ opacity: isDrawerOpen || !isDesktop ? 1 : 0, color: isActive ? theme.palette.primary.main : null }} />
              </ListItemButton>} title={label} />
            </ListItem>
          };

          return (option?.childs ? <NestedItem {...option} key={option?.label + i} /> : <SimpleItem {...option} key={option?.label + i} />);
        })}
      </List>
    </>
  );

  const UserAvatarMenuIcon = memo(() => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [avatarError, setAvatarError] = useState(false);
    const open = Boolean(anchorEl);
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const { picture: pictureURL, displayName } = useSelector((state: RootState) => state.auth.data);

    const handleClick = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    // Memoize the avatar component to prevent unnecessary re-renders and image refetches
    const avatarComponent = useMemo(() => (
      <Avatar 
        src={(!avatarError && pictureURL) ? pictureURL : undefined}
        onError={() => setAvatarError(true)}
      >
        {!pictureURL || avatarError ? displayName?.charAt(0)?.toUpperCase() : null}
      </Avatar>
    ), [pictureURL, displayName, avatarError]);

    const avatarButton = (<>
      <Tooltip title="Cuenta">
        <IconButton onClick={handleClick} size="small" sx={{ ml: 2 }}>
          {avatarComponent}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        //onClick={handleClose}
        PaperProps={{
          elevation: 3,
          sx: { mt: 1.5, minWidth: 180 },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleClose}>Perfil</MenuItem>
        <MenuItem onClick={handleClose}>Configuración</MenuItem>
        <MenuItem onClick={toggleColorMode}>
          {mode === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
          <IconButton size="small" sx={{ mr: 1 }}>
            {mode === 'light' ? <DarkMode /> : <LightMode />}
          </IconButton>
        </MenuItem>
        <MenuItem onClick={() => { dispatch(logOut()); navigate('/sign-in'); }}>Cerrar sesión</MenuItem>
      </Menu>
    </>);

    // En desktop, posición fija en esquina superior derecha
    if (isDesktop) {
      return (<Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1300 }}>
        {avatarButton}
      </Box>
      );
    }

    // En mobile, se inyecta en el AppBar (sin estilos fijos)
    return avatarButton;
  });

  function NotificationsIcon() {

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));


    const handleClick = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const avatarButton = (<>
      <Tooltip title="Notificaciones" >
        <IconButton onClick={handleClick} size='large' >
          <Notifications />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          elevation: 3,
          sx: { mt: 1.5, minWidth: 180 },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleClose}>Notificación 1</MenuItem>
        <MenuItem onClick={handleClose}>Notificación 2</MenuItem>
        <MenuItem onClick={handleClose}>Notificación 3</MenuItem>
        <MenuItem onClick={handleClose}>Notificación 4</MenuItem>
        <MenuItem onClick={handleClose}>Notificación 5</MenuItem>
      </Menu>
    </>);
    // En desktop, posición fija en esquina superior derecha
    if (isDesktop) {
      return (<Box sx={{ position: 'fixed', top: 16, right: 80, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {avatarButton}
      </Box>
      );
    }

    // En mobile, se inyecta en el AppBar (sin estilos fijos)
    return avatarButton;
  };
  //const company = useSelector((state: RootState) => state.myCompany.data.company);
  const companyName =  '';

  const logoPath = '';


  return (<Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', }}>
    <CssBaseline />
    {isDesktop ? (
      <Drawer variant="permanent" open={isDrawerOpen}>
        <NotificationsIcon />
        <UserAvatarMenuIcon />
        <DrawerHeader>
          {logoPath && isDrawerOpen ? <img src={logoPath} style={{ height: 50, maxWidth: '190px' }} alt="Logo de la empresa" /> : companyName && isDrawerOpen && <Typography variant="h6" noWrap>{companyName}</Typography>}
          <IconButton onClick={toggleDrawerDashboard}>
            {isDrawerOpen ? <ChevronLeft /> : <ChevronRight />}
          </IconButton>
        </DrawerHeader>
        {drawerContent}
      </Drawer>
    ) : (
      <>
        <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, height: topBarHeight }}>
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton color="inherit" edge="start" onClick={toggleDrawerDashboard} sx={{ mr: 2 }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" noWrap>Hybrid Drawer</Typography>
            </Box>

            <UserAvatarMenuIcon />
          </Toolbar>
        </AppBar>

        <MuiDrawer variant="temporary" open={mobileOpen} onClose={toggleDrawerDashboard} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: drawerWidth } }} >
          {drawerContent}
        </MuiDrawer>
      </>
    )}

    <Box component="main" sx={{ flexGrow: 1, p: 3, overflowY: 'auto', height: '100vh', }}>
      {/* <DrawerHeader /> */}
      {children}
    </Box>
  </Box>);
};
// Separate component for session monitoring to avoid re-rendering the entire Dashboard
const SessionMonitorWrapper = memo(() => {
  const {
    showWarning,
    timeRemaining,
    isExtending,
    extendSession,
    handleLogout
  } = useSessionMonitor({
    warningThreshold: 60, // Show warning at 60 seconds
    checkInterval: 1 // Check every second locally
  });

  return (
    <SessionExpirationModal
      open={showWarning}
      secondsRemaining={timeRemaining}
      onExtendSession={extendSession}
      onLogout={handleLogout}
    />
  );
});

const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  //const { toggleColorMode, mode } = useThemeContext();
  const dispatch: AppDispatch = useDispatch();
  const { data: auth } = useSelector((state: RootState) => state.auth);
  //const { company } = useSelector((state: RootState) => state.myCompany?.data);
  const hasFetchedSettings = useRef(false);
  useEffect(() => {
    if (!hasFetchedSettings.current) {
      //dispatch(getMyCompany());
      hasFetchedSettings.current = true;
    }
  }, [navigate, dispatch]);
  // const dispatch: AppDispatch = useDispatch();
  const { data } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Solo verifica autenticación si no hay datos de usuario
    if (!data.user) {
      dispatch(me());
    }
  }, [dispatch, data.user]);

  // Check for session expiration cookie and store it - runs periodically
  useEffect(() => {
    const getCookieValue = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
    };

    const checkForSessionCookie = () => {
      const sessionExpiresAt = getCookieValue('sessionExpiresAt');
      
      if (sessionExpiresAt) {
        // Validate the date string before storing
        const expirationDate = new Date(sessionExpiresAt);
        const isValidDate = !isNaN(expirationDate.getTime());
        
        if (isValidDate) {
          console.log('🍪 Processing session expiration cookie:', expirationDate.toLocaleString());
          setSessionExpiration(sessionExpiresAt);
          
          // Clear the cookie after reading (security best practice)
          document.cookie = 'sessionExpiresAt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          console.log('🗑️ Session expiration cookie cleared');
        } else {
          console.error('❌ Invalid session expiration cookie:', sessionExpiresAt);
        }
      }
    };

    // Initial check
    checkForSessionCookie();

    // Check for cookies periodically (every 5 seconds) to catch session refreshes
    const cookieCheckInterval = setInterval(checkForSessionCookie, 5000);

    return () => clearInterval(cookieCheckInterval);
  }, []);
  if (!auth?.email && false) {
    return (<div><BarLoaderSpinner /></div>)
  }

  return (
    <>
      <MainDrawer>
        <Box sx={{ paddingTop: 8 }}>
          <Outlet />
        </Box>
      </MainDrawer>
      
      {/* Session Expiration Warning Modal - isolated to prevent re-renders */}
      <SessionMonitorWrapper />
    </>
  );
};

export default Dashboard;


