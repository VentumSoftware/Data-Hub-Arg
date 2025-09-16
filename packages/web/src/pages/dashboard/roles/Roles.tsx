import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Box, Button, Card, CardContent, Grid, Typography, Dialog, DialogActions, DialogContent, 
    DialogTitle, TextField, IconButton, List, ListItem, ListItemText, ListItemIcon,
    Accordion, AccordionSummary, AccordionDetails, FormControlLabel, Checkbox,
    CircularProgress, Divider, Chip, Stack, Alert, Tooltip, Breadcrumbs, Link
} from '@mui/material';
import {
    Add, Edit, Delete, Security, Assignment, ExpandMore, VpnKey, Save, Cancel,
    CheckBox, Person, Group, Description, Label
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';

const Roles = () => {
    const navigate = useNavigate();
    const { roleId } = useParams();
    
    // State management
    const [roles, setRoles] = useState([]);
    const [allPermissions, setAllPermissions] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    
    // Dialog states
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleFormData, setRoleFormData] = useState({
        name: '',
        label: '',
        description: '',
        group: 'custom'
    });
    const [selectedPermissions, setSelectedPermissions] = useState([]);

    useEffect(() => {
        fetchRolesAndPermissions();
    }, []);

    const fetchRolesAndPermissions = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const apiUrl = import.meta.env.VITE_API_URL;
            
            // Fetch all roles and permissions
            const [rolesResponse, permissionsResponse] = await Promise.all([
                fetch(`${apiUrl}/api/access/roles`, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                }),
                fetch(`${apiUrl}/api/access/permissions`, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                })
            ]);
            
            if (!rolesResponse.ok || !permissionsResponse.ok) {
                throw new Error('Failed to fetch roles and permissions');
            }
            
            const [rolesResult, permissionsResult] = await Promise.all([
                rolesResponse.json(),
                permissionsResponse.json()
            ]);
            
            setRoles(rolesResult.data || []);
            setAllPermissions(permissionsResult.data || []);
            
        } catch (err) {
            console.error('Fetch error:', err);
            setError(err.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    // Group permissions by category
    const groupedPermissions = allPermissions.reduce((groups, permission) => {
        const group = permission.group || 'general';
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(permission);
        return groups;
    }, {});

    const handleCreateRole = () => {
        setEditingRole(null);
        setRoleFormData({
            name: '',
            label: '',
            description: '',
            group: 'custom'
        });
        setSelectedPermissions([]);
        setRoleDialogOpen(true);
    };

    const handleEditRole = (role) => {
        setEditingRole(role);
        setRoleFormData({
            name: role.name || '',
            label: role.label || '',
            description: role.description || '',
            group: role.group || 'custom'
        });
        // TODO: Load role permissions when backend supports it
        setSelectedPermissions([]);
        setRoleDialogOpen(true);
    };

    const handleDeleteRole = async (role) => {
        if (!window.confirm(`¿Está seguro de que desea eliminar el rol "${role.label || role.name}"?`)) {
            return;
        }
        
        try {
            setSaving(true);
            const apiUrl = import.meta.env.VITE_API_URL;
            
            // TODO: Add DELETE endpoint for roles in backend
            const response = await fetch(`${apiUrl}/api/access/roles/${role.id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                await fetchRolesAndPermissions();
            } else {
                const error = await response.json();
                alert('Error al eliminar rol: ' + (error.message || 'Error desconocido'));
            }
        } catch (error) {
            console.error('Error deleting role:', error);
            alert('Error al eliminar rol');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveRole = async () => {
        try {
            setSaving(true);
            const apiUrl = import.meta.env.VITE_API_URL;
            
            const roleData = {
                ...roleFormData,
                permissions: selectedPermissions
            };
            
            const method = editingRole ? 'PUT' : 'POST';
            const url = editingRole 
                ? `${apiUrl}/api/access/roles/${editingRole.id}`
                : `${apiUrl}/api/access/roles`;
            
            // TODO: Add POST/PUT endpoints for roles in backend
            const response = await fetch(url, {
                method,
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(roleData)
            });
            
            if (response.ok) {
                setRoleDialogOpen(false);
                await fetchRolesAndPermissions();
            } else {
                const error = await response.json();
                alert('Error al guardar rol: ' + (error.message || 'Error desconocido'));
            }
        } catch (error) {
            console.error('Error saving role:', error);
            alert('Error al guardar rol');
        } finally {
            setSaving(false);
        }
    };

    const handlePermissionToggle = (permissionName, checked) => {
        if (checked) {
            setSelectedPermissions(prev => [...prev, permissionName]);
        } else {
            setSelectedPermissions(prev => prev.filter(p => p !== permissionName));
        }
    };

    // DataGrid columns for roles table
    const columns: GridColDef[] = [
        {
            field: 'name',
            headerName: 'Nombre',
            width: 150,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Security sx={{ mr: 1, color: 'primary.main', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {params.value}
                    </Typography>
                </Box>
            )
        },
        {
            field: 'label',
            headerName: 'Etiqueta',
            width: 200,
            renderCell: (params) => (
                <Typography variant="body2">
                    {params.value || params.row.name}
                </Typography>
            )
        },
        {
            field: 'description',
            headerName: 'Descripción',
            width: 300,
            renderCell: (params) => (
                <Typography variant="body2" color="text.secondary">
                    {params.value || 'Sin descripción'}
                </Typography>
            )
        },
        {
            field: 'group',
            headerName: 'Grupo',
            width: 120,
            renderCell: (params) => (
                <Chip 
                    size="small" 
                    label={params.value || 'general'}
                    color={params.value === 'system' ? 'primary' : 'default'}
                />
            )
        },
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Acciones',
            width: 100,
            getActions: (params) => [
                <GridActionsCellItem
                    icon={<Edit />}
                    label="Editar"
                    onClick={() => handleEditRole(params.row)}
                    disabled={saving}
                />,
                <GridActionsCellItem
                    icon={<Delete />}
                    label="Eliminar"
                    onClick={() => handleDeleteRole(params.row)}
                    disabled={saving || params.row.group === 'system'}
                />
            ],
        },
    ];

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    Error al cargar datos: {error}
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Breadcrumbs>
                    <Link 
                        color="inherit" 
                        href="/dashboard"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate('/dashboard');
                        }}
                    >
                        Dashboard
                    </Link>
                    <Typography color="textPrimary">Roles</Typography>
                </Breadcrumbs>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="h4" component="h1" sx={{ 
                        fontWeight: 700, 
                        display: 'flex', 
                        alignItems: 'center' 
                    }}>
                        <Security sx={{ mr: 2, color: 'primary.main' }} />
                        Gestión de Roles
                    </Typography>
                    
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={handleCreateRole}
                        disabled={saving}
                        sx={{ borderRadius: 2 }}
                    >
                        Crear Rol
                    </Button>
                </Box>
            </Box>

            {/* Roles Table */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        mb: 2 
                    }}>
                        <Assignment sx={{ mr: 1, color: 'info.main' }} />
                        Roles del Sistema ({roles.length})
                    </Typography>
                    
                    <Box sx={{ height: 400, width: '100%' }}>
                        <DataGrid
                            rows={roles}
                            columns={columns}
                            pageSize={10}
                            rowsPerPageOptions={[10, 25, 50]}
                            disableSelectionOnClick
                            sx={{ border: 'none' }}
                        />
                    </Box>
                </CardContent>
            </Card>

            {/* Role Creation/Edit Dialog */}
            <Dialog 
                open={roleDialogOpen} 
                onClose={() => !saving && setRoleDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                        <Security sx={{ mr: 1 }} />
                        {editingRole ? 'Editar Rol' : 'Crear Nuevo Rol'}
                    </Typography>
                </DialogTitle>
                
                <DialogContent>
                    <Grid container spacing={3}>
                        {/* Basic Role Information */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                                Información Básica
                            </Typography>
                        </Grid>
                        
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Nombre del Rol"
                                value={roleFormData.name}
                                onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                                disabled={saving}
                                required
                                helperText="Nombre único del rol (usado internamente)"
                            />
                        </Grid>
                        
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Etiqueta"
                                value={roleFormData.label}
                                onChange={(e) => setRoleFormData(prev => ({ ...prev, label: e.target.value }))}
                                disabled={saving}
                                helperText="Nombre visible del rol"
                            />
                        </Grid>
                        
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                rows={2}
                                label="Descripción"
                                value={roleFormData.description}
                                onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                                disabled={saving}
                                helperText="Descripción del propósito del rol"
                            />
                        </Grid>

                        {/* Permissions Assignment */}
                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" gutterBottom sx={{ 
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <VpnKey sx={{ mr: 1 }} />
                                Permisos del Rol ({selectedPermissions.length} seleccionados)
                            </Typography>
                        </Grid>

                        <Grid item xs={12}>
                            {Object.entries(groupedPermissions).map(([group, permissions]) => (
                                <Accordion key={group} sx={{ mb: 1 }}>
                                    <AccordionSummary expandIcon={<ExpandMore />}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                            {group.replace(/-/g, ' ')} ({permissions.length} permisos)
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Grid container spacing={1}>
                                            {permissions.map((permission) => (
                                                <Grid item xs={12} sm={6} md={4} key={permission.id}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={selectedPermissions.includes(permission.name)}
                                                                onChange={(e) => handlePermissionToggle(permission.name, e.target.checked)}
                                                                disabled={saving}
                                                                size="small"
                                                            />
                                                        }
                                                        label={
                                                            <Box>
                                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                                    {permission.label || permission.name}
                                                                </Typography>
                                                                {permission.description && (
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {permission.description}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        }
                                                        sx={{ alignItems: 'flex-start', width: '100%' }}
                                                    />
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </AccordionDetails>
                                </Accordion>
                            ))}
                        </Grid>
                    </Grid>
                </DialogContent>
                
                <DialogActions>
                    <Button 
                        onClick={() => setRoleDialogOpen(false)}
                        disabled={saving}
                        startIcon={<Cancel />}
                    >
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleSaveRole}
                        variant="contained"
                        disabled={saving || !roleFormData.name}
                        startIcon={saving ? <CircularProgress size={18} /> : <Save />}
                    >
                        {editingRole ? 'Actualizar' : 'Crear'} Rol
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Roles;