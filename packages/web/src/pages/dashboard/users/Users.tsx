import React, { useEffect, useState, useRef, useMemo, useCallback, forwardRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
    Accordion, AccordionActions, AccordionDetails, AccordionSummary, Autocomplete, Avatar, Badge, Box, Button, Breadcrumbs, Card, CardContent, Checkbox, Collapse, CircularProgress, Dialog, DialogActions, DialogContent, Divider, Grid, IconButton, DialogContentText,
    DialogTitle, FormControl, FormControlLabel, Stack, Tab, Tabs, TextField, Typography, Tooltip, Popper, Fade, Link, List, ListItem, ListItemButton, ListSubheader, InputLabel, MenuItem, Select,
    ListItemIcon, ListItemText
} from '@mui/material';
import {
    AccessTime, Add, Api, AttachFile, Cancel, Check, CheckBox, Close, Circle, CreditCard, Comment, DataObject, Delete, Event, Error, ExpandLess, ExpandMore, FavoriteBorder, FormatListBulleted, HourglassEmpty,
    History, Notifications as NotificationIcon, LocalActivity, Person, RadioButtonChecked, RadioButtonUnchecked, Receipt, Refresh, Timeline, Edit, Note, MoreVert, Visibility, QrCode, Label, Source, Send,
    ReportProblem, WarningAmber, QuestionMark, VpnKey, Security, Group, Assignment,

} from '@mui/icons-material';
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid, GridToolbar, GridActionsCellItem, QuickFilter } from '@mui/x-data-grid';
import { getData, createUser, updateUser, deleteUser, getUserDetails, fetchUserHistory } from './UsersSlice';
import { RootState, AppDispatch } from '../../../store';
import { Form, DollarWidget, PerWidget, ActionMenu, JsonViewer } from '../../../components';
import PermissionScopeSelector from '../../../components/PermissionScopeSelector';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import { replaceAll } from "../../../lib";

type SelectOption = {
    value: (string | number);
    label: string;
}
type SchemaField = {
    type: 'string' | 'number' | 'boolean' | 'select' | 'chromepicker' | 'multiple-items' | 'file' | 'text' | 'date';
    title: string;
    default?: any;
    width?: string | number | object;
    enum?: SelectOption[]; // valores para un select
    sampleColor?: any,
    properties?: { [key: string]: SchemaField };
    limitItems?: number
    disabled?: boolean
    helperText?: string
};
type Schema = {
    type: 'object'; // literal
    required?: string[];
    properties: {
        [key: string]: SchemaField;
    };
};

const Users = () => {
    const pathname = (useLocation().pathname)?.split('/').filter(x => x !== '');
    const navigate = useNavigate();
    const theme = useTheme();
    const dispatch = useDispatch<AppDispatch>();
    const users = useSelector((state: RootState) => state.users.data.users);
    const fetched = useSelector((state: RootState) => state.users.fetched);
    const userDetails = useSelector((state: RootState) => state.users.userDetails.data);
    const userDetailsFetching = useSelector((state: RootState) => state.users.userDetails.fetching);
    const userDetailsError = useSelector((state: RootState) => state.users.userDetails.error);
    const [selectedRow, setSelectedRow] = useState(parseInt(pathname[2]) || null);
    const [actionsTab, setActionsTab] = useState(pathname[3] || null);
    const [openCreate, setOpenCreate] = useState(false);
    useEffect(() => {
        setSelectedRow(parseInt(pathname[2]) || null);
        const tab = pathname[3] || null;
        
        // Handle legacy routes - redirect to new unified routes
        if (tab === 'detalles' || tab === 'edicion' || tab === 'eliminacion') {
            navigate(`/dashboard/usuarios/${pathname[2]}/gestion`, { replace: true });
            setActionsTab('gestion');
        } else {
            setActionsTab(tab);
        }
    }, [pathname, navigate]);
    useEffect(() => {
        if (!fetched) {
            dispatch(getData());
        }
    }, [dispatch]); // users?.length fuera de las deps
    
    useEffect(() => {
        if (selectedRow && (actionsTab === 'gestion' || actionsTab === 'detalles' || actionsTab === 'edicion' || actionsTab === 'eliminacion')) {
            dispatch(getUserDetails(selectedRow));
        }
    }, [selectedRow, actionsTab, dispatch]);
    const userSchema: Schema = {
        type: 'object',
        required: ['amount', 'functionalUnitId', 'date'],
        properties: {
            email: { type: 'string', title: 'Email', helperText: 'El email debe ser único', default: '', },
            first: { type: 'string', title: 'Nombre', default: '' },
            lastName: { type: 'string', title: 'Apellido', default: '' },
            alias: { type: 'string', title: 'Alias', default: '' },
            gender: { type: 'select', title: 'Genero', default: '', enum: [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'O', label: 'Otro' }] },
            locale: { type: 'string', title: 'Localidad', default: '' },
            phone: { type: 'string', title: 'Telefono', default: '' },
            address: { type: 'string', title: 'Direccion', default: '' },
            company: { type: 'select', title: 'Empresa', default: '', enum: [] },
        },
    } as const;
    const CreateForm = ({ open, onClose, }: { open: boolean; onClose: () => void }) => {
        const [isSubmitting, setIsSubmitting] = useState(false);

        const handleSubmit = async ({ formData }: { formData: any }) => {
            setIsSubmitting(true);
            await dispatch(createUser({ ...formData }));
            setIsSubmitting(false);
            onClose();
        };

        return (<Dialog open={open} onClose={onClose}>
            <DialogTitle>Crear nuevo Usuario</DialogTitle>
            <DialogContent >
                <Form schema={userSchema} onSubmit={handleSubmit} />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpenCreate(false)}>Cancelar</Button>
            </DialogActions>
        </Dialog>)
    }
    const Table = () => {
        const [paginationModel, setPaginationModel] = useState({
            pageSize: 10,
            page: 0,
        });
        
        const [columnVisibilityModel, setColumnVisibilityModel] = useState({
            alias: false,
            phone: false,
            editedAt: false,
        });

        const loading = useSelector((state: RootState) => state.users.fetching > 0);
        const error = useSelector((state: RootState) => state.users.error);
        
        // Debug logging - Redux state
        const fullUsersState = useSelector((state: RootState) => state.users);
        console.log('=== USERS DEBUG ===');
        console.log('Full users state:', fullUsersState);
        console.log('Users data:', users);
        console.log('Users type:', typeof users);
        console.log('Users is array:', Array.isArray(users));
        console.log('Users length:', users?.length);
        console.log('First user:', users?.[0]);
        console.log('Loading:', loading);
        console.log('Error:', error);
        console.log('Fetched:', fetched);
        console.log('===================');

        if (error) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                    <Typography color="error">Error al cargar usuarios: {error}</Typography>
                </Box>
            );
        }

        // Show a message when no users are found and not loading
        if (!loading && users && users.length === 0) {
            return (
                <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                        <Person sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No hay usuarios registrados
                        </Typography>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                            Parece que no hay usuarios en el sistema aún.{' '}
                            {!fetched && 'Los datos se están cargando...'}
                        </Typography>
                        <Button 
                            variant="contained" 
                            startIcon={<Add />}
                            onClick={() => setOpenCreate(true)}
                        >
                            Crear Primer Usuario
                        </Button>
                    </Box>
                </Box>
            );
        }

        // Calculate user statistics
        const activeUsers = users?.filter(u => !u.isDeleted).length || 0;
        const inactiveUsers = users?.filter(u => u.isDeleted).length || 0;
        const totalUsers = users?.length || 0;

        return (
            <Box sx={{ width: '100%' }}>

                {/* DataGrid */}
                <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
                    <DataGrid
                    rows={users || []}
                    columns={[
                        { 
                            field: 'id', 
                            headerName: 'ID', 
                            width: 50,
                            align: 'center',
                            headerAlign: 'center'
                        },
                        {
                            field: 'profilePicture',
                            headerName: 'Avatar',
                            width: 60,
                            renderCell: (params) => (
                                <Box sx={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center' 
                                }}>
                                    <Avatar 
                                        src={params.row.profilePicture} 
                                        sx={{ width: 32, height: 32 }}
                                    >
                                        {params.row.firstName?.[0]}{params.row.lastName?.[0]}
                                    </Avatar>
                                </Box>
                            ),
                            sortable: false,
                            filterable: false
                        },
                        { 
                            field: 'email', 
                            headerName: 'Email', 
                            flex: 1.5,
                            minWidth: 150
                        },
                        { 
                            field: 'firstName', 
                            headerName: 'Nombre', 
                            flex: 0.8,
                            minWidth: 90 
                        },
                        { 
                            field: 'lastName', 
                            headerName: 'Apellido', 
                            flex: 0.8,
                            minWidth: 90 
                        },
                        { 
                            field: 'alias', 
                            headerName: 'Alias', 
                            flex: 0.6,
                            minWidth: 80,
                            renderCell: (params) => params.value ? `@${params.value}` : '-',
                            hideable: true
                        },
                        { 
                            field: 'phone', 
                            headerName: 'Teléfono', 
                            flex: 0.8,
                            minWidth: 100,
                            renderCell: (params) => params.value || '-',
                            hideable: true
                        },
                        { 
                            field: 'company', 
                            headerName: 'Empresa', 
                            flex: 0.8,
                            minWidth: 100,
                            valueGetter: (params) => {
                                // TODO: Fetch company name from company ID
                                return params?.row?.company ? `Empresa ${params.row.company}` : '-';
                            }
                        },
                        {
                            field: 'roles',
                            headerName: 'Roles',
                            flex: 1,
                            minWidth: 120,
                            renderCell: (params) => {
                                // Get actual roles from API response
                                const roles = params.row.roles?.map(role => role.label || role.name) || [];
                                
                                if (!roles || roles.length === 0) {
                                    return <span style={{ color: '#666' }}>Sin roles</span>;
                                }
                                
                                const displayText = roles.length > 2 
                                    ? `[${roles[0]}, ${roles[1]}, ...${roles.length - 2} más]`
                                    : `[${roles.join(', ')}]`;
                                
                                return (
                                    <Tooltip 
                                        title={
                                            <div>
                                                <Typography variant="subtitle2" style={{ marginBottom: 4 }}>
                                                    Roles del usuario:
                                                </Typography>
                                                {roles.map((role, index) => (
                                                    <div key={index} style={{ paddingLeft: 8 }}>
                                                        • {role}
                                                    </div>
                                                ))}
                                            </div>
                                        }
                                        arrow
                                        placement="top"
                                    >
                                        <span style={{ 
                                            cursor: 'help',
                                            color: '#1976d2',
                                            fontWeight: 500
                                        }}>
                                            {displayText}
                                        </span>
                                    </Tooltip>
                                );
                            }
                        },
                        {
                            field: 'permissions',
                            headerName: 'Permisos',
                            width: 80,
                            renderCell: (params) => {
                                // Get actual permissions from API response
                                const permissions = params.row.permissions || [];
                                
                                if (!permissions || permissions.length === 0) {
                                    return <span style={{ color: '#666' }}>0</span>;
                                }
                                
                                return (
                                    <Tooltip 
                                        title={
                                            <div>
                                                <Typography variant="subtitle2" style={{ marginBottom: 4 }}>
                                                    Permisos del usuario ({permissions.length}):
                                                </Typography>
                                                {permissions.map((permission, index) => (
                                                    <div key={index} style={{ paddingLeft: 8 }}>
                                                        • {permission.label || permission.name?.replace(/_/g, ' ') || 'Sin nombre'}
                                                    </div>
                                                ))}
                                            </div>
                                        }
                                        arrow
                                        placement="top"
                                    >
                                        <span style={{ 
                                            cursor: 'help',
                                            color: '#2e7d32',
                                            fontWeight: 600,
                                            backgroundColor: '#e8f5e8',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: '12px'
                                        }}>
                                            {permissions.length}
                                        </span>
                                    </Tooltip>
                                );
                            }
                        },
                        { 
                            field: 'isDeleted', 
                            headerName: 'Estado',
                            width: 90,
                            align: 'center',
                            headerAlign: 'center',
                            renderCell: (params) => (
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1, 
                                    justifyContent: 'center', 
                                    width: '100%',
                                    height: '100%'
                                }}>
                                    <Circle 
                                        sx={{ 
                                            color: params.value ? 'error.main' : 'success.main', 
                                            fontSize: 10 
                                        }} 
                                    />
                                    <Typography variant="body2">
                                        {params.value ? 'Inactivo' : 'Activo'}
                                    </Typography>
                                </Box>
                            )
                        },
                        { 
                            field: 'editedAt', 
                            headerName: 'Última Modificación', 
                            flex: 1,
                            minWidth: 140,
                            valueGetter: (params) => {
                                if (!params?.row?.editedAt) return '-';
                                return new Date(params.row.editedAt).toLocaleString('es-AR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            },
                            hideable: true
                        },
                        {
                            field: 'lastLogin',
                            headerName: 'Último login',
                            flex: 0.8,
                            minWidth: 110,
                            align: 'center',
                            headerAlign: 'center',
                            renderCell: (params) => {
                                const loginDate = params.row.lastSession?.createdAt;
                                
                                if (!loginDate) {
                                    return <span style={{ color: '#666' }}>Sin logins</span>;
                                }
                                
                                const now = new Date();
                                const diffInMs = now.getTime() - new Date(loginDate).getTime();
                                const diffInMinutes = Math.floor(diffInMs / 60000);
                                const diffInHours = Math.floor(diffInMinutes / 60);
                                const diffInDays = Math.floor(diffInHours / 24);
                                
                                let timeAgo;
                                let color = '#1976d2';
                                
                                if (diffInMinutes < 60) {
                                    timeAgo = `Hace ${diffInMinutes} min`;
                                    color = '#2e7d32';
                                } else if (diffInHours < 24) {
                                    timeAgo = `Hace ${diffInHours}h`;
                                    color = '#ed6c02';
                                } else if (diffInDays < 7) {
                                    timeAgo = `Hace ${diffInDays}d`;
                                    color = '#d32f2f';
                                } else {
                                    timeAgo = new Date(loginDate).toLocaleDateString('es-AR');
                                    color = '#666';
                                }
                                
                                return (
                                    <Tooltip 
                                        title={
                                            <div>
                                                <Typography variant="body2">
                                                    Último login: {new Date(loginDate).toLocaleString('es-AR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit'
                                                    })}
                                                </Typography>
                                            </div>
                                        }
                                        arrow
                                    >
                                        <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 0.5,
                                            cursor: 'help',
                                            width: '100%',
                                            height: '100%'
                                        }}>
                                            <AccessTime sx={{ fontSize: 16, color }} />
                                            <Typography variant="body2" sx={{ color, fontWeight: 500 }}>
                                                {timeAgo}
                                            </Typography>
                                        </Box>
                                    </Tooltip>
                                );
                            }
                        },
                        {
                            field: 'lastActivity',
                            headerName: 'Última Actividad',
                            flex: 0.9,
                            minWidth: 120,
                            align: 'center',
                            headerAlign: 'center',
                            renderCell: (params) => {
                                // Get actual last session data from API response
                                const lastSessionDate = params.row.lastSessionDate || params.row.lastSession?.createdAt;
                                
                                if (!lastSessionDate) {
                                    return <span style={{ color: '#666' }}>Sin sesiones</span>;
                                }
                                
                                const now = new Date();
                                const diffInMs = now.getTime() - new Date(lastSessionDate).getTime();
                                const diffInMinutes = Math.floor(diffInMs / 60000);
                                const diffInHours = Math.floor(diffInMinutes / 60);
                                const diffInDays = Math.floor(diffInHours / 24);
                                
                                let timeAgo;
                                let color = '#1976d2'; // Default blue
                                
                                if (diffInMinutes < 2) {
                                    timeAgo = 'En línea';
                                    color = '#2e7d32'; // Green
                                } else if (diffInMinutes < 15) {
                                    timeAgo = `Hace ${diffInMinutes} min`;
                                    color = '#2e7d32'; // Green - Recent activity
                                } else if (diffInMinutes < 60) {
                                    timeAgo = `Hace ${diffInMinutes} min`;
                                    color = '#ed6c02'; // Orange - Within the hour
                                } else if (diffInHours < 24) {
                                    timeAgo = `Hace ${diffInHours}h`;
                                    color = '#ed6c02'; // Orange - Today
                                } else if (diffInDays < 7) {
                                    timeAgo = `Hace ${diffInDays}d`;
                                    color = '#d32f2f'; // Red - This week
                                } else {
                                    timeAgo = new Date(lastSessionDate).toLocaleDateString('es-AR');
                                    color = '#666'; // Gray - Old
                                }
                                
                                return (
                                    <Tooltip 
                                        title={
                                            <div>
                                                <Typography variant="body2">
                                                    Última actividad: {new Date(lastSessionDate).toLocaleString('es-AR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit'
                                                    })}
                                                </Typography>
                                            </div>
                                        }
                                        arrow
                                    >
                                        <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 0.5,
                                            cursor: 'help',
                                            width: '100%',
                                            height: '100%'
                                        }}>
                                            <AccessTime sx={{ fontSize: 16, color }} />
                                            <Typography variant="body2" sx={{ color, fontWeight: 500 }}>
                                                {timeAgo}
                                            </Typography>
                                        </Box>
                                    </Tooltip>
                                );
                            }
                        },
                        {
                            field: 'actions',
                            headerName: 'Acciones',
                            width: 80,
                            sortable: false,
                            filterable: false,
                            renderCell: (params) => (
                                <ActionMenu 
                                    options={[
                                        { 
                                            label: 'Ver Detalles', 
                                            onClick: () => navigate(`/dashboard/usuarios/${params.row.id}/gestion`)
                                        },
                                        { 
                                            label: 'Ver Actividad', 
                                            onClick: () => navigate(`/dashboard/usuarios/${params.row.id}/actividad`)
                                        },
                                        { 
                                            label: 'Gestionar Permisos', 
                                            onClick: () => navigate(`/dashboard/usuarios/${params.row.id}/permisos`)
                                        },
                                    ]} 
                                />
                            ),
                        },
                    ]}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={setColumnVisibilityModel}
                    pageSizeOptions={[10, 25, 50, 100]}
                    checkboxSelection
                    disableRowSelectionOnClick
                    getRowId={(row) => row.id}
                    loading={loading}
                    slots={{ 
                        toolbar: GridToolbar 
                    }}
                    slotProps={{
                        toolbar: {
                            showQuickFilter: true,
                            quickFilterProps: { debounceMs: 500 },
                        },
                    }}
                    sx={{
                        '& .MuiDataGrid-cell:focus': {
                            outline: 'none',
                        },
                        '& .MuiDataGrid-row:hover': {
                            backgroundColor: 'action.hover',
                        },
                        '& .MuiDataGrid-columnHeaders': {
                            backgroundColor: 'background.paper',
                            borderBottom: 2,
                            borderColor: 'divider',
                        },
                    }}
                    localeText={{
                        toolbarDensity: 'Densidad',
                        toolbarColumns: 'Columnas',
                        toolbarFilters: 'Filtros',
                        toolbarExport: 'Exportar',
                        toolbarQuickFilterPlaceholder: 'Buscar...',
                        toolbarQuickFilterLabel: 'Buscar',
                        toolbarQuickFilterDeleteIconLabel: 'Limpiar',
                    }}
                />
                </Box>
            </Box>
        );
    };
    const RowActions = () => {
        const row = users?.find(user => user.id === selectedRow);
        const handleChange = (event: React.SyntheticEvent, newValue: string) => navigate((`/dashboard/usuarios/${row?.id}/${newValue}`));
        // Componente Unificado de Gestión de Usuario
        const GestionUsuario = () => {
            const [isEditing, setIsEditing] = useState(false);
            const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
            const [editFormData, setEditFormData] = useState({});
            const [isSubmitting, setIsSubmitting] = useState(false);

            if (userDetailsFetching) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <CircularProgress />
                    </Box>
                );
            }

            if (userDetailsError) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <Typography color="error">Error: {userDetailsError}</Typography>
                    </Box>
                );
            }

            if (!userDetails) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <Typography>No se encontraron detalles del usuario</Typography>
                    </Box>
                );
            }

            const { user, roles = [], groups = [], permissions = [], summary = {} } = userDetails.data || {};

            // Initialize form data when entering edit mode
            const handleEditClick = () => {
                setEditFormData({
                    email: user?.email || '',
                    firstName: user?.firstName || '',
                    lastName: user?.lastName || '',
                    alias: user?.alias || '',
                    gender: user?.gender || '',
                    locale: user?.locale || '',
                    phone: user?.phone || '',
                    address: user?.address || '',
                    company: user?.company || '',
                });
                setIsEditing(true);
            };

            const handleSave = async () => {
                setIsSubmitting(true);
                try {
                    await dispatch(updateUser({
                        userId: user.id,
                        data: editFormData
                    }));
                    
                    // Refresh the user details to show updated data
                    await dispatch(getUserDetails(user.id));
                    
                    // Also refresh the users list to show updated data in the table
                    await dispatch(getData());
                    
                    setIsEditing(false);
                } catch (error) {
                    console.error('Error updating user:', error);
                } finally {
                    setIsSubmitting(false);
                }
            };

            const handleCancel = () => {
                setIsEditing(false);
                setEditFormData({});
            };

            const handleDelete = async () => {
                await dispatch(deleteUser({ userId: user.id }));
                setShowDeleteConfirm(false);
                // Navigate back to users list
                navigate('/dashboard/usuarios');
            };

            const handleFormChange = (field, value) => {
                setEditFormData(prev => ({
                    ...prev,
                    [field]: value
                }));
            };

            return (
                <>
                <Box sx={{ position: 'relative' }}>
                    {/* Action Buttons */}
                    <Box sx={{ 
                        position: 'sticky', 
                        top: 0, 
                        zIndex: 10, 
                        bgcolor: 'background.paper', 
                        p: 2, 
                        borderBottom: 1, 
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                            <Person sx={{ mr: 1 }} />
                            Gestión de Usuario - {user?.firstName} {user?.lastName}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {!isEditing ? (
                                <>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Edit />}
                                        onClick={handleEditClick}
                                    >
                                        Editar
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<Delete />}
                                        onClick={() => setShowDeleteConfirm(true)}
                                    >
                                        Eliminar
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="contained"
                                        startIcon={<Check />}
                                        onClick={handleSave}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? <CircularProgress size={20} /> : 'Guardar'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Cancel />}
                                        onClick={handleCancel}
                                        disabled={isSubmitting}
                                    >
                                        Cancelar
                                    </Button>
                                </>
                            )}
                        </Box>
                    </Box>

                    <Stack spacing={3} sx={{ p: 3 }}>
                        {/* User Profile Section - Full Width */}
                        <Card>
                            <CardContent sx={{ py: 3 }}>
                                <Grid container spacing={3} alignItems="center">
                                    {/* Avatar and Basic Info */}
                                    <Grid item xs={12} sm={6} md={4} lg={3}>
                                        <Box sx={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            alignItems: 'center',
                                            textAlign: 'center'
                                        }}>
                                            <Avatar
                                                src={user?.profilePicture}
                                                sx={{ 
                                                    width: 100, 
                                                    height: 100, 
                                                    mb: 2,
                                                    boxShadow: 3
                                                }}
                                            >
                                                {user?.firstName?.[0]}{user?.lastName?.[0]}
                                            </Avatar>
                                            
                                            {!isEditing ? (
                                                <>
                                                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                                                        {user?.firstName} {user?.lastName}
                                                    </Typography>
                                                    {user?.alias && (
                                                        <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                            @{user.alias}
                                                        </Typography>
                                                    )}
                                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                        {user?.email}
                                                    </Typography>
                                                    <Box sx={{ 
                                                        display: 'flex', 
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        mt: 1
                                                    }}>
                                                        <Circle sx={{ 
                                                            fontSize: 12, 
                                                            color: user?.isDeleted ? 'error.main' : 'success.main' 
                                                        }} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {user?.isDeleted ? 'Inactivo' : 'Activo'}
                                                        </Typography>
                                                    </Box>
                                                </>
                                            ) : (
                                                <Stack spacing={2} sx={{ width: '100%' }}>
                                                    <TextField
                                                        label="Nombre"
                                                        value={editFormData.firstName || ''}
                                                        onChange={(e) => handleFormChange('firstName', e.target.value)}
                                                        fullWidth
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                    <TextField
                                                        label="Apellido"
                                                        value={editFormData.lastName || ''}
                                                        onChange={(e) => handleFormChange('lastName', e.target.value)}
                                                        fullWidth
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                    <TextField
                                                        label="Alias"
                                                        value={editFormData.alias || ''}
                                                        onChange={(e) => handleFormChange('alias', e.target.value)}
                                                        fullWidth
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                    <TextField
                                                        label="Email"
                                                        value={editFormData.email || ''}
                                                        onChange={(e) => handleFormChange('email', e.target.value)}
                                                        fullWidth
                                                        size="small"
                                                        variant="outlined"
                                                        type="email"
                                                    />
                                                </Stack>
                                            )}
                                        </Box>
                                    </Grid>

                                    {/* Personal Information */}
                                    <Grid item xs={12} sm={6} md={8} lg={9}>
                                        <Box>
                                            <Typography variant="h6" gutterBottom sx={{ 
                                                display: 'flex', 
                                                alignItems: 'center',
                                                mb: 2,
                                                fontWeight: 600
                                            }}>
                                                <Person sx={{ mr: 1, color: 'primary.main' }} />
                                                Información Personal
                                            </Typography>
                                            
                                            {!isEditing ? (
                                                <Grid container spacing={3}>
                                                    <Grid item xs={12} sm={6} md={4} lg={3}>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary" sx={{ 
                                                                textTransform: 'uppercase',
                                                                fontWeight: 600,
                                                                fontSize: '0.7rem'
                                                            }}>
                                                                ID del Usuario
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                                #{user?.id}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={4} lg={3}>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary" sx={{ 
                                                                textTransform: 'uppercase',
                                                                fontWeight: 600,
                                                                fontSize: '0.7rem'
                                                            }}>
                                                                Género
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                                {user?.gender === 'M' ? 'Masculino' : 
                                                                 user?.gender === 'F' ? 'Femenino' : 
                                                                 user?.gender === 'O' ? 'Otro' : 'No especificado'}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={4} lg={3}>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary" sx={{ 
                                                                textTransform: 'uppercase',
                                                                fontWeight: 600,
                                                                fontSize: '0.7rem'
                                                            }}>
                                                                Teléfono
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                                {user?.phone || 'No especificado'}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={4} lg={3}>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary" sx={{ 
                                                                textTransform: 'uppercase',
                                                                fontWeight: 600,
                                                                fontSize: '0.7rem'
                                                            }}>
                                                                Empresa
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                                {user?.company ? `Empresa ${user.company}` : 'Sin empresa'}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary" sx={{ 
                                                                textTransform: 'uppercase',
                                                                fontWeight: 600,
                                                                fontSize: '0.7rem'
                                                            }}>
                                                                Localidad
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                                {user?.locale || 'No especificada'}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary" sx={{ 
                                                                textTransform: 'uppercase',
                                                                fontWeight: 600,
                                                                fontSize: '0.7rem'
                                                            }}>
                                                                Dirección
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                                {user?.address || 'No especificada'}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    {user?.birthday && (
                                                        <Grid item xs={12} sm={6}>
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary" sx={{ 
                                                                    textTransform: 'uppercase',
                                                                    fontWeight: 600,
                                                                    fontSize: '0.7rem'
                                                                }}>
                                                                    Fecha de Nacimiento
                                                                </Typography>
                                                                <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                                    {new Date(user.birthday).toLocaleDateString()}
                                                                </Typography>
                                                            </Box>
                                                        </Grid>
                                                    )}
                                                    {user?.timezone && (
                                                        <Grid item xs={12} sm={6}>
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary" sx={{ 
                                                                    textTransform: 'uppercase',
                                                                    fontWeight: 600,
                                                                    fontSize: '0.7rem'
                                                                }}>
                                                                    Zona Horaria
                                                                </Typography>
                                                                <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                                    {user.timezone}
                                                                </Typography>
                                                            </Box>
                                                        </Grid>
                                                    )}
                                                </Grid>
                                            ) : (
                                                <Grid container spacing={2.5}>
                                                    <Grid item xs={12}>
                                                        <Box sx={{ 
                                                            p: 2, 
                                                            bgcolor: 'grey.50', 
                                                            borderRadius: 1,
                                                            border: '1px solid',
                                                            borderColor: 'grey.200'
                                                        }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ID del Usuario (no editable)
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                                #{user?.id}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <FormControl fullWidth size="small">
                                                            <InputLabel>Género</InputLabel>
                                                            <Select
                                                                value={editFormData.gender || ''}
                                                                label="Género"
                                                                onChange={(e) => handleFormChange('gender', e.target.value)}
                                                            >
                                                                <MenuItem value="M">Masculino</MenuItem>
                                                                <MenuItem value="F">Femenino</MenuItem>
                                                                <MenuItem value="O">Otro</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <TextField
                                                            label="Teléfono"
                                                            value={editFormData.phone || ''}
                                                            onChange={(e) => handleFormChange('phone', e.target.value)}
                                                            fullWidth
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <TextField
                                                            label="Localidad"
                                                            value={editFormData.locale || ''}
                                                            onChange={(e) => handleFormChange('locale', e.target.value)}
                                                            fullWidth
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <FormControl fullWidth size="small">
                                                            <InputLabel>Empresa</InputLabel>
                                                            <Select
                                                                value={editFormData.company || ''}
                                                                label="Empresa"
                                                                onChange={(e) => handleFormChange('company', e.target.value)}
                                                            >
                                                                <MenuItem value="">Sin empresa</MenuItem>
                                                                {/* TODO: Load companies from API */}
                                                            </Select>
                                                        </FormControl>
                                                    </Grid>
                                                    <Grid item xs={12}>
                                                        <TextField
                                                            label="Dirección"
                                                            value={editFormData.address || ''}
                                                            onChange={(e) => handleFormChange('address', e.target.value)}
                                                            fullWidth
                                                            size="small"
                                                            variant="outlined"
                                                            multiline
                                                            rows={2}
                                                            placeholder="Ingrese la dirección completa"
                                                        />
                                                    </Grid>
                                                </Grid>
                                            )}
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>

                        {/* Access Summary - Full Width */}
                        <Card>
                            <CardContent sx={{ pb: 3 }}>
                                <Typography variant="h6" gutterBottom sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    mb: 3,
                                    fontWeight: 600
                                }}>
                                    <Label sx={{ mr: 1, color: 'primary.main' }} />
                                    Resumen de Accesos
                                </Typography>
                                <Grid container spacing={2.5}>
                                    <Grid item xs={12} sm={4}>
                                        <Box sx={{ 
                                            textAlign: 'center', 
                                            p: 3, 
                                            bgcolor: 'primary.main', 
                                            borderRadius: 2,
                                            boxShadow: 2,
                                            '&:hover': {
                                                boxShadow: 4,
                                                transform: 'translateY(-2px)',
                                                transition: 'all 0.2s ease-in-out'
                                            }
                                        }}>
                                            <Typography variant="h3" color="primary.contrastText" sx={{ fontWeight: 700 }}>
                                                {summary.rolesCount || 0}
                                            </Typography>
                                            <Typography variant="body1" color="primary.contrastText" sx={{ 
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: 1
                                            }}>
                                                Roles
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Box sx={{ 
                                            textAlign: 'center', 
                                            p: 3, 
                                            bgcolor: 'secondary.main', 
                                            borderRadius: 2,
                                            boxShadow: 2,
                                            '&:hover': {
                                                boxShadow: 4,
                                                transform: 'translateY(-2px)',
                                                transition: 'all 0.2s ease-in-out'
                                            }
                                        }}>
                                            <Typography variant="h3" color="secondary.contrastText" sx={{ fontWeight: 700 }}>
                                                {summary.groupsCount || 0}
                                            </Typography>
                                            <Typography variant="body1" color="secondary.contrastText" sx={{ 
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: 1
                                            }}>
                                                Grupos
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Box sx={{ 
                                            textAlign: 'center', 
                                            p: 3, 
                                            bgcolor: 'success.main', 
                                            borderRadius: 2,
                                            boxShadow: 2,
                                            '&:hover': {
                                                boxShadow: 4,
                                                transform: 'translateY(-2px)',
                                                transition: 'all 0.2s ease-in-out'
                                            }
                                        }}>
                                            <Typography variant="h3" color="success.contrastText" sx={{ fontWeight: 700 }}>
                                                {summary.permissionsCount || 0}
                                            </Typography>
                                            <Typography variant="body1" color="success.contrastText" sx={{ 
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: 1
                                            }}>
                                                Permisos
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>

                        {/* Roles and Groups Row - Full Width */}
                        {(roles.length > 0 || groups.length > 0) && (
                            <Card>
                                <CardContent sx={{ pb: 3 }}>
                                    <Grid container spacing={3}>
                                        {/* Roles */}
                                        {roles.length > 0 && (
                                            <Grid item xs={12} md={6}>
                                                <Box>
                                                    <Typography variant="h6" gutterBottom sx={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center',
                                                        mb: 2,
                                                        fontWeight: 600
                                                    }}>
                                                        <DataObject sx={{ mr: 1, color: 'primary.main' }} />
                                                        Roles Asignados ({roles.length})
                                                    </Typography>
                                                    <List dense sx={{ 
                                                        '& .MuiListItem-root': {
                                                            px: 0,
                                                            py: 1
                                                        }
                                                    }}>
                                                        {roles.map((role: any, index: number) => (
                                                            <ListItem key={role.id} divider={index < roles.length - 1}>
                                                                <ListItemIcon sx={{ minWidth: 32 }}>
                                                                    <Box sx={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: '50%',
                                                                        bgcolor: 'primary.main'
                                                                    }} />
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={
                                                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                                            {role.label || role.name}
                                                                        </Typography>
                                                                    }
                                                                    secondary={
                                                                        role.description && (
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                {role.description}
                                                                            </Typography>
                                                                        )
                                                                    }
                                                                />
                                                            </ListItem>
                                                        ))}
                                                    </List>
                                                </Box>
                                            </Grid>
                                        )}

                                        {/* Groups */}
                                        {groups.length > 0 && (
                                            <Grid item xs={12} md={6}>
                                                <Box>
                                                    <Typography variant="h6" gutterBottom sx={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center',
                                                        mb: 2,
                                                        fontWeight: 600
                                                    }}>
                                                        <FormatListBulleted sx={{ mr: 1, color: 'secondary.main' }} />
                                                        Grupos ({groups.length})
                                                    </Typography>
                                                    <List dense sx={{ 
                                                        '& .MuiListItem-root': {
                                                            px: 0,
                                                            py: 1
                                                        }
                                                    }}>
                                                        {groups.map((group: any, index: number) => (
                                                            <ListItem key={group.id} divider={index < groups.length - 1}>
                                                                <ListItemIcon sx={{ minWidth: 32 }}>
                                                                    <Box sx={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: '50%',
                                                                        bgcolor: 'secondary.main'
                                                                    }} />
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={
                                                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                                            {group.name}
                                                                        </Typography>
                                                                    }
                                                                />
                                                            </ListItem>
                                                        ))}
                                                    </List>
                                                </Box>
                                            </Grid>
                                        )}
                                    </Grid>
                                </CardContent>
                            </Card>
                        )}

                        {/* Permissions - Full Width */}
                        {permissions.length > 0 && (
                            <Card>
                                <CardContent sx={{ pb: 3 }}>
                                    <Typography variant="h6" gutterBottom sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        mb: 3,
                                        fontWeight: 600
                                    }}>
                                        <CheckBox sx={{ mr: 1, color: 'success.main' }} />
                                        Permisos Otorgados ({permissions.length})
                                    </Typography>
                                    <Grid container spacing={1.5}>
                                        {permissions.map((permission: any) => (
                                            <Grid item xs={12} sm={6} md={4} lg={3} key={permission.id}>
                                                <Box sx={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    p: 1.5, 
                                                    bgcolor: 'success.main', 
                                                    borderRadius: 2,
                                                    boxShadow: 1,
                                                    '&:hover': {
                                                        boxShadow: 2,
                                                        transform: 'translateY(-1px)',
                                                        transition: 'all 0.2s ease-in-out'
                                                    }
                                                }}>
                                                    <Check sx={{ 
                                                        fontSize: 18, 
                                                        mr: 1, 
                                                        color: 'success.contrastText',
                                                        flexShrink: 0
                                                    }} />
                                                    <Typography variant="body2" sx={{ 
                                                        color: 'success.contrastText',
                                                        fontWeight: 500,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {permission.label || permission.name}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </CardContent>
                            </Card>
                        )}

                        {/* Audit Information - Full Width */}
                        {(user?.editedAt || user?.editedBy) && (
                            <Card>
                                <CardContent sx={{ pb: 3 }}>
                                    <Typography variant="h6" gutterBottom sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        mb: 3,
                                        fontWeight: 600
                                    }}>
                                        <History sx={{ mr: 1, color: 'info.main' }} />
                                        Información de Auditoría
                                    </Typography>
                                    <Grid container spacing={3}>
                                        {user?.editedAt && (
                                            <Grid item xs={12} sm={6}>
                                                <Box sx={{
                                                    p: 2,
                                                    borderRadius: 1,
                                                    bgcolor: 'grey.50',
                                                    border: '1px solid',
                                                    borderColor: 'grey.200'
                                                }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ 
                                                        textTransform: 'uppercase',
                                                        fontWeight: 600,
                                                        fontSize: '0.7rem'
                                                    }}>
                                                        Última Modificación
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                        {new Date(user.editedAt).toLocaleString('es-AR', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        )}
                                        {user?.editedBy && (
                                            <Grid item xs={12} sm={6}>
                                                <Box sx={{
                                                    p: 2,
                                                    borderRadius: 1,
                                                    bgcolor: 'grey.50',
                                                    border: '1px solid',
                                                    borderColor: 'grey.200'
                                                }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ 
                                                        textTransform: 'uppercase',
                                                        fontWeight: 600,
                                                        fontSize: '0.7rem'
                                                    }}>
                                                        Modificado Por
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                                        Usuario ID: {user.editedBy}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        )}
                                    </Grid>
                                </CardContent>
                            </Card>
                        )}
                    </Stack>

                    {/* Delete Confirmation Dialog */}
                    <Dialog
                        open={showDeleteConfirm}
                        onClose={() => setShowDeleteConfirm(false)}
                    >
                        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
                            <ReportProblem sx={{ mr: 1, color: 'error.main' }} />
                            Confirmar Eliminación
                        </DialogTitle>
                        <DialogContent>
                            <DialogContentText>
                                ¿Está seguro que desea eliminar al usuario <strong>{user?.firstName} {user?.lastName}</strong> (ID: {user?.id})?
                            </DialogContentText>
                            <DialogContentText sx={{ mt: 1, color: 'error.main', fontWeight: 'bold' }}>
                                Esta acción no se puede deshacer.
                            </DialogContentText>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setShowDeleteConfirm(false)}>
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handleDelete} 
                                color="error" 
                                variant="contained"
                                startIcon={<Delete />}
                            >
                                Eliminar Usuario
                            </Button>
                        </DialogActions>
                    </Dialog>
                </Box>
                </>
            );
        };


        // IP Location Tooltip Component
        const IPLocationTooltip = ({ ip, children }) => {
            const [locationData, setLocationData] = useState(null);
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState(null);

            const fetchLocationData = async () => {
                if (!ip || ip === '-' || locationData) return;
                
                setLoading(true);
                try {
                    const response = await fetch(`https://ipapi.co/${ip}/json/`);
                    const data = await response.json();
                    
                    if (data.city) {
                        setLocationData(data);
                    } else {
                        setError('Location not found');
                    }
                } catch (err) {
                    setError('Failed to fetch location');
                } finally {
                    setLoading(false);
                }
            };

            const renderTooltipContent = () => {
                if (loading) return <CircularProgress size={16} />;
                if (error) return <Typography variant="body2">{error}</Typography>;
                if (!locationData) return <Typography variant="body2">Hover to load location</Typography>;
                
                return (
                    <Box>
                        <Typography variant="body2" fontWeight="bold">{locationData.ip}</Typography>
                        <Typography variant="body2">{locationData.city}, {locationData.region}</Typography>
                        <Typography variant="body2">{locationData.country_name}</Typography>
                        {locationData.org && <Typography variant="body2">ISP: {locationData.org}</Typography>}
                        <Typography variant="body2">Lat: {locationData.latitude}, Lon: {locationData.longitude}</Typography>
                    </Box>
                );
            };

            if (!ip || ip === '-') {
                return children;
            }

            return (
                <Tooltip
                    title={renderTooltipContent()}
                    onOpen={fetchLocationData}
                    arrow
                    placement="top"
                >
                    <span style={{ cursor: 'help' }}>{children}</span>
                </Tooltip>
            );
        };

        // Componente de Actividad
        const Actividad = () => {
            const [activityData, setActivityData] = useState(null);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState(null);

            useEffect(() => {
                const fetchActivity = async () => {
                    try {
                        setLoading(true);
                        setError(null);
                        
                        const apiUrl = import.meta.env.VITE_API_URL;
                        console.log('Making request to:', `${apiUrl}/api/access/activity/user/${selectedRow}`);
                        const response = await fetch(`${apiUrl}/api/access/activity/user/${selectedRow}`, {
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                        });
                        console.log('Response received:', response.status, response.statusText);
                        
                        if (!response.ok) {
                            const errorMessage = `Failed to fetch activity: ${response.status} ${response.statusText}`;
                            console.error('Response not ok:', errorMessage);
                            setError(errorMessage);
                            return;
                        }
                        
                        const result = await response.json();
                        setActivityData(result.data);
                    } catch (err) {
                        console.error('Activity fetch error:', err);
                        const errorMessage = err && typeof err === 'object' && err.message 
                            ? err.message 
                            : err 
                            ? String(err) 
                            : 'Unknown error occurred';
                        setError(errorMessage);
                    } finally {
                        setLoading(false);
                    }
                };

                if (selectedRow) {
                    fetchActivity();
                }
            }, [selectedRow]);

            if (loading) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <CircularProgress />
                    </Box>
                );
            }

            if (error) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <Typography color="error">Error al cargar actividad: {error}</Typography>
                    </Box>
                );
            }

            if (!activityData || !activityData.activities || activityData.activities.length === 0) {
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
                        <LocalActivity sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            Sin actividad registrada
                        </Typography>
                        <Typography variant="body2" color="text.secondary" align="center">
                            Este usuario no tiene actividad registrada en el sistema.
                        </Typography>
                    </Box>
                );
            }

            const { user, activities, summary } = activityData;

            return (
                <Box sx={{ p: 2, width: '100%' }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Timeline sx={{ mr: 1 }} />
                        Actividad Reciente ({activities.length})
                    </Typography>
                    <DataGrid
                        rows={activities.map((activity, index) => ({
                            id: index,
                            type: activity.type,
                            timestamp: activity.timestamp,
                            description: activity.type === 'LOGIN' ? 'Inicio de sesión' : 
                                      activity.type === 'LOGOUT' ? 'Cerrar sesión' :
                                      activity.type === 'KICKED_OUT' ? 'Sesión revocada' :
                                      'Cambio en base de datos',
                            provider: activity.details.provider,
                            ipAddress: activity.details.ipAddress,
                            userAgent: activity.details.userAgent,
                            tableName: activity.details.tableName,
                            operation: activity.details.operation,
                            changedData: activity.details.changedData,
                            revokedBy: activity.details.revokedBy,
                            revokedByUser: activity.details.revokedByUser
                        }))}
                        columns={[
                            {
                                field: 'type',
                                headerName: 'Tipo',
                                width: 80,
                                align: 'center',
                                headerAlign: 'center',
                                renderCell: (params) => {
                                    const isDatabaseChange = params.row.type === 'DATABASE_CHANGE';
                                    const hasChangedData = params.row.changedData;
                                    
                                    const getIcon = () => {
                                        if (params.row.type === 'LOGIN') {
                                            return <Person sx={{ color: 'success.main' }} />;
                                        } else if (params.row.type === 'LOGOUT') {
                                            return <Person sx={{ color: 'warning.main' }} />;
                                        } else if (params.row.type === 'KICKED_OUT') {
                                            return <Person sx={{ color: 'error.main' }} />;
                                        } else {
                                            // Database change - show different icon based on whether there's changed data
                                            return hasChangedData ? (
                                                <Tooltip
                                                    title="Cambio en base de datos - Pasa el cursor sobre la descripción para ver los datos modificados"
                                                    arrow
                                                    placement="top"
                                                >
                                                    <DataObject sx={{ 
                                                        color: 'info.main',
                                                        cursor: 'help',
                                                        '&:hover': {
                                                            color: 'info.dark',
                                                            transform: 'scale(1.1)',
                                                            transition: 'all 0.2s ease-in-out'
                                                        }
                                                    }} />
                                                </Tooltip>
                                            ) : (
                                                <DataObject sx={{ color: 'info.main', opacity: 0.7 }} />
                                            );
                                        }
                                    };

                                    return (
                                        <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            width: '100%', 
                                            height: '100%' 
                                        }}>
                                            {getIcon()}
                                        </Box>
                                    );
                                }
                            },
                            {
                                field: 'description',
                                headerName: 'Actividad',
                                flex: 1,
                                minWidth: 180,
                                renderCell: (params) => {
                                    const isDatabaseChange = params.row.type === 'DATABASE_CHANGE';
                                    const hasChangedData = params.row.changedData;
                                    
                                    // Debug logging
                                    if (isDatabaseChange) {
                                        console.log('Database change row:', params.row);
                                        console.log('Changed data:', hasChangedData);
                                    }
                                    
                                    // Function to format changed data for display
                                    const formatChangedData = (data) => {
                                        if (!data) return 'Sin datos de cambio disponibles';
                                        
                                        try {
                                            // If it's already a parsed object
                                            if (typeof data === 'object') {
                                                return Object.entries(data)
                                                    .filter(([key, value]) => 
                                                        // Filter out internal CDC fields and null values
                                                        !key.startsWith('_cdc') && 
                                                        value !== null && 
                                                        value !== undefined
                                                    )
                                                    .map(([key, value]) => {
                                                        // Format field names nicely
                                                        const fieldName = key === 'first_name' ? 'First Name' :
                                                                         key === 'last_name' ? 'Last Name' :
                                                                         key === 'is_deleted' ? 'Is Deleted' :
                                                                         key === 'edited_by' ? 'Edited By' :
                                                                         key === 'edited_at' ? 'Edited At' :
                                                                         key.charAt(0).toUpperCase() + key.slice(1);
                                                        
                                                        // Format values nicely
                                                        const displayValue = typeof value === 'boolean' ? 
                                                                           (value ? 'Yes' : 'No') :
                                                                           value;
                                                        
                                                        return `${fieldName}: ${displayValue}`;
                                                    })
                                                    .join('\n');
                                            }
                                            
                                            // If it's a string, try to parse it
                                            if (typeof data === 'string') {
                                                const parsed = JSON.parse(data);
                                                return formatChangedData(parsed);
                                            }
                                            
                                            return String(data);
                                        } catch (error) {
                                            console.log('Error formatting changed data:', error);
                                            return JSON.stringify(data, null, 2) || 'Sin datos de cambio disponibles';
                                        }
                                    };

                                    const content = (
                                        <Box>
                                            <Typography variant="body2">
                                                {params.value}
                                            </Typography>
                                            {params.row.type === 'KICKED_OUT' && params.row.revokedByUser && (
                                                <Typography variant="caption" color="text.secondary">
                                                    Por: {params.row.revokedByUser.fullName || params.row.revokedByUser.email}
                                                </Typography>
                                            )}
                                            {isDatabaseChange && params.row.tableName && (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                    Tabla: {params.row.tableName} | Operación: {params.row.operation || 'N/A'}
                                                </Typography>
                                            )}
                                        </Box>
                                    );

                                    // If it's a database change and has changed data, wrap in tooltip
                                    if (isDatabaseChange && hasChangedData) {
                                        return (
                                            <Tooltip
                                                title={
                                                    <Box sx={{ maxWidth: 400 }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                                            Datos Modificados:
                                                        </Typography>
                                                        <Typography variant="body2" component="pre" sx={{ 
                                                            whiteSpace: 'pre-wrap',
                                                            fontSize: '0.75rem',
                                                            fontFamily: 'monospace'
                                                        }}>
                                                            {formatChangedData(params.row.changedData)}
                                                        </Typography>
                                                    </Box>
                                                }
                                                arrow
                                                placement="top"
                                                sx={{ cursor: 'help' }}
                                            >
                                                <Box sx={{ cursor: 'help' }}>
                                                    {content}
                                                </Box>
                                            </Tooltip>
                                        );
                                    }

                                    return content;
                                }
                            },
                            {
                                field: 'timestamp',
                                headerName: 'Fecha y Hora',
                                width: 180,
                                renderCell: (params) => (
                                    new Date(params.value).toLocaleString('es-AR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    })
                                )
                            },
                            {
                                field: 'provider',
                                headerName: 'Provider',
                                width: 100,
                                renderCell: (params) => params.value || '-'
                            },
                            {
                                field: 'ipAddress',
                                headerName: 'IP',
                                width: 120,
                                renderCell: (params) => (
                                    <IPLocationTooltip ip={params.value}>
                                        <span>{params.value || '-'}</span>
                                    </IPLocationTooltip>
                                )
                            },
                            {
                                field: 'userAgent',
                                headerName: 'Dispositivo',
                                flex: 1,
                                minWidth: 200,
                                renderCell: (params) => (
                                    params.value ? (
                                        <Box sx={{ 
                                            whiteSpace: 'nowrap', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis',
                                            width: '100%'
                                        }} title={params.value}>
                                            {params.value}
                                        </Box>
                                    ) : '-'
                                )
                            },
                            {
                                field: 'tableName',
                                headerName: 'Tabla',
                                width: 120,
                                renderCell: (params) => params.value || '-'
                            },
                            {
                                field: 'operation',
                                headerName: 'Operación',
                                width: 100,
                                renderCell: (params) => params.value || '-'
                            }
                        ]}
                        initialState={{
                            pagination: {
                                paginationModel: { page: 0, pageSize: 20 }
                            }
                        }}
                        pageSizeOptions={[5, 10, 20, 25, 50]}
                        disableRowSelectionOnClick
                        sx={{ height: 'calc(100vh - 180px)', width: '100%' }}
                    />
                </Box>
            );
        };

        // Componente de Permisos del Usuario
        const PermisosUsuario = () => {
            const [allPermissions, setAllPermissions] = useState([]);
            const [allRoles, setAllRoles] = useState([]);
            const [userPermissions, setUserPermissions] = useState([]);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState(null);
            const [saving, setSaving] = useState(false);
            const [selectedRoles, setSelectedRoles] = useState([]);
            const [assignRoleDialogOpen, setAssignRoleDialogOpen] = useState(false);
            const [permissionScopes, setPermissionScopes] = useState({});

            useEffect(() => {
                const fetchPermissionsData = async () => {
                    try {
                        setLoading(true);
                        setError(null);
                        
                        const apiUrl = import.meta.env.VITE_API_URL;
                        
                        // Fetch all system permissions
                        const permissionsResponse = await fetch(`${apiUrl}/api/access/permissions`, {
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                        });
                        
                        // Fetch all system roles
                        const rolesResponse = await fetch(`${apiUrl}/api/access/roles`, {
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                        });
                        
                        // Fetch user's current permissions
                        const userPermissionsResponse = await fetch(`${apiUrl}/api/access/users/${selectedRow}/permissions`, {
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                        });
                        
                        if (!permissionsResponse.ok || !rolesResponse.ok || !userPermissionsResponse.ok) {
                            throw new Error('Failed to fetch permissions data');
                        }
                        
                        const [permissionsResult, rolesResult, userPermissionsResult] = await Promise.all([
                            permissionsResponse.json(),
                            rolesResponse.json(),
                            userPermissionsResponse.json()
                        ]);
                        
                        setAllPermissions(permissionsResult.data || []);
                        setAllRoles(rolesResult.data || []);
                        setUserPermissions(userPermissionsResult.data || []);
                        
                    } catch (err) {
                        console.error('Permissions fetch error:', err);
                        setError(err.message || 'Error al cargar permisos');
                    } finally {
                        setLoading(false);
                    }
                };

                if (selectedRow) {
                    fetchPermissionsData();
                }
            }, [selectedRow]);

            if (loading) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <CircularProgress />
                    </Box>
                );
            }

            if (error) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <Typography color="error">Error al cargar permisos: {error}</Typography>
                    </Box>
                );
            }

            // Group permissions by group/category
            const groupedPermissions = allPermissions.reduce((groups, permission) => {
                const group = permission.group || 'general';
                if (!groups[group]) {
                    groups[group] = [];
                }
                groups[group].push(permission);
                return groups;
            }, {});

            // Check if user has a specific permission
            const hasPermission = (permissionName) => {
                return userPermissions.some(p => p.name === permissionName);
            };

            // Check if user has a specific role  
            const hasRole = (roleName) => {
                return userPermissions.some(p => p.source === 'role' && p.sourceDetails?.roleName === roleName);
            };

            // Group user permissions by source
            const permissionsBySource = userPermissions.reduce((groups, permission) => {
                const source = permission.source || 'direct';
                if (!groups[source]) {
                    groups[source] = [];
                }
                groups[source].push(permission);
                return groups;
            }, {});

            // Refresh permissions data
            const refreshPermissions = async () => {
                const apiUrl = import.meta.env.VITE_API_URL;
                const userPermissionsResponse = await fetch(`${apiUrl}/api/access/users/${selectedRow}/permissions`, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                });
                
                if (userPermissionsResponse.ok) {
                    const result = await userPermissionsResponse.json();
                    setUserPermissions(result.data || []);
                }
            };

            // Assign permission to user
            const assignPermission = async (permissionName, scope = null) => {
                try {
                    setSaving(true);
                    const apiUrl = import.meta.env.VITE_API_URL;
                    const body = {
                        permissionName,
                        ...(scope && scope.type !== 'global' && {
                            referenceableType: scope.type,
                            referenceableId: scope.id
                        })
                    };
                    const response = await fetch(`${apiUrl}/api/access/users/${selectedRow}/permissions`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(body)
                    });

                    if (response.ok) {
                        await refreshPermissions();
                    } else {
                        const error = await response.json();
                        console.error('Failed to assign permission:', error);
                        alert('Error al asignar permiso: ' + (error.message || 'Error desconocido'));
                    }
                } catch (error) {
                    console.error('Error assigning permission:', error);
                    alert('Error al asignar permiso');
                } finally {
                    setSaving(false);
                }
            };

            // Remove permission from user
            const removePermission = async (permissionName) => {
                try {
                    setSaving(true);
                    const apiUrl = import.meta.env.VITE_API_URL;
                    const response = await fetch(`${apiUrl}/api/access/users/${selectedRow}/permissions/${encodeURIComponent(permissionName)}`, {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        }
                    });

                    if (response.ok) {
                        await refreshPermissions();
                    } else {
                        const error = await response.json();
                        console.error('Failed to remove permission:', error);
                        alert('Error al remover permiso: ' + (error.message || 'Error desconocido'));
                    }
                } catch (error) {
                    console.error('Error removing permission:', error);
                    alert('Error al remover permiso');
                } finally {
                    setSaving(false);
                }
            };

            // Assign role to user
            const assignRole = async (roleName) => {
                try {
                    setSaving(true);
                    const apiUrl = import.meta.env.VITE_API_URL;
                    const response = await fetch(`${apiUrl}/api/access/users/${selectedRow}/roles`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ roleName })
                    });

                    if (response.ok) {
                        await refreshPermissions();
                    } else {
                        const error = await response.json();
                        console.error('Failed to assign role:', error);
                        alert('Error al asignar rol: ' + (error.message || 'Error desconocido'));
                    }
                } catch (error) {
                    console.error('Error assigning role:', error);
                    alert('Error al asignar rol');
                } finally {
                    setSaving(false);
                }
            };

            // Remove role from user
            const removeRole = async (roleName) => {
                try {
                    setSaving(true);
                    const apiUrl = import.meta.env.VITE_API_URL;
                    const response = await fetch(`${apiUrl}/api/access/users/${selectedRow}/roles/${encodeURIComponent(roleName)}`, {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        }
                    });

                    if (response.ok) {
                        await refreshPermissions();
                    } else {
                        const error = await response.json();
                        console.error('Failed to remove role:', error);
                        alert('Error al remover rol: ' + (error.message || 'Error desconocido'));
                    }
                } catch (error) {
                    console.error('Error removing role:', error);
                    alert('Error al remover rol');
                } finally {
                    setSaving(false);
                }
            };

            return (
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        mb: 3 
                    }}>
                        <Security sx={{ mr: 1, color: 'primary.main' }} />
                        Gestión de Permisos - Usuario #{selectedRow}
                    </Typography>

                    <Grid container spacing={3}>
                        {/* User's Current Permissions Summary */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        mb: 2
                                    }}>
                                        <Assignment sx={{ mr: 1, color: 'success.main' }} />
                                        Resumen de Permisos ({userPermissions.length})
                                    </Typography>
                                    
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={4}>
                                            <Box sx={{ 
                                                textAlign: 'center',
                                                p: 2,
                                                bgcolor: 'success.main',
                                                color: 'success.contrastText',
                                                borderRadius: 2
                                            }}>
                                                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                                    {permissionsBySource.direct?.length || 0}
                                                </Typography>
                                                <Typography variant="body2" sx={{ textTransform: 'uppercase' }}>
                                                    Directos
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <Box sx={{ 
                                                textAlign: 'center',
                                                p: 2,
                                                bgcolor: 'primary.main',
                                                color: 'primary.contrastText',
                                                borderRadius: 2
                                            }}>
                                                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                                    {permissionsBySource.role?.length || 0}
                                                </Typography>
                                                <Typography variant="body2" sx={{ textTransform: 'uppercase' }}>
                                                    Por Roles
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <Box sx={{ 
                                                textAlign: 'center',
                                                p: 2,
                                                bgcolor: 'secondary.main',
                                                color: 'secondary.contrastText',
                                                borderRadius: 2
                                            }}>
                                                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                                    {permissionsBySource.group?.length || 0}
                                                </Typography>
                                                <Typography variant="body2" sx={{ textTransform: 'uppercase' }}>
                                                    Por Grupos
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Current Permissions by Source */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        mb: 2
                                    }}>
                                        <VpnKey sx={{ mr: 1, color: 'info.main' }} />
                                        Permisos Actuales
                                    </Typography>
                                    
                                    {Object.keys(permissionsBySource).length === 0 ? (
                                        <Typography color="text.secondary">
                                            Este usuario no tiene permisos asignados.
                                        </Typography>
                                    ) : (
                                        <Grid container spacing={2}>
                                            {Object.entries(permissionsBySource).map(([source, permissions]) => (
                                                <Grid item xs={12} md={4} key={source}>
                                                    <Box>
                                                        <Typography variant="subtitle1" gutterBottom sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            fontWeight: 600,
                                                            color: source === 'direct' ? 'success.main' : 
                                                                   source === 'role' ? 'primary.main' : 'secondary.main'
                                                        }}>
                                                            {source === 'direct' && <Person sx={{ mr: 0.5, fontSize: 18 }} />}
                                                            {source === 'role' && <Assignment sx={{ mr: 0.5, fontSize: 18 }} />}
                                                            {source === 'group' && <Group sx={{ mr: 0.5, fontSize: 18 }} />}
                                                            {source === 'direct' ? 'Permisos Directos' : 
                                                             source === 'role' ? 'Por Roles' : 'Por Grupos'} ({permissions.length})
                                                        </Typography>
                                                        <List dense sx={{ maxHeight: 200, overflowY: 'auto' }}>
                                                            {permissions.map((permission, index) => (
                                                                <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                                                                    <ListItemIcon sx={{ minWidth: 24 }}>
                                                                        <Circle sx={{ 
                                                                            fontSize: 6,
                                                                            color: source === 'direct' ? 'success.main' : 
                                                                                   source === 'role' ? 'primary.main' : 'secondary.main'
                                                                        }} />
                                                                    </ListItemIcon>
                                                                    <ListItemText
                                                                        primary={
                                                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                                                {permission.label || permission.name}
                                                                            </Typography>
                                                                        }
                                                                        secondary={
                                                                            permission.sourceDetails && (
                                                                                <Typography variant="caption" color="text.secondary">
                                                                                    {permission.sourceDetails.roleName || permission.sourceDetails.groupName}
                                                                                </Typography>
                                                                            )
                                                                        }
                                                                    />
                                                                </ListItem>
                                                            ))}
                                                        </List>
                                                    </Box>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Role Management */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        mb: 2
                                    }}>
                                        <Assignment sx={{ mr: 1, color: 'primary.main' }} />
                                        Gestión de Roles
                                    </Typography>
                                    
                                    <Grid container spacing={2}>
                                        {allRoles.map((role) => {
                                            const userHasRole = hasRole(role.name);
                                            return (
                                                <Grid item xs={12} sm={6} md={4} key={role.id}>
                                                    <Box sx={{ 
                                                        p: 2, 
                                                        border: 1, 
                                                        borderColor: userHasRole ? 'primary.main' : 'grey.300',
                                                        borderRadius: 2,
                                                        bgcolor: userHasRole ? 'primary.light' : 'background.paper',
                                                        transition: 'all 0.2s ease-in-out'
                                                    }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: userHasRole ? 'primary.contrastText' : 'inherit' }}>
                                                                    {role.label || role.name}
                                                                </Typography>
                                                                {role.description && (
                                                                    <Typography variant="caption" sx={{ color: userHasRole ? 'primary.contrastText' : 'text.secondary' }}>
                                                                        {role.description}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                            <IconButton
                                                                onClick={() => userHasRole ? removeRole(role.name) : assignRole(role.name)}
                                                                disabled={saving}
                                                                size="small"
                                                                sx={{ 
                                                                    color: userHasRole ? 'primary.contrastText' : 'primary.main',
                                                                    '&:hover': {
                                                                        bgcolor: userHasRole ? 'rgba(255,255,255,0.1)' : 'primary.light'
                                                                    }
                                                                }}
                                                            >
                                                                {userHasRole ? <Delete /> : <Add />}
                                                            </IconButton>
                                                        </Box>
                                                    </Box>
                                                </Grid>
                                            );
                                        })}
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* All System Permissions (editable) */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        mb: 2
                                    }}>
                                        <CheckBox sx={{ mr: 1, color: 'warning.main' }} />
                                        Asignación Directa de Permisos
                                    </Typography>
                                    
                                    {saving && (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                                            <CircularProgress size={24} />
                                        </Box>
                                    )}
                                    
                                    {Object.entries(groupedPermissions).map(([group, permissions]) => (
                                        <Accordion key={group} sx={{ mb: 1 }}>
                                            <AccordionSummary expandIcon={<ExpandMore />}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                                    {group.replace(/-/g, ' ')} ({permissions.length})
                                                </Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <Grid container spacing={1}>
                                                    {permissions.map((permission) => {
                                                        const userHasDirectPermission = userPermissions.some(p => 
                                                            p.name === permission.name && p.source === 'direct'
                                                        );
                                                        const userHasPermissionFromOtherSource = userPermissions.some(p => 
                                                            p.name === permission.name && p.source !== 'direct'
                                                        );
                                                        
                                                        return (
                                                            <Grid item xs={12} key={permission.id}>
                                                                <Box sx={{ 
                                                                    p: 2, 
                                                                    border: 1, 
                                                                    borderColor: userHasDirectPermission ? 'primary.main' : 'grey.300',
                                                                    borderRadius: 1,
                                                                    bgcolor: userHasDirectPermission ? 'primary.light' : 'background.paper',
                                                                    '&:hover': {
                                                                        borderColor: 'primary.main',
                                                                        bgcolor: userHasDirectPermission ? 'primary.light' : 'grey.50'
                                                                    }
                                                                }}>
                                                                    <Grid container spacing={2} alignItems="center">
                                                                        <Grid item xs={12} md={6}>
                                                                            <FormControlLabel
                                                                                control={
                                                                                    <Checkbox
                                                                                        checked={userHasDirectPermission}
                                                                                        onChange={(e) => {
                                                                                            if (e.target.checked) {
                                                                                                const scope = permissionScopes[permission.name];
                                                                                                assignPermission(permission.name, scope);
                                                                                            } else {
                                                                                                removePermission(permission.name);
                                                                                                setPermissionScopes(prev => {
                                                                                                    const updated = { ...prev };
                                                                                                    delete updated[permission.name];
                                                                                                    return updated;
                                                                                                });
                                                                                            }
                                                                                        }}
                                                                                        disabled={saving}
                                                                                        size="small"
                                                                                        color={userHasPermissionFromOtherSource && !userHasDirectPermission ? 'secondary' : 'primary'}
                                                                                    />
                                                                                }
                                                                                label={
                                                                                    <Box>
                                                                                        <Typography variant="body2" sx={{ 
                                                                                            fontWeight: 500,
                                                                                            color: userHasPermissionFromOtherSource && !userHasDirectPermission ? 'secondary.main' : 'inherit'
                                                                                        }}>
                                                                                            {permission.label || permission.name}
                                                                                            {userHasPermissionFromOtherSource && !userHasDirectPermission && (
                                                                                                <Typography component="span" variant="caption" sx={{ ml: 1, color: 'secondary.main' }}>
                                                                                                    (por rol/grupo)
                                                                                                </Typography>
                                                                                            )}
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
                                                                        <Grid item xs={12} md={6}>
                                                                            {userHasDirectPermission && (
                                                                                <PermissionScopeSelector
                                                                                    permissionName={permission.name}
                                                                                    currentScope={permissionScopes[permission.name]}
                                                                                    onScopeChange={(scope) => {
                                                                                        setPermissionScopes(prev => ({
                                                                                            ...prev,
                                                                                            [permission.name]: scope
                                                                                        }));
                                                                                    }}
                                                                                    disabled={saving}
                                                                                    compact={true}
                                                                                />
                                                                            )}
                                                                        </Grid>
                                                                    </Grid>
                                                                </Box>
                                                            </Grid>
                                                        );
                                                    })}
                                                </Grid>
                                            </AccordionDetails>
                                        </Accordion>
                                    ))}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>
            );
        };

        // Componente de Historial del Usuario
        const HistorialUsuario = () => {
            const { userHistory } = useSelector((state: RootState) => state.users);

            useEffect(() => {
                if (selectedRow) {
                    dispatch(fetchUserHistory(parseInt(selectedRow.toString())));
                }
            }, [dispatch, selectedRow]);

            if (userHistory.fetching) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <CircularProgress />
                    </Box>
                );
            }

            if (userHistory.error) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <Typography color="error">Error al cargar historial: {userHistory.error}</Typography>
                    </Box>
                );
            }

            if (!userHistory.data || !userHistory.data.changes || userHistory.data.changes.length === 0) {
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
                        <History sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            Sin historial de cambios
                        </Typography>
                        <Typography variant="body2" color="text.secondary" align="center">
                            No se encontraron cambios en el historial de este usuario.
                        </Typography>
                    </Box>
                );
            }

            // Format change data for display
            const formatChangeData = (data: any) => {
                if (!data || typeof data !== 'object') return 'N/A';
                
                // Filter out CDC metadata and null values
                const filtered = Object.entries(data).filter(([key, value]) => {
                    return !key.startsWith('_cdc_') && value !== null && value !== undefined;
                }).reduce((obj, [key, value]) => {
                    obj[key] = value;
                    return obj;
                }, {} as any);
                
                return JSON.stringify(filtered, null, 2);
            };

            return (
                <Box>
                    <DataGrid
                        rows={userHistory.data.changes.map((change: any, index: number) => ({
                            id: change.cdcId || index,
                            operation: change.operation,
                            timestamp: change.timestamp,
                            editor: change.editor?.fullName || 'Sistema',
                            editorEmail: change.editor?.email || '',
                            changedData: change.changedData
                        }))}
                        columns={[
                            {
                                field: 'operation',
                                headerName: 'Operación',
                                width: 120,
                                renderCell: (params) => (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {params.value === 'INSERT' && <Add color="success" />}
                                        {params.value === 'UPDATE' && <Edit color="info" />}
                                        {params.value === 'DELETE' && <Delete color="error" />}
                                        <Typography variant="body2">
                                            {params.value === 'INSERT' && 'Creado'}
                                            {params.value === 'UPDATE' && 'Modificado'}
                                            {params.value === 'DELETE' && 'Eliminado'}
                                        </Typography>
                                    </Box>
                                )
                            },
                            {
                                field: 'timestamp',
                                headerName: 'Fecha y Hora',
                                width: 180,
                                renderCell: (params) => (
                                    new Date(params.value).toLocaleString('es-AR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    })
                                )
                            },
                            {
                                field: 'editor',
                                headerName: 'Modificado por',
                                width: 200,
                                renderCell: (params) => (
                                    <Box>
                                        <Typography variant="body2">{params.value}</Typography>
                                        {params.row.editorEmail && (
                                            <Typography variant="caption" color="text.secondary">
                                                {params.row.editorEmail}
                                            </Typography>
                                        )}
                                    </Box>
                                )
                            },
                            {
                                field: 'changedData',
                                headerName: 'Datos',
                                width: 150,
                                sortable: false,
                                renderCell: (params) => {
                                    const content = (
                                        <Typography 
                                            variant="body2" 
                                            sx={{ 
                                                color: 'primary.main',
                                                cursor: 'help',
                                                textDecoration: 'underline'
                                            }}
                                        >
                                            Ver datos →
                                        </Typography>
                                    );

                                    if (params.value && typeof params.value === 'object') {
                                        return (
                                            <Tooltip 
                                                title={
                                                    <Box sx={{ maxWidth: 600 }}>
                                                        <Typography variant="body2" component="pre" sx={{ 
                                                            whiteSpace: 'pre-wrap',
                                                            fontSize: '0.75rem',
                                                            fontFamily: 'monospace'
                                                        }}>
                                                            {formatChangeData(params.value)}
                                                        </Typography>
                                                    </Box>
                                                }
                                                arrow
                                                placement="top"
                                                sx={{ cursor: 'help' }}
                                            >
                                                <Box sx={{ cursor: 'help' }}>
                                                    {content}
                                                </Box>
                                            </Tooltip>
                                        );
                                    }

                                    return content;
                                }
                            }
                        ]}
                        initialState={{
                            pagination: {
                                paginationModel: { page: 0, pageSize: 20 }
                            }
                        }}
                        pageSizeOptions={[5, 10, 20, 25, 50]}
                        disableRowSelectionOnClick
                        sx={{ height: 'calc(100vh - 180px)', width: '100%' }}
                    />
                </Box>
            );
        };

        return (
            <Box sx={{ width: '100%' }}>
                {/* Tabs de navegación */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={actionsTab}
                        onChange={handleChange}
                        aria-label="Opciones de usuario"
                    >
                        <Tab
                            label="Detalles"
                            value="gestion"
                            sx={{ textTransform: 'none' }}
                        />
                        <Tab
                            label="Actividad"
                            value="actividad"
                            sx={{ textTransform: 'none' }}
                        />
                        <Tab
                            label="Historial"
                            value="historial"
                            sx={{ textTransform: 'none' }}
                        />
                        <Tab
                            label="Permisos"
                            value="permisos"
                            sx={{ textTransform: 'none' }}
                        />
                    </Tabs>
                </Box>

                {/* Contenido de las tabs */}
                <Box sx={{ p: 2 }}>
                    {actionsTab === 'gestion' && <GestionUsuario />}
                    {actionsTab === 'actividad' && <Actividad />}
                    {actionsTab === 'historial' && <HistorialUsuario />}
                    {actionsTab === 'permisos' && <PermisosUsuario />}
                </Box>
            </Box>
        );
    }
    const AppBar = () => {
        return (
            <Box sx={{ mb: 3 }}>
                <Box
                    sx={{
                        px: 0,
                        py: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: 1,
                        borderColor: 'divider',
                        mb: 2
                    }}
                >
                    <Breadcrumbs>
                        <Link
                            component={RouterLink}
                            to="/dashboard/usuarios"
                            color="text.primary"
                            underline="hover"
                            variant="body2"
                            sx={{ '&:hover': { color: 'primary.main', } }}
                            children={'Usuarios'.toUpperCase()}
                        />
                        {selectedRow && <Link
                            to={`/dashboard/usuarios/${selectedRow}/${actionsTab}`}
                            component={RouterLink}
                            color="text.primary"
                            underline="hover"
                            variant="body2"
                            sx={{ '&:hover': { color: 'primary.main', } }} children={'ID: ' + selectedRow} />}
                        {actionsTab && <Link
                            to={`/dashboard/usuarios/${selectedRow}/${actionsTab}`}
                            component={RouterLink}
                            color="text.primary"
                            underline="hover"
                            variant="body2"
                            sx={{ '&:hover': { color: 'primary.main', } }} children={actionsTab?.toUpperCase()} />}

                    </Breadcrumbs>
                    <Button 
                        variant="contained" 
                        startIcon={<Add />}
                        onClick={() => setOpenCreate(true)}
                        size="small"
                    >
                        Nuevo Usuario
                    </Button>
                </Box>
                {!selectedRow && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="h4" gutterBottom>
                                Gestión de Usuarios
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Administra los usuarios del sistema, sus permisos y accesos
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                Total: {users?.length || 0} usuarios
                            </Typography>
                        </Box>
                    </Box>
                )}
            </Box>
        );
    };
    return (<Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
        <AppBar />
        <CreateForm open={openCreate} onClose={() => setOpenCreate(false)} />
        {selectedRow ? <RowActions /> : <Table />}


    </Box>);
};


export default Users;
