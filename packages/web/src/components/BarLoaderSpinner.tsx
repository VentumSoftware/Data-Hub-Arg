import { BarLoader } from 'react-spinners';
import {
    Accordion, AccordionActions, AccordionDetails, AccordionSummary, Autocomplete, Avatar, Badge, Box, Button, Breadcrumbs, Card, CardContent, Checkbox, Collapse, CircularProgress, Dialog, DialogActions, DialogContent, Divider, Grid, IconButton, DialogContentText,
    DialogTitle, FormControl, FormControlLabel, Stack, Tab, Tabs, TextField, Typography, Tooltip, Popper, Fade, Link, List, ListItem, ListItemButton, ListSubheader, InputLabel, MenuItem, Select,
    ListItemIcon, ListItemText, CardActions
} from '@mui/material';
const BarLoaderSpinner = ({width=200, height=6, color="#e0e0e0"}: {width?: number, height?: number, color?: string}) =>

     <Box sx={{ height: 'calc(100vh - 32px)', overflow: 'hidden', backgroundColor: 'transparent' }}><Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: 'calc(100% - 63px)' // Restamos la altura del Box superior
    }}>
        <BarLoader
            color={color}
            height={height}
            width={width}
        />
    </Box>   </Box>


export default BarLoaderSpinner