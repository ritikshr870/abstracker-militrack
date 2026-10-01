import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useFleet } from '../contexts/FleetContext';
import { FileDown, Filter, Route, Clock, Gauge, Compass, CheckCircle2, AlertCircle, FileText, Search, Printer, Download, ChevronLeft, ChevronRight, Copy, Check, Eye, MapPin, Play } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import TripLivePreviewModal from '../components/TripLivePreviewModal';

const EVENT_TYPE_DICTIONARY = {
  deviceOnline: 'Device Online (Active)',
  deviceOffline: 'Device Offline (No Signal)',
  deviceMoving: 'Vehicle Moving',
  deviceStopped: 'Vehicle Stopped',
  deviceOverspeed: 'Overspeed Alert',
  ignitionOn: 'Ignition Turned ON',
  ignitionOff: 'Ignition Turned OFF',
  geofenceEnter: 'Geofence Entered',
  geofenceExit: 'Geofence Exited',
  alarm: 'SOS / Emergency Alarm',
  commandResult: 'Command Acknowledged'
};

function degreesToCompass(deg) {
  if (deg === undefined || deg === null) return 'N';
  const val = Math.floor((deg / 22.5) + 0.5);
  const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return arr[val % 16];
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0h 0m';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function getHaversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ReportsHub() {
  const { allDevices, fleet } = useFleet();
  const [category, setCategory] = useState('route');
  const [deviceId, setDeviceId] = useState('');
  const [fromDate, setFromDate] = useState(format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm"));
  const [toDate, setToDate] = useState(format(endOfDay(new Date()), "yyyy-MM-dd'T'HH:mm"));
  
  const [reportRows, setReportRows] = useState([]);
  const [reportColumns, setReportColumns] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Table Search & Pagination
  const [tableSearch, setTableSearch] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedRowIdx, setCopiedRowIdx] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  const devicesList = allDevices.length > 0 ? allDevices : fleet.map(f => f.device || f);

  // Set default selected vehicle
  useEffect(() => {
    if (!deviceId && devicesList.length > 0) {
      setDeviceId(String(devicesList[0].id));
    }
  }, [devicesList, deviceId]);

  const setPreset = (type) => {
    const now = new Date();
    if (type === 'today') {
      setFromDate(format(startOfDay(now), "yyyy-MM-dd'T'HH:mm"));
      setToDate(format(endOfDay(now), "yyyy-MM-dd'T'HH:mm"));
    } else if (type === 'yesterday') {
      const y = subDays(now, 1);
      setFromDate(format(startOfDay(y), "yyyy-MM-dd'T'HH:mm"));
      setToDate(format(endOfDay(y), "yyyy-MM-dd'T'HH:mm"));
    } else if (type === '3days') {
      const d = subDays(now, 3);
      setFromDate(format(startOfDay(d), "yyyy-MM-dd'T'HH:mm"));
      setToDate(format(endOfDay(now), "yyyy-MM-dd'T'HH:mm"));
    } else if (type === 'week') {
      const w = startOfWeek(now, { weekStartsOn: 1 });
      setFromDate(format(w, "yyyy-MM-dd'T'HH:mm"));
      setToDate(format(endOfDay(now), "yyyy-MM-dd'T'HH:mm"));
    } else if (type === 'month') {
      const m = startOfMonth(now);
      setFromDate(format(m, "yyyy-MM-dd'T'HH:mm"));
      setToDate(format(endOfDay(now), "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const processAndFormatData = (rawRecords, cat, targetDevName) => {
    if (!Array.isArray(rawRecords)) rawRecords = rawRecords ? [rawRecords] : [];
    if (rawRecords.length === 0) {
      setReportRows([]);
      setReportColumns([]);
      setMetrics(null);
      return;
    }

    let totalDistM = 0;
    let topSpeed = 0;
    let movingDurationMs = 0;
    let idleDurationMs = 0;
    let movingSpeedSum = 0;
    let movingSpeedCount = 0;

    const isRouteOrPositions = cat === 'route' || (rawRecords.length > 0 && (rawRecords[0].fixTime || rawRecords[0].deviceTime));

    if (isRouteOrPositions) {
      const sorted = [...rawRecords].sort((a, b) => {
        const tA = new Date(a.fixTime || a.deviceTime || a.serverTime || 0).getTime();
        const tB = new Date(b.fixTime || b.deviceTime || b.serverTime || 0).getTime();
        return tA - tB;
      });

      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        let spd = p.speedKmh ? parseFloat(p.speedKmh) : (p.speed !== undefined ? Math.round(Number(p.speed) * 1.852) : 0);
        if (spd > 160) spd = 0;
        if (spd > topSpeed) topSpeed = spd;

        if (i > 0) {
          const prev = sorted[i - 1];
          const tPrev = new Date(prev.fixTime || prev.deviceTime || prev.serverTime || 0).getTime();
          const tCurr = new Date(p.fixTime || p.deviceTime || p.serverTime || 0).getTime();
          const deltaMs = Math.max(0, tCurr - tPrev);

          if (deltaMs > 0 && deltaMs < 4 * 3600 * 1000) {
            const distM = getHaversineDist(Number(prev.latitude), Number(prev.longitude), Number(p.latitude), Number(p.longitude));
            const impliedKmh = (distM / (deltaMs / 1000)) * 3.6;

            if (impliedKmh <= 160 && (distM >= 3 || spd > 2)) {
              totalDistM += distM;
            }

            if (spd > 2) {
              movingDurationMs += deltaMs;
              movingSpeedSum += spd;
              movingSpeedCount++;
            } else {
              idleDurationMs += deltaMs;
            }
          }
        }
      }
    } else {
      rawRecords.forEach(item => {
        let d = item['Distance (km)'] ? parseFloat(item['Distance (km)']) * 1000 : (item.distance !== undefined ? Number(item.distance) : 0);
        totalDistM += d;

        let spd = item['Max Speed (km/h)'] ? parseFloat(item['Max Speed (km/h)']) : (item.maxSpeed !== undefined ? Math.round(Number(item.maxSpeed) * 1.852) : 0);
        if (spd > 160) spd = 0;
        if (spd > topSpeed) topSpeed = spd;

        let avg = item['Avg Speed (km/h)'] ? parseFloat(item['Avg Speed (km/h)']) : (item.averageSpeed !== undefined ? Math.round(Number(item.averageSpeed) * 1.852) : 0);
        if (avg > 0) {
          movingSpeedSum += avg;
          movingSpeedCount++;
        }

        if (item.duration !== undefined) movingDurationMs += Number(item.duration);
        else if (item.engineHours !== undefined) movingDurationMs += Number(item.engineHours);
        if (item.todayStoppedTime !== undefined) idleDurationMs += Number(item.todayStoppedTime);
      });
    }

    const calculatedAvgSpeed = movingSpeedCount > 0 ? Math.round(movingSpeedSum / movingSpeedCount) : 0;

    setMetrics({
      totalRecords: rawRecords.length,
      totalDistance: (totalDistM / 1000).toFixed(2) + ' km',
      maxSpeed: topSpeed + ' km/h',
      avgSpeed: calculatedAvgSpeed + ' km/h',
      movingDuration: formatDuration(movingDurationMs),
      idleDuration: formatDuration(idleDurationMs)
    });

    const formattedRows = rawRecords.map((raw, idx) => {
      const clean = {};
      clean['#'] = idx + 1;
      clean['Vehicle'] = targetDevName;

      if (isRouteOrPositions) {
        const rawTime = raw.formattedTime || raw.fixTime || raw.deviceTime || raw.serverTime;
        clean['Recorded Time'] = rawTime ? new Date(rawTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) : 'N/A';
        
        if (raw.latitude !== undefined && raw.longitude !== undefined) {
          clean['Coordinates'] = `${Number(raw.latitude).toFixed(6)}, ${Number(raw.longitude).toFixed(6)}`;
        }

        const spd = raw.speedKmh ? raw.speedKmh : (raw.speed !== undefined ? Math.round(Number(raw.speed) * 1.852) + ' km/h' : '0 km/h');
        clean['Speed'] = spd;

        if (raw.course !== undefined) {
          clean['Direction'] = `${degreesToCompass(raw.course)} (${Math.round(raw.course)}°)`;
        }

        clean['Ignition'] = (raw.ignition === 'ON' || raw.attributes?.ignition === true) ? 'ON' : 'OFF';
        clean['Location'] = raw.address || 'GPS Coordinate Fix';
        clean._raw = raw;
        return clean;
      }

      if (raw.type !== undefined) {
        clean['Event Alert'] = EVENT_TYPE_DICTIONARY[raw.type] || String(raw.type).toUpperCase();
      }

      if (raw['Distance (km)']) clean['Distance'] = raw['Distance (km)'];
      else if (raw.distance !== undefined) clean['Distance'] = (Number(raw.distance) / 1000).toFixed(2) + ' km';

      if (raw['Odometer (km)']) clean['Odometer'] = raw['Odometer (km)'];
      else if (raw.totalDistance !== undefined) clean['Odometer'] = (Number(raw.totalDistance) / 1000).toFixed(2) + ' km';

      if (raw['Speed (km/h)']) clean['Speed'] = raw['Speed (km/h)'];
      else if (raw.speed !== undefined) clean['Speed'] = Math.round(Number(raw.speed) * 1.852) + ' km/h';

      if (raw['Max Speed (km/h)']) clean['Max Speed'] = raw['Max Speed (km/h)'];
      else if (raw.maxSpeed !== undefined) clean['Max Speed'] = Math.round(Number(raw.maxSpeed) * 1.852) + ' km/h';

      if (raw['Duration']) clean['Duration'] = raw['Duration'];
      else if (raw.duration !== undefined) {
        clean['Duration'] = formatDuration(Number(raw.duration));
      }

      if (raw.startTime) clean['Start Time'] = new Date(raw.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
      if (raw.endTime) clean['End Time'] = new Date(raw.endTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
      if (raw.serverTime || raw.eventTime) clean['Event Time'] = new Date(raw.serverTime || raw.eventTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

      if (raw.address) clean['Address'] = raw.address;
      if (raw.attributes?.ignition !== undefined) clean['Ignition'] = raw.attributes.ignition ? 'ON' : 'OFF';

      clean._raw = raw;
      return clean;
    });

    setReportRows(formattedRows);
    if (formattedRows.length > 0) {
      setReportColumns(Object.keys(formattedRows[0]).filter(k => k !== '_raw'));
    }
  };

  const handleGenerate = async () => {
    if (!deviceId) return alert('Please select a target vehicle');
    setLoading(true);
    setErrorMsg(null);

    const targetDev = devicesList.find(d => String(d.id) === String(deviceId));
    const devName = targetDev ? targetDev.name : `Device #${deviceId}`;

    try {
      const fromIso = new Date(fromDate).toISOString();
      const toIso = new Date(toDate).toISOString();

      let rawData = null;

      if (category === 'route') {
        try {
          const reportRes = await axios.get(`/api/reports/route?deviceId=${deviceId}&from=${fromIso}&to=${toIso}`);
          if (Array.isArray(reportRes.data) && reportRes.data.length > 0) {
            rawData = reportRes.data;
          }
        } catch (e) {}

        if (!rawData || rawData.length === 0) {
          const posRes = await axios.get(`/api/positions?deviceId=${deviceId}&from=${fromIso}&to=${toIso}`);
          if (Array.isArray(posRes.data)) {
            rawData = posRes.data;
          }
        }
      } else {
        const url = `/api/reports/${category}?deviceId=${deviceId}&from=${fromIso}&to=${toIso}`;
        const res = await axios.get(url);
        rawData = res.data;
      }

      if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
        setReportRows([]);
        setReportColumns([]);
        setMetrics(null);
        setErrorMsg('No telemetry records found for the selected timeframe.');
      } else {
        processAndFormatData(rawData, category, devName);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to compile report. Verify server connection.');
      setReportRows([]);
      setReportColumns([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (reportRows.length === 0) return alert('No report data to export.');
    try {
      const ws = XLSX.utils.json_to_sheet(reportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${category.toUpperCase()}_Report`);
      XLSX.writeFile(wb, `Abstracker_${category}_report_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    } catch (err) {
      // Fallback to server endpoint
      const fromIso = new Date(fromDate).toISOString();
      const toIso = new Date(toDate).toISOString();
      window.open(`/api/reports/${category}?deviceId=${deviceId}&from=${fromIso}&to=${toIso}&export=xlsx`, '_blank');
    }
  };

  const handleExportCsv = () => {
    if (reportRows.length === 0) return alert('No report data to export.');
    try {
      const ws = XLSX.utils.json_to_sheet(reportRows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Abstracker_${category}_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to export CSV');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenLivePreview = async (row) => {
    const raw = row._raw || {};
    const vehicleName = row['Vehicle'] || 'Vehicle Asset';

    let sLat = Number(raw.startLat ?? raw.startLatitude ?? raw.latitude);
    let sLon = Number(raw.startLon ?? raw.startLongitude ?? raw.longitude);
    let eLat = Number(raw.endLat ?? raw.endLatitude ?? sLat);
    let eLon = Number(raw.endLon ?? raw.endLongitude ?? sLon);

    if (isNaN(sLat) || isNaN(sLon) || sLat === 0 || sLon === 0) {
      sLat = 25.5941;
      sLon = 85.1376;
    }
    if (isNaN(eLat) || isNaN(eLon) || eLat === 0 || eLon === 0) {
      eLat = sLat + 0.015;
      eLon = sLon + 0.015;
    }

    const initialPreview = {
      title: `Trip #${row['#'] || 1} Live Route Playback`,
      vehicle: vehicleName,
      type: 'Trip Route',
      startPoint: {
        lat: sLat,
        lon: sLon,
        time: row['Start Time'] || 'Departure',
        address: raw.startAddress || row['Address'] || 'Origin'
      },
      endPoint: {
        lat: eLat,
        lon: eLon,
        time: row['End Time'] || 'Arrival',
        address: raw.endAddress || 'Destination'
      },
      polyline: [[sLat, sLon], [eLat, eLon]],
      stats: {
        distance: row['Distance'] || undefined,
        duration: row['Duration'] || undefined,
        speed: row['Max Speed'] || row['Speed'] || undefined
      },
      routePoints: []
    };

    setPreviewData(initialPreview);

    // Fetch intermediate GPS route points for smooth turn-by-turn playback
    const devId = raw.deviceId || selectedDevice;
    const startTimeStr = raw.startTime || raw.start;
    const endTimeStr = raw.endTime || raw.end;

    if (devId && startTimeStr && endTimeStr) {
      try {
        const fromIso = new Date(startTimeStr).toISOString();
        const toIso = new Date(endTimeStr).toISOString();
        const res = await axios.get('/api/reports/route', {
          params: { deviceId: devId, from: fromIso, to: toIso },
          headers: { Accept: 'application/json' }
        });
        if (Array.isArray(res.data) && res.data.length > 1) {
          const validRaw = res.data.filter(p => p && Number(p.latitude) !== 0 && Number(p.longitude) !== 0 && !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude)));
          if (validRaw.length > 1) {
            const detailedPoints = validRaw.map(p => ({
              lat: Number(p.latitude),
              lon: Number(p.longitude),
              speed: p.speedKmh || `${Math.round((p.speed || 0) * 1.852)} km/h`,
              time: p.formattedTime || (p.fixTime ? new Date(p.fixTime).toLocaleTimeString('en-IN') : ''),
              course: p.course || 0
            }));
            const detailedPoly = detailedPoints.map(p => [p.lat, p.lon]);
            setPreviewData(prev => prev ? {
              ...prev,
              polyline: detailedPoly,
              routePoints: detailedPoints
            } : null);
          }
        }
      } catch (err) {
        console.warn('Could not fetch detailed intermediate trip route:', err.message);
      }
    }
  };

  const handleCopyCoord = (coordText, idx) => {
    navigator.clipboard.writeText(coordText);
    setCopiedRowIdx(idx);
    setTimeout(() => setCopiedRowIdx(null), 1500);
  };

  // Filtered rows based on table search
  const filteredReportRows = reportRows.filter(r => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return Object.values(r).some(val => String(val).toLowerCase().includes(q));
  });

  // Pagination calculations
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredReportRows.length / Number(pageSize)));
  const displayedRows = pageSize === 'all' 
    ? filteredReportRows 
    : filteredReportRows.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize));

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scroll">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Controls Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Vehicle Reports</h2>
              <p className="text-xs text-slate-500">Generate trips, stoppages, speed history, and route tracking logs</p>
            </div>
            
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                onClick={handleExportExcel}
                disabled={reportRows.length === 0}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                title="Export Excel Worksheet"
              >
                <FileDown size={14} /> <span>Excel (.xlsx)</span>
              </button>
              <button
                onClick={handleExportCsv}
                disabled={reportRows.length === 0}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                title="Download CSV"
              >
                <Download size={13} /> <span>CSV</span>
              </button>
              <button
                onClick={handlePrint}
                disabled={reportRows.length === 0}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl transition"
                title="Print Report"
              >
                <Printer size={15} />
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Timeframe:</span>
            <button onClick={() => setPreset('today')} className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition">Today</button>
            <button onClick={() => setPreset('yesterday')} className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition">Yesterday</button>
            <button onClick={() => setPreset('3days')} className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition">Last 3 Days</button>
            <button onClick={() => setPreset('week')} className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition">This Week</button>
            <button onClick={() => setPreset('month')} className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition">This Month</button>
          </div>

          {/* 5-Column Responsive Query Filters - No Overlapping */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Report Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-red-600"
              >
                <option value="route">Route Positions Log</option>
                <option value="summary">Summary Report</option>
                <option value="trips">Trips Report</option>
                <option value="stops">Stops Report</option>
                <option value="events">Events & Alerts Report</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Target Vehicle</label>
              <select
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-red-600"
              >
                <option value="">Select Vehicle</option>
                {devicesList.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.uniqueId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">From Timestamp</label>
              <input
                type="datetime-local"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-red-600"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">To Timestamp</label>
              <input
                type="datetime-local"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-red-600"
              />
            </div>

            <div>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
              >
                <Filter size={14} />
                <span>{loading ? 'Loading...' : 'Generate Report'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Summary Metric KPI Cards */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Records</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileText size={15} />
                </div>
              </div>
              <span className="text-xl font-black text-slate-900 mt-2 font-mono">{metrics.totalRecords}</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Distance</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Route size={15} />
                </div>
              </div>
              <span className="text-xl font-black text-blue-600 mt-2 font-mono">{metrics.totalDistance}</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Speed</span>
                <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <Gauge size={15} />
                </div>
              </div>
              <div>
                <span className="text-xl font-black text-red-600 mt-2 font-mono block">{metrics.maxSpeed}</span>
                <span className="text-[10px] text-slate-400 font-medium">Avg: {metrics.avgSpeed}</span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Moving Duration</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Clock size={15} />
                </div>
              </div>
              <span className="text-xl font-black text-emerald-600 mt-2 font-mono">{metrics.movingDuration}</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Idle / Stopped</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Clock size={15} />
                </div>
              </div>
              <span className="text-xl font-black text-amber-600 mt-2 font-mono">{metrics.idleDuration}</span>
            </div>
          </div>
        )}

        {/* Report Output Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Table Toolbar with Search and Page Size */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between bg-slate-50/70 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                {category.toUpperCase()} REPORT
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-[10px] font-mono font-bold">
                {filteredReportRows.length} {tableSearch ? 'matched' : 'records'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* In-table Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={e => { setTableSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Filter table rows..."
                  className="bg-white border border-slate-200 rounded-xl pl-7 pr-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-red-600 font-medium w-40 sm:w-56"
                />
              </div>

              {/* Rows per page */}
              <select
                value={pageSize}
                onChange={e => { setPageSize(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-700"
              >
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
                <option value="all">View All</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-left text-xs text-slate-700 min-w-[700px]">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  {reportColumns.length > 0 ? (
                    <>
                      {reportColumns.map(col => <th key={col} className="px-4 py-3.5 whitespace-nowrap">{col}</th>)}
                      {category === 'trips' && <th className="px-4 py-3.5 text-right whitespace-nowrap">Live Trip Map</th>}
                    </>
                  ) : (
                    <th className="px-4 py-3.5">Report Columns</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={reportColumns.length ? (category === 'trips' ? reportColumns.length + 1 : reportColumns.length) : 1} className="text-center py-16 text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></span>
                        <span>Loading vehicle report records...</span>
                      </div>
                    </td>
                  </tr>
                ) : errorMsg ? (
                  <tr>
                    <td colSpan={reportColumns.length ? (category === 'trips' ? reportColumns.length + 1 : reportColumns.length) : 1} className="text-center py-12 text-red-500 font-semibold">
                      <div className="flex items-center justify-center gap-1.5">
                        <AlertCircle size={16} />
                        <span>{errorMsg}</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={reportColumns.length ? (category === 'trips' ? reportColumns.length + 1 : reportColumns.length) : 1} className="text-center py-12 text-slate-400">
                      {reportRows.length === 0 
                        ? 'No active report generated. Choose vehicle, range, and click Generate.' 
                        : `No records matching "${tableSearch}".`}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      {reportColumns.map(col => (
                        <td key={col} className="px-4 py-3 whitespace-nowrap">
                          {col === 'Ignition' ? (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${row[col] === 'ON' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              {row[col]}
                            </span>
                          ) : col === 'Speed' ? (
                            <strong className={`font-mono ${Number(row[col]) > 60 ? 'text-red-600 font-black' : 'text-slate-900'}`}>
                              {row[col]} {Number(row[col]) > 60 && <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded ml-1 font-sans font-bold">Overspeed</span>}
                            </strong>
                          ) : col === 'Coordinates' ? (
                            <div className="flex items-center gap-1.5 font-mono text-slate-600">
                              <span>{row[col]}</span>
                              <button
                                onClick={() => handleCopyCoord(row[col], idx)}
                                className="text-slate-400 hover:text-slate-800 p-0.5 rounded"
                                title="Copy Coordinates"
                              >
                                {copiedRowIdx === idx ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          ) : (
                            <span>{row[col] !== undefined ? String(row[col]) : '--'}</span>
                          )}
                        </td>
                      ))}
                      {category === 'trips' && (
                        <td className="px-4 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenLivePreview(row)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                            title="Play Trip Route Live"
                          >
                            <Play size={12} className="text-emerald-400 fill-emerald-400" />
                            <span>Play Trip</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-xs">
              <span className="text-slate-500 font-medium">
                Showing {((currentPage - 1) * Number(pageSize)) + 1} to {Math.min(currentPage * Number(pageSize), filteredReportRows.length)} of {filteredReportRows.length} entries
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 font-mono font-bold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Interactive Trip / Route Live Preview Modal */}
      {previewData && (
        <TripLivePreviewModal
          data={previewData}
          onClose={() => setPreviewData(null)}
        />
      )}
    </div>
  );
}
