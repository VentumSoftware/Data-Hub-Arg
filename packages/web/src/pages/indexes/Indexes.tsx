import React, { useRef, useEffect, useState } from 'react';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Modal,
  Fade,
  Backdrop,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  FormControlLabel,
  Divider, Container, Skeleton, Chip, Fab
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import * as math from 'mathjs';
import { useDispatch } from 'react-redux';
import { getIndexes, getCurrencyIndexes } from './indexesSlice';
import { AppDispatch } from '../../store';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import Switch from '@mui/material/Switch';
import { useThemeContext } from '../../ThemeContext';
import { styled, useTheme } from '@mui/material/styles';
import VentumLogo from '../../components/VentumLogo';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Code,
  Security,
  Speed,
  CloudDone,
  GitHub,
  Launch,
  ArrowForward, KeyboardArrowUp
} from '@mui/icons-material';
import path from 'path';
const { VITE_API_URL } = import.meta.env;

const MaterialUISwitch = styled(Switch)(({ theme }) => ({
  width: 62,
  height: 34,
  padding: 7,
  '& .MuiSwitch-switchBase': {
    margin: 0,
    padding: 0,
    top: '50%',
    transform: 'translateX(6px) translateY(-50%)',
    '&.Mui-checked': {
      color: 'background.default',
      transform: 'translateX(35px) translateY(-50%)',
      '& .MuiSwitch-thumb:before': {
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="15" width="15" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
          '#fff',
        )}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`,
      },
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: '#aab4be',
        ...theme.applyStyles('dark', {
          backgroundColor: '#8796A5',
        }),
      },
    },
  },
  '& .MuiSwitch-thumb': {
    backgroundColor: 'background.default',
    width: 20, // Reducido de 22 a 20
    height: 20, // Reducido de 22 a 20
    '&::before': {
      content: "''",
      position: 'absolute',
      width: '100%',
      height: '100%',
      left: 0,
      top: 0,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="15" width="15" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
        '#090909ff',
      )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`,
    },
    ...theme.applyStyles('dark', {
      backgroundColor: 'background.default',
    }),
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: '#aab4be',
    borderRadius: 20 / 2,
    height: 20, // Añadido para controlar la altura del track
    ...theme.applyStyles('dark', {
      backgroundColor: '#8796A5',
    }),
  },
}));
interface CurrencyIndex {
  id: number;
  date: string;
  currenciesRelationsId: number;
  value: number;
  isDeleted: boolean;
  editedAt: string;
  editedBy: number;
  editedSession?: string;
  dividendCurrencyCode: string;
  dividendCurrencyLabel: string;
  divisorCurrencyCode: string;
  divisorCurrencyLabel: string;
  op: 'direct' | 'inverse' | 'both';
}

interface PivotedData {
  date: string;
  [key: string]: string | number; // Dynamic keys for each divisor-operation combination
}

interface Currency {
  id: number;
  code: string;
  label: string;
  symbol: string;
}

interface ConversionForm {
  value: string;
  fromCurrencyId: string;
  fromDate: string;
  toCurrencyId: string;
  toDate: string;
  constantCurrencyId: string;
}

interface ConversionResult {
  value: number;
  from: { date: string; currencyId: number };
  to: { date: string; currencyId: number };
  constantCurrencyId: number;
};
// Componente Card para cada índice
const IndexCard: React.FC<{ data: PivotedData }> = ({ data }) => {
  const [showAll, setShowAll] = useState(false);
  
  return (
  <Card
    sx={{
      mb: 2,
      p: 2,
      border: `1px solid rgba(190, 181, 181, 0.1)`,
      '&:hover': {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
        transition: 'box-shadow 0.2s ease-in-out'
      },
      height: '100%', width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignContent: 'stretch'
    }}
  >
      {/* Header */}
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
        <Typography variant="h6" fontWeight="bold" color="primary">
          {new Date(data.date).toLocaleDateString('es-ES', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </Typography>
        {data.date > new Date().toISOString().split('T')[0] && (
          <Chip
            label="Proyectado"
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* Contenido de monedas */}
      <Grid container spacing={1}>
        {Object.entries(data)
          .filter(([key]) => key !== 'date' && key !== 'id')
          .slice(0, showAll ? undefined : 4)
          .map(([currency, value]) => (
            <Grid size={12} key={currency}> 
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" fontWeight="medium" color="text.secondary">
                  {currency.toUpperCase()}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {typeof value === 'number' ? value.toFixed(4) : 'N/A'}
                </Typography>
              </Box>
            </Grid>
          ))}
      </Grid>

      {Object.keys(data).filter(key => key !== 'date' && key !== 'id').length > 4 && (
        <Box textAlign="center" mt={1}>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              setShowAll((prevShowAll) => !prevShowAll );
            }}>
          <Typography variant="caption" color="text.secondary">
            { showAll ? 'Mostrar -' : 'Mostrar '+ `${Object.keys(data).filter(key => key !== 'date' && key !== 'id').length - 4} +`}
          </Typography>
          </Button>
        </Box>
      )}
    </Box>

  </Card>
)};
// Skeleton loader para cards
const CardSkeleton: React.FC = () => (
  <Card sx={{ mb: 2, p: 2 }}>
    <Skeleton variant="text" width="60%" height={30} />
    <Skeleton variant="text" width="40%" height={20} sx={{ mt: 1 }} />
    <Box display="flex" justifyContent="space-between" mt={2}>
      <Skeleton variant="rectangular" width="45%" height={60} />
      <Skeleton variant="rectangular" width="45%" height={60} />
    </Box>
  </Card>
);
const Indexes: React.FC = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      const container = containerRef.current;
  
      if (!container) return;
  
      const handleScroll = () => {
        // Detecta si se ha scrolleado más de 10px
        const scrolled = container.scrollTop > 10;
        setIsScrolled(scrolled);
      };
  
      // Agrega el event listener al contenedor
      container.addEventListener('scroll', handleScroll);
  
      // Limpia el event listener cuando el componente se desmonta
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }, []);
    const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth' // Desplazamiento suave
      });
    }
  };
  const navigate = useNavigate();
  const pathname = (useLocation()).pathname;

  const dispatch = useDispatch<AppDispatch>();
  const { indexes, currencies } = useSelector((state: RootState) => state.indexes?.data);
  const { toggleColorMode, mode } = useThemeContext();

  const theme = useTheme();
  //const [indexes, setIndexes] = useState<CurrencyIndex[]>([]);
  const [pivotedData, setPivotedData] = useState<PivotedData[]>([]);
  const [displayData, setDisplayData] = useState<PivotedData[]>([]); // Final data for DataGrid
  const [columns, setColumns] = useState<GridColDef[]>([]);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 100 });
  // Estado para la versión cards
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(10); // Puedes ajustar según necesidad
  // Conversion form state
  const [conversionForm, setConversionForm] = useState<ConversionForm>({
    value: '100',
    fromCurrencyId: '',
    fromDate: '2025-07-24',
    toCurrencyId: '',
    toDate: '2025-07-24',
    constantCurrencyId: '',
  });
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Modal states
  const [columnasModalOpen, setColumnasModalOpen] = useState(false);
  const [proyeccionesModalOpen, setProyeccionesModalOpen] = useState(false);

  // Proyecciones modal states
  const [mathExpression, setMathExpression] = useState('');
  const [mathResult, setMathResult] = useState<string | null>(null);
  const [mathError, setMathError] = useState<string | null>(null);
  const [indexFormulas, setIndexFormulas] = useState<{ [key: string]: string }>({});
  const [projectionDate, setProjectionDateState] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1); // Default to tomorrow
    return date;
  });

  // Wrapper to track all projection date changes
  const setProjectionDate = (newDate: Date | string) => {
    const dateObj = newDate instanceof Date ? newDate : new Date(newDate);
    setProjectionDateState(dateObj);
  };
  const [projectedData, setProjectedData] = useState<PivotedData[]>([]);
  const [activeTab, setActiveTab] = useState<string>(pathname?.split('/').pop() || '');
  // console.log('AAAAAAAAAAAAAAAAAAAA', pathname?.split('/').pop(), activeTab)
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [dataGridKey, setDataGridKey] = useState(0); // Force DataGrid re-render

  const fetchIndexes = async (page: number, pageSize: number) => {
    try {
      setLoading(true);
      dispatch(getIndexes({ page, pageSize })).unwrap();

    } catch (err) {
      console.error('Error fetching indexes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setLoading(true);

    setRowCount(indexes?.length || 0);
    transformToPivotedData(indexes);
    setLoading(false);
  }, [indexes]);

  // Calcular datos para la paginación de cards
  const cardData = pivotedData.slice(0, (currentPage + 1) * itemsPerPage);
  const hasMoreCards = cardData.length < pivotedData.length;

  // Función para cargar más cards
  const loadMoreCards = () => {
    if (hasMoreCards) {
      setCurrentPage(prev => prev + 1);
    }
  };
  const handleConversion = async () => {
    try {
      setConversionLoading(true);
      setConversionError(null);

      const response = await fetch(`${VITE_API_URL}/api/indexes/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: parseFloat(conversionForm.value),
          from: {
            date: conversionForm.fromDate,
            currencyId: parseInt(conversionForm.fromCurrencyId),
          },
          to: {
            date: conversionForm.toDate,
            currencyId: parseInt(conversionForm.toCurrencyId),
          },
          constantCurrencyId: parseInt(conversionForm.constantCurrencyId),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to convert currency');
      }

      const result = await response.json();
      setConversionResult(result);
    } catch (err) {
      console.error('Error converting currency:', err);
      setConversionError(err instanceof Error ? err.message : 'Failed to convert currency');
    } finally {
      setConversionLoading(false);
    }
  };

  const evaluateMathExpression = () => {
    try {
      setMathError(null);
      if (!mathExpression.trim()) {
        setMathError('Por favor ingrese una expresión matemática');
        return;
      }

      // Create a scope with some useful constants and functions
      const scope = {
        pi: Math.PI,
        e: Math.E,
        // You can add more variables here, like current currency values
        // For example: dolarMEP: 632.32, peso: 1, etc.
      };

      // Evaluate the expression
      const result = math.evaluate(mathExpression, scope);

      // Format the result
      if (typeof result === 'number') {
        setMathResult(result.toFixed(6));
      } else if (math.isMatrix(result)) {
        setMathResult(math.format(result, { precision: 4 }));
      } else {
        setMathResult(String(result));
      }
    } catch (error) {
      setMathError(error instanceof Error ? error.message : 'Error al evaluar la expresión');
      setMathResult(null);
    }
  };

  const evaluateIndexFormula = (indexName: string, formula: string) => {
    return evaluateIndexFormulaForDate(indexName, formula, projectionDate);
  };

  const evaluateIndexFormulaForDate = (indexName: string, formula: string, targetDate: Date | string) => {
    try {
      if (!formula.trim()) return null;

      // Ensure targetDate is a proper Date object
      const date = targetDate instanceof Date ? targetDate : new Date(targetDate);
      if (isNaN(date.getTime())) {
        return 'Error: Invalid date';
      }

      // Get current value for the index (from historical data only, excluding projections)
      const getCurrentValue = (daysBack: number = 0) => {
        if (daysBack > 0) return null; // Only allow 0 or negative values

        // Always use fresh transformation from indexes
        let dataSource: PivotedData[] = [];

        if (indexes?.length > 0) {
          dataSource = transformIndexesToPivoted(indexes);
        } else {
          return 1000; // Default fallback
        }

        if (!dataSource.length) {
          return 1000; // Default fallback
        }

        // Filter out projection rows to get only historical data
        const today = new Date().toISOString().split('T')[0];
        const historicalData = dataSource.filter(row => row.date <= today);

        if (!historicalData.length) {
          return 1000; // Default fallback
        }

        const targetIndex = Math.abs(daysBack);

        // Special handling for v(0): find most recent non-null value
        if (targetIndex === 0) {
          // Check if the most recent row has a valid value
          if (historicalData.length > 0) {
            const mostRecentRow = historicalData[0];
            const mostRecentValue = mostRecentRow[indexName];

            if (typeof mostRecentValue === 'number' && !isNaN(mostRecentValue) && mostRecentValue !== null) {
              return mostRecentValue;
            }

            // If most recent is null, find the first non-null value
            for (let i = 1; i < historicalData.length; i++) {
              const row = historicalData[i];
              const value = row[indexName];
              if (typeof value === 'number' && !isNaN(value) && value !== null) {
                return value;
              }
            }
          }
        } else {
          // Normal handling for other daysBack values
          if (targetIndex < historicalData.length) {
            const targetRow = historicalData[targetIndex];
            const value = targetRow[indexName];
            if (typeof value === 'number' && !isNaN(value) && value !== null) {
              return value;
            }

            // If target index has null, search forward from that position
            for (let i = targetIndex + 1; i < historicalData.length; i++) {
              const row = historicalData[i];
              const value = row[indexName];
              if (typeof value === 'number' && !isNaN(value) && value !== null) {
                return value;
              }
            }
          }
        }

        // If still no value found, return 1000 as ultimate fallback
        return 1000;
      };

      // Calculate days and months from today to target date
      const today = new Date();
      const diffTime = date.getTime() - today.getTime();
      const d = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Days from now
      const m = Math.round(d / 30.44); // Average days per month
      const y = date.getFullYear();

      // Create a scope with the v function and date parameters
      const scope = {
        v: getCurrentValue,
        d: d,
        m: m,
        y: y,
        pi: Math.PI,
        e: Math.E,
      };

      // Create a function from the formula and call it with parameters
      // Remove arrow function syntax and evaluate as expression
      let cleanFormula = formula.trim();

      // If it starts with (v, d, m, y) =>, extract just the expression part
      if (cleanFormula.includes('=>')) {
        cleanFormula = cleanFormula.split('=>')[1].trim();
      }

      const result = math.evaluate(cleanFormula, scope);

      return typeof result === 'number' ? result.toFixed(4) : String(result);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Invalid formula'}`;
    }
  };

  const updateIndexFormula = (indexName: string, formula: string) => {
    setIndexFormulas(prev => ({
      ...prev,
      [indexName]: formula
    }));
  };

  // Get list of available indexes from columns
  const getAvailableIndexes = () => {
    return columns
      .filter(col => col.field !== 'date')
      .map(col => ({
        field: col.field,
        name: col.headerName || col.field
      }));
  };

  const calculateAndSaveProjections = () => {
    const projectionDates: PivotedData[] = [];

    // Calculate all dates from tomorrow to projection date (inclusive)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    // Ensure projectionDate is a proper Date object
    const endDate = projectionDate instanceof Date ? new Date(projectionDate) : new Date(projectionDate);
    const endDateStr = endDate.toISOString().split('T')[0]; // Get the target date as string

    const currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow
    currentDate.setHours(0, 0, 0, 0); // Normalize to start of day

    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Break if we've passed the end date
      if (dateStr > endDateStr) {
        break;
      }

      const projectionRow: PivotedData = {
        date: dateStr
      };

      // Calculate projections for this specific date
      getAvailableIndexes().forEach(index => {
        const formula = getDefaultFormula(index.field);
        if (formula && formula.trim()) {
          const result = evaluateIndexFormulaForDate(index.field, formula, new Date(currentDate));
          if (result && !result.toString().startsWith('Error:')) {
            projectionRow[index.field] = parseFloat(result);
          }
        }
      });

      projectionDates.push(projectionRow);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    setProjectedData([...projectionDates]); // Store array of projection rows with new reference

    // Data transformation will be handled by useEffect
  };

  // Get default formula for an index
  const getDefaultFormula = (indexField: string) => {
    return indexFormulas[indexField] || 'v(0)';
  };

  // Restore all formulas to default state
  const restoreDefaultFormulas = () => {
    setIndexFormulas({});
    setProjectedData([]);
    // Auto-calculate with default formulas
    setTimeout(() => {
      calculateAndSaveProjections();
    }, 100);
  };

  // Helper function to transform indexes data without state updates (for v(0) calculations)
  const transformIndexesToPivoted = (rawData: CurrencyIndex[]): PivotedData[] => {
    if (!rawData || rawData.length === 0) {
      return [];
    }

    // Group data by date
    const groupedByDate: { [date: string]: CurrencyIndex[] } = {};
    rawData.forEach(item => {
      if (!groupedByDate[item.date]) {
        groupedByDate[item.date] = [];
      }
      groupedByDate[item.date].push(item);
    });

    // Transform data to pivoted format
    const pivoted: PivotedData[] = Object.keys(groupedByDate).sort().reverse().map(date => {
      const row: PivotedData = { date };

      groupedByDate[date].forEach(item => {
        // Special case: CPI-MEP relation should show as one combined column
        if (item.dividendCurrencyLabel === 'CPI' && item.divisorCurrencyLabel === 'Dolar MEP' && item.op === 'both') {
          row['CPI/MEP'] = item.value;
          return;
        }

        // Handle divisor currencies
        let divisorKey: string;
        if (item.op === 'both') {
          divisorKey = item.divisorCurrencyLabel;
        } else {
          if (item.divisorCurrencyLabel === 'Dolar MEP' || item.divisorCurrencyLabel === 'Dolar CCL') {
            divisorKey = item.divisorCurrencyLabel;
          } else {
            const opText = item.op === 'direct' ? 'Compra' : 'Venta';
            divisorKey = `${item.divisorCurrencyLabel}-${opText}`;
          }
        }
        row[divisorKey] = item.value;

        // Handle dividend currencies
        if (item.dividendCurrencyLabel !== 'Peso' && !(item.dividendCurrencyLabel === 'CPI' && item.divisorCurrencyLabel === 'Dolar MEP')) {
          let dividendKey: string;
          if (item.op === 'both') {
            dividendKey = item.dividendCurrencyLabel;
          } else {
            const opText = item.op === 'direct' ? 'Venta' : 'Compra';
            dividendKey = `${item.dividendCurrencyLabel}-${opText}`;
          }
          row[dividendKey] = item.value;
        }
      });

      return row;
    });

    return pivoted;
  };

  const transformToPivotedData = (rawData: CurrencyIndex[]) => {
    try {

      if (!rawData || rawData.length === 0) {
        setPivotedData([]);
        setColumns([{ field: 'date', headerName: 'Fecha', width: 120 }]);
        return;
      }

      // Group data by date
      const groupedByDate: { [date: string]: CurrencyIndex[] } = {};
      rawData.forEach(item => {
        if (!groupedByDate[item.date]) {
          groupedByDate[item.date] = [];
        }
        groupedByDate[item.date].push(item);
      });

      // Get all unique currency-operation combinations (both dividend and divisor)
      const uniqueCombinations = new Set<string>();
      rawData.forEach(item => {
        // Special case: CPI-MEP relation should show as one combined column
        if (item.dividendCurrencyLabel.startsWith('CPI') && item.divisorCurrencyLabel.startsWith('Dolar MEP') && item.op === 'both') {
          uniqueCombinations.add('CPI/MEP');
          return; // Skip adding separate CPI and MEP columns for this relation
        }

        // Handle divisor currencies (existing logic)
        let divisorKey: string;
        if (item.op === 'both') {
          divisorKey = item.divisorCurrencyLabel;
        } else {
          // For Dolar MEP and Dolar CCL, don't add operation suffix since compra/venta are the same
          if (item.divisorCurrencyLabel.startsWith('Dolar MEP') || item.divisorCurrencyLabel.startsWith('Dolar CCL')) {
            divisorKey = item.divisorCurrencyLabel;
          } else {
            const opText = item.op === 'direct' ? 'Compra' : 'Venta';
            divisorKey = `${item.divisorCurrencyLabel}-${opText}`;
          }
        }
        uniqueCombinations.add(divisorKey);

        // Handle dividend currencies (for cases like CPI)
        // Only add if it's not "Peso" (which is the base currency)
        // And skip CPI when it's already handled as CPI/MEP above
        if (item.dividendCurrencyLabel !== 'Peso' && !(item.dividendCurrencyLabel.startsWith('CPI') && item.divisorCurrencyLabel.startsWith('Dolar MEP'))) {
          let dividendKey: string;
          if (item.op === 'both') {
            dividendKey = item.dividendCurrencyLabel;
          } else {
            // For dividend currencies, invert the operation text
            const opText = item.op === 'direct' ? 'Venta' : 'Compra';
            dividendKey = `${item.dividendCurrencyLabel}-${opText}`;
          }
          uniqueCombinations.add(dividendKey);
        }
      });


      // Define which currency types to show by default
      const visibleCurrencyTypes = ['Dolar MEP', 'Dolar CCL', 'Dolar Oficial', 'Dolar Blue', 'Dolar Informal', 'CPI/MEP', 'CAC', 'iCAC General', 'iCAC Mano de Obra', 'iCAC Materiales'];

      // Create dynamic columns
      const dynamicColumns: GridColDef[] = [
        {
          field: 'date',
          headerName: 'Fecha',
          width: 130,
          type: 'string',
          //pinned: 'left',
        }
      ];

      // Sort combinations and build visibility model
      const sortedCombinations = Array.from(uniqueCombinations).sort();
      const visibilityModel: { [key: string]: boolean } = {};

      sortedCombinations.forEach(combination => {
        // Check if this combination should be visible by default
        const isVisible = visibleCurrencyTypes.some(currencyType =>
          combination.startsWith(currencyType)
        );

        visibilityModel[combination] = isVisible;
        dynamicColumns.push({
          field: combination,
          headerName: combination
            .replace('Dolar Informal', 'Dolar Blue')
            .replace('iCAC General-Compra', 'iCAC')
            .replace('iCAC General-Venta', 'iCAC')
            .replace('iCAC General', 'iCAC')
            .replace('iCAC Mano de Obra-Compra', 'iCAC MO')
            .replace('iCAC Mano de Obra-Venta', 'iCAC MO')
            .replace('iCAC Mano de Obra', 'iCAC MO')
            .replace('iCAC Materiales-Compra', 'iCAC Mat')
            .replace('iCAC Materiales-Venta', 'iCAC Mat')
            .replace('iCAC Materiales', 'iCAC Mat'),
          flex: 1, // Increased by 10% from 130 to 145
          type: 'number',
          valueFormatter: (value) => value ? Number(value).toFixed(2) : '-',
        });
      });
      setColumns(dynamicColumns);
      setColumnVisibilityModel(visibilityModel);

      // Transform data to pivoted format
      const pivoted: PivotedData[] = Object.keys(groupedByDate).sort().reverse().map(date => {
        const row: PivotedData = { date };

        groupedByDate[date].forEach(item => {
          // Special case: CPI-MEP relation should show as one combined column
          if (item.dividendCurrencyLabel.startsWith('CPI') && item.divisorCurrencyLabel.startsWith('Dolar MEP') && item.op === 'both') {
            row['CPI/MEP'] = item.value;
            return; // Skip adding separate CPI and MEP values for this relation
          }

          // Handle divisor currencies (existing logic)
          let divisorKey: string;
          if (item.op === 'both') {
            divisorKey = item.divisorCurrencyLabel;
          } else {
            // For Dolar MEP and Dolar CCL, don't add operation suffix since compra/venta are the same
            if (item.divisorCurrencyLabel.startsWith('Dolar MEP') || item.divisorCurrencyLabel.startsWith('Dolar CCL')) {
              divisorKey = item.divisorCurrencyLabel;
            } else {
              const opText = item.op === 'direct' ? 'Compra' : 'Venta';
              divisorKey = `${item.divisorCurrencyLabel}-${opText}`;
            }
          }

          row[divisorKey] = item.value;

          // Handle dividend currencies (for cases like CPI)
          // Only add if it's not "Peso" (which is the base currency)
          // And skip CPI when it's already handled as CPI/MEP above
          if (item.dividendCurrencyLabel !== 'Peso' && !(item.dividendCurrencyLabel.startsWith('CPI') && item.divisorCurrencyLabel.startsWith('Dolar MEP'))) {
            let dividendKey: string;
            if (item.op === 'both') {
              dividendKey = item.dividendCurrencyLabel;
            } else {
              // For dividend currencies, invert the operation text
              const opText = item.op === 'direct' ? 'Venta' : 'Compra';
              dividendKey = `${item.dividendCurrencyLabel}-${opText}`;
            }
            // For dividend currencies, we might need to invert the value or use it as-is
            // depending on the business logic
            row[dividendKey] = item.value;
          }
        });

        return row;
      });

      // Add projection rows if we have projected data
      if (projectedData.length > 0) {
        projectedData.forEach(projectionRow => {
          pivoted.unshift(projectionRow); // Add at the beginning
        });
      }
      setPivotedData([...pivoted]); // Force new reference
      setDisplayData([...pivoted]); // Update display data separately
    } catch (error) {
      console.error('Error in transformation:', error);
      setError('Error transforming data');
    }
  };

  useEffect(() => {
    fetchIndexes(paginationModel.page, paginationModel.pageSize);
  }, [paginationModel.page, paginationModel.pageSize]);

  useEffect(() => {
    dispatch(getCurrencyIndexes());
  }, []);

  useEffect(() => {
    // Re-transform data when projections change or projection date changes
    if (indexes?.length > 0) {
      transformToPivotedData(indexes);
    }
  }, [projectedData]);

  // Separate useEffect to handle projection date changes and trigger recalculation
  useEffect(() => {
    // Only recalculate if we have data and no current projections (from clearing)
    if (pivotedData.length > 0 && projectedData.length === 0 && activeTab === 'proyecciones') {
      setTimeout(() => {
        calculateAndSaveProjections();
      }, 100);
    }
  }, [projectionDate, pivotedData.length, projectedData.length, activeTab, indexFormulas]);

  // Calculate projections when switching to Proyecciones tab or on initial load
  useEffect(() => {
    if (activeTab === 'proyecciones' && indexes?.length > 0) {
      // Only calculate if we don't have projections yet
      if (projectedData.length === 0) {
        setTimeout(() => {
          calculateAndSaveProjections();
        }, 500);
      }
    }
  }, [activeTab, indexes]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
    navigate(`/indices/${newValue}`);
  };

  return (<Box ref={containerRef} sx={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%', overflow: 'auto', backgroundColor: 'background.default' }}>

    {/* Header */}
    <Box sx={{
      backgroundColor: 'background.default',
      borderBottom: 'none',
      position: 'relative',
      // position: 'fixed',
      // top: 0,
      // zIndex: 10,
      width: '100%',
      transition: 'all 0.3s ease-in-out' // Agrega una transición suave
    }}>
      {/* Botón "Scroll to Top" */}
      <Fade in={isScrolled} timeout={300}>
        <Fab
          onClick={scrollToTop}
          sx={{
            position: 'fixed',
            top: 24,
            right: '50%',
            zIndex: 1000,
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark',
              //transform: 'scale(1.1)',
            },
            transition: 'all 1s ease-in-out',
            boxShadow: 3,
          }}
          size="medium"
          aria-label="scroll back to top"
        >
          <KeyboardArrowUp />
        </Fab>
      </Fade>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 2, px: 3

      }}>
        <VentumLogo onClick={() => navigate('/')} size="medium" />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="text"
            startIcon={<GitHub />}
            href="https://github.com/your-username/ventum-framework"
            target="_blank"
            sx={{ display: { xs: 'none', sm: 'flex' }, textTransform: 'none' }}
          >
            GitHub
          </Button>
          <FormControlLabel

            control={<MaterialUISwitch sx={{ m: 1 }} checked={mode === 'dark'} onChange={toggleColorMode} />}
            label=""
          />
        </Box>
      </Box>
    </Box>
    <Box sx={{ pr: 3, pl: 3, }}>
      {/* Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Índices" value={'historico'} />
          <Tab label="Proyecciones" value={'proyecciones'} />
          <Tab label="Funciones" value={'funciones'} />
          <Tab label="Resultado" value={'resultado'} />
          <Tab label="Conversor" value={'conversor'} />
          <Tab label="Ayuda" value={'ayuda'} />
        </Tabs>
      </Box>

      {/* Tab 0: Índices */}
      {['', 'indices', '/indices', '/', 'historico'].includes(activeTab) && (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5">
              Índices de Monedas
            </Typography>
            <Button variant="outlined" onClick={() => setColumnasModalOpen(true)}>
              Columnas
            </Button>
          </Box>
          <Paper sx={{ height: 'calc(100vh - 200px)', flexDirection: 'column', display: { xs: 'none', md: 'flex' } }}>
            <DataGrid
              key={dataGridKey}
              rows={displayData}
              columns={columns}
              columnVisibilityModel={columnVisibilityModel}
              onColumnVisibilityModelChange={setColumnVisibilityModel}
              loading={loading}
              paginationMode="server"
              rowCount={rowCount}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[100, 200, 500]}
              disableRowSelectionOnClick
              getRowId={(row) => row.date}
              slots={{ toolbar: GridToolbar }}
              slotProps={{
                toolbar: {
                  showQuickFilter: true,
                  //showColumnsButton: true,
                },
              }}
              sx={{
                display: { xs: 'none', md: 'flex' },
                flex: 1,
                '& .MuiDataGrid-columnHeader': {
                  fontSize: '0.75rem',
                },
                '& .MuiDataGrid-row': {
                  // Style projected rows (dates in the future)
                  ...(() => {
                    const today = new Date().toISOString().split('T')[0];
                    const projectedRowStyles: any = {};

                    projectedData.forEach(row => {
                      if (row.date > today) {
                        projectedRowStyles[`&[data-id="${row.date}"]`] = {
                          '& .MuiDataGrid-cell': {
                            color: '#d97706',
                            fontWeight: 'bold',
                          }
                        };
                      }
                    });

                    return projectedRowStyles;
                  })()
                }
              }}
            />
          </Paper>

          {/* VERSIÓN MOBILE - Cards (oculto en desktop) */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            {loading ? (
              // Loading skeletons
              Array.from(new Array(6)).map((_, index) => (
                <CardSkeleton key={index} />
              ))
            ) : error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : cardData.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  No hay datos disponibles
                </Typography>
              </Paper>
            ) : (
              <>
                {/* Grid de Cards responsive */}
                <Grid container spacing={2}  sx={{ 
    alignItems: "stretch" // ✅ Esto es clave para igualar alturas
  }}>
                  {cardData.map((data, index) => (
                    <Grid
                      size={{ xs: 12, sm: 6 }}
                       sx={{
        display: 'flex', // ✅ Flex para que el hijo ocupe toda la altura
      }}
                      key={`${data.date}-${index}`}
                    >
                      <IndexCard data={data} />
                    </Grid>
                  ))}
                </Grid>

                {/* Botón "Cargar más" con paginación infinita */}
                {hasMoreCards && (
                  <Box display="flex" justifyContent="center" mt={3} mb={2}>
                    <Button
                      variant="outlined"
                      onClick={loadMoreCards}
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={16} /> : null}
                    >
                      {loading ? 'Cargando...' : 'Cargar más'}
                    </Button>
                  </Box>
                )}

                {/* Información de paginación */}
                <Box mt={1} textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    Mostrando {cardData.length} de {pivotedData.length} fechas
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          <Box>
            <Typography variant="body1" gutterBottom>
              Mostrando {pivotedData.length} de {rowCount} fechas con tipos de cambio históricos
            </Typography>
          </Box>
        </>
      )}

      {/* Tab 1: Proyecciones */}
      {activeTab === 'proyecciones' && (
        <Box sx={{ pb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5">
              Proyecciones de Índices
            </Typography>
            <Button
              variant="outlined"
              color="secondary"
              onClick={restoreDefaultFormulas}
            >
              Restaurar por Defecto
            </Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Define fórmulas matemáticas para proyectar cada índice. Las fórmulas reciben 4 parámetros: (v, d, m, y)
            </Typography>
            <Tooltip
              title={
                <Box sx={{ p: 2, maxWidth: '600px' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: 'white' }}>
                    Parámetros de la función:
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'white' }}>
                    • <strong>v(daysBack)</strong>: Función que retorna el valor del índice hace X días (0 = hoy, -1 = ayer, etc.)
                    <br />
                    • <strong>d</strong>: Días en el futuro desde hoy hasta la fecha de proyección
                    <br />
                    • <strong>m</strong>: Meses en el futuro desde hoy hasta la fecha de proyección (aprox.)
                    <br />
                    • <strong>y</strong>: Año de la fecha de proyección
                    <br />
                    • <strong>Constantes</strong>: pi, e
                    <br />
                    • <strong>Funciones</strong>: sqrt(), log(), sin(), cos(), tan(), abs(), round(), etc.
                    <br />
                    • <strong>Ejemplos</strong>:
                    <br />
                    &nbsp;&nbsp;- <code>v(0) * 1.05</code> (5% de incremento)
                    <br />
                    &nbsp;&nbsp;- <code>v(0) * (1 + 0.01 * d)</code> (1% por día futuro)
                    <br />
                    &nbsp;&nbsp;- <code>v(0) + m * 50</code> (incremento de $50 por mes futuro)
                    <br />
                    &nbsp;&nbsp;- <code>(v(0) + v(-30)) / 2</code> (promedio con hace 30 días)
                  </Typography>
                </Box>
              }
              arrow
              placement="bottom-start"
              componentsProps={{
                tooltip: {
                  sx: {
                    maxWidth: '600px',
                    '& .MuiTooltip-tooltip': {
                      maxWidth: '600px'
                    }
                  }
                }
              }}
            >
              <IconButton size="small" sx={{ ml: 1 }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ mb: 3, p: 2, bgcolor: mode === 'dark' ? 'background.paperSecondary' : 'info.light', borderRadius: 1, color: 'text.secondary', border: '2px solid', borderColor: mode === 'dark' ? 'info.light' : 'info' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
                  <DatePicker
                    label="Fecha de Proyección"
                    value={projectionDate}
                    onChange={(newValue: any) => {
                      if (newValue) {
                        setProjectionDate(newValue);
                        // Clear projected data first
                        setProjectedData([]);
                        // The useEffect will handle recalculation when projectedData and projectionDate change
                      }
                    }}
                    shouldDisableDate={(date: any) => {
                      if (!date) return true;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const checkDate = new Date(date);
                      checkDate.setHours(0, 0, 0, 0);
                      return checkDate <= today;
                    }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: {

                        }
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid size={6}>
                <Typography variant="body2" >
                  Los resultados se calcularán para esta fecha
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {getAvailableIndexes().map((index) => {
            const formulaResult = evaluateIndexFormula(index.field, getDefaultFormula(index.field));
            const hasError = formulaResult && formulaResult.toString().startsWith('Error:');

            return (
              <Card key={index.field} sx={{ mb: 2, p: 2, borderRadius: 1, boxShadow: 'none' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap', }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', width: '160px', flexShrink: 0 }}>
                    {index.name}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Fórmula(v,d,m,y) {'=>'}
                  </Typography>

                  <TextField
                    size="small"
                    variant="outlined"
                    placeholder="Ej: v(0) * (1 + 0.05 * (m / 12))"
                    value={getDefaultFormula(index.field)}
                    onChange={(e) => {
                      updateIndexFormula(index.field, e.target.value);

                      // Clear existing timeout and use immediate update
                      if (autoSaveTimeout) {
                        clearTimeout(autoSaveTimeout);
                      }

                      // Clear projections and trigger recalculation via useEffect
                      const newTimeout = setTimeout(() => {
                        setProjectedData([]);
                      }, 300); // Short delay for UI responsiveness
                      setAutoSaveTimeout(newTimeout);
                    }}
                    error={hasError || false}
                    sx={{
                      flexGrow: 1,
                      //minWidth: '500px', // Wider like before
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          border: '1px solid #ccc',
                        },
                      }
                    }}
                  />

                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Resultado
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      color: hasError ? 'error.main' : 'success.main',
                      fontWeight: 'bold',
                      minWidth: '100px',
                      textAlign: 'right',
                      flexShrink: 0
                    }}
                  >
                    {hasError ? 'Error' : (formulaResult || '-')}
                  </Typography>
                </Box>

                {/* Error message on new line */}
                {hasError && (
                  <Box sx={{ mt: 1, ml: '192px' }}> {/* Align with formula input - adjusted for wider index name */}
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{
                        display: 'block',
                        backgroundColor: 'error.light',
                        color: 'error.contrastText',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}
                    >
                      {formulaResult}
                    </Typography>
                  </Box>
                )}
              </Card>
            )
          })}

        </Box>
      )}

      {/* Tab 3: Resultado */}
      {activeTab === 'resultado' && (
        <Box sx={{ pb: 2 }}>
          <Typography variant="h5" gutterBottom>
            Resultados de Proyecciones
          </Typography>
          {projectedData.length > 0 ? (
            <Paper>
              <DataGrid
                rows={projectedData}
                columns={columns}
                autoHeight
                disableRowSelectionOnClick
                getRowId={(row) => row.date}
                sx={{
                  '& .MuiDataGrid-columnHeader': {
                    fontSize: '0.75rem',
                  },
                  '& .MuiDataGrid-cell': {
                    color: '#d97706',
                    fontWeight: 'bold',
                  }
                }}
              />
            </Paper>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No hay proyecciones disponibles. Ve a la pestaña "Funciones" para crear proyecciones.
            </Typography>
          )}
        </Box>
      )}

      {/* Tab 2: Funciones */}
      {activeTab === 'funciones' && (
        <Box sx={{ pb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5">
              Funciones Avanzadas
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Define fórmulas matemáticas que pueden referenciar múltiples índices. Las fórmulas reciben parámetros: (v, d, m, y)
            </Typography>
            <Tooltip
              title={
                <Box sx={{ p: 2, maxWidth: '600px' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: 'white' }}>
                    Parámetros de la función:
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'white' }}>
                    • <strong>v(currency)</strong>: Función que retorna el valor del índice especificado
                    <br />
                    &nbsp;&nbsp;- currency: Código del índice en minúsculas con : (ej: "dolar:mep", "cpi:mep", "icac:general")
                    <br />
                    • <strong>d</strong>: Días transcurridos desde la fecha de inicio hasta el día actual del cálculo
                    <br />
                    • <strong>m</strong>: Meses transcurridos desde la fecha de inicio (aprox.)
                    <br />
                    • <strong>y</strong>: Año del día actual del cálculo
                    <br />
                    • <strong>Constantes</strong>: pi, e
                    <br />
                    • <strong>Funciones</strong>: sqrt(), log(), sin(), cos(), tan(), abs(), round(), etc.
                    <br />
                    • <strong>Ejemplos</strong>:
                    <br />
                    &nbsp;&nbsp;- <code>v("dolar:mep") * 1.05</code> (MEP actual + 5%)
                    <br />
                    &nbsp;&nbsp;- <code>v("cpi:mep") * (1 + 0.01 * d)</code> (CPI/MEP con 1% diario)
                    <br />
                    &nbsp;&nbsp;- <code>(v("dolar:mep") + v("dolar:ccl")) / 2</code> (promedio MEP-CCL)
                    <br />
                    &nbsp;&nbsp;- <code>v("icac:general") * exp(0.05 * m / 12)</code> (iCAC con crecimiento)
                  </Typography>
                </Box>
              }
              arrow
              placement="bottom-start"
              componentsProps={{
                tooltip: {
                  sx: {
                    maxWidth: '600px',
                    '& .MuiTooltip-tooltip': {
                      maxWidth: '600px'
                    }
                  }
                }
              }}
            >
              <IconButton size="small" sx={{ ml: 1 }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ mb: 3, p: 2, bgcolor: mode === 'dark' ? 'background.paperSecondary' : 'info.light', borderRadius: 1, color: 'text.secondary', border: '2px solid', borderColor: mode === 'dark' ? 'info.light' : 'info' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
                  <DatePicker
                    label="Fecha de Proyección"
                    value={projectionDate}
                    onChange={(newValue: any) => {
                      if (newValue) {
                        setProjectionDate(newValue);
                        // Clear projected data first
                        setProjectedData([]);
                        // The useEffect will handle recalculation when projectedData and projectionDate change
                      }
                    }}
                    shouldDisableDate={(date: any) => {
                      if (!date) return true;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const checkDate = new Date(date);
                      checkDate.setHours(0, 0, 0, 0);
                      return checkDate <= today;
                    }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: {

                        }
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid size={6}>
                <Typography variant="body2" fontWeight={'bold'}>
                  Los resultados se calcularán para esta fecha
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {/* Custom Functions List */}
          <Typography variant="h6" gutterBottom>
            Funciones Personalizadas
          </Typography>

          <Card sx={{ mb: 2, p: 2, borderRadius: 1, boxShadow: 'none' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
              Promedio MEP-CCL
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={3}>
                <TextField
                  size="small"
                  label="Fecha Inicio"
                  type="date"
                  defaultValue="2025-01-01"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid size={3}>
                <TextField
                  size="small"
                  label="Fecha Fin"
                  type="date"
                  defaultValue="2025-12-31"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    Resultado:
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      color: 'success.main',
                      fontWeight: 'bold'
                    }}
                  >
                    -
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                Función(v,d,m,y) {'=>'}
              </Typography>

              <TextField
                size="small"
                variant="outlined"
                placeholder='Ej: (v("dolar:mep") + v("dolar:ccl")) / 2'
                defaultValue='(v("dolar:mep") + v("dolar:ccl")) / 2'
                sx={{
                  flexGrow: 1,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      border: '1px solid #ccc',
                    },
                  }
                }}
              />
            </Box>
          </Card>

          <Card sx={{ mb: 2, p: 2, borderRadius: 1, boxShadow: 'none' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
              CPI Proyectado
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={3}>
                <TextField
                  size="small"
                  label="Fecha Inicio"
                  type="date"
                  defaultValue="2025-01-01"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid size={3}>
                <TextField
                  size="small"
                  label="Fecha Fin"
                  type="date"
                  defaultValue="2025-12-31"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    Resultado:
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      color: 'success.main',
                      fontWeight: 'bold'
                    }}
                  >
                    -
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                Función(v,d,m,y) {'=>'}
              </Typography>

              <TextField
                size="small"
                variant="outlined"
                placeholder='Ej: v("cpi:mep") * exp(0.02 * d / 365)'
                defaultValue='v("cpi:mep") * exp(0.02 * d / 365)'
                sx={{
                  flexGrow: 1,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      border: '1px solid #ccc',
                    },
                  }
                }}
              />
            </Box>
          </Card>

          <Card sx={{ mb: 2, p: 2, borderRadius: 1, boxShadow: 'none' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
              iCAC Ajustado
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={3}>
                <TextField
                  size="small"
                  label="Fecha Inicio"
                  type="date"
                  defaultValue="2025-01-01"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid size={3}>
                <TextField
                  size="small"
                  label="Fecha Fin"
                  type="date"
                  defaultValue="2025-12-31"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    Resultado:
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      color: 'success.main',
                      fontWeight: 'bold'
                    }}
                  >
                    -
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                Función(v,d,m,y) {'=>'}
              </Typography>

              <TextField
                size="small"
                variant="outlined"
                placeholder='Ej: v("icac:general") * (1 + 0.05 * m / 12)'
                defaultValue='v("icac:general") * (1 + 0.05 * m / 12)'
                sx={{
                  flexGrow: 1,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      border: '1px solid #ccc',
                    },
                  }
                }}
              />
            </Box>
          </Card>

        </Box>
      )}

      {/* Tab 4: Conversor */}
      {activeTab === 'conversor' && (
        <Box sx={{ pb: 2 }}>
          <Card sx={{ overflow: 'auto' }}>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Conversor de Monedas
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Convierte un valor de una moneda en una fecha específica a otra moneda en otra fecha, usando una moneda constante como unidad.
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Nota:</strong> Esta calculadora de conversión utiliza únicamente los índices históricos existentes en la base de datos.
                  No incluye proyecciones o valores calculados, solo datos reales registrados.
                </Typography>
              </Alert>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ sm: 6, md: 12 }}>
                  <TextField
                    fullWidth
                    label="Valor"
                    type="number"
                    value={conversionForm.value}
                    onChange={(e) => setConversionForm(prev => ({ ...prev, value: e.target.value }))}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>

                <Grid size={{ sm: 6, md: 12 }}>
                  <TextField
                    fullWidth
                    select
                    label="Moneda Origen"
                    value={conversionForm.fromCurrencyId}
                    onChange={(e) => setConversionForm(prev => ({ ...prev, fromCurrencyId: e.target.value }))}
                    sx={{ minWidth: 200 }}
                  >
                    {currencies?.map((currency) => (
                      <MenuItem key={currency.id} value={currency.id}>
                        {currency.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid size={{ sm: 6, md: 12 }}>
                  <TextField
                    fullWidth
                    label="Fecha Origen"
                    type="date"
                    value={conversionForm.fromDate}
                    onChange={(e) => setConversionForm(prev => ({ ...prev, fromDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid size={{ sm: 6, md: 12 }}>
                  <TextField
                    fullWidth
                    select
                    label="Moneda Destino"
                    value={conversionForm.toCurrencyId}
                    onChange={(e) => setConversionForm(prev => ({ ...prev, toCurrencyId: e.target.value }))}
                    sx={{ minWidth: 200 }}
                  >
                    {currencies?.map((currency) => (
                      <MenuItem key={currency.id} value={currency.id}>
                        {currency.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid size={{ sm: 6, md: 12 }}>
                  <TextField
                    fullWidth
                    label="Fecha Destino"
                    type="date"
                    value={conversionForm.toDate}
                    onChange={(e) => setConversionForm(prev => ({ ...prev, toDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid size={{ sm: 6, md: 12 }}>
                  <TextField
                    fullWidth
                    select
                    label="Moneda Constante"
                    value={conversionForm.constantCurrencyId}
                    onChange={(e) => setConversionForm(prev => ({ ...prev, constantCurrencyId: e.target.value }))}
                    sx={{ minWidth: 200 }}
                  >
                    {currencies?.map((currency) => (
                      <MenuItem key={currency.id} value={currency.id}>
                        {currency.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  onClick={handleConversion}
                  disabled={conversionLoading || !conversionForm.fromCurrencyId || !conversionForm.toCurrencyId || !conversionForm.constantCurrencyId}
                >
                  {conversionLoading ? <CircularProgress size={20} /> : 'Convertir'}
                </Button>
              </Box>

              {conversionError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {conversionError}
                </Alert>
              )}

              {conversionResult && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="h6">
                    Resultado: {conversionResult.value.toFixed(4)}
                  </Typography>
                  <Typography variant="body2">
                    {conversionForm.value} {currencies?.find(c => c.id === parseInt(conversionForm.fromCurrencyId))?.label}
                    ({conversionForm.fromDate}) = {conversionResult.value.toFixed(4)} {currencies?.find(c => c.id === parseInt(conversionForm.toCurrencyId))?.label}
                    ({conversionForm.toDate})
                  </Typography>
                  <Typography variant="caption">
                    Usando {currencies?.find(c => c.id === parseInt(conversionForm.constantCurrencyId))?.label} como moneda constante
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tab 5: Ayuda */}
      {activeTab === 'ayuda' && (
        <Box sx={{ pb: 2 }}>
          <Typography variant="h5" gutterBottom>
            Ayuda - Funciones Matemáticas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Explora las funciones matemáticas disponibles para usar en tus fórmulas de proyección.
          </Typography>

          <Grid container spacing={3}>
            {/* Funciones Básicas */}
            <Grid size={{ sm: 6, md: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Matemáticas Básicas
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2"><code>add(a, b)</code> - Suma</Typography>
                    <Typography variant="body2"><code>subtract(a, b)</code> - Resta</Typography>
                    <Typography variant="body2"><code>multiply(a, b)</code> - Multiplicación</Typography>
                    <Typography variant="body2"><code>divide(a, b)</code> - División</Typography>
                    <Typography variant="body2"><code>pow(a, b)</code> - Potencia (a^b)</Typography>
                    <Typography variant="body2"><code>sqrt(x)</code> - Raíz cuadrada</Typography>
                    <Typography variant="body2"><code>abs(x)</code> - Valor absoluto</Typography>
                    <Typography variant="body2"><code>round(x)</code> - Redondeo</Typography>
                    <Typography variant="body2"><code>ceil(x)</code> - Redondeo hacia arriba</Typography>
                    <Typography variant="body2"><code>floor(x)</code> - Redondeo hacia abajo</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Funciones Trigonométricas */}
            <Grid size={{ sm: 6, md: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="secondary">
                    Trigonométricas
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2"><code>sin(x)</code> - Seno</Typography>
                    <Typography variant="body2"><code>cos(x)</code> - Coseno</Typography>
                    <Typography variant="body2"><code>tan(x)</code> - Tangente</Typography>
                    <Typography variant="body2"><code>asin(x)</code> - Arco seno</Typography>
                    <Typography variant="body2"><code>acos(x)</code> - Arco coseno</Typography>
                    <Typography variant="body2"><code>atan(x)</code> - Arco tangente</Typography>
                    <Typography variant="body2"><code>atan2(y, x)</code> - Arco tangente de y/x</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Funciones Logarítmicas */}
            <Grid size={{ sm: 6, md: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="success.main">
                    Logarítmicas y Exponenciales
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2"><code>log(x)</code> - Logaritmo natural</Typography>
                    <Typography variant="body2"><code>log10(x)</code> - Logaritmo base 10</Typography>
                    <Typography variant="body2"><code>log2(x)</code> - Logaritmo base 2</Typography>
                    <Typography variant="body2"><code>exp(x)</code> - e^x</Typography>
                    <Typography variant="body2"><code>exp10(x)</code> - 10^x</Typography>
                    <Typography variant="body2"><code>exp2(x)</code> - 2^x</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Funciones Estadísticas */}
            <Grid size={{ sm: 6, md: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="warning.main">
                    Estadísticas
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2"><code>mean(...args)</code> - Media aritmética</Typography>
                    <Typography variant="body2"><code>median(...args)</code> - Mediana</Typography>
                    <Typography variant="body2"><code>mode(...args)</code> - Moda</Typography>
                    <Typography variant="body2"><code>std(...args)</code> - Desviación estándar</Typography>
                    <Typography variant="body2"><code>variance(...args)</code> - Varianza</Typography>
                    <Typography variant="body2"><code>min(...args)</code> - Valor mínimo</Typography>
                    <Typography variant="body2"><code>max(...args)</code> - Valor máximo</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Constantes */}
            <Grid size={{ sm: 6, md: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color={mode === 'dark' ? "info" : "info.dark"}>
                    Constantes
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2"><code>pi</code> - π ≈ 3.14159</Typography>
                    <Typography variant="body2"><code>e</code> - e ≈ 2.71828</Typography>
                    <Typography variant="body2"><code>phi</code> - φ ≈ 1.61803 (razón áurea)</Typography>
                    <Typography variant="body2"><code>tau</code> - τ ≈ 6.28318 (2π)</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Ejemplos de Uso */}
            <Grid size={{ sm: 6, md: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="error.main">
                    Ejemplos de Uso
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2"><code>v(0) * exp(0.05 * d / 365)</code> - Crecimiento exponencial</Typography>
                    <Typography variant="body2"><code>v(0) + sin(d * pi / 30) * 100</code> - Variación cíclica</Typography>
                    <Typography variant="body2"><code>mean(v(0), v(-1), v(-2))</code> - Media móvil</Typography>
                    <Typography variant="body2"><code>v(0) * pow(1.05, m)</code> - Crecimiento compuesto</Typography>
                    <Typography variant="body2"><code>max(v(0) * 1.1, v(-30))</code> - Valor mínimo garantizado</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Columnas Modal */}
      <Modal
        open={columnasModalOpen}
        onClose={() => setColumnasModalOpen(false)}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
      >
        <Fade in={columnasModalOpen}>
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 4,
          }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Configuración de Columnas
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              Aquí podrás configurar qué columnas mostrar y ocultar en la tabla de índices.
            </Typography>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setColumnasModalOpen(false)}>
                Cerrar
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>

      {/* Proyecciones Modal */}
      <Modal
        open={proyeccionesModalOpen}
        onClose={() => setProyeccionesModalOpen(false)}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
      >
        <Fade in={proyeccionesModalOpen}>
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 800,
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 4,
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Proyecciones de Índices
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Define fórmulas matemáticas para proyectar cada índice. Las fórmulas reciben 4 parámetros: (v, d, m, y)
            </Typography>

            <Box sx={{ mb: 3, p: 2, bgcolor: 'info.light', borderRadius: 1, border: '1px solid', borderColor: 'info.dark' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
                    <DatePicker
                      label="Fecha de Proyección"
                      value={projectionDate}
                      onChange={(newValue: any) => {
                        if (newValue) {
                          //console.log('Date changed to:', newValue.toISOString().split('T')[0]);
                          setProjectionDate(newValue);
                          // Clear projected data first - useEffect will handle recalculation
                          setProjectedData([]);
                        }
                      }}
                      shouldDisableDate={(date: any) => {
                        if (!date) return true;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const checkDate = new Date(date);
                        checkDate.setHours(0, 0, 0, 0);
                        return checkDate <= today;
                      }}
                      slotProps={{
                        textField: {
                          size: 'small',
                          fullWidth: true,
                          sx: {
                            '& .MuiInputLabel-root': { color: 'white' },
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': { borderColor: 'white' },
                              '&:hover fieldset': { borderColor: 'white' },
                              '&.Mui-focused fieldset': { borderColor: 'white' },
                              '& input': { color: 'white' },
                              '& .MuiSvgIcon-root': { color: 'white' }
                            }
                          }
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" sx={{ color: 'white' }}>
                    Los resultados se calcularán para esta fecha
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {getAvailableIndexes().map((index) => (
              <Box key={index.field} sx={{ mb: 3, p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {index.name}
                </Typography>

                <Grid container spacing={2} alignItems="center">
                  <Grid size={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Fórmula (v, d, m, y) =>"
                      placeholder="Ej: v(0) * (1 + 0.05 * (m / 12))"
                      value={getDefaultFormula(index.field)}
                      onChange={(e) => updateIndexFormula(index.field, e.target.value)}
                    />
                  </Grid>
                  <Grid size={4}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Resultado:
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          color: 'success.main'
                        }}
                      >
                        {evaluateIndexFormula(index.field, getDefaultFormula(index.field)) || '-'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            ))}

            <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.main', borderRadius: 1, color: 'white' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'white' }}>
                Parámetros de la función:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'white' }}>
                • <strong>v(daysBack)</strong>: Función que retorna el valor del índice hace X días (0 = hoy, -1 = ayer, etc.)
                <br />
                • <strong>d</strong>: Días en el futuro desde hoy hasta la fecha de proyección
                <br />
                • <strong>m</strong>: Meses en el futuro desde hoy hasta la fecha de proyección (aprox.)
                <br />
                • <strong>y</strong>: Año de la fecha de proyección
                <br />
                • <strong>Constantes</strong>: pi, e
                <br />
                • <strong>Funciones</strong>: sqrt(), log(), sin(), cos(), tan(), abs(), round(), etc.
                <br />
                • <strong>Ejemplos</strong>:
                <br />
                &nbsp;&nbsp;- <code>v(0) * 1.05</code> (5% de incremento)
                <br />
                &nbsp;&nbsp;- <code>v(0) * (1 + 0.01 * d)</code> (1% por día futuro)
                <br />
                &nbsp;&nbsp;- <code>v(0) + m * 50</code> (incremento de $50 por mes futuro)
                <br />
                &nbsp;&nbsp;- <code>(v(0) + v(-30)) / 2</code> (promedio con hace 30 días)
              </Typography>
            </Box>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setProyeccionesModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="contained"
                onClick={calculateAndSaveProjections}
              >
                Guardar Proyecciones
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>
    </Box>
  </Box>);
};

export default Indexes;