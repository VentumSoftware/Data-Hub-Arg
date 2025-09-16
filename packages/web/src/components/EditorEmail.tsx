import React, { useRef } from 'react';
import { Box, Button } from '@mui/material';
import EmailEditor from 'react-email-editor';

const EditorEmail = ({ onSave }: any) => {
  const emailEditorRef = useRef(null);

  const onLoad = () => {
    console.log('Editor cargado');
  };

  const exportHTML = () => {
    const editor = emailEditorRef?.current?.editor;
    editor.exportHtml(({ html }: any) => {
      if (onSave) onSave(html);
    });
  };

  return (
    <Box sx={{ pt: '1rem' }}>
      <EmailEditor ref={emailEditorRef} onLoad={onLoad} />
      <Button variant="contained" onClick={exportHTML} sx={{ mt: '1rem' }}>Confirmar Cuerpo del Mail</Button>
    </Box>
  );
};

export default EditorEmail;