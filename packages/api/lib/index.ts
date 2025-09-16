import nodemailer from './mailer/index';
export { nodemailer as mailer };

export const excelDateToJSDate = (excelDate: number, offset = -1) => {
    try {
        const startDate = new Date(1900, 0, 1);
        const date = new Date(startDate.getTime() + (excelDate + offset) * 24 * 60 * 60 * 1000);
        return date.toISOString();
    } catch (error) {
        throw new Error(`Error converting date: ${excelDate}. Details: ${error}`);
    }

};
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

export const normalizeDate = (date: string) => new Date(date).toISOString().split("T")[0];
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
export const stringToUrlFormat = (str: string) => {
  str = str.replace(/ /g, '-')
  str = handleString(str)
  str = str.toLowerCase()
  return str
};

export const replaceAll = (str: string, find: string, replace: string): string => {
  if (typeof str !== 'string') return str; // or throw error
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};

// Helper function to escape special regex characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function extractDoubleKeys(texto) {
  const regex = /{{.*?}}/g;
  const coincidencias = texto.match(regex);
  return coincidencias || [];
}
export const handleReplacementOfDinamicFields = (html: string, fieldsMail: any, data: any) => {
  const replacedFields = (html: string, field: any) => {
    const properties = field.variable.split('.');
    let value = data;
    for (let prop of properties) {
      value = value?.[prop];
      console.log(field.variable, value);
      if (value === undefined || value === null) throw new Error(`Campo faltante: ${field.variable}`);
    }
    html = replaceAll(html,`{{${field.name}}}`, value);
    return html;
  }
  fieldsMail?.forEach(field => {
    html = replacedFields(html, field);
  });
  return html;
};
export const handleReplacementOfStaticFields = (html: string, staticFields: any) => {
  const replacedFields = (html: string, field: string) => {
    let value = staticFields[field]
    if (value === undefined || value === null) throw new Error(`Campo faltante: ${field}`);
    return replaceAll(html,`{{${field}}}`, staticFields[field] ?? `{{${field}}}`);
  };
  Object.keys(staticFields)?.forEach(field => html = replacedFields(html, field));
  return html
};


// Date utils
export const isSameDayUTC = (date1: Date, date2: Date) => {
  return (
      date1.getUTCFullYear() === date2.getUTCFullYear() &&
      date1.getUTCMonth() === date2.getUTCMonth() &&
      date1.getUTCDate() === date2.getUTCDate()
  );
};

export const isSameDay = (date1: Date, date2: Date) => {
  return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
  );
};