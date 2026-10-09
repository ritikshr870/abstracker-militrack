import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracking } from '../contexts/TrackingContext';
import { api } from '../api/client';
import VehicleLoadingAnimation from '../components/VehicleLoadingAnimation';
import {
  FileText,
  MapPin,
  Calendar,
  Clock,
  Gauge,
  ArrowRight,
  Loader2,
  Navigation,
  Search,
  Download,
  FileSpreadsheet,
  FileType,
  Copy,
  Check,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Table,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  Filter
} from 'lucide-react';
import { VehicleCategoryIcon } from '../components/VehicleIcons';
import {
  exportToCSV,
  exportToXLSX,
  exportToPDF,
  formatReportDateTime,
  formatHoursMinutes,
  formatReportDistance
} from '../utils/reportExporter';

export default function ReportsPage() {
  const { liveVehicles, selectedVehicle, setSelectedVehicleId } = useTracking();
  const navigate = useNavigate();

  // Multi-vehicle selection state
  const [selectedVehicleIds, setSelectedVehicleIds] = useState(() => {
    if (selectedVehicle?.id) return [selectedVehicle.id];
    if (liveVehicles[0]?.id) return [liveVehicles[0].id];
    return [];
  });
  const [isVehicleSelectorOpen, setIsVehicleSelectorOpen] = useState(false);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [inReportVehicleFilter, setInReportVehicleFilter] = useState('all');

  // Default to 'summary' as requested
  const [reportType, setReportType] = useState('summary'); // 'summary', 'trips', 'stops'
  const [dateRange, setDateRange] = useState('yesterday'); // 'today', 'yesterday', 'week', 'month', 'custom'
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [viewMode, setViewMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768) ? 'cards' : 'table'); // Default to cards on mobile for mobile-first experience
  const [exportingType, setExportingType] = useState(null); // 'csv' | 'xlsx' | 'pdf' | null
  const [toastMessage, setToastMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Initialize selected vehicle if empty and liveVehicles loads
  useEffect(() => {
    if (selectedVehicleIds.length === 0 && liveVehicles.length > 0) {
      setSelectedVehicleIds([selectedVehicle?.id || liveVehicles[0].id]);
    }
  }, [liveVehicles, selectedVehicle]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const calculateDateBounds = () => {
    let from = new Date();
    let to = new Date();

    if (dateRange === 'today') {
      from.setHours(0, 0, 0, 0);
    } else if (dateRange === 'yesterday') {
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
    } else if (dateRange === 'week') {
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
    } else if (dateRange === 'month') {
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
    } else if (dateRange === 'custom') {
      from = new Date(customFrom + 'T00:00:00');
      to = new Date(customTo + 'T23:59:59');
    }

    return { from, to };
  };

  // Generate / Fetch Report from Backend for ALL Selected Vehicles
  const handleShowReport = async () => {
    if (selectedVehicleIds.length === 0) {
      showToast('Please select at least 1 vehicle');
      return;
    }

    setLoading(true);
    const { from, to } = calculateDateBounds();
    const periodMs = to.getTime() - from.getTime();
    const startDateFormatted = formatReportDateTime(from);
    const endDateFormatted = formatReportDateTime(to);

    try {
      const endpoint = reportType === 'summary'
        ? '/api/reports/summary'
        : (reportType === 'trips' ? '/api/reports/trips' : '/api/reports/stops');

      const targetVehicles = liveVehicles.filter(v => selectedVehicleIds.includes(v.id));

      // Fetch with chunking (10 vehicles concurrently) to ensure high reliability
      const chunkSize = 10;
      let combined = [];

      for (let i = 0; i < targetVehicles.length; i += chunkSize) {
        const chunk = targetVehicles.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(async (veh) => {
          try {
            const res = await api.get(endpoint, {
              params: {
                deviceId: veh.id,
                from: from.toISOString(),
                to: to.toISOString()
              }
            });
            const list = Array.isArray(res.data) ? res.data : [];

            if (reportType === 'summary') {
              if (list.length > 0) {
                return list.map(item => {
                  const dist = item.distance || 0;
                  const runMs = item.runningHours || 0;
                  const idlMs = item.idleHours || 0;
                  const stopMs = item.stoppedHours || Math.max(0, periodMs - runMs - idlMs);

                  return {
                    ...item,
                    deviceId: veh.id,
                    vehicleName: veh.name,
                    vehiclePlate: veh.uniqueId,
                    vehicleCategory: veh.category,
                    startDate: startDateFormatted,
                    endDate: endDateFormatted,
                    distance: dist,
                    distanceStr: formatReportDistance(dist),
                    engineHours: item.engineHours || 0,
                    engineHoursStr: formatHoursMinutes(item.engineHours || 0),
                    runningHours: runMs,
                    runningHoursStr: formatHoursMinutes(runMs),
                    stoppedHours: stopMs,
                    stoppedHoursStr: formatHoursMinutes(stopMs),
                    idleHours: idlMs,
                    idleHoursStr: formatHoursMinutes(idlMs),
                    airConditionerHours: item.airConditionerHours || item.acHours || 0,
                    acHoursStr: formatHoursMinutes(item.airConditionerHours || item.acHours || 0)
                  };
                });
              } else {
                // If stationary all day (matching screenshot BR25G5917 format)
                return [{
                  deviceId: veh.id,
                  vehicleName: veh.name,
                  vehiclePlate: veh.uniqueId,
                  vehicleCategory: veh.category,
                  startTime: from.toISOString(),
                  endTime: to.toISOString(),
                  startDate: startDateFormatted,
                  endDate: endDateFormatted,
                  distance: 0,
                  distanceStr: '0 km',
                  engineHours: 0,
                  engineHoursStr: '00:00',
                  runningHours: 0,
                  runningHoursStr: '00:00',
                  stoppedHours: periodMs,
                  stoppedHoursStr: formatHoursMinutes(periodMs),
                  idleHours: 0,
                  idleHoursStr: '00:00',
                  airConditionerHours: 0,
                  acHoursStr: '00:00'
                }];
              }
            }

            return list.map(item => ({
              ...item,
              deviceId: veh.id,
              vehicleName: veh.name,
              vehiclePlate: veh.uniqueId,
              vehicleCategory: veh.category
            }));
          } catch (err) {
            console.warn(`Report fetch failed for ${veh.name}:`, err.message);
            if (reportType === 'summary') {
              return [{
                deviceId: veh.id,
                vehicleName: veh.name,
                vehiclePlate: veh.uniqueId,
                vehicleCategory: veh.category,
                startTime: from.toISOString(),
                endTime: to.toISOString(),
                startDate: startDateFormatted,
                endDate: endDateFormatted,
                distance: 0,
                distanceStr: '0 km',
                engineHours: 0,
                engineHoursStr: '00:00',
                runningHours: 0,
                runningHoursStr: '00:00',
                stoppedHours: periodMs,
                stoppedHoursStr: formatHoursMinutes(periodMs),
                idleHours: 0,
                idleHoursStr: '00:00',
                airConditionerHours: 0,
                acHoursStr: '00:00'
              }];
            }
            return [];
          }
        }));
        combined = combined.concat(chunkResults.flat());
      }

      // Sort by distance descending or start timestamp
      if (reportType === 'summary') {
        combined.sort((a, b) => (b.distance || 0) - (a.distance || 0));
      } else {
        combined.sort((a, b) => {
          const timeA = new Date(a.startTime || a.serverTime || a.deviceTime || 0).getTime();
          const timeB = new Date(b.startTime || b.serverTime || b.deviceTime || 0).getTime();
          return timeB - timeA;
        });
      }

      setReportData(combined);
      setInReportVehicleFilter('all');
    } catch (err) {
      console.error('Report fetch error:', err.message);
      setReportData([]);
      showToast('Could not load report records. Please try another period.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedVehicleIds.length > 0) {
      handleShowReport();
    }
  }, [reportType, dateRange]);

  // Filter report data in-page if user selects a specific vehicle pill
  const displayedReportData = useMemo(() => {
    if (inReportVehicleFilter === 'all') return reportData;
    return reportData.filter(item => item.deviceId === Number(inReportVehicleFilter));
  }, [reportData, inReportVehicleFilter]);

  // Per-vehicle individual count, metric aggregates, and records grouping
  const vehicleStatsSummary = useMemo(() => {
    return selectedVehicleIds.map(vId => {
      const veh = liveVehicles.find(v => v.id === vId) || { id: vId, name: `Vehicle ${vId}`, uniqueId: '', category: 'car' };
      const vehRecords = reportData.filter(r => r.deviceId === vId);

      const count = vehRecords.length;
      const totalDist = vehRecords.reduce((acc, r) => acc + (r.distance || 0), 0);
      const totalDistKm = (totalDist / 1000).toFixed(1);

      const runningMs = vehRecords.reduce((acc, r) => acc + (r.runningHours || r.duration || 0), 0);
      const stoppedMs = vehRecords.reduce((acc, r) => acc + (r.stoppedHours || 0), 0);
      const idleMs = vehRecords.reduce((acc, r) => acc + (r.idleHours || 0), 0);
      const maxSpd = Math.round(vehRecords.reduce((max, r) => Math.max(max, r.maxSpeed ? r.maxSpeed * 1.852 : 0), 0));

      return {
        vehicle: veh,
        records: vehRecords,
        count,
        totalDistKm,
        runningHoursStr: formatHoursMinutes(runningMs),
        stoppedHoursStr: formatHoursMinutes(stoppedMs),
        idleHoursStr: formatHoursMinutes(idleMs),
        maxSpeedKmh: maxSpd
      };
    });
  }, [selectedVehicleIds, liveVehicles, reportData]);

  // Derived KPI calculations across displayed report records
  const totalTripKm = displayedReportData.reduce((acc, item) => acc + (item.distance ? item.distance / 1000 : 0), 0).toFixed(2);
  const totalDurationMs = displayedReportData.reduce((acc, item) => acc + (item.duration || item.runningHours || 0), 0);
  const totalDurationHrs = (totalDurationMs / (1000 * 60 * 60)).toFixed(1);
  const maxSpeedKmh = Math.round(displayedReportData.reduce((max, item) => Math.max(max, item.maxSpeed ? item.maxSpeed * 1.852 : 0), 0));
  const avgSpeedKmh = displayedReportData.length > 0 
    ? Math.round(displayedReportData.reduce((sum, item) => sum + (item.averageSpeed ? item.averageSpeed * 1.852 : 0), 0) / displayedReportData.length)
    : 0;

  // Export metadata for headers
  const getExportMetadata = () => {
    const { from, to } = calculateDateBounds();
    const rangeLabel = dateRange === 'today' ? 'Today'
      : (dateRange === 'yesterday' ? 'Yesterday'
      : (dateRange === 'week' ? 'Last 7 Days'
      : (dateRange === 'month' ? 'Last 30 Days'
      : `${customFrom} to ${customTo}`)));

    const count = inReportVehicleFilter === 'all' 
      ? selectedVehicleIds.length 
      : 1;
    const singleVeh = count === 1
      ? (inReportVehicleFilter !== 'all'
          ? liveVehicles.find(v => v.id === Number(inReportVehicleFilter))
          : liveVehicles.find(v => v.id === selectedVehicleIds[0]))
      : null;
    const vehicleLabel = count === 1
      ? (singleVeh?.name || 'Vehicle')
      : (count === liveVehicles.length ? `All Fleet (${count} Vehicles)` : `${count} Vehicles Selected`);

    return {
      from,
      to,
      dateRange: rangeLabel,
      vehicleLabel: vehicleLabel,
      vehicleScope: count === 1 ? singleVeh?.name : `${count} Vehicles Selected`,
      vehicleCount: count,
      isMultiVehicle: count > 1,
      kpis: count === 1 ? {
        totalKm: totalTripKm,
        totalTime: `${totalDurationHrs} hrs`,
        maxSpeed: `${maxSpeedKmh} km/h`,
        avgSpeed: `${avgSpeedKmh} km/h`
      } : null
    };
  };

  const getExportVehicleTarget = () => {
    if (inReportVehicleFilter !== 'all') {
      return liveVehicles.find(v => v.id === Number(inReportVehicleFilter)) || { name: 'Vehicle', category: 'car' };
    }
    if (selectedVehicleIds.length === 1) {
      return liveVehicles.find(v => v.id === selectedVehicleIds[0]);
    }
    return {
      name: `${selectedVehicleIds.length}_Vehicles_Report`,
      category: 'fleet'
    };
  };

  // Download Handlers
  const handleExportCSV = async () => {
    if (displayedReportData.length === 0) return showToast('No records to export');
    setExportingType('csv');
    try {
      await new Promise(r => setTimeout(r, 150));
      exportToCSV(reportType, displayedReportData, getExportVehicleTarget(), getExportMetadata());
      showToast('CSV report downloaded successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to download CSV');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportXLSX = async () => {
    if (displayedReportData.length === 0) return showToast('No records to export');
    setExportingType('xlsx');
    try {
      await new Promise(r => setTimeout(r, 150));
      exportToXLSX(reportType, displayedReportData, getExportVehicleTarget(), getExportMetadata());
      showToast('Excel (.xlsx) report downloaded successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to download Excel');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPDF = async () => {
    if (displayedReportData.length === 0) return showToast('No records to export');
    setExportingType('pdf');
    try {
      await new Promise(r => setTimeout(r, 150));
      exportToPDF(reportType, displayedReportData, getExportVehicleTarget(), getExportMetadata());
      showToast('PDF report downloaded successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to download PDF');
    } finally {
      setExportingType(null);
    }
  };

  const handleCopyText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleReplayTrip = (trip) => {
    if (trip?.deviceId) {
      setSelectedVehicleId(trip.deviceId);
      navigate('/history');
    }
  };

  // Multi-vehicle selector toggle helper functions
  const toggleVehicleSelect = (id) => {
    setSelectedVehicleIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(vId => vId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectAllVehicles = () => {
    setSelectedVehicleIds(liveVehicles.map(v => v.id));
  };

  const selectOnlyRunning = () => {
    const runningIds = liveVehicles.filter(v => v.status === 'running').map(v => v.id);
    if (runningIds.length > 0) setSelectedVehicleIds(runningIds);
    else showToast('No running vehicles currently');
  };

  const selectOnlyParked = () => {
    const parkedIds = liveVehicles.filter(v => v.status === 'parked' || v.status === 'stopped').map(v => v.id);
    if (parkedIds.length > 0) setSelectedVehicleIds(parkedIds);
    else showToast('No parked vehicles currently');
  };

  const clearVehicleSelection = () => {
    if (liveVehicles[0]?.id) {
      setSelectedVehicleIds([liveVehicles[0].id]);
    }
  };

  // Filter vehicles within the selector dialog
  const filteredSelectorVehicles = useMemo(() => {
    if (!vehicleSearchQuery) return liveVehicles;
    const q = vehicleSearchQuery.toLowerCase().trim();
    return liveVehicles.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.uniqueId && v.uniqueId.toLowerCase().includes(q)) ||
      (v.category && v.category.toLowerCase().includes(q))
    );
  }, [liveVehicles, vehicleSearchQuery]);

  // Vehicles with records in current report
  const vehiclesWithRecords = useMemo(() => {
    const set = new Set();
    reportData.forEach(r => {
      if (r.deviceId) set.add(r.deviceId);
    });
    return Array.from(set).map(id => liveVehicles.find(v => v.id === id)).filter(Boolean);
  }, [reportData, liveVehicles]);

  const singleSelectedVehicle = selectedVehicleIds.length === 1
    ? liveVehicles.find(v => v.id === selectedVehicleIds[0])
    : null;

  const { from: activeFrom, to: activeTo } = calculateDateBounds();

  const renderReportTable = (records, headerBlock = null) => (
    <div className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-xs space-y-0">
      {headerBlock}
      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#4F46E5] text-white font-bold text-[11px] tracking-wide">
            {reportType === 'summary' ? (
              <tr>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60 w-10">#</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Vehicle Number</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Start Date &amp; Time</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">End Date &amp; Time</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Distance</th>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60">Engine Hours</th>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60">Running Hours</th>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60">Stopped Hours</th>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60">Idle Hours</th>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60">AC Hours</th>
              </tr>
            ) : reportType === 'trips' ? (
              <tr>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60 w-10">#</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Vehicle Number</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Start Date &amp; Time</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">End Date &amp; Time</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Distance</th>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60">Duration</th>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60">Avg / Max Speed</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Start Location</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">End Location</th>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60">Replay</th>
              </tr>
            ) : (
              <tr>
                <th className="py-2.5 px-3 text-center border border-indigo-700/60 w-10">#</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Vehicle Number</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Arrival Time</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Departure Time</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Halt Duration</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Stop Address / Landmark</th>
                <th className="py-2.5 px-3.5 border border-indigo-700/60">Coordinates</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {reportType === 'summary' ? (
              records.map((item, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/20 transition">
                  <td className="py-2 px-3 text-center font-bold text-slate-500 font-mono border border-slate-200 bg-slate-50/50">{idx + 1}</td>
                  <td className="py-2 px-3.5 font-bold text-slate-900 whitespace-nowrap border border-slate-200">
                    {item.vehicleName}
                  </td>
                  <td className="py-2 px-3.5 font-mono text-slate-700 whitespace-nowrap border border-slate-200">
                    {item.startDate}
                  </td>
                  <td className="py-2 px-3.5 font-mono text-slate-700 whitespace-nowrap border border-slate-200">
                    {item.endDate}
                  </td>
                  <td className="py-2 px-3.5 font-bold text-slate-900 font-mono whitespace-nowrap border border-slate-200">
                    {item.distanceStr}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-medium border border-slate-200">
                    {item.engineHoursStr}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-medium border border-slate-200">
                    {item.runningHoursStr}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-medium border border-slate-200">
                    {item.stoppedHoursStr}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-medium border border-slate-200">
                    {item.idleHoursStr}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-medium border border-slate-200">
                    {item.acHoursStr}
                  </td>
                </tr>
              ))
            ) : reportType === 'trips' ? (
              records.map((trip, idx) => {
                const distKm = trip['Distance (km)'] || (trip.distance ? formatReportDistance(trip.distance) : '0 km');
                const duration = trip['Duration'] || (trip.duration ? formatHoursMinutes(trip.duration) : '00:00');
                const avgSpeed = trip['Avg Speed (km/h)'] || Math.round(trip.averageSpeed ? trip.averageSpeed * 1.852 : 0) + ' km/h';
                const maxSpeed = trip['Max Speed (km/h)'] || Math.round(trip.maxSpeed ? trip.maxSpeed * 1.852 : 0) + ' km/h';
                const startTime = trip['Start Time'] || (trip.startTime ? formatReportDateTime(trip.startTime) : '');
                const endTime = trip['End Time'] || (trip.endTime ? formatReportDateTime(trip.endTime) : '');
                const vehName = trip.vehicleName || 'Vehicle';

                return (
                  <tr key={idx} className="hover:bg-indigo-50/20 transition">
                    <td className="py-2 px-3 text-center font-bold text-slate-500 font-mono border border-slate-200 bg-slate-50/50">{idx + 1}</td>
                    <td className="py-2 px-3.5 font-bold text-slate-900 whitespace-nowrap border border-slate-200">{vehName}</td>
                    <td className="py-2 px-3.5 font-mono text-slate-700 whitespace-nowrap border border-slate-200">{startTime}</td>
                    <td className="py-2 px-3.5 font-mono text-slate-700 whitespace-nowrap border border-slate-200">{endTime}</td>
                    <td className="py-2 px-3.5 font-black text-indigo-600 font-mono tabular-nums whitespace-nowrap border border-slate-200">{distKm}</td>
                    <td className="py-2 px-3 text-center font-bold text-slate-800 whitespace-nowrap border border-slate-200">{duration}</td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums whitespace-nowrap border border-slate-200">{avgSpeed} / {maxSpeed}</td>
                    <td className="py-2 px-3.5 max-w-[200px] truncate border border-slate-200" title={trip.startAddress}>{trip.startAddress || 'Start location'}</td>
                    <td className="py-2 px-3.5 max-w-[200px] truncate border border-slate-200" title={trip.endAddress}>{trip.endAddress || 'End location'}</td>
                    <td className="py-2 px-3 text-center border border-slate-200">
                      <button
                        onClick={() => handleReplayTrip(trip)}
                        className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 cursor-pointer"
                        title="Replay Trip on Map"
                      >
                        <Play size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              records.map((stop, idx) => {
                const stopTime = stop.startTime ? formatReportDateTime(stop.startTime) : '';
                const endTime = stop.endTime ? formatReportDateTime(stop.endTime) : '';
                const durationDisplay = stop.duration ? formatHoursMinutes(stop.duration) : '00:00';
                const vehName = stop.vehicleName || 'Vehicle';

                return (
                  <tr key={idx} className="hover:bg-indigo-50/20 transition">
                    <td className="py-2 px-3 text-center font-bold text-slate-500 font-mono border border-slate-200 bg-slate-50/50">{idx + 1}</td>
                    <td className="py-2 px-3.5 font-bold text-slate-900 whitespace-nowrap border border-slate-200">{vehName}</td>
                    <td className="py-2 px-3.5 font-mono text-slate-700 whitespace-nowrap border border-slate-200">{stopTime}</td>
                    <td className="py-2 px-3.5 font-mono text-slate-700 whitespace-nowrap border border-slate-200">{endTime}</td>
                    <td className="py-2 px-3.5 font-black text-red-600 font-mono tabular-nums whitespace-nowrap border border-slate-200">{durationDisplay}</td>
                    <td className="py-2 px-3.5 max-w-[300px] truncate border border-slate-200" title={stop.address}>{stop.address || 'Halt location'}</td>
                    <td className="py-2 px-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap border border-slate-200">
                      {stop.latitude ? `${Number(stop.latitude).toFixed(4)}, ${Number(stop.longitude).toFixed(4)}` : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReportCards = (records) => (
    <div className="space-y-3">
      {reportType === 'summary' ? (
        records.map((sum, idx) => (
          <div key={idx} className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-black text-[11px] flex items-center justify-center font-mono">
                  #{idx + 1}
                </span>
                <span className="font-black text-slate-900 text-sm">{sum.vehicleName}</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs font-mono tabular-nums">
                {sum.distanceStr}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span>Start: <strong>{sum.startDate}</strong></span>
              <span>End: <strong>{sum.endDate}</strong></span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Engine Hours</span>
                <span className="text-base font-black text-slate-800 font-mono tabular-nums mt-0.5 block">{sum.engineHoursStr}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Running Hours</span>
                <span className="text-base font-black text-emerald-600 font-mono tabular-nums mt-0.5 block">{sum.runningHoursStr}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Stopped Hours</span>
                <span className="text-base font-black text-red-600 font-mono tabular-nums mt-0.5 block">{sum.stoppedHoursStr}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Idle Hours</span>
                <span className="text-base font-black text-amber-600 font-mono tabular-nums mt-0.5 block">{sum.idleHoursStr}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">AC Hours</span>
                <span className="text-base font-black text-slate-600 font-mono tabular-nums mt-0.5 block">{sum.acHoursStr}</span>
              </div>
            </div>
          </div>
        ))
      ) : reportType === 'trips' ? (
        records.map((trip, idx) => {
          const distKm = trip['Distance (km)'] || (trip.distance ? formatReportDistance(trip.distance) : '0 km');
          const duration = trip['Duration'] || (trip.duration ? formatHoursMinutes(trip.duration) : '00:00');
          const avgSpeed = trip['Avg Speed (km/h)'] || Math.round(trip.averageSpeed ? trip.averageSpeed * 1.852 : 0) + ' km/h';
          const maxSpeed = trip['Max Speed (km/h)'] || Math.round(trip.maxSpeed ? trip.maxSpeed * 1.852 : 0) + ' km/h';
          const startTime = trip['Start Time'] || (trip.startTime ? formatReportDateTime(trip.startTime) : '');
          const endTime = trip['End Time'] || (trip.endTime ? formatReportDateTime(trip.endTime) : '');
          const vehName = trip.vehicleName || 'Vehicle';

          return (
            <div key={idx} className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-black text-[11px] flex items-center justify-center font-mono shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-900 truncate block">
                      {vehName} • Trip {idx + 1}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs font-mono tabular-nums">
                    {distKm}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs font-mono">
                    {duration}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">
                      Start • {startTime}
                    </span>
                    <p className="text-slate-800 line-clamp-1 leading-tight font-medium">
                      {trip.startAddress || 'Start location'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0"></div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">
                      End • {endTime}
                    </span>
                    <p className="text-slate-800 line-clamp-1 leading-tight font-medium">
                      {trip.endAddress || 'End location'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Avg Speed</span>
                  <span className="font-black text-slate-800 font-mono tabular-nums">{avgSpeed}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Top Speed</span>
                  <span className="font-black text-red-600 font-mono tabular-nums">{maxSpeed}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
                <button
                  onClick={() => handleReplayTrip(trip)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Play size={13} />
                  <span>Replay Route</span>
                </button>

                <button
                  onClick={() => handleCopyText(`trip-${idx}`, `${trip.startAddress || ''} to ${trip.endAddress || ''}`)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                  title="Copy trip addresses"
                >
                  {copiedId === `trip-${idx}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          );
        })
      ) : (
        records.map((stop, idx) => {
          const stopTime = stop.startTime ? formatReportDateTime(stop.startTime) : '';
          const endTime = stop.endTime ? formatReportDateTime(stop.endTime) : '';
          const durationDisplay = stop.duration ? formatHoursMinutes(stop.duration) : '00:00';
          const vehName = stop.vehicleName || 'Vehicle';

          return (
            <div key={idx} className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 font-black text-[11px] flex items-center justify-center font-mono">
                    🛑
                  </span>
                  <span className="font-extrabold text-slate-900">{vehName} • Stop #{idx + 1}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-black text-xs font-mono tabular-nums">
                  {durationDisplay}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                📍 {stop.address || 'Parking Location'}
              </p>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 font-mono">
                <span>Arrived: {stopTime}</span>
                <span>Departed: {endTime}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 overflow-hidden select-none font-sans">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-fadeIn backdrop-blur-md">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Filter and Controls Bar */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200/90 space-y-3 shrink-0 shadow-xs">
        
        {/* Row 1: Vehicle Multi-Selector Button & Quick Date Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          
          {/* Multi-Vehicle Trigger Button */}
          <div className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => setIsVehicleSelectorOpen(true)}
              className="flex-1 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/90 rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 transition flex items-center justify-between gap-2 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 p-1 shrink-0 flex items-center justify-center">
                  {singleSelectedVehicle ? (
                    <VehicleCategoryIcon category={singleSelectedVehicle.category} className="w-full h-full object-contain" />
                  ) : (
                    <SlidersHorizontal size={16} className="text-indigo-600" />
                  )}
                </div>
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-black text-slate-900">
                      {singleSelectedVehicle
                        ? singleSelectedVehicle.name
                        : (selectedVehicleIds.length === liveVehicles.length
                            ? `All Fleet Vehicles (${liveVehicles.length})`
                            : `${selectedVehicleIds.length} Vehicles Selected`)}
                    </span>
                    {selectedVehicleIds.length > 1 && (
                      <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-mono font-bold shrink-0">
                        Multi
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold block truncate">
                    {singleSelectedVehicle
                      ? `${singleSelectedVehicle.category.toUpperCase()} • Click to change or multi-select`
                      : 'Click to manage vehicle selection'}
                  </span>
                </div>
              </div>
              <ChevronDown size={16} className="text-slate-400 shrink-0 ml-1" />
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200 overflow-x-auto custom-scroll">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: '7 Days' },
              { id: 'month', label: '30 Days' },
              { id: 'custom', label: 'Custom' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateRange(tab.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition whitespace-nowrap cursor-pointer ${
                  dateRange === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker Accordion */}
        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl animate-fadeIn text-xs">
            <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase">From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase">To:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleShowReport}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
            >
              Apply Filter
            </button>
          </div>
        )}

        {/* Row 2: Report Type Tabs and View Mode */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200 flex-1">
            <button
              onClick={() => setReportType('summary')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                reportType === 'summary' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={13} />
              <span>Daily Summary</span>
            </button>

            <button
              onClick={() => setReportType('trips')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                reportType === 'trips' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation size={13} />
              <span>Trips Route</span>
            </button>

            <button
              onClick={() => setReportType('stops')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                reportType === 'stops' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={13} />
              <span>Stoppages</span>
            </button>
          </div>

          {/* Table vs Cards View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-xl transition cursor-pointer ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
              title="Table View (Exact Grid)"
            >
              <Table size={15} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-xl transition cursor-pointer ${viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
              title="Card View"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>

        {/* Row 3: Action Center with EXPORT BUTTONS (CSV, XLSX, PDF) & Refresh */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          
          {/* Quick Refresh Button */}
          <button
            onClick={handleShowReport}
            disabled={loading}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Reload report data"
          >
            <RotateCcw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
            <span>{loading ? 'Generating...' : 'Generate Report'}</span>
          </button>

          {/* EXPORT BUTTONS: CSV, XLSX, PDF */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
              Download Report:
            </span>

            {/* CSV Download */}
            <button
              onClick={handleExportCSV}
              disabled={displayedReportData.length === 0 || exportingType !== null}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download RFC-4180 CSV"
            >
              {exportingType === 'csv' ? (
                <Loader2 size={13} className="animate-spin text-indigo-600" />
              ) : (
                <FileText size={13} className="text-slate-600" />
              )}
              <span>CSV</span>
            </button>

            {/* Excel XLSX Download */}
            <button
              onClick={handleExportXLSX}
              disabled={displayedReportData.length === 0 || exportingType !== null}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download Microsoft Excel Worksheet (.xlsx)"
            >
              {exportingType === 'xlsx' ? (
                <Loader2 size={13} className="animate-spin text-emerald-600" />
              ) : (
                <FileSpreadsheet size={13} className="text-emerald-600" />
              )}
              <span>Excel (.xlsx)</span>
            </button>

            {/* PDF Download */}
            <button
              onClick={handleExportPDF}
              disabled={displayedReportData.length === 0 || exportingType !== null}
              className="px-3.5 py-2 bg-[#4F46E5] hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download Executive Vector Telematics PDF Report"
            >
              {exportingType === 'pdf' ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              <span>PDF Report</span>
            </button>
          </div>
        </div>

        {/* Row 4: If Multiple Vehicles Selected and Report Generated, show quick filter chips */}
        {selectedVehicleIds.length > 1 && reportData.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pt-1 border-t border-slate-100 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0 flex items-center gap-1">
              <Filter size={11} /> Filter:
            </span>
            <button
              onClick={() => setInReportVehicleFilter('all')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                inReportVehicleFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Vehicles ({reportData.length})
            </button>
            {vehiclesWithRecords.map(v => {
              const count = reportData.filter(r => r.deviceId === v.id).length;
              return (
                <button
                  key={v.id}
                  onClick={() => setInReportVehicleFilter(String(v.id))}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer ${
                    inReportVehicleFilter === String(v.id)
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{v.name}</span>
                  <span className="text-[10px] opacity-80">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Info Banner (Matches Top Grid of PDF Template) */}
      <div className="p-3 sm:px-4 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-2xs">
          <table className="text-xs">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="px-3 py-1 font-bold text-slate-600 bg-slate-50 border-r border-slate-200 text-[11px]">Report Type:</td>
                <td className="px-3 py-1 font-bold text-slate-900 capitalize">
                  {reportType === 'summary' ? 'Summary' : (reportType === 'trips' ? 'Trips Route' : 'Stoppages')}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-1 font-bold text-slate-600 bg-slate-50 border-r border-slate-200 text-[11px]">Period:</td>
                <td className="px-3 py-1 font-mono text-slate-800 text-[11px]">
                  {formatReportDateTime(activeFrom)} - {formatReportDateTime(activeTo)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Individual Vehicle KPI Stats for single selection (multi-vehicle displays individual cards below) */}
        {selectedVehicleIds.length === 1 && (
          <div className="flex items-center gap-2">
            <div className="bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[9px] text-slate-400 font-bold block uppercase">Total Distance</span>
              <span className="text-sm font-black text-indigo-600 font-mono tabular-nums">{totalTripKm} km</span>
            </div>
            <div className="bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[9px] text-slate-400 font-bold block uppercase">Records</span>
              <span className="text-sm font-black text-slate-800 font-mono tabular-nums">{displayedReportData.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Report Body: Cards or Exact Grid Table */}
      <div className="flex-1 overflow-y-auto custom-scroll p-3 sm:p-4 space-y-4 pb-24">
        
        {loading ? (
          <VehicleLoadingAnimation
            vehicleNumber={singleSelectedVehicle?.name || `${selectedVehicleIds.length} Fleet Vehicles`}
            message="Generating multi-vehicle telematics report..."
          />
        ) : displayedReportData.length === 0 ? (
          <div className="text-center py-20 text-slate-400 space-y-3 max-w-sm mx-auto">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
              <FileText size={32} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No records found for this period</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Click <span className="font-bold text-indigo-600">Generate Report</span> to review vehicle records.
              </p>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          selectedVehicleIds.length > 1 && inReportVehicleFilter === 'all' ? (
            vehicleStatsSummary.filter(vs => vs.records.length > 0).map((vs, vIndex) =>
              renderReportTable(vs.records, (
                <div key={vs.vehicle.id} className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 sm:px-4 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-900/60">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center font-mono font-black text-xs shrink-0">
                      #{vIndex + 1}
                    </span>
                    <VehicleCategoryIcon category={vs.vehicle.category} size={28} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-white tracking-wide">{vs.vehicle.name}</span>
                        {vs.vehicle.uniqueId && (
                          <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-md text-slate-300">
                            {vs.vehicle.uniqueId}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-indigo-200">
                        Individual Vehicle Telematics Log
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-indigo-600/60 border border-indigo-400/40 text-white font-black px-2.5 py-1 rounded-xl font-mono">
                      {vs.count} {reportType === 'trips' ? 'Trips' : reportType === 'stops' ? 'Stops' : 'Days'}
                    </span>
                    <span className="bg-emerald-600/50 border border-emerald-400/40 text-emerald-200 font-black px-2.5 py-1 rounded-xl font-mono">
                      {vs.totalDistKm} km
                    </span>
                    <span className="bg-slate-700/50 border border-slate-500/40 text-slate-200 font-bold px-2.5 py-1 rounded-xl font-mono">
                      {vs.runningHoursStr}
                    </span>
                  </div>
                </div>
              ))
            )
          ) : (
            renderReportTable(displayedReportData)
          )
        ) : (
          /* RESPONSIVE CARDS VIEW */
          selectedVehicleIds.length > 1 && inReportVehicleFilter === 'all' ? (
            vehicleStatsSummary.filter(vs => vs.records.length > 0).map((vs, vIndex) => (
              <div key={vs.vehicle.id} className="space-y-3">
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 sm:px-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs border border-indigo-900/60">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center font-mono font-black text-xs shrink-0">
                      #{vIndex + 1}
                    </span>
                    <VehicleCategoryIcon category={vs.vehicle.category} size={28} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-white tracking-wide">{vs.vehicle.name}</span>
                        {vs.vehicle.uniqueId && (
                          <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-md text-slate-300">
                            {vs.vehicle.uniqueId}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-indigo-200">
                        Individual Vehicle Telematics Log
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-indigo-600/60 border border-indigo-400/40 text-white font-black px-2.5 py-1 rounded-xl font-mono">
                      {vs.count} {reportType === 'trips' ? 'Trips' : reportType === 'stops' ? 'Stops' : 'Days'}
                    </span>
                    <span className="bg-emerald-600/50 border border-emerald-400/40 text-emerald-200 font-black px-2.5 py-1 rounded-xl font-mono">
                      {vs.totalDistKm} km
                    </span>
                    <span className="bg-slate-700/50 border border-slate-500/40 text-slate-200 font-bold px-2.5 py-1 rounded-xl font-mono">
                      {vs.runningHoursStr}
                    </span>
                  </div>
                </div>
                {renderReportCards(vs.records)}
              </div>
            ))
          ) : (
            renderReportCards(displayedReportData)
          )
        )}
      </div>

      {/* MULTI-VEHICLE SELECTION MODAL */}
      {isVehicleSelectorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn select-none font-sans">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slideUp">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-white to-blue-50/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                    Select Vehicles for Report
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {selectedVehicleIds.length} of {liveVehicles.length} vehicles selected
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsVehicleSelectorOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Filter Toolbar & Search */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200/80 space-y-2.5">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={vehicleSearchQuery}
                  onChange={(e) => setVehicleSearchQuery(e.target.value)}
                  placeholder="Search by vehicle name or registration plate..."
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-9 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition"
                />
                {vehicleSearchQuery && (
                  <button
                    onClick={() => setVehicleSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll text-xs">
                <button
                  type="button"
                  onClick={selectAllVehicles}
                  className="px-3 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 shrink-0 transition cursor-pointer shadow-2xs"
                >
                  Select All ({liveVehicles.length})
                </button>
                <button
                  type="button"
                  onClick={selectOnlyRunning}
                  className="px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 shrink-0 transition cursor-pointer"
                >
                  Only Moving
                </button>
                <button
                  type="button"
                  onClick={selectOnlyParked}
                  className="px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 shrink-0 transition cursor-pointer"
                >
                  Only Parked
                </button>
                <button
                  type="button"
                  onClick={clearVehicleSelection}
                  className="px-3 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-500 font-semibold border border-slate-200 shrink-0 transition cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* Scrollable Vehicle Checkbox List */}
            <div className="flex-1 overflow-y-auto custom-scroll p-3 sm:p-4 space-y-1.5 max-h-[48vh]">
              {filteredSelectorVehicles.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-xs font-bold text-slate-600">No vehicles match search</p>
                </div>
              ) : (
                filteredSelectorVehicles.map(veh => {
                  const isChecked = selectedVehicleIds.includes(veh.id);
                  const isMoving = veh.status === 'running';
                  const isIdle = veh.status === 'idle';

                  return (
                    <div
                      key={veh.id}
                      onClick={() => toggleVehicleSelect(veh.id)}
                      className={`p-2.5 sm:p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Styled Checkbox */}
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition shrink-0 ${
                          isChecked ? 'bg-indigo-600 text-white' : 'border-2 border-slate-300'
                        }`}>
                          {isChecked && <Check size={13} strokeWidth={3} />}
                        </div>

                        {/* Category Icon */}
                        <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 p-1 shrink-0 flex items-center justify-center">
                          <VehicleCategoryIcon category={veh.category} className="w-full h-full object-contain" />
                        </div>

                        {/* Name & Plate */}
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 truncate">
                            {veh.name}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono block truncate">
                            {veh.uniqueId || veh.category.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Status Pill */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        isMoving
                          ? 'bg-emerald-100 text-emerald-800'
                          : (isIdle ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isMoving ? 'bg-emerald-500 animate-pulse' : (isIdle ? 'bg-amber-500' : 'bg-slate-400')}`}></span>
                        <span>{isMoving ? 'Moving' : (isIdle ? 'Idle' : 'Parked')}</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Sticky Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700">
                <span className="font-black text-indigo-600">{selectedVehicleIds.length}</span> vehicles selected
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsVehicleSelectorOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsVehicleSelectorOpen(false);
                    handleShowReport();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-black transition shadow-md shadow-indigo-600/25 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Generate Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
