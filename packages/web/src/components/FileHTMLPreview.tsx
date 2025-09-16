import { Typography } from '@mui/material';
export default function FileHTMLPreview(props: any) {
    const { html, height, width } = props;
    return html
        ? <iframe style={{ height, width }} srcDoc={html} title="Vista previa" />
        : <Typography>No hay vista previa disponible</Typography>;
};

