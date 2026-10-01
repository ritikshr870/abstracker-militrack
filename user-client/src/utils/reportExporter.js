import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Formats Date to YYYY-MM-DD HH:mm (e.g., 2026-09-29 00:00)
export function formatReportDateTime(val) {
  if (!val) return '2026-09-29 00:00';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return String(val);
  }
}

// Formats milliseconds to HH:MM (e.g. 02:38, 00:00, 23:59)
export function formatHoursMinutes(ms) {
  if (!ms || isNaN(ms) || ms <= 0) return '00:00';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}`;
}

// Formats distance in meters to "X.XX km" or "0 km"
export function formatReportDistance(meters) {
  if (!meters || isNaN(meters) || meters <= 0) return '0 km';
  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
}

function formatDurationMs(ms) {
  if (!ms || isNaN(ms) || ms <= 0) return '00:00';
  return formatHoursMinutes(ms);
}

/**
 * Normalize report items into standard tabular structures matching exact executive template
 */
export function normalizeReportData(reportType, rawData, vehicle, metadata = {}) {
  if (!Array.isArray(rawData)) return [];

  if (reportType === 'summary') {
    return rawData.map((item) => {
      const vehNumber = item.vehicleName || item.deviceName || item['Vehicle Number'] || vehicle?.name || 'Vehicle';
      const startDate = item.startDate || formatReportDateTime(item.startTime || metadata.from);
      const endDate = item.endDate || formatReportDateTime(item.endTime || metadata.to);
      const distance = item.distanceStr || (typeof item.distance === 'number' ? formatReportDistance(item.distance) : (item.Distance || '0 km'));
      const engineHours = item.engineHoursStr || formatHoursMinutes(item.engineHours);
      const runningHours = item.runningHoursStr || formatHoursMinutes(item.runningHours);
      const stoppedHours = item.stoppedHoursStr || formatHoursMinutes(item.stoppedHours);
      const idleHours = item.idleHoursStr || formatHoursMinutes(item.idleHours);
      const acHours = item.acHoursStr || formatHoursMinutes(item.airConditionerHours || item.acHours);

      return {
        'Vehicle Number': vehNumber,
        'Start Date & Time': startDate,
        'End Date & Time': endDate,
        'Distance': distance,
        'Engine Hours': engineHours,
        'Running Hours': runningHours,
        'Stopped Hours': stoppedHours,
        'Idle Hours': idleHours,
        'AC Hours': acHours
      };
    });
  }

  if (reportType === 'trips') {
    return rawData.map((item, idx) => {
      const vehNumber = item.vehicleName || item.deviceName || vehicle?.name || 'Vehicle';
      const distKm = item['Distance (km)'] || (item.distance ? formatReportDistance(item.distance) : '0 km');
      const duration = item['Duration'] || (item.duration ? formatHoursMinutes(item.duration) : '00:00');
      const avgSpeed = item['Avg Speed (km/h)'] || (item.averageSpeed ? Math.round(item.averageSpeed * 1.852) + ' km/h' : '0 km/h');
      const maxSpeed = item['Max Speed (km/h)'] || (item.maxSpeed ? Math.round(item.maxSpeed * 1.852) + ' km/h' : '0 km/h');
      const startTime = formatReportDateTime(item.startTime || item['Start Time']);
      const endTime = formatReportDateTime(item.endTime || item['End Time']);
      const startAddr = item.startAddress || item['Start Address'] || (item.startLat ? `${item.startLat}, ${item.startLng}` : 'Start Location');
      const endAddr = item.endAddress || item['End Address'] || (item.endLat ? `${item.endLat}, ${item.endLng}` : 'End Location');

      return {
        'Vehicle Number': vehNumber,
        'Start Date & Time': startTime,
        'End Date & Time': endTime,
        'Distance': distKm,
        'Duration': duration,
        'Avg Speed': avgSpeed,
        'Max Speed': maxSpeed,
        'Start Location': startAddr,
        'End Location': endAddr
      };
    });
  }

  // Stoppages Report
  return rawData.map((item, idx) => {
    const vehNumber = item.vehicleName || item.deviceName || vehicle?.name || 'Vehicle';
    const startTime = formatReportDateTime(item.startTime || item['Start Time']);
    const endTime = formatReportDateTime(item.endTime || item['End Time']);
    const duration = item['Halt Duration'] || (item.duration ? formatHoursMinutes(item.duration) : '00:00');
    const addr = item.address || item['Address'] || (item.latitude ? `${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}` : 'Halt Location');

    return {
      'Vehicle Number': vehNumber,
      'Arrival Time': startTime,
      'Departure Time': endTime,
      'Halt Duration': duration,
      'Stop Address / Landmark': addr,
      'Latitude': item.latitude ? Number(item.latitude).toFixed(6) : '-',
      'Longitude': item.longitude ? Number(item.longitude).toFixed(6) : '-'
    };
  });
}

/**
 * Generate safe file base name
 */
function getFileName(vehicleName, reportType, ext) {
  const cleanName = (vehicleName || 'Fleet').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  return `AbsTracker_${cleanName}_${reportType.toUpperCase()}_${dateStr}.${ext}`;
}

/**
 * Export data to standard CSV with UTF-8 BOM matching exact structure
 */
export function exportToCSV(reportType, rawData, vehicle, metadata = {}) {
  const rows = normalizeReportData(reportType, rawData, vehicle, metadata);
  if (rows.length === 0) {
    throw new Error('No data available to export.');
  }

  const headers = Object.keys(rows[0]);
  const fromFormatted = formatReportDateTime(metadata.from);
  const toFormatted = formatReportDateTime(metadata.to);
  const periodText = `${fromFormatted} - ${toFormatted}`;
  const reportTypeTitle = reportType === 'summary' ? 'Summary' : (reportType === 'trips' ? 'Trips Route' : 'Stoppages');

  const metaLines = [
    `"Report Type:","${reportTypeTitle}"`,
    `"Period:","${periodText}"`,
    ''
  ];

  const csvRows = rows.map(row => {
    return headers.map(header => {
      const val = row[header] === undefined || row[header] === null ? '' : String(row[header]);
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + metaLines.join('\r\n') + headers.map(h => `"${h}"`).join(',') + '\r\n' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getFileName(vehicle?.name, reportType, 'csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to Microsoft Excel (.xlsx) workbook matching exact grid layout
 */
export function exportToXLSX(reportType, rawData, vehicle, metadata = {}) {
  const rows = normalizeReportData(reportType, rawData, vehicle, metadata);
  if (rows.length === 0) {
    throw new Error('No data available to export.');
  }

  const wb = XLSX.utils.book_new();
  const fromFormatted = formatReportDateTime(metadata.from);
  const toFormatted = formatReportDateTime(metadata.to);
  const periodText = `${fromFormatted} - ${toFormatted}`;
  const reportTypeTitle = reportType === 'summary' ? 'Summary' : (reportType === 'trips' ? 'Trips Route' : 'Stoppages');

  // Create formatted worksheet from json starting at row 4
  const ws = XLSX.utils.json_to_sheet(rows, { origin: 'A4' });

  // Add metadata rows matching template
  XLSX.utils.sheet_add_aoa(ws, [
    ['Report Type:', reportTypeTitle],
    ['Period:', periodText],
    []
  ], { origin: 'A1' });

  // Calculate auto column widths
  const colWidths = Object.keys(rows[0]).map(key => {
    let maxLen = key.length;
    rows.forEach(r => {
      const valLen = r[key] ? String(r[key]).length : 0;
      if (valLen > maxLen) maxLen = valLen;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
  });
  ws['!cols'] = colWidths;

  const sheetName = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)}_Report`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, getFileName(vehicle?.name, reportType, 'xlsx'));
}

/**
 * Export data to exact High-Precision PDF matching provided format:
 * - Top metadata block with grid borders (Report Type, Period)
 * - Indigo #4F46E5 header row with crisp white text
 * - Clean black/slate grid lines across all cells
 * - Formatted distances, dates (YYYY-MM-DD HH:mm), and hours (HH:MM)
 */
export function exportToPDF(reportType, rawData, vehicle, metadata = {}) {
  const rows = normalizeReportData(reportType, rawData, vehicle, metadata);
  if (rows.length === 0) {
    throw new Error('No data available to export.');
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const fromFormatted = formatReportDateTime(metadata.from);
  const toFormatted = formatReportDateTime(metadata.to);
  const periodText = `${fromFormatted} -\n${toFormatted}`;
  const reportTypeTitle = reportType === 'summary' ? 'Summary' : (reportType === 'trips' ? 'Trips Route' : 'Stoppages');

  // Top Metadata Grid Box matching screenshot
  autoTable(doc, {
    startY: 28,
    margin: { left: 36 },
    tableWidth: 260,
    theme: 'grid',
    styles: {
      lineColor: [50, 50, 50],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      fontSize: 8.5,
      cellPadding: 4.5
    },
    body: [
      ['Report Type:', reportTypeTitle],
      ['Period:', periodText]
    ],
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold', fillColor: [255, 255, 255] },
      1: { cellWidth: 180, fillColor: [255, 255, 255] }
    }
  });

  const tableStartY = (doc.lastAutoTable?.finalY || 60) + 12;

  const tableHeaders = Object.keys(rows[0]);
  const tableData = rows.map(r => Object.values(r));

  // Determine specific column styles for clean layout
  const colStyles = {};
  tableHeaders.forEach((h, idx) => {
    if (h === 'Vehicle Number') {
      colStyles[idx] = { cellWidth: 90, fontStyle: 'normal', halign: 'left' };
    } else if (h.includes('Date & Time') || h.includes('Time')) {
      colStyles[idx] = { cellWidth: 95, halign: 'left' };
    } else if (h === 'Distance') {
      colStyles[idx] = { cellWidth: 65, halign: 'left' };
    } else if (h.includes('Hours') || h.includes('Duration')) {
      colStyles[idx] = { cellWidth: 55, halign: 'center' };
    } else if (h.includes('Speed')) {
      colStyles[idx] = { cellWidth: 55, halign: 'center' };
    } else {
      colStyles[idx] = { cellWidth: 'auto', halign: 'left' };
    }
  });

  // Main Grid Table with Indigo Header (#4F46E5) and clean borders
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: tableStartY,
    margin: { left: 36, right: 36, bottom: 35 },
    theme: 'grid',
    styles: {
      lineColor: [50, 50, 50], // Crisp black grid line
      lineWidth: 0.5,
      fontSize: 8,
      textColor: [0, 0, 0],
      cellPadding: 4.5,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: [79, 70, 229], // #4F46E5 Vibrant Indigo matching user screenshot
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 8,
      cellPadding: 5
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255] // Clean white table body matching template
    },
    columnStyles: colStyles,
    didDrawPage: (data) => {
      // Clean Footer on Every Page
      const pageStr = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Powered by Abstracker Team • Enterprise Telematics', 36, pageHeight - 14);
      doc.text(pageStr, pageWidth - 36 - doc.getTextWidth(pageStr), pageHeight - 14);
    }
  });

  doc.save(getFileName(vehicle?.name, reportType, 'pdf'));
}
