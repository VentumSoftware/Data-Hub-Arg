/**
 * Convierte una fecha de Excel (número serial) a una fecha JS en formato ISO
 * @param excelDate Número serial de fecha de Excel
 * @param offset Ajuste para corrección de fecha (default -1 por error histórico en Excel)
 */export const excelDateToJSDate = (excelDate: number, offset = -1) => {
  try {
    const startDate = new Date(1900, 0, 1);
    const date = new Date(startDate.getTime() + (excelDate + offset) * 24 * 60 * 60 * 1000);
    return date.toISOString();
  } catch (error) {
    throw new Error(`Error converting date: ${excelDate}. Details: ${error}`);
  }

};


/**
 * Formatea un tamaño en bytes a la unidad más legible (KB, MB, GB, etc.)
 * @param sizeInBytes Tamaño en bytes a formatear
 * @returns String formateado con unidad (ej: "1.23 MB")
 */
export const formatFileSize = (sizeInBytes: number) => {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let size = sizeInBytes;
  let i = 0;
  if (size == null) return 'N/A';
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }

  return `${size.toFixed(2)}${units[i]}`;
};


/**
 * Convierte milisegundos a la unidad de tiempo más apropiada (ms, s, min, h)
 * @param timeInMs Tiempo en milisegundos
 * @returns String formateado con unidad y color sugerido para visualización
 */
export const formatTime = (timeInMs: number) => {

  const units = ["ms", "s", "min", "h"];
  let time = timeInMs;
  let i = 0;

  if (time >= 1000) { time /= 1000; i++; }
  if (time >= 60 && i === 1) { time /= 60; i++; }
  if (time >= 60 && i === 2) { time /= 60; i++; }

  const formattedTime = `${time.toFixed(2)} ${units[i]}`;

  let color = "success";
  if (timeInMs > 30000) color = "warning";
  if (timeInMs > 60000) color = "error";

  return formattedTime;
};


/**
 * Normaliza una fecha string al formato YYYY-MM-DD (ISO date part)
 * @param date Fecha en cualquier formato string válido
 * @returns Fecha en formato YYYY-MM-DD
 */
export const normalizeDate = (date: string) => new Date(date).toISOString().split("T")[0];


/**
 * Normaliza un string removiendo acentos y caracteres especiales
 * @param str String a normalizar
 * @param isUpperCase Indica si el resultado debe estar en mayúsculas
 * @returns String normalizado sin caracteres especiales
 */
export const handleString = (str: string, isUpperCase = false) => {
  str = str.replace(/á/g, 'a');
  str = str.replace(/Á/g, 'A')
  str = str.replace(/é/g, 'e')
  str = str.replace(/É/g, 'E')
  str = str.replace(/í/g, 'i')
  str = str.replace(/Í/g, 'I')
  str = str.replace(/ó/g, 'o')
  str = str.replace(/Ó/g, 'O')
  str = str.replace(/ú/g, 'u')
  str = str.replace(/Ú/g, 'U')
  str = str.replace(/Ü/g, 'U')
  str = str.replace(/ü/g, 'u')
  str = str.replace(/'/g, '')
  str = str.replace(/`/g, '');
  str = str.replace(/´/g, '');
  str = isUpperCase ? str.toUpperCase() : str;
  return str
};


/**
 * Convierte un string a formato URL-friendly (kebab-case sin caracteres especiales)
 * @param str String a convertir
 * @returns String en formato URL-friendly (ej: "mi-título-articulo")
 */
export const stringToUrlFormat = (str: string) => {
  str = str.replace(/ /g, '-')
  str = handleString(str)
  str = str.toLowerCase()
  return str
};


/**
 * Reemplaza todas las ocurrencias de un substring en un string
 * @param str String original
 * @param find Substring a buscar
 * @param replace Substring de reemplazo
 * @returns Nuevo string con todos los reemplazos aplicados
 */
export const replaceAll = (str: string, find: string, replace: string): string => {
  if (typeof str !== 'string') return str; // or throw error
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};

// Escapa caracteres especiales para uso en expresiones regulares
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/**
 * Determina el color de contraste óptimo (blanco o negro) para un color hexadecimal
 * @param hexColor Color hexadecimal (#RRGGBB)
 * @returns "#FFFFFF" (blanco) o "#000000" (negro) según mejor contraste
 */
export const getContrastColor = (hexColor: string) => {
  const rgb = hexColorToRgb(hexColor);
  const contrastWithWhite = contrastRatio(rgb, [255, 255, 255]);
  const contrastWithBlack = contrastRatio(rgb, [0, 0, 0]);

  return contrastWithWhite > contrastWithBlack ? "#FFFFFF" : "#000000";
}


// Convierte color hexadecimal a array RGB [r, g, b]
function hexColorToRgb(hex: string) {
  hex = hex.replace("#", "");
  const bigint = parseInt(hex, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}


// Calcula luminancia relativa para un color (WCAG standard)
function luminance(r: number, g: number, b: number) {
  const a = [r, g, b].map((v) => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}


// Calcula ratio de contraste entre dos colores RGB
function contrastRatio(rgb1: number[], rgb2: number[]) {
  const lum1 = luminance(...rgb1);
  const lum2 = luminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

type FileTypes = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'office' | 'archive' | 'unknown';
export const getFileType = (fileName: string): FileTypes => {
  const extension = fileName.toLowerCase().split('.').pop() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension)) {
    return 'image';
  }

  if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(extension)) {
    return 'video';
  }

  if (['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
    return 'audio';
  }

  if (extension === 'pdf') {
    return 'pdf';
  }

  if (['txt', 'log', 'json', 'md', 'csv'].includes(extension)) {
    return 'text';
  }

  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb'].includes(extension)) {
    return 'code';
  }

  if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension)) {
    return 'office';
  }

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'].includes(extension)) {
    return 'archive';
  }

  return 'unknown';
}

/**
 * Extrae todas las claves dinámicas marcadas con doble llave ({{clave}}) de un string
 * @param str String que contiene las claves
 * @returns Array de claves encontradas (ej: ["{{nombre}}", "{{email}}"])
 */
export const extractDoubleKeys = (str: string): string[] => {
  const regex = /{{.*?}}/g;
  const coincidencias = str.match(regex);
  return coincidencias || [];
}

/**
 * Reemplaza campos dinámicos en un HTML con valores de un objeto de datos
 * @param html String HTML con placeholders
 * @param fieldsMail Definición de campos dinámicos a reemplazar
 * @param data Objeto con los valores para reemplazo
 * @returns HTML con los placeholders reemplazados por valores reales
 */
export const handleReplacementOfDinamicFields = (html: string, fieldsMail: any, data: any) => {
  const replacedFields = (html: string, field: any) => {
    const properties = field.variable.split('.');
    let value = data;
    for (let prop of properties) {
      value = value?.[prop];
      if (value === undefined || value === null) throw new Error(`Campo faltante: ${field.variable}`);
    }
    html = replaceAll(html, `{{${field.name}}}`, value);
    return html;
  }
  fieldsMail?.forEach((field: any) => {
    html = replacedFields(html, field);
  });
  return html;
};


/**
 * Reemplaza campos estáticos en un HTML con valores predefinidos
 * @param html String HTML con placeholders
 * @param staticFields Objeto con valores para reemplazo
 * @returns HTML con los placeholders estáticos reemplazados
 */
export const handleReplacementOfStaticFields = (html: string, staticFields: any) => {
  const replacedFields = (html: string, field: string) => {
    let value = staticFields[field]
    if (value === undefined || value === null) throw new Error(`Campo faltante: ${field}`);
    return replaceAll(html, `{{${field}}}`, staticFields[field] ?? `{{${field}}}`);
  };
  Object.keys(staticFields)?.forEach(field => html = replacedFields(html, field));
  return html
};


/**
 * Extrae claves dinámicas de un string (ej: {{nombre}})
 */
export function extractDynamicKeys(str: string): string[] {
  if (!str) return [];
  const regex = /{{.*?}}/g;
  const matches = str.match(regex) || [];
  return matches;
}


/**
 * Filtra campos estáticos excluyendo los dinámicos definidos
 */
export function filterStaticFields(
  html: string,
  dynamicFields: { name: string }[] = []
): string[] {
  const allKeys = extractDynamicKeys(html);
  const dynamicFieldNames = dynamicFields.map(field => `{{${field.name}}}`);

  return allKeys.filter(
    key => !dynamicFieldNames.includes(key)
  );
}


/**
 * Crea un objeto de campos estáticos con valores vacíos
 */
export function createStaticFieldsObject(
  staticKeys: string[]
): Record<string, string> {
  return staticKeys.reduce((acc, key) => {
    const cleanKey = key.replace(/{{|}}/g, '');
    return { ...acc, [cleanKey]: '' };
  }, {});
}


/**
 * Obtiene campos estáticos iniciales a partir de un HTML y campos dinámicos
 */
export function getInitialStaticFields(
  html?: string,
  dynamicFields?: { name: string }[]
): Record<string, string> {
  if (!html || !dynamicFields) return {};

  const staticKeys = filterStaticFields(html, dynamicFields);
  return createStaticFieldsObject(staticKeys);
}