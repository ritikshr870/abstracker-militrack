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

  const vehicleGroups = {};
  rows.forEach(r => {
    const vKey = r['Vehicle Number'] || 'Vehicle';
    if (!vehicleGroups[vKey]) vehicleGroups[vKey] = [];
    vehicleGroups[vKey].push(r);
  });
  const vehicleNames = Object.keys(vehicleGroups);

  if (vehicleNames.length > 1) {
    // Add individual sheet per vehicle - no aggregate total sheet
    vehicleNames.forEach((vName, idx) => {
      const vRows = vehicleGroups[vName];
      const ws = XLSX.utils.json_to_sheet(vRows, { origin: 'A4' });
      XLSX.utils.sheet_add_aoa(ws, [
        ['Vehicle:', vName],
        ['Report Type:', reportTypeTitle],
        ['Period:', periodText],
        []
      ], { origin: 'A1' });

      const colWidths = Object.keys(vRows[0]).map(key => {
        let maxLen = key.length;
        vRows.forEach(r => {
          const valLen = r[key] ? String(r[key]).length : 0;
          if (valLen > maxLen) maxLen = valLen;
        });
        return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
      });
      ws['!cols'] = colWidths;

      const safeSheet = vName.replace(/[:\\/?*\[\]]/g, '').slice(0, 28) || `Veh_${idx + 1}`;
      XLSX.utils.book_append_sheet(wb, ws, safeSheet);
    });
  } else {
    const ws = XLSX.utils.json_to_sheet(rows, { origin: 'A4' });
    XLSX.utils.sheet_add_aoa(ws, [
      ['Report Type:', reportTypeTitle],
      ['Period:', periodText],
      []
    ], { origin: 'A1' });

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
  }

  XLSX.writeFile(wb, getFileName(vehicle?.name, reportType, 'xlsx'));
}

/**
 * Export data to exact Executive PDF with AbsTracker Branding:
 * - Multi-vehicle: separate section and table for EACH vehicle, NO single lump-sum total count
 * - Single-vehicle: vehicle KPI stat cards and dedicated table
 * - Clean professional table with alternating fills and crisp lines
 * - Confidentiality footer with page numbering
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
  const primaryColor = [15, 23, 42]; // Slate-900
  const accentBlue = [37, 99, 235]; // Blue-600
  const brandRed = [220, 38, 38]; // Red-600
  const emeraldGreen = [16, 185, 129]; // Emerald-500

  // 1. Top Decorative Brand Bar
  const drawBrandHeader = () => {
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 52, 'F');

    // Red accent bottom stripe
    doc.setFillColor(...brandRed);
    doc.rect(0, 49, pageWidth, 3, 'F');

    // Brand Name (Line 1 at Y=26)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Abs', 36, 26);
    const absWidth = doc.getTextWidth('Abs');
    doc.setTextColor(...brandRed);
    doc.text('Tracker', 36 + absWidth, 26);

    // Subtitle (Line 2 at Y=40)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // Slate-300
    doc.text('Enterprise Telematics & Fleet Intelligence', 36, 40);

    // Right-aligned report type badge in header
    const titleBadge = `${reportType.toUpperCase()} REPORT`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(titleBadge, pageWidth - 36 - doc.getTextWidth(titleBadge), 32);
  };

  drawBrandHeader();

  // Group rows by vehicle number
  const vehicleGroups = {};
  rows.forEach(r => {
    const vKey = r['Vehicle Number'] || (vehicle?.name || 'Vehicle');
    if (!vehicleGroups[vKey]) {
      vehicleGroups[vKey] = [];
    }
    vehicleGroups[vKey].push(r);
  });

  const vehicleNames = Object.keys(vehicleGroups);
  const isMultiVehicle = vehicleNames.length > 1;

  let currentY = 70;

  const fromFormatted = formatReportDateTime(metadata.from);
  const toFormatted = formatReportDateTime(metadata.to);
  const dateRangeStr = `Reporting Period: ${fromFormatted} to ${toFormatted} (${metadata.dateRange || 'Custom Period'})`;

  if (isMultiVehicle) {
    // 2. Multi-Vehicle Top Header: NO lump-sum total count
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...primaryColor);
    doc.text(`Fleet Telematics Report (${vehicleNames.length} Vehicles)`, 36, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(dateRangeStr, 36, currentY + 13);

    const genDateStr = `Generated: ${new Date().toLocaleString('en-IN')} | Scope: Individual Vehicle Telematics Logs`;
    doc.text(genDateStr, pageWidth - 36 - doc.getTextWidth(genDateStr), currentY + 13);

    currentY += 28;

    // Iterate over each vehicle and draw individual breakdown
    vehicleNames.forEach((vName, vIdx) => {
      const vRows = vehicleGroups[vName];

      // Calculate this vehicle's individual stats
      let vDistKm = 0;
      let vMaxSpd = 0;
      let vRunningHrs = '00:00';
      let vStoppedHrs = '00:00';
      let vIdleHrs = '00:00';

      vRows.forEach(r => {
        if (r['Distance']) {
          const match = String(r['Distance']).match(/([\d.]+)/);
          if (match) vDistKm += parseFloat(match[1]);
        }
        if (r['Max Speed']) {
          const match = String(r['Max Speed']).match(/([\d.]+)/);
          if (match && parseFloat(match[1]) > vMaxSpd) vMaxSpd = parseFloat(match[1]);
        }
      });

      if (reportType === 'summary' && vRows[0]) {
        vRunningHrs = vRows[0]['Running Hours'] || '00:00';
        vStoppedHrs = vRows[0]['Stopped Hours'] || '00:00';
        vIdleHrs = vRows[0]['Idle Hours'] || '00:00';
      }

      // Check remaining space on current page
      if (currentY + 120 > pageHeight - 40) {
        doc.addPage();
        drawBrandHeader();
        currentY = 68;
      }

      // Individual Vehicle Section Header Bar
      doc.setFillColor(15, 23, 42); // Slate-900
      doc.roundedRect(36, currentY, pageWidth - 72, 28, 4, 4, 'F');

      // Vehicle number badge
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`[${vIdx + 1}] Vehicle: ${vName}`, 48, currentY + 18);

      // Vehicle-specific metrics right aligned
      let statSummary = '';
      if (reportType === 'summary') {
        statSummary = `Run: ${vDistKm.toFixed(1)} km  |  Running: ${vRunningHrs}  |  Stopped: ${vStoppedHrs}  |  Idle: ${vIdleHrs}`;
      } else if (reportType === 'trips') {
        statSummary = `Trips: ${vRows.length}  |  Total Run: ${vDistKm.toFixed(1)} km  |  Top Speed: ${vMaxSpd} km/h`;
      } else {
        statSummary = `Total Halts: ${vRows.length}`;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(147, 197, 253); // Blue-300
      doc.text(statSummary, pageWidth - 48 - doc.getTextWidth(statSummary), currentY + 18);

      currentY += 34;

      // Table headers without redundant "Vehicle Number"
      const allHeaders = Object.keys(vRows[0]);
      const vHeaders = allHeaders.filter(h => h !== 'Vehicle Number');
      const vTableData = vRows.map(r => vHeaders.map(h => r[h]));

      const colStyles = {};
      vHeaders.forEach((h, idx) => {
        if (h.includes('Date & Time') || h.includes('Time')) {
          colStyles[idx] = { cellWidth: 105, halign: 'left' };
        } else if (h === 'Distance') {
          colStyles[idx] = { cellWidth: 70, halign: 'left', fontStyle: 'bold' };
        } else if (h.includes('Hours') || h.includes('Duration')) {
          colStyles[idx] = { cellWidth: 65, halign: 'center' };
        } else if (h.includes('Speed')) {
          colStyles[idx] = { cellWidth: 65, halign: 'center' };
        } else {
          colStyles[idx] = { cellWidth: 'auto', halign: 'left' };
        }
      });

      autoTable(doc, {
        head: [vHeaders],
        body: vTableData,
        startY: currentY,
        margin: { left: 36, right: 36, bottom: 35 },
        theme: 'grid',
        styles: {
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
          fontSize: 7.5,
          textColor: [51, 65, 85],
          cellPadding: 3.5,
          font: 'helvetica'
        },
        headStyles: {
          fillColor: [30, 41, 59], // Slate-800
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 8,
          cellPadding: 4.5
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: colStyles,
        didDrawPage: () => {
          const pageStr = `Page ${doc.internal.getNumberOfPages()}`;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text('AbsTracker Fleet Telematics Suite • Confidential Operational Record', 36, pageHeight - 14);
          doc.text(pageStr, pageWidth - 36 - doc.getTextWidth(pageStr), pageHeight - 14);
        }
      });

      currentY = doc.lastAutoTable.finalY + 18;
    });

  } else {
    // 3. Single-Vehicle Report: individual vehicle metadata & individual KPI cards
    const vehicleTitle = metadata.vehicleLabel || metadata.vehicleScope || vehicle?.name || 'Vehicle Report';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...primaryColor);
    doc.text(vehicleTitle, 36, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(dateRangeStr, 36, currentY + 13);

    const genDateStr = `Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${rows.length}`;
    doc.text(genDateStr, pageWidth - 36 - doc.getTextWidth(genDateStr), currentY + 13);

    currentY += 24;

    // Single Vehicle KPI cards
    if (metadata.kpis) {
      const boxWidth = (pageWidth - 72 - 36) / 4;
      const boxHeight = 40;

      const statBoxes = [
        { label: 'TOTAL RUN', val: metadata.kpis.totalKm ? `${metadata.kpis.totalKm} km` : '0 km', color: accentBlue },
        { label: 'TOTAL DURATION', val: metadata.kpis.totalTime || '0 hrs', color: primaryColor },
        { label: 'MAX SPEED', val: metadata.kpis.maxSpeed || '0 km/h', color: brandRed },
        { label: 'TOTAL ENTRIES', val: String(rows.length), color: emeraldGreen }
      ];

      statBoxes.forEach((stat, i) => {
        const bx = 36 + i * (boxWidth + 12);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(bx, currentY, boxWidth, boxHeight, 5, 5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(stat.label, bx + 8, currentY + 13);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(...stat.color);
        doc.text(stat.val, bx + 8, currentY + 30);
      });

      currentY += boxHeight + 16;
    } else {
      currentY += 16;
    }

    const tableHeaders = Object.keys(rows[0]);
    const tableData = rows.map(r => Object.values(r));

    const colStyles = {};
    tableHeaders.forEach((h, idx) => {
      if (h === 'Vehicle Number') {
        colStyles[idx] = { cellWidth: 90, fontStyle: 'bold', halign: 'left' };
      } else if (h.includes('Date & Time') || h.includes('Time')) {
        colStyles[idx] = { cellWidth: 95, halign: 'left' };
      } else if (h === 'Distance') {
        colStyles[idx] = { cellWidth: 65, halign: 'left', fontStyle: 'bold' };
      } else if (h.includes('Hours') || h.includes('Duration')) {
        colStyles[idx] = { cellWidth: 55, halign: 'center' };
      } else if (h.includes('Speed')) {
        colStyles[idx] = { cellWidth: 55, halign: 'center' };
      } else {
        colStyles[idx] = { cellWidth: 'auto', halign: 'left' };
      }
    });

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: currentY,
      margin: { left: 36, right: 36, bottom: 35 },
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: 4,
        font: 'helvetica'
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 8,
        cellPadding: 5.5
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
        doc.text('AbsTracker Fleet Telematics Suite • Confidential Operational Record', 36, pageHeight - 16);
        doc.text(pageStr, pageWidth - 36 - doc.getTextWidth(pageStr), pageHeight - 16);
      }
    });
  }

  doc.save(getFileName(vehicle?.name, reportType, 'pdf'));
}
