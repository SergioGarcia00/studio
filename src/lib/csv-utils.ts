type PlayerData = {
  playerName: string;
  team: string;
  score: number;
};

export function exportToCsv(data: PlayerData[], filename: string) {
  if (data.length === 0) {
    return;
  }
  
  // Sanitize data for CSV
  const sanitize = (value: string | number) => {
    const str = String(value);
    // If the string contains a comma, double quote, or newline, enclose it in double quotes
    if (/[",\n\r]/.test(str)) {
      // Escape existing double quotes by doubling them up
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = 'Player Name,Team,Score\n';
  const rows = data
    .map(d => 
      `${sanitize(d.playerName)},${sanitize(d.team)},${sanitize(d.score)}`
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
