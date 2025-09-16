// components/Form.tsx
import React, { useState } from 'react';
import { Box, TextField, Button, Typography, FormControl, Select, MenuItem, InputLabel } from '@mui/material';
import ColorPicker from 'react-pick-color';



export type ColorProps = {
    value: string
    onChange: (data: string) => void;
    width?: string;
};

const ColorPick: React.FC<ColorProps> = ({
    onChange,
    value,
    width = '100%',
}) => {

    return (
        <Box sx={{ display: 'block', gap: 2, width }}>


            <ColorPicker
                theme={{
                    background: 'grey',
                    inputBackground: 'lightgrey',
                    borderColor: 'grey',
                    borderRadius: '5px',
                    color: 'black',
                    //width: '300px'
                }}
                color={value}
                onChange={(color) => { onChange(color.hex) }}
            />
        </Box>
    );
};
export default (ColorPick);
