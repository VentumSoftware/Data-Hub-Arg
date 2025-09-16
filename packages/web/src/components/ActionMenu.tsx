import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, Typography } from '@mui/material';
import { MoreVert } from '@mui/icons-material';

interface MenuOption {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface ActionMenuProps {
  options: MenuOption[];
  icon?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export default function ActionMenu({ options, icon = <MoreVert />, size = 'small' }: ActionMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (onClick: () => void) => {
    onClick();
    handleClose();
  };

  return (
    <>
      <IconButton
        aria-label="menu de acciones"
        aria-controls={open ? 'action-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        size={size}
      >
        {icon}
      </IconButton>
      <Menu
        id="action-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'action-menu-button',
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {options.map((option, index) => (
          <MenuItem
            key={`${option.label}-${index}`}
            onClick={() => handleMenuItemClick(option.onClick)}
            disabled={option.disabled}
          >
            {option.icon && <ListItemIcon>{option.icon}</ListItemIcon>}
            <Typography variant="body2">{option.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};