import React from "react";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

interface PerWidgetProps {
  id: string;
  value?: number;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  label?: string;
  onChange: (value?: number) => void;
}

const PerWidget: React.FC<PerWidgetProps> = ({
  id,
  value,
  required = false,
  disabled = false,
  readonly = false,
  label,
  onChange,
}) => {
  return (
    <TextField
      id={id}
      label={label}
      value={value ?? ""}
      required={required}
      disabled={disabled}
      InputProps={{
        startAdornment: <InputAdornment position="start">%</InputAdornment>,
        readOnly: readonly,
      }}
      fullWidth
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        onChange(event.target.value === "" ? undefined : Number(event.target.value))
      }
      type="number"
      variant="outlined"
    />
  );
};

export default PerWidget;
