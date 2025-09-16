import { handleString, replaceAll } from "../lib";
import { TextField } from "@mui/material";
export default function FieldsFromModelEmail({ staticFields, setStaticFields }: any) {
    const handleChange = (e: any, field: string) => {
        setStaticFields((prev: any) => ({...prev, [field]: e.target.value}));
    }

    const formatFieldLabel = (field: string) => {
        // Primero removemos las llaves {{ }}
        let label = replaceAll(field, '{{', '');
        label = replaceAll(label, '}}', '');
        // Luego aplicamos el formateo de string para uniformidad
        return handleString(label, true); // true para mayúsculas
    }

    return (
        <>
            {Object.keys(staticFields || {}).map((field, index) => (
                <TextField 
                    key={`field-${index}`} 
                    value={staticFields[field] || ''}
                    sx={{ width: '100%', m: '1rem' }} 
                    label={formatFieldLabel(field)} 
                    onChange={(e) => handleChange(e, field)} 
                />
            ))}
        </>
    );
}