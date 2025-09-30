type CsvData = {
  [key: string]: string | number;
};

export function exportToCsv(data: CsvData[], filename: string, headers: string[]) {
  if (data.length === 0) {
    return;
  }
  
  const sanitize = (value: string | number | null | undefined) => {
    const str = String(value ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = headers.join(',') + '\n';
  const dataKeys = ['rank', 'playerName', 'team', 'score', 'image'];
  
  const rows = data
    .map(row => 
      dataKeys.map(key => sanitize(row[key])).join(',')
    )
    .join('\n');
    
  const csvContent = header + rows;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
