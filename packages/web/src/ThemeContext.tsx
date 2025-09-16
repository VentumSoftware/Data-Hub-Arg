import React, { createContext, useContext, useMemo, useState, useRef, useEffect } from 'react';
import { ThemeProvider as MUIThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from './theme';
//import { getMyCompany } from './store/reducers/myCompanySlice';
import { AppDispatch, RootState } from './store';
import { useSelector, useDispatch } from "react-redux";

type ColorMode = 'light' | 'dark';

interface ThemeContextType {
  toggleColorMode: () => void;
  mode: ColorMode;
}

const ThemeContext = createContext<ThemeContextType>({
  toggleColorMode: () => { },
  mode: 'light',
});

export const useThemeContext = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ColorMode>('dark');
  const dispatch = useDispatch<AppDispatch>();
  const fetched = null // useSelector((state: RootState) => state.myCompany.fetched);
  //const template = useSelector((state: RootState) => state.myCompany.data?.company?.template);
  //useEffect(() => { if (!fetched) { dispatch(getMyCompany()); } }, [dispatch]);
  const toggleColorMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ toggleColorMode, mode }}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
