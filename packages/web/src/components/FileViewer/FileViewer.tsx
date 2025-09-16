import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, Button, Paper, CircularProgress } from '@mui/material';
import { Close, NavigateBefore, NavigateNext, Download } from '@mui/icons-material';
import { getFileType } from '../../lib/index';

export interface FileViewerItem {
    name: string;
    fileURL: string;
    type?: string; // Optional: can be inferred from name extension
    size?: number; // Optional: file size for display
}

export interface FileViewerProps {
    files: FileViewerItem[];
    open: boolean;
    onClose: () => void;
    initialFileIndex?: number;
}

// Function to render preview based on file type
const FilePreview: React.FC<{ file: FileViewerItem, loading: boolean, setLoading: (loading: boolean) => void }> = ({ file, loading, setLoading }) => {
    const [textContent, setTextContent] = useState<string>('');
    const fileType = file.type || getFileType(file.name);

    useEffect(() => {
        setLoading(true);
        if (fileType === 'text' || fileType === 'code') {
            fetch(file.fileURL)
                .then(response => response.text())
                .then(text => {
                    setTextContent(text);
                    setLoading(false);
                })
                .catch(error => {
                    console.error('Error loading text file:', error);
                    setLoading(false);
                });
        }
    }, [file, fileType, setLoading]);

    // if (loading) {
    //     return (
    //         <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
    //             <CircularProgress />
    //         </Box>
    //     );
    // }

    console.log({ file, loading });
    switch (fileType) {
        case 'image':
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', maxHeight: '70vh', padding: 2, id: 'file-viewer' }}>
                    <img
                        src={file.fileURL}
                        alt={file.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        onLoad={() => setLoading(false)}
                        onError={() => setLoading(false)}
                    />
                </Box>
            );

        case 'video':
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', maxHeight: '70vh', padding: 2 }}>
                    <video
                        controls
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                        onLoadedData={() => setLoading(false)}
                        onError={() => setLoading(false)}
                    >
                        <source src={file.fileURL} />
                        Your browser does not support the video tag.
                    </video>
                </Box>
            );

        case 'audio':
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', padding: 2 }}>
                    <audio
                        controls
                        style={{ width: '100%' }}
                        onLoadedData={() => setLoading(false)}
                        onError={() => setLoading(false)}
                    >
                        <source src={file.fileURL} />
                        Your browser does not support the audio tag.
                    </audio>
                </Box>
            );

        case 'pdf':
            return (
                <Box sx={{ height: '70vh', width: '100%', padding: 2 }}>
                    <iframe
                        src={`${file.fileURL}#view=FitH`}
                        title={file.name}
                        width="100%"
                        height="100%"
                        onLoad={() => setLoading(false)}
                        onError={() => setLoading(false)}
                    />
                </Box>
            );

        case 'text':
        case 'code':
            return (
                <Box sx={{ padding: 2, maxHeight: '70vh', overflow: 'auto' }}>
                    <Paper sx={{ padding: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                        {textContent}
                    </Paper>
                </Box>
            );

        case 'office':
            return (
                <Box sx={{ padding: 4, textAlign: 'center' }}>
                    <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                        Preview not available for this file type
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<Download />}
                        href={file.fileURL}
                        download={file.name}
                    >
                        Download File
                    </Button>
                </Box>
            );

        default:
            return (
                <Box sx={{ padding: 4, textAlign: 'center' }}>
                    <Typography variant="h6" component="div">
                        Unknown file type
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<Download />}
                        href={file.fileURL}
                        download={file.name}
                        sx={{ mt: 2 }}
                    >
                        Download File
                    </Button>
                </Box>
            );
    }
};

const FileViewer: React.FC<FileViewerProps> = ({ files, open, onClose, initialFileIndex = 0 }) => {
    const [currentIndex, setCurrentIndex] = useState<number>(initialFileIndex);
    const [loading, setLoading] = useState<boolean>(true);
    const currentFile = files[currentIndex];
    const hasMultipleFiles = files.length > 1;

    if (!files.length) return null;

    useEffect(() => {
        if (open) {
            setCurrentIndex(initialFileIndex);
            setLoading(true);
        }
    }, [open, files, initialFileIndex]);

    const handlePrevious = () => {
        setLoading(true);
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1));
    };

    const handleNext = () => {
        setLoading(true);
        setCurrentIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0));
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            sx={{ '& .MuiDialog-paper': { height: '80vh', display: 'flex', flexDirection: 'column' } }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <Typography variant="h6" component="div" noWrap sx={{ maxWidth: '70%', textOverflow: 'ellipsis' }}>
                        {currentFile?.name}
                    </Typography>

                    {/* File count indicator */}
                    {hasMultipleFiles && (
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                            {currentIndex + 1} of {files.length}
                        </Typography>
                    )}
                </Box>

                <Box>
                    {/* Download button */}
                    <IconButton
                        size="small"
                        href={currentFile?.fileURL}
                        download={currentFile?.name}
                        sx={{ mr: 1 }}
                    >
                        <Download />
                    </IconButton>

                    {/* Close button */}
                    <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
                {/* File preview */}
                <FilePreview file={currentFile} loading={loading} setLoading={setLoading} />

                {/* Navigation arrows for multiple files */}
                {hasMultipleFiles && (
                    <Box sx={{ position: 'absolute', top: '50%', width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                        <IconButton
                            onClick={handlePrevious}
                            sx={{
                                left: 8,
                                transform: 'translateY(-50%)',
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
                            }}
                        >
                            <NavigateBefore />
                        </IconButton>
                        <IconButton
                            onClick={handleNext}
                            sx={{
                                right: 8,
                                transform: 'translateY(-50%)',
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
                            }}
                        >
                            <NavigateNext />
                        </IconButton>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default FileViewer;