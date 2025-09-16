import { CircularProgress, Dialog, DialogContent } from '@mui/material';

export const LoadingDialog = ({ open }: { open: boolean}) => {
    return <Dialog open={open}
        PaperProps={{ style: { backgroundColor: 'transparent', boxShadow: 'none' } }}
        BackdropProps={{ sx: { backgroundColor: 'rgba(0, 0, 0, 0.75)', } }}
    >
        <DialogContent sx={{ backgroundColor: 'transparent', overflow: "hidden" }}>
            <CircularProgress sx={{ color: 'var(--primary-contrastText) !important' }} />
        </DialogContent>
    </Dialog>

};