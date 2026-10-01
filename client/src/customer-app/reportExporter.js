import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDateTime(val) {
  if (!val) return 'N/A';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(val);
  }
}

function formatDurationMs(ms) {
  if (!ms || isNaN(ms) || ms <= 0) return '0 min';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

export function normalizeReportData(reportType, rawData, vehicle) {
  if (!Array.isArray(rawData)) return [];

  if (reportType === 'trips') {
    return rawData.map((item, idx) => {
      const distKm = item['Distance (km)'] || (item.distance ? (item.distance / 1000).toFixed(2) + ' km' : '0 km');
      const duration = item['Duration'] || (item.duration ? formatDurationMs(item.duration) : '0 min');
      const avgSpeed = item['Avg Speed (km/h)'] || (item.averageSpeed ? Math.round(item.averageSpeed * 1.852) + ' km/h' : '0 km/h');
      const maxSpeed = item['Max Speed (km/h)'] || (item.maxSpeed ? Math.round(item.maxSpeed * 1.852) + ' km/h' : '0 km/h');
      const startTime = formatDateTime(item.startTime || item['Start Time']);
      const endTime = formatDateTime(item.endTime || item['End Time']);
      const startAddr = item.startAddress || item['Start Address'] || (item.startLat ? `${item.startLat}, ${item.startLng}` : 'Start Location');
      const endAddr = item.endAddress || item['End Address'] || (item.endLat ? `${item.endLat}, ${item.endLng}` : 'End Location');

      return {
        '#': idx + 1,
        'Vehicle': vehicle?.name || 'AbsTracker Vehicle',
        'Start Time': startTime,
        'End Time': endTime,
        'Duration': duration,
        'Distance': distKm,
        'Avg Speed': avgSpeed,
        'Max Speed': maxSpeed,
        'Start Address': startAddr,
        'End Address': endAddr
      };
    });
  }

  if (reportType === 'stops') {
    return rawData.map((item, idx) => {
      const startTime = formatDateTime(item.startTime || item['Start Time']);
      const endTime = formatDateTime(item.endTime || item['End Time']);
      const duration = item['Duration'] || (item.duration ? formatDurationMs(item.duration) : '0 min');
      const addr = item.address || item['Address'] || (item.latitude ? `${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}` : 'Halt Location');

      return {
        '#': idx + 1,
        'Vehicle': vehicle?.name || 'AbsTracker Vehicle',
        'Arrived': startTime,
        'Departed': endTime,
        'Halt Duration': duration,
        'Address / Landmark': addr,
        'Latitude': item.latitude ? Number(item.latitude).toFixed(6) : '-',
        'Longitude': item.longitude ? Number(item.longitude).toFixed(6) : '-'
      };
    });
  }

  return rawData.map((item, idx) => {
    const distKm = item['Distance (km)'] || (item.distance ? (item.distance / 1000).toFixed(2) + ' km' : '0 km');
    const maxSpeed = item['Max Speed (km/h)'] || (item.maxSpeed ? Math.round(item.maxSpeed * 1.852) + ' km/h' : '0 km/h');
    const avgSpeed = item['Avg Speed (km/h)'] || (item.averageSpeed ? Math.round(item.averageSpeed * 1.852) + ' km/h' : '0 km/h');
    const engineHours = item['Engine Hours'] || (item.engineHours ? formatDurationMs(item.engineHours) : (item.duration ? formatDurationMs(item.duration) : '0 min'));
    const spentFuel = item['Spent Fuel'] || (item.spentFuel ? `${Number(item.spentFuel).toFixed(2)} L` : '0.00 L');

    return {
      '#': idx + 1,
      'Vehicle': item.deviceName || vehicle?.name || 'AbsTracker Vehicle',
      'Distance Run': distKm,
      'Max Speed': maxSpeed,
      'Average Speed': avgSpeed,
      'Running / Engine Hours': engineHours,
      'Estimated Fuel': spentFuel
    };
  });
}

function getFileName(vehicleName, reportType, ext) {
  const cleanName = (vehicleName || 'Vehicle').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  return `AbsTracker_${cleanName}_${reportType.toUpperCase()}_${dateStr}.${ext}`;
}

export function exportToCSV(reportType, rawData, vehicle, metadata = {}) {
  const rows = normalizeReportData(reportType, rawData, vehicle);
  if (rows.length === 0) {
    throw new Error('No data available to export.');
  }

  const headers = Object.keys(rows[0]);
  const metaLines = [
    `"AbsTracker Fleet Telematics Report - ${reportType.toUpperCase()}"`,
    `"Vehicle: ${vehicle?.name || 'All'}","Category: ${vehicle?.category || 'Fleet'}","Generated: ${new Date().toLocaleString('en-IN')}"`,
    `"Time Period: ${metadata.dateRange || 'Custom'}"`,
    ''
  ];

  const csvRows = rows.map(row => {
    return headers.map(header => {
      const val = row[header] === undefined || row[header] === null ? '' : String(row[header]);
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + metaLines.join('\r\n') + '\r\n' + headers.map(h => `"${h}"`).join(',') + '\r\n' + csvRows.join('\r\n');
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

export function exportToXLSX(reportType, rawData, vehicle, metadata = {}) {
  const rows = normalizeReportData(reportType, rawData, vehicle);
  if (rows.length === 0) {
    throw new Error('No data available to export.');
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { origin: 'A4' });

  XLSX.utils.sheet_add_aoa(ws, [
    [`ABSTRACKER TELEMATICS - ${reportType.toUpperCase()} REPORT`],
    [`Vehicle: ${vehicle?.name || 'Fleet'} | Period: ${metadata.dateRange || 'Custom'} | Generated: ${new Date().toLocaleString('en-IN')}`],
    []
  ], { origin: 'A1' });

  const colWidths = Object.keys(rows[0]).map(key => {
    let maxLen = key.length;
    rows.forEach(r => {
      const valLen = r[key] ? String(r[key]).length : 0;
      if (valLen > maxLen) maxLen = valLen;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
  });
  ws['!cols'] = colWidths;

  const sheetName = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)}_Report`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, getFileName(vehicle?.name, reportType, 'xlsx'));
}

export function exportToPDF(reportType, rawData, vehicle, metadata = {}) {
  const rows = normalizeReportData(reportType, rawData, vehicle);
  if (rows.length === 0) {
    throw new Error('No data available to export.');
  }

  const orientation = reportType === 'trips' ? 'landscape' : (reportType === 'stops' ? 'landscape' : 'portrait');
  const doc = new jsPDF({
    orientation,
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primaryColor = [15, 23, 42]; // Slate-900
  const accentBlue = [37, 99, 235]; // Blue-600
  const brandRed = [220, 38, 38]; // Red-600

  // 1. Top Decorative Brand Bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 58, 'F');

  // Red accent bottom stripe
  doc.setFillColor(...brandRed);
  doc.rect(0, 55, pageWidth, 3, 'F');

  // Brand Name (Line 1 at Y=28)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Abs', 36, 28);
  const absWidth = doc.getTextWidth('Abs');
  doc.setTextColor(...brandRed);
  doc.text('Tracker', 36 + absWidth, 28);

  // Subtitle (Line 2 at Y=44 - Completely separated, no horizontal collision)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text('Enterprise Telematics & Fleet Intelligence', 36, 44);

  // Right-aligned report type badge in header
  const titleBadge = `${reportType.toUpperCase()} REPORT`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(titleBadge, pageWidth - 36 - doc.getTextWidth(titleBadge), 34);

  // 2. Metadata Section
  let currentY = 78;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text(vehicle?.name || 'All Fleet Vehicles', 36, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const dateRangeStr = `Reporting Period: ${metadata.dateRange || 'Custom Period'} | Category: ${(vehicle?.category || 'Fleet').toUpperCase()}`;
  doc.text(dateRangeStr, 36, currentY + 14);

  const genDateStr = `Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${rows.length}`;
  doc.text(genDateStr, pageWidth - 36 - doc.getTextWidth(genDateStr), currentY + 14);

  if (metadata.kpis) {
    currentY += 28;
    const boxWidth = (pageWidth - 72 - 36) / 4;
    const boxHeight = 44;

    const statBoxes = [
      { label: 'TOTAL RUN', val: metadata.kpis.totalKm ? `${metadata.kpis.totalKm} km` : '0 km', color: accentBlue },
      { label: 'TOTAL TIME', val: metadata.kpis.totalTime || '0 hrs', color: primaryColor },
      { label: 'MAX SPEED', val: metadata.kpis.maxSpeed || '0 km/h', color: brandRed },
      { label: 'RECORD COUNT', val: String(rows.length), color: [16, 185, 129] }
    ];

    statBoxes.forEach((stat, i) => {
      const bx = 36 + i * (boxWidth + 12);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(bx, currentY, boxWidth, boxHeight, 6, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(stat.label, bx + 10, currentY + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...stat.color);
      doc.text(stat.val, bx + 10, currentY + 34);
    });

    currentY += boxHeight + 16;
  } else {
    currentY += 26;
  }

  const tableHeaders = Object.keys(rows[0]);
  const tableData = rows.map(r => Object.values(r));

  const colStyles = {};
  tableHeaders.forEach((h, idx) => {
    if (h === '#') {
      colStyles[idx] = { cellWidth: 26, halign: 'center' };
    } else if (h.includes('Speed') || h === 'Distance' || h === 'Duration' || h.includes('Hours')) {
      colStyles[idx] = { cellWidth: 60, halign: 'center', fontStyle: 'bold' };
    } else if (h.includes('Time') || h === 'Arrived' || h === 'Departed') {
      colStyles[idx] = { cellWidth: 75 };
    } else if (h.includes('Address')) {
      colStyles[idx] = { cellWidth: 'auto' };
    }
  });

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: currentY,
    margin: { left: 36, right: 36, bottom: 40 },
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 6
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: colStyles,
    didDrawPage: () => {
      const pageStr = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('AbsTracker Fleet Telematics Suite • Confidential Operational Record', 36, pageHeight - 18);
      doc.text(pageStr, pageWidth - 36 - doc.getTextWidth(pageStr), pageHeight - 18);
    }
  });

  doc.save(getFileName(vehicle?.name, reportType, 'pdf'));
}
