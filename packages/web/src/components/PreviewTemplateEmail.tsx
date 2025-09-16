import FileHTMLPreview from "./FileHTMLPreview";
import { Box, Typography } from "@mui/material";
import { handleReplacementOfDinamicFields, handleReplacementOfStaticFields } from "../lib";
export default function PreviewTemplateEmail({ instanceInfo, height = '100%', width = '100%', staticFields, testUnit, fieldsMail }: any) {
    const { html, subject } = instanceInfo;
    return html ? (
        <Box sx={{ flexGrow: 1, width, pt: 2 }}>
            <Typography>To: {testUnit?.user?.email} ({testUnit?.user?.name} {testUnit?.user?.lastName}) - Unidad: {testUnit?.unit}</Typography>
            <Typography>Asunto: {handleReplacementOfStaticFields(handleReplacementOfDinamicFields(subject, fieldsMail, testUnit), staticFields)}</Typography>
            <FileHTMLPreview html={handleReplacementOfStaticFields(handleReplacementOfDinamicFields(html, fieldsMail, testUnit), staticFields)} height={height} width={width} />
        </Box>
    ) : <Typography>No hay vista previa disponible</Typography>
}