import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import React, { useEffect, useState, useRef } from "react";
import {
    Avatar, Badge, Breadcrumbs, CardActions, CardContent, CardMedia, Collapse, CircularProgress, Dialog, DialogActions, DialogContent, Divider, IconButton, DialogContentText,
    DialogTitle, Stack, Tab, Tabs, TextField, Typography, Tooltip, Popper, Fade, Link, List, ListItem, ListItemButton, ListSubheader,
    ListItemIcon, ListItemText, ListItemAvatar
} from '@mui/material';
export const PopupIcon = ({ label, keyComponent, Icon }) => {
    const [anchorEl, setAnchorEl] = useState(null);

    const handlePopoverOpen = (event) => {
        setAnchorEl(event.currentTarget)
    };

    const handlePopoverClose = () => {
        setAnchorEl(null)
    };
    const open = Boolean(anchorEl);
    return (
        <Box key={keyComponent + label}>
            <Icon aria-owns={open ? label : undefined}
                aria-haspopup="true"
                onMouseEnter={handlePopoverOpen}
                onMouseLeave={handlePopoverClose}> </Icon>
            <Popover
                id={label}
                sx={{
                    pointerEvents: 'none',
                }}
                open={open}
                anchorEl={anchorEl}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                onClose={handlePopoverClose}
                disableRestoreFocus
            >
                <Typography sx={{ p: 1 }}>{label}</Typography>
            </Popover>
        </Box>
    )
};
