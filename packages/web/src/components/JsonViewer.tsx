import React, { useState } from "react";
import {
  Box,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
  SxProps,
  Theme
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { v4 } from 'uuid';

type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonObject 
  | JsonArray 
  | React.ReactNode;

interface JsonObject {
  [key: string]: JsonValue;
}

type JsonArray = JsonValue[];

interface RenderComponentProps {
  k: string;
  v: JsonValue;
  sx?: SxProps<Theme>;
  depth?: number;
}

interface JsonViewerComponents {
  RenderObject?: React.ComponentType<RenderComponentProps>;
  RenderArray?: React.ComponentType<RenderComponentProps>;
  RenderString?: React.ComponentType<RenderComponentProps>;
  RenderNumber?: React.ComponentType<RenderComponentProps>;
  RenderBoolean?: React.ComponentType<RenderComponentProps>;
  RenderComponent?: React.ComponentType<RenderComponentProps>;
}

interface JsonViewerProps {
  json: JsonObject | JsonArray | null;
  subheader?: string;
  sx?: SxProps<Theme>;
  components?: JsonViewerComponents;
}
function isReactElement(value: unknown): value is React.ReactElement {
  return (
    typeof value === 'object' && 
    value !== null && 
    '$$typeof' in value && 
    (value as { $$typeof: symbol }).$$typeof === Symbol.for('react.element')
  );
}
const JsonViewer: React.FC<JsonViewerProps> = ({ 
  json, 
  subheader, 
  sx = {}, 
  components = {} 
}) => {
  const defaultComponents = {
    RenderObject: ({ k, v, sx = {}, depth = 0 }: RenderComponentProps) => {
      const [open, setOpen] = useState(false);
      const handleClick = () => setOpen(!open);
     
      return (
        <>
          <ListItemButton onClick={handleClick} sx={{ paddingLeft: `${depth}rem` }}>
            <ListItemText primary={<Typography fontWeight={500}>{k}</Typography>} />
            {open ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={open} timeout="auto" unmountOnExit sx={{ paddingLeft: `${depth}rem` }}>
            <List component="div" disablePadding>
              {v && typeof v === 'object' && !Array.isArray(v) && v !== null && (
                Object.entries(v).map(([k, v]) => {
                  if (Array.isArray(v)) {
                    return <RenderArray k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                  } else if (v && typeof v === 'object' && '$$typeof' in v && v.$$typeof === Symbol.for('react.element')) {
                    return <RenderComponent k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                  } else if (v && typeof v === 'object') {
                    return <RenderObject k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                  } else if (typeof v === 'string') {
                    return <RenderString k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                  } else if (typeof v === 'number') {
                    return <RenderNumber k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                  } else if (typeof v === 'boolean') {
                    return <RenderBoolean k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                  }
                  return null;
                })
              )}
            </List>
          </Collapse>
        </>
      );
    },
    RenderArray: ({ k, v, sx = {}, depth = 0 }: RenderComponentProps) => {
      const [open, setOpen] = useState(false);
      const handleClick = () => setOpen(!open);
      
      return (
        <>
          <ListItemButton onClick={handleClick} sx={{ paddingLeft: `${depth}rem` }}>
            <ListItemText primary={<Typography fontWeight={500}>{k}</Typography>} />
            {open ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={open} timeout="auto" unmountOnExit sx={{ paddingLeft: `${depth}rem` }}>
            <List component="div" disablePadding>
              {Array.isArray(v) && v.map((v, i) => {
                const k = (i + 1).toString();
                if (Array.isArray(v)) {
                  return <RenderArray k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                } else if (v && typeof v === 'object' && isReactElement(v)) {
                  return <RenderComponent k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                } else if (v && typeof v === 'object') {
                  return <RenderObject k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                } else if (typeof v === 'string') {
                  return <RenderString k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                } else if (typeof v === 'number') {
                  return <RenderNumber k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                } else if (typeof v === 'boolean') {
                  return <RenderBoolean k={k} v={v} sx={sx} depth={depth + 1} key={v4()} />;
                }
                return null;
              })}
            </List>
          </Collapse>
        </>
      );
    },
    RenderString: ({ k, v, sx = {}, depth = 0 }: RenderComponentProps) => (
      <ListItemButton sx={{ paddingLeft: `${depth}rem` }}>
        <ListItemText primary={
          <>
            <Typography component="span" fontWeight={500}>{`${k}: `}</Typography>
            <Typography component="span" color={'primary'} fontWeight={600}>{`${v}`}</Typography>
          </>
        } />
      </ListItemButton>
    ),
    RenderNumber: ({ k, v, sx = {}, depth = 0 }: RenderComponentProps) => (
      <ListItemButton sx={{ paddingLeft: `${depth}rem` }}>
        <ListItemText primary={
          <>
            <Typography component="span" fontWeight={500}>{`${k}: `}</Typography>
            <Typography component="span" color={'primary'} fontWeight={600}>{`${v}`}</Typography>
          </>
        } />
      </ListItemButton>
    ),
    RenderBoolean: ({ k, v, sx = {}, depth = 0 }: RenderComponentProps) => (
      <ListItemButton sx={{ paddingLeft: `${depth}rem` }}>
        <ListItemText primary={
          <>
            <Typography component="span" fontWeight={500}>{`${k}: `}</Typography>
            <Typography component="span" color={'primary'} fontWeight={600}>{`${v ? 'SI' : 'NO'}`}</Typography>
          </>
        } />
      </ListItemButton>
    ),
    RenderComponent: ({ k, v, sx = {}, depth = 0 }: RenderComponentProps) => (
      <ListItemButton sx={{ paddingLeft: `${depth}rem` }}>
        <ListItemText primary={
          <>
            <Typography component="span" fontWeight={500}>{`${k}: `}</Typography>
            {v as React.ReactNode}
          </>
        } />
      </ListItemButton>
    ),
    ...components
  };

  const {
    RenderObject,
    RenderArray,
    RenderString,
    RenderNumber,
    RenderBoolean,
    RenderComponent
  } = defaultComponents;

  const renderValue = (k: string, v: JsonValue) => {
    if (Array.isArray(v)) {
      return <RenderArray k={k} v={v} sx={sx} key={v4()} />;
    } else if (v && typeof v === 'object' && isReactElement(v)) {
      return <RenderComponent k={k} v={v} sx={sx} key={v4()} />;
    } else if (v && typeof v === 'object') {
      return <RenderObject k={k} v={v} sx={sx} key={v4()} />;
    } else if (typeof v === 'string') {
      return <RenderString k={k} v={v} sx={sx} key={v4()} />;
    } else if (typeof v === 'number') {
      return <RenderNumber k={k} v={v} sx={sx} key={v4()} />;
    } else if (typeof v === 'boolean') {
      return <RenderBoolean k={k} v={v} sx={sx} key={v4()} />;
    }
    return null;
  };

  return (
    <List
      sx={{ width: '100%', bgcolor: 'background.paper', ...sx }}
      component="nav"
      subheader={subheader ? (
        <ListSubheader 
          component="div" 
          id="nested-list-subheader" 
          sx={{ fontStyle: 'italic', paddingLeft: 0 }}
        >
          {subheader}
        </ListSubheader>
      ) : null}
    >
      {json && (Array.isArray(json) 
        ? json.map((v, i) => renderValue(i.toString(), v))
        : Object.entries(json).map(([k, v]) => renderValue(k, v))
      )}
    </List>
  );
};

export default JsonViewer;