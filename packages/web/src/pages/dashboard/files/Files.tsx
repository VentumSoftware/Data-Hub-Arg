import * as React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Tooltip, Typography } from '@mui/material';
import FileViewer, { FileViewerItem } from '../../../components/FileViewer/FileViewer';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { InsertDriveFile as FileIcon, CreateNewFolder, Delete, Refresh, PostAdd, Folder, Edit as EditIcon, DriveFolderUpload, Download } from '@mui/icons-material';
import { getData, FSNodeDTO, deleteNode, createFile, createFolder, renameNode, selectFolder } from './FilesSlices';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../../store';
import { useEffect, useState } from 'react';
export default function Files() {

    const dispatch = useDispatch<AppDispatch>();
    useEffect(() => { dispatch(getData()) }, []);

    const nodeToTreeViewItem = (node: FSNodeDTO): TreeViewBaseItem => ({
        id: node.path,
        label: node.name,
        children: node?.childs?.filter(c => c.type === 'dir')?.map(nodeToTreeViewItem)
    });

    const getNodesInDir = (path: string, nodes: Array<FSNodeDTO>): Array<FSNodeDTO> => {
        const steps = path.split('/');
        let nodesInDir = nodes || [];
        for (let i = 0; i < steps.length; i++) {
            const node = nodesInDir?.find((node: any) => node.name === steps[i]);
            if (node?.type === 'dir') {
                nodesInDir = node?.childs || [];
            }
        }
        return nodesInDir;
    };

    const FoldersTreeView = () => {
        const { nodes } = useSelector((state: RootState) => state.files.data);
        const treeViewItems = nodes?.map(nodeToTreeViewItem) || [];

        return (<Box sx={{ flex: 3, height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(156, 156, 156, 0.5)', pr: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ flex: 1 }}>Carpetas</Typography>
                <IconButton size="small" >
                    <Refresh />
                </IconButton>
                <IconButton size="small" color="error" disabled>
                    <Delete />
                </IconButton>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <RichTreeView
                    items={treeViewItems}
                    expansionTrigger="iconContainer"
                    onItemClick={(event, itemId) => {
                        const target = event.target as HTMLElement;
                        if (!target.closest('.MuiTreeItem-iconContainer')) {
                            dispatch(selectFolder(itemId));
                        }
                    }}
                    sx={{
                        '& .MuiTreeItem-content.Mui-selected': { backgroundColor: 'transparent', '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' } },
                        '& .MuiTreeItem-content:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
                        '& .MuiTreeItem-root:focus > .MuiTreeItem-content': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                />
            </Box>
        </Box>)
    };

    const FilesTable = () => {
        const dispatch = useDispatch<AppDispatch>();
        const { nodes, selectedFolder } = useSelector((state: RootState) => state.files.data);
        const [selectedRows, setSelectedRows] = React.useState<GridRowSelectionModel>();
        const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
        const fileInputRef = React.useRef<HTMLInputElement>(null);
        const nodesInDir = getNodesInDir(selectedFolder, nodes || []).concat(((selectedFolder !== '/' && selectedFolder !== '') ? [{ name: '..', type: 'up-dir', path: selectedFolder }] : []));
        const [hoveredRow, setHoveredRow] = useState<string | null>(null);

        // File viewer state
        const [fileViewerOpen, setFileViewerOpen] = useState(false);
        const [viewerFiles, setViewerFiles] = useState<FileViewerItem[]>([]);
        const [initialFileIndex, setInitialFileIndex] = useState(0);

        const openFileViewer = (filesToView: FSNodeDTO[], startIndex: number = 0) => {

            Promise.all(filesToView.map(file => {
                fetch(`${import.meta.env.VITE_API_URL}/api/fs/file/${file.path}`, { credentials: 'include' })
                    .then(response => response.blob())
                    .then(URL.createObjectURL);
            })).then((urls: string[]) => {
                const viewerItems: FileViewerItem[] = filesToView.map((file, index) => ({
                    name: file.name,
                    fileURL: urls[index]
                }));
            });

            setViewerFiles(viewerItems);
            setInitialFileIndex(startIndex);
            setFileViewerOpen(true);
        };

        const columns: GridColDef[] = [
            {
                field: 'name',
                headerName: 'Name',
                flex: 2,
                // Custom sort comparator to keep parent directory ('..') always at top
                sortComparator: (v1, v2, param1, param2) => {
                    // Get the row data by id from the DataGrid API
                    const rowA = param1.api.getRow(param1.id);
                    const rowB = param2.api.getRow(param2.id);

                    // Always put parent directory at the top
                    if (rowA && rowA.type === 'up-dir') return -1;
                    if (rowB && rowB.type === 'up-dir') return 1;

                    // Then put directories before files
                    if (rowA && rowB && rowA.type !== rowB.type) {
                        return rowA.type === 'dir' ? -1 : 1;
                    }

                    // For same type items, sort alphabetically
                    const nameA = String(v1).toLowerCase();
                    const nameB = String(v2).toLowerCase();
                    return nameA.localeCompare(nameB);
                },
                renderCell: (params) => {
                    const isHovered = hoveredRow === params.row.path;
                    return (
                        <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', '&:hover': { '& .edit-icon': { opacity: 1 } } }}
                            onMouseEnter={() => setHoveredRow(params.row.path)}
                            onMouseLeave={() => setHoveredRow(null)}
                        >
                            {params.row.type === 'dir' ? <Folder color="primary" /> : null}
                            {params.row.type === 'up-dir' ? <DriveFolderUpload color="primary" /> : null}
                            {params.row.type === 'file' ? <FileIcon /> : null}
                            <span
                                style={{ cursor: 'pointer' }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation(); // Prevent DataGrid's default double-click behavior
                                    handleNameDoubleClick(params.row.path, params.row.type);
                                }}
                            >
                                {params.value}
                            </span>
                            {/* Only show edit icon for files and directories, not for parent directory */}
                            {params.row.type !== 'up-dir' && (
                                <IconButton
                                    size="small"
                                    className="edit-icon"
                                    sx={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.2s', ml: 'auto', p: 0.5 }}
                                    onClick={e => {
                                        e.stopPropagation();
                                        params.api.startCellEditMode({ id: params.id, field: 'name' });
                                    }}
                                >
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    );
                },
                // Only allow editing via the edit button, not by default double-click
                editable: true,
            },
            { field: 'type', headerName: 'Type', flex: 1 },
            { field: 'size', headerName: 'Size', flex: 1 },
            { field: 'lastUpdate', headerName: 'Modified', renderCell: (params) => params.value ? new Date(params.value).toLocaleString() : '', flex: 1.5 },
            {
                field: 'preview',
                headerName: 'Preview',
                width: 80,
                sortable: false,
                filterable: false,
                renderCell: (params) => {
                    // Only show preview for files, not directories
                    if (params.row.type !== 'file') {
                        return null;
                    }

                    return (
                        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                            <Tooltip title="Preview file">
                                <IconButton size="small" onClick={e => { e.stopPropagation(); openFileViewer([params.row]) }} >
                                    <FileIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    );
                },
            },
        ];

        const DeleteDialog = () => {
            const closeDeleteDialog = () => setDeleteDialogOpen(false);

            const handleDeleteFiles = async () => {
                const ids = Array.from(selectedRows?.ids || []).map(id => id.toString());
                for (let i = 0; i <= ids.length; i++) {
                    await dispatch(deleteNode(ids[i])).unwrap();
                }

                await dispatch(getData()).unwrap();
                setDeleteDialogOpen(false);
            };

            return <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
                <DialogTitle>
                    {`Eliminar ${selectedRows?.ids?.size || 0} ${selectedRows?.ids?.size === 1 ? 'elemento' : 'elementos'}`}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {selectedRows && selectedRows.ids && selectedRows.ids.size === 1
                            ? "¿Está seguro que desea eliminar el elemento seleccionado? Esta acción no se puede deshacer."
                            : `¿Está seguro que desea eliminar los ${selectedRows && selectedRows.ids ? selectedRows.ids.size : 0} elementos seleccionados? Esta acción no se puede deshacer.`}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog} color="inherit" variant="outlined">Cancelar</Button>
                    <Button onClick={handleDeleteFiles} autoFocus color="error" variant="contained">
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

        };

        const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = event.target.files;
            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    dispatch(createFile({
                        file: file,
                        path: `${selectedFolder}${selectedFolder.endsWith('/') ? '' : '/'}${file.name}`,
                        ensureParentDir: true
                    }));
                }
            }
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };

        const openDeleteDialog = () => {
            const selectedCount = selectedRows && selectedRows.ids ? selectedRows.ids.size : 0;
            if (selectedCount > 0) {
                setDeleteDialogOpen(true);
            }
        };

        // Function to handle navigation or opening files
        const handleNavigation = (path: string, type: string) => {
            if (type === 'dir') {
                dispatch(selectFolder(path));
            } else if (type === 'up-dir') {
                dispatch(selectFolder(path.substring(0, path.lastIndexOf('/'))));
            } else if (type === 'file') {
                // Find the file node and open in file viewer
                const fileNode = nodesInDir.find(node => node.path === path && node.type === 'file');
                if (fileNode) {
                    openFileViewer([fileNode]);
                }
            }
        };

        // For backwards compatibility with double-click handler
        const handleNameDoubleClick = handleNavigation;

        const onNameEdit = (updatedRow: any, originalRow: any) => {
            if (updatedRow.name !== originalRow.name) {
                const newPath = `${originalRow.path.substring(0, originalRow.path.lastIndexOf('/'))}/${updatedRow.name}`;
                dispatch(renameNode({ path: originalRow.path, newPath }))
                    .unwrap()
                    .then(() => dispatch(getData()));
            }
            return updatedRow;
        };

        return <Box sx={{ flex: 9, height: '100%', pl: 2 }}>
            <DeleteDialog />
            <FileViewer files={viewerFiles} open={fileViewerOpen} onClose={() => setFileViewerOpen(false)} initialFileIndex={initialFileIndex} />
            <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ flex: 1 }}>{`Archivos: ${selectedFolder}`}</Typography>
                <IconButton size="small" onClick={() => fileInputRef.current?.click()} title="Upload files"><PostAdd /></IconButton>
                <IconButton size="small" title="Create folder"><CreateNewFolder /></IconButton>
                <IconButton size="small" onClick={() => dispatch(getData())} title="Refresh"><Refresh /></IconButton>
                <IconButton onClick={openDeleteDialog} color="error" disabled={!selectedRows || !selectedRows.ids || selectedRows.ids.size === 0} title="Delete selected"><Delete /></IconButton>
            </Box>
            <hr style={{ height: 1, background: '#e0e0e0', border: 'none', margin: '4px 0' }} />
            <Box sx={{ flex: 1, overflow: 'auto', height: 'calc(100% - 48px)' }}>
                <DataGrid
                    getRowId={r => r.path}
                    rows={nodesInDir}
                    processRowUpdate={onNameEdit}
                    columns={columns}
                    density="compact"
                    onCellDoubleClick={(_, event) => event.stopPropagation()} // Prevent default double-click behavior (entering edit mode)
                    onRowClick={(params, event) => {
                        // Check if we clicked on a specific UI element that should have its own behavior
                        const target = event.target as HTMLElement;
                        const isCheckbox = target.closest('.MuiCheckbox-root') !== null;
                        const isEditButton = target.closest('.edit-icon') !== null;

                        // If clicking anywhere except checkbox or edit icon...
                        if (!isCheckbox && !isEditButton) {
                            // For directories, navigate into them
                            if (params.row.type === 'dir' || params.row.type === 'up-dir') {
                                // Navigate instead of selecting
                                event.preventDefault();
                                event.stopPropagation(); // Prevent selection

                                // Use setTimeout to ensure event propagation is fully stopped
                                // before we attempt navigation
                                setTimeout(() => { handleNavigation(params.row.path, params.row.type) }, 0);
                                return false;
                            }
                            // For files, just allow default row selection
                        }
                    }}
                    disableRowSelectionOnClick={true} // Don't select row when clicking anywhere except the checkbox
                    initialState={{
                        pagination: { paginationModel: { page: 0, pageSize: 20 } },
                        sorting: {
                            sortModel: [{ field: 'name', sort: 'asc' }]
                        }
                    }}
                    pageSizeOptions={[10, 20, 50]}
                    checkboxSelection
                    onRowSelectionModelChange={setSelectedRows}
                    sx={{
                        border: 'none',
                        '& .MuiDataGrid-cell:focus': { outline: 'none' },
                        '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(25, 118, 210, 0.04)', cursor: 'pointer' },
                        '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'rgba(25, 118, 210, 0.08)' }
                    }}
                />
            </Box>
        </Box>
    };

    return (<Box sx={{ minHeight: 352, minWidth: 250, height: '100%', borderTop: '1px solid rgba(156, 156, 156,  0.5)', pt: 2 }}>
        <Box sx={{ display: 'flex', height: '100%' }}>
            <FoldersTreeView />
            <FilesTable />
        </Box>
    </Box>);
}