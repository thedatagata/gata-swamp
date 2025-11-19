// Sanitize DuckDB data types for WebDataRocks
function sanitizeQueryData(data: any[]): any[] {
  return data.map(row => {
    const newRow: any = {};
    for (const key in row) {
      const value = row[key];
      if (typeof value === 'bigint') {
        newRow[key] = Number(value);
      } else if (value instanceof Uint8Array) {
        const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
        newRow[key] = Number(view.getBigUint64(0, true));
      } else if (value instanceof Date) {
        newRow[key] = value.toISOString().split('T')[0];
      } else if (value && typeof value === 'object' && 'days' in value) {
        newRow[key] = new Date((value as any).days * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
      } else if (typeof value === 'number' && value > 1000000000000) {
        newRow[key] = new Date(value).toISOString().split('T')[0];
      } else if (typeof value === 'boolean') {
        // Convert boolean to 0/1 for proper sum aggregation in pivot table
        newRow[key] = value ? 1 : 0;
      } else {
        newRow[key] = value;
      }
    }
    return newRow;
  });
}

export { sanitizeQueryData };
