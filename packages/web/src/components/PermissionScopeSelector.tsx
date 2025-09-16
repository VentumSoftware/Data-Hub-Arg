import React, { useState, useEffect } from 'react';
import {
    Box, FormControl, InputLabel, Select, MenuItem, Chip, Typography,
    CircularProgress, Alert, Switch, FormControlLabel, Grid, Button,
    Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem,
    ListItemText, ListItemIcon, Checkbox, TextField, IconButton
} from '@mui/material';
import {
    Business, Apartment, Home, Group, Domain, LocationOn,
    Public, Lock, Search, Clear
} from '@mui/icons-material';

interface ScopeableEntity {
    type: string;
    label: string;
    description: string;
    table: string;
    icon: string;
    allowedPermissions: string[];
}

interface EntityInstance {
    id: number;
    display: string;
    type: string;
}

interface ScopeSettings {
    allowGlobalPermissions: boolean;
    scopeAllPermissions: boolean;
    defaultScopeType: string;
}

interface PermissionScope {
    type: string;
    id: number | null;
    label?: string;
}

interface PermissionScopeSelectorProps {
    permissionName: string;
    currentScope?: PermissionScope;
    onScopeChange: (scope: PermissionScope | null) => void;
    disabled?: boolean;
    compact?: boolean;
}

const iconMap = {
    business: <Business />,
    apartment: <Apartment />,
    home: <Home />,
    group: <Group />,
    domain: <Domain />,
    location_on: <LocationOn />,
    public: <Public />,
    lock: <Lock />
};

const PermissionScopeSelector: React.FC<PermissionScopeSelectorProps> = ({
    permissionName,
    currentScope,
    onScopeChange,
    disabled = false,
    compact = false
}) => {
    const [scopeableEntities, setScopeableEntities] = useState<ScopeableEntity[]>([]);
    const [scopeSettings, setScopeSettings] = useState<ScopeSettings | null>(null);
    const [selectedEntityType, setSelectedEntityType] = useState<string>('global');
    const [entityInstances, setEntityInstances] = useState<EntityInstance[]>([]);
    const [selectedInstance, setSelectedInstance] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingInstances, setLoadingInstances] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchScopeConfiguration();
    }, []);

    useEffect(() => {
        if (currentScope) {
            setSelectedEntityType(currentScope.type || 'global');
            setSelectedInstance(currentScope.id);
        }
    }, [currentScope]);

    useEffect(() => {
        if (selectedEntityType && selectedEntityType !== 'global') {
            fetchEntityInstances(selectedEntityType);
        } else {
            setEntityInstances([]);
            setSelectedInstance(null);
        }
    }, [selectedEntityType]);

    const fetchScopeConfiguration = async () => {
        try {
            setLoading(true);
            const apiUrl = import.meta.env.VITE_API_URL;
            
            const response = await fetch(`${apiUrl}/api/access/scope/entities`, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch scope configuration');
            }

            const result = await response.json();
            setScopeableEntities(result.data.entities || []);
            setScopeSettings(result.data.settings || null);
        } catch (err) {
            console.error('Error fetching scope configuration:', err);
            setError('Failed to load scope configuration');
        } finally {
            setLoading(false);
        }
    };

    const fetchEntityInstances = async (entityType: string) => {
        try {
            setLoadingInstances(true);
            const apiUrl = import.meta.env.VITE_API_URL;
            
            const response = await fetch(`${apiUrl}/api/access/scope/entities/${entityType}/instances`, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch entity instances');
            }

            const result = await response.json();
            setEntityInstances(result.data || []);
        } catch (err) {
            console.error('Error fetching entity instances:', err);
            setEntityInstances([]);
        } finally {
            setLoadingInstances(false);
        }
    };

    const handleEntityTypeChange = (type: string) => {
        setSelectedEntityType(type);
        if (type === 'global') {
            handleScopeChange(null);
        }
    };

    const handleInstanceSelect = (instanceId: number) => {
        setSelectedInstance(instanceId);
        const instance = entityInstances.find(i => i.id === instanceId);
        if (instance) {
            handleScopeChange({
                type: selectedEntityType,
                id: instanceId,
                label: instance.display
            });
        }
        setDialogOpen(false);
    };

    const handleScopeChange = (scope: PermissionScope | null) => {
        onScopeChange(scope);
    };

    const canPermissionBeScoped = (entityType: string): boolean => {
        const entity = scopeableEntities.find(e => e.type === entityType);
        if (!entity) return false;
        
        return entity.allowedPermissions.includes('*') || 
               entity.allowedPermissions.includes(permissionName);
    };

    const getEntityIcon = (iconName: string) => {
        return iconMap[iconName] || <Domain />;
    };

    const filteredInstances = entityInstances.filter(instance =>
        instance.display.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <CircularProgress size={20} />;
    }

    if (error) {
        return <Alert severity="error" sx={{ fontSize: '0.75rem' }}>{error}</Alert>;
    }

    if (!scopeSettings?.allowGlobalPermissions && selectedEntityType === 'global') {
        setSelectedEntityType(scopeSettings?.defaultScopeType || 'company');
    }

    const selectedEntity = scopeableEntities.find(e => e.type === selectedEntityType);
    const selectedInstanceObj = entityInstances.find(i => i.id === selectedInstance);

    if (compact) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedEntityType === 'global' ? (
                    <Chip
                        icon={<Public />}
                        label="Global"
                        size="small"
                        color="default"
                        onClick={() => !disabled && setDialogOpen(true)}
                    />
                ) : (
                    <Chip
                        icon={getEntityIcon(selectedEntity?.icon || 'domain')}
                        label={selectedInstanceObj ? selectedInstanceObj.display : selectedEntity?.label}
                        size="small"
                        color="primary"
                        onDelete={() => !disabled && handleEntityTypeChange('global')}
                        onClick={() => !disabled && setDialogOpen(true)}
                    />
                )}

                <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>
                        Seleccionar Alcance del Permiso
                    </DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Tipo de Entidad</InputLabel>
                                    <Select
                                        value={selectedEntityType}
                                        onChange={(e) => handleEntityTypeChange(e.target.value)}
                                        label="Tipo de Entidad"
                                    >
                                        {scopeSettings?.allowGlobalPermissions && (
                                            <MenuItem value="global">
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Public fontSize="small" />
                                                    Global (Sin restricción)
                                                </Box>
                                            </MenuItem>
                                        )}
                                        {scopeableEntities
                                            .filter(entity => canPermissionBeScoped(entity.type))
                                            .map(entity => (
                                                <MenuItem key={entity.type} value={entity.type}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        {getEntityIcon(entity.icon)}
                                                        {entity.label}
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {selectedEntityType !== 'global' && (
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder="Buscar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        InputProps={{
                                            startAdornment: <Search fontSize="small" sx={{ mr: 1 }} />,
                                            endAdornment: searchTerm && (
                                                <IconButton size="small" onClick={() => setSearchTerm('')}>
                                                    <Clear fontSize="small" />
                                                </IconButton>
                                            )
                                        }}
                                    />
                                    
                                    {loadingInstances ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                            <CircularProgress size={24} />
                                        </Box>
                                    ) : (
                                        <List sx={{ maxHeight: 300, overflow: 'auto', mt: 1 }}>
                                            {filteredInstances.map(instance => (
                                                <ListItem
                                                    key={instance.id}
                                                    button
                                                    selected={selectedInstance === instance.id}
                                                    onClick={() => handleInstanceSelect(instance.id)}
                                                >
                                                    <ListItemIcon>
                                                        <Checkbox
                                                            checked={selectedInstance === instance.id}
                                                            edge="start"
                                                        />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={instance.display}
                                                        secondary={`ID: ${instance.id}`}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    )}
                                </Grid>
                            )}
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button 
                            variant="contained" 
                            onClick={() => setDialogOpen(false)}
                            disabled={selectedEntityType !== 'global' && !selectedInstance}
                        >
                            Aplicar
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        );
    }

    return (
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                    <InputLabel>Alcance</InputLabel>
                    <Select
                        value={selectedEntityType}
                        onChange={(e) => handleEntityTypeChange(e.target.value)}
                        label="Alcance"
                        disabled={disabled}
                    >
                        {scopeSettings?.allowGlobalPermissions && (
                            <MenuItem value="global">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Public fontSize="small" />
                                    Global
                                </Box>
                            </MenuItem>
                        )}
                        {scopeableEntities
                            .filter(entity => canPermissionBeScoped(entity.type))
                            .map(entity => (
                                <MenuItem key={entity.type} value={entity.type}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getEntityIcon(entity.icon)}
                                        {entity.label}
                                    </Box>
                                </MenuItem>
                            ))}
                    </Select>
                </FormControl>
            </Grid>
            
            {selectedEntityType !== 'global' && (
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Instancia</InputLabel>
                        <Select
                            value={selectedInstance || ''}
                            onChange={(e) => handleInstanceSelect(e.target.value as number)}
                            label="Instancia"
                            disabled={disabled || loadingInstances}
                        >
                            {entityInstances.map(instance => (
                                <MenuItem key={instance.id} value={instance.id}>
                                    {instance.display}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
            )}
        </Grid>
    );
};

export default PermissionScopeSelector;