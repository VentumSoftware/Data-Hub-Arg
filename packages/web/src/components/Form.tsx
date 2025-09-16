// components/Form.tsx
import React, { useState } from 'react';
import { Box, TextField, Button, Typography, FormControl, FormControlLabel, FormLabel, Select, MenuItem, InputLabel, Tooltip, Popover, InputAdornment, IconButton, Switch } from '@mui/material';
//import { HexColorPicker, HexColorInput } from "react-colorful";
//import { ColorPicker, useColor } from "react-color-palette";
import ColorPicker from 'react-pick-color';
import { Edit, Abc, Delete, UploadFile, HelpOutline } from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { getContrastColor } from '../lib';
import dayjs from 'dayjs';
type SelectOption = {
  value: (string | number);
  label: string;
}
type SchemaField = {
  type: 'string' | 'number' | 'text' | 'boolean' | 'select' | 'chromepicker' | 'multiple-items' | 'file' | 'date';
  title: string;
  default?: any;
  width?: string | number | object;
  enum?: SelectOption[]; // valores para un select
  sampleColor?: any,
  properties?: { [key: string]: SchemaField }; // SOLO para type: 'multiple-items'
  limitItems?: number
  disabled?: boolean
  helperText?: string
};

export type Schema = {
  type: 'object';
  required?: string[];
  width?: string | number | object;
  properties: {
    [key: string]: SchemaField;
  };
  title?: string;
  SaveButton?: React.ReactNode
};

export type UiSchema = {
  [key: string]: {
    'ui:widget'?: string;
  };
};

export type FormProps = {
  schema: Schema;
  uiSchema?: UiSchema;
  onSubmit: (data: { formData: any }) => void;
  onError?: (errors: string[]) => void;
  width?: string;
};

const Form: React.FC<FormProps> = ({
  schema,
  uiSchema = {},
  onSubmit,
  onError,
  width = '100%',
}) => {
  const initialValues = Object.keys(schema.properties).reduce((acc, key) => {
    acc[key] = schema.properties[key].default ?? '';
    return acc;
  }, {} as Record<string, any>);
  const [formData, setFormData] = useState(initialValues);
  const [errors, setErrors] = useState<string[]>([]);
  const [colorPickers, setColorPickers] = useState<Record<string, HTMLElement | null>>({});
  const [loading, setLoading] = useState(false);
  const openColorPicker = (key: string, anchor: HTMLElement) => {
    setColorPickers(prev => ({ ...prev, [key]: anchor }));
  };

  const closeColorPicker = (key: string) => {
    setColorPickers(prev => ({ ...prev, [key]: null }));
  };
  const handleChange = (key: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [key]: schema.properties[key].type === 'number' ? parseFloat(value) || '' : value,
    }));
  };
  const handleFileChange = (key: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        [key]: file
      }));
    }
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const validationErrors: string[] = [];

    schema.required?.forEach(field => {
      if (formData[field] === '' || formData[field] === undefined) {
        validationErrors.push(`${field} es un campo obligatorio.`);
      }
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      onError?.(validationErrors);
      setLoading(false);
    } else {
      onSubmit({ formData });
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'block', gap: 2, width, mt: 1 }}>
      {Object.entries(schema.properties).map(([key, field]) => {
        const widget = uiSchema[key]?.['ui:widget'];
        // Dentro del .map de los campos:
        // 1. Soporte para select dinámico desde uiSchema.enumOptions
        switch (field.type) {
          case 'string':
          case 'number':
          case 'text':
            return (
              <TextField
                sx={{ width: field.width ? field.width : '100%', p: 1 }}
                key={key}
                disabled={field.disabled}
                label={field.title}
                type={field.type === 'number' ? 'number' : 'text'}
                multiline={field.type === 'text'}
                rows={field.type === 'text' ? 4 : 1}
                value={formData[key]}
                onChange={handleChange(key)}
                InputProps={{
                  startAdornment: (
                    <>
                      {widget === 'dollar' && <Typography sx={{ mr: 1 }}>$</Typography>}
                      {field.helperText && (
                        <InputAdornment position="start">
                          <Tooltip title={field.helperText} arrow>
                            <IconButton edge="start" size="small">
                              <HelpOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      )}
                    </>
                  ),
                }}
                fullWidth
              />
            );
          case 'select':
            return (
              <FormControl fullWidth key={key} sx={{ width: field.width ? field.width : '100%', p: 1 }} >
                {field.helperText && <Tooltip title={field.helperText} arrow>
                  <IconButton edge="start" size="small">
                    <HelpOutline fontSize="small" />
                  </IconButton>
                </Tooltip>}
                <InputLabel>{field.title}</InputLabel>
                <Select
                  disabled={field.disabled}
                  value={formData[key]}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  label={field.title}

                >
                  {(field.enum || []).map((option) => (
                    <MenuItem value={option.value} key={option.label + option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            );
          case 'chromepicker':
            return (
              <Box key={key} sx={{ width: field.width ? field.width : '100%', p: 1, position: 'relative' }}>
                <Typography>{field.helperText && <Tooltip title={field.helperText} arrow>
                  <IconButton edge="start" size="small">
                    <HelpOutline fontSize="small" />
                  </IconButton>
                </Tooltip>}{field.title}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {
                    field.sampleColor.type === 'text' ?
                      <Abc sx={{ color: formData[key], fontSize: 50 }} />
                      : <Box sx={{ width: 200, height: 50, backgroundColor: formData[key], fontWeight: 'bold', color: getContrastColor(formData[key]), display: 'flex', justifyContent: 'center', alignItems: 'center' }} children={<Abc sx={{ fontSize: 50 }} />} />}
                  <Typography>{formData[key]}</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => openColorPicker(key, e.currentTarget)}
                    disabled={field.disabled}
                  >
                    <Edit />
                  </Button>
                </Box>

                {colorPickers[key] && (
                  <Box
                    sx={{
                      position: 'relative',
                      borderRadius: 1,
                      p: 1,
                      width: '315px',
                      boxShadow: 3,
                    }}
                  >
                    <Box sx={{ display: 'block', justifyContent: 'flex-end', mt: 0, }}>
                      <Button size="small" onClick={() => closeColorPicker(key)} children={'x'} />
                      <ColorPicker
                        theme={{
                          background: 'grey',
                          inputBackground: 'lightgrey',
                          borderColor: 'grey',
                          borderRadius: '5px',
                          color: 'black',
                          width: '300px'
                        }}
                        color={formData[key]}
                        onChange={(color) => {
                          setFormData((prev) => ({ ...prev, [key]: color.hex }));
                        }}
                      />
                    </Box>
                  </Box>
                )}
              </Box>
            );
          case 'file':
            return (
              <Box key={key} sx={{ width: field.width ? field.width : '100%', p: 1 }}>
                <Typography gutterBottom>{field.helperText && <Tooltip title={field.helperText} arrow>
                  <IconButton edge="start" size="small">
                    <HelpOutline fontSize="small" />
                  </IconButton>
                </Tooltip>}{field.title}</Typography>
                {formData[key] instanceof File ?
                  <Box sx={{ mb: 1 }}>
                    <img
                      src={URL.createObjectURL(formData[key])}
                      alt={field.title}
                      style={{ maxHeight: 50, borderRadius: 0 }}
                    />
                  </Box>
                  : formData[key] ? <img src={formData[key]} style={{ height: 50 }} alt={`${field.title}`} /> : null}

                <label htmlFor={`file-upload-${key}-${field.title}`}>
                  <input
                    id={`file-upload-${key}-${field.title}`}
                    type="file"
                    accept="*/*"
                    disabled={field.disabled}
                    style={{ display: 'none' }}
                    onChange={handleFileChange(key)}
                  />
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<UploadFile />}
                  >
                    {formData[key] ? 'Cambiar archivo' : 'Subir archivo'}
                  </Button>
                </label>

                {/* Nombre del archivo si ya está cargado */}
                {formData[key] instanceof File && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Archivo cargado: {(formData[key] as File).name}
                  </Typography>
                )}
              </Box>
            );
          case 'boolean':
            return (
              <FormControl fullWidth key={key + field} sx={{ width: field.width ? field.width : '100%', p: 1 }} >
                <FormLabel component="legend"> {field.helperText && <Tooltip title={field.helperText} arrow>
                  <IconButton edge="start" size="small">
                    <HelpOutline fontSize="small" />
                  </IconButton>
                </Tooltip>}{field.title}</FormLabel>

                <Switch
                  checked={formData[key]}
                  onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.checked }))}
                />
              </FormControl>
            )
          case 'date':
            return (
              <Box key={key} sx={{ borderRadius: 1, p: 1, mb: 2, width: field.width || '100%' }}>
                <Typography variant="subtitle1" gutterBottom>{field.helperText && <Tooltip title={field.helperText} arrow>
                  <IconButton edge="start" size="small">
                    <HelpOutline fontSize="small" />
                  </IconButton>
                </Tooltip>}{field.title}</Typography>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    disabled={field.disabled}
                    value={formData[key] ? dayjs(formData[key]) : null}
                    onChange={(newValue) => {
                      setFormData(prev => ({ ...prev, [key]: newValue }));
                    }}
                  />
                </LocalizationProvider>
              </Box>
            )
          case 'multiple-items':
            return (
              <Box key={key} sx={{ borderRadius: 1, p: 1, mb: 2, width: field.width || '100%' }}>

                <Typography variant="subtitle1" gutterBottom>{field.helperText && <Tooltip title={field.helperText} arrow>
                  <IconButton edge="start" size="small">
                    <HelpOutline fontSize="small" />
                  </IconButton>
                </Tooltip>}{field.title}</Typography>

                {(formData[key] || []).map((item: any, index: number) => (
                  <Box key={index} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1, width: field.width || '100%' }}>
                    {Object.entries(field.properties || {}).map(([subKey, subField]) => {

                      switch (subField.type) {
                        case 'select':
                          return (
                            <FormControl key={subKey + index + key + field + subField} sx={{ width: subField.width || 180, mb: 1 }}>
                              <InputLabel>{subField.title}</InputLabel>
                              <Select
                                disabled={subField.disabled}
                                value={item[subKey] || ''}
                                onChange={(e) => {
                                  const newItems = [...formData[key]];
                                  newItems[index] = {
                                    ...newItems[index],
                                    [subKey]: e.target.value
                                  };
                                  setFormData(prev => ({ ...prev, [key]: newItems }));
                                }}
                                label={subField.title}
                              >
                                {(subField.enum || []).map((opt) => (
                                  <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )
                        case 'string':
                        case 'number':
                        case 'text':

                          return (<FormControl sx={{ width: subField.width || '90%', mb: 1 }} children={<TextField
                            key={subKey + index + key + field + subField}
                            disabled={subField.disabled}
                            label={subField.title}
                            type={subField.type === 'number' ? 'number' : 'text'}
                            multiline={subField.type === 'text'}
                            rows={subField.type === 'text' ? 4 : 1}
                            value={item[subKey] || ''}
                            onChange={(e) => {
                              const newItems = [...formData[key]];
                              newItems[index] = {
                                ...newItems[index],
                                [subKey]: e.target.value
                              };
                              setFormData(prev => ({ ...prev, [key]: newItems }));
                            }}
                            sx={{ width: '100%' }}
                          />} />)
                        case 'file':

                          return (
                            <Box key={subKey + index + key + field + subField} sx={{ padding: 0, width: (subField?.width || '100%'), mb: 1 }}>

                              {item[subKey] instanceof File ?
                                <Box sx={{ mb: 1 }}>
                                  <img
                                    src={URL.createObjectURL(item[subKey])}
                                    alt={field.title}
                                    style={{ maxHeight: 50, borderRadius: 0, width: '30%' }}
                                  />
                                </Box>
                                : typeof item[subKey] === 'string' && item[subKey].startsWith('http') ? (
                                  <img
                                    src={item[subKey]}
                                    alt={field.title}
                                    style={{ maxHeight: 50, borderRadius: 0, width: '30%' }}
                                  />
                                ) : null}

                              <input
                                id={`file-upload-${key}-${index}-${subKey}-${field}-${subField}-${subField.title}`}  // <-- ID único para cada item
                                type="file"
                                accept="*/*"
                                style={{ display: 'none' }}
                                disabled={subField.disabled}
                                onChange={(e) => {
                                  const newItems = [...formData[key]];
                                  // Crear una copia del objeto en lugar de modificarlo directamente
                                  newItems[index] = {
                                    ...newItems[index],
                                    [subKey]: e.target.files?.[0]
                                  };
                                  setFormData(prev => ({ ...prev, [key]: newItems }));
                                }}
                              />
                              <label htmlFor={`file-upload-${key}-${index}-${subKey}-${field}-${subField}-${subField.title}`}>
                                <Button
                                  disabled={subField.disabled}
                                  variant="outlined"
                                  component="span"
                                  startIcon={<UploadFile />}
                                  style={{ width: '70%' }}
                                >
                                  {item[subKey] ? 'Cambiar archivo' : 'Subir archivo'}
                                </Button>
                              </label>

                              {/* Nombre del archivo si ya está cargado */}
                              {item[subKey] instanceof File && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  Archivo cargado: {(item[subKey] as File).name}
                                </Typography>
                              )}
                            </Box>
                          );
                        case 'boolean':
                          return (
                            <FormControl fullWidth key={key + subKey} sx={{ width: subField.width ? subField.width : '100%', p: 1, mb: 1 }} >
                              <FormLabel component="legend"> {subField.helperText && <Tooltip title={subField.helperText} arrow>
                                <IconButton edge="start" size="small">
                                  <HelpOutline fontSize="small" />
                                </IconButton>
                              </Tooltip>}{subField.title}</FormLabel>

                              <Switch
                                checked={item[subKey]}
                                onChange={(e) => {
                                  const newItems = [...formData[key]];
                                  newItems[index] = {
                                    ...newItems[index],
                                    [subKey]: e.target.checked
                                  };
                                  setFormData(prev => ({ ...prev, [key]: newItems }));
                                }}
                              />
                            </FormControl>
                          )
                        default:
                          return (<Typography color='danger'>{subField.title}</Typography>)
                      }
                    })}
                    <Button
                      sx={{ width: '5%' }}
                      color="error" onClick={() => {
                        const newItems = [...formData[key]];
                        newItems.splice(index, 1);
                        setFormData(prev => ({ ...prev, [key]: newItems }));
                      }} children={<Delete />} />
                  </Box>))}


                {(!field?.limitItems || (formData[key]?.length ?? 0) < field.limitItems) && <Button
                  variant="outlined"
                  onClick={() => {
                    const newItem = Object.entries(field.properties || {}).reduce((acc, [subKey, subField]) => {
                      acc[subKey] = subField.default ?? '';
                      return acc;
                    }, {} as Record<string, any>);
                    const newItems = [...(formData[key] || []), newItem];
                    setFormData(prev => ({ ...prev, [key]: newItems }));
                  }}
                >
                  + Agregar
                </Button>}
              </Box>
            )

          default:
            <Typography color='danger'>{field.title}</Typography>
            break;
        }

      })}

      {
        errors.length > 0 && (
          <Box>
            {errors.map((err, idx) => (
              <Typography key={idx} color="error">
                {err}
              </Typography>
            ))}
          </Box>
        )
      }

      {schema.SaveButton ||<Button variant="contained" type="submit" sx={{ width: '98%', m: 1 }} >
        Guardar
      </Button>}
    </Box >
  );
};
export default (Form);
