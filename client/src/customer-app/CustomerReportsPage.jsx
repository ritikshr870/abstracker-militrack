import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerTracking } from './CustomerTrackingContext';
import axios from 'axios';
import VehicleLoadingAnimation from './VehicleLoadingAnimation';
import {
  FileText,
  MapPin,
  Calendar,
  Clock,
  Gauge,
  ArrowRight,
  Navigation,
  Play,
  RotateCcw,
  Loader2,
  FileSpreadsheet,
  Download,
  Table,
  LayoutGrid,
  CheckCircle2
} from 'lucide-react';
import { VehicleCategoryIcon } from './CustomerVehicleIcons';
import { exportToCSV, exportToXLSX, exportToPDF } from './reportExporter';

export function formatDuration(ms) {
  if (!ms || isNaN(ms) || ms <= 0) return '0 min';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

export function formatIndianTime(dateString) {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return String(dateString);
  }
}

export default function CustomerReportsPage() {
  const { liveVehicles, selectedVehicle, setSelectedVehicleId } = useCustomerTracking();
  const navigate = useNavigate();

  const [reportType, setReportType] = useState('trips');
  const [dateRange, setDateRange] = useState('yesterday');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [viewMode, setViewMode] = useState('cards');
  const [exportingType, setExportingType] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const activeVehicle = selectedVehicle || liveVehicles[0];

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

  const loadReport = () => {
    if (!activeVehicle?.id) return;
    setLoading(true);

    const { from, to } = calculateDateBounds();
    const endpoint = reportType === 'trips' 
      ? '/api/reports/trips' 
      : (reportType === 'stops' ? '/api/reports/stops' : '/api/reports/summary');

    axios.get(endpoint, {
      params: {
        deviceId: activeVehicle.id,
        from: from.toISOString(),
        to: to.toISOString()
      }
    })
    .then(res => {
      setReportData(Array.isArray(res.data) ? res.data : []);
    })
    .catch(() => {
      setReportData([]);
    })
    .finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadReport();
  }, [activeVehicle?.id, reportType, dateRange]);

  const handleReplayTrip = (trip) => {
    setSelectedVehicleId(activeVehicle.id);
    navigate('/app/history', {
      state: {
        vehicleId: activeVehicle.id,
        from: trip.startTime,
        to: trip.endTime
      }
    });
  };

  const totalTripKm = reportData.reduce((acc, item) => acc + (item.distance ? item.distance / 1000 : 0), 0).toFixed(1);
  const totalDurationMs = reportData.reduce((acc, item) => acc + (item.duration || 0), 0);
  const totalDurationHrs = (totalDurationMs / (1000 * 60 * 60)).toFixed(1);
  const maxSpeedKmh = Math.round(reportData.reduce((max, item) => Math.max(max, item.maxSpeed ? item.maxSpeed * 1.852 : 0), 0));
  const avgSpeedKmh = reportData.length > 0 
    ? Math.round(reportData.reduce((sum, item) => sum + (item.averageSpeed ? item.averageSpeed * 1.852 : 0), 0) / reportData.length)
    : 0;

  const getExportMetadata = () => {
    const rangeLabel = dateRange === 'today' ? 'Today'
      : (dateRange === 'yesterday' ? 'Yesterday'
      : (dateRange === 'week' ? 'Last 7 Days'
      : (dateRange === 'month' ? 'Last 30 Days'
      : `${customFrom} to ${customTo}`)));

    return {
      dateRange: rangeLabel,
      kpis: {
        totalKm: totalTripKm,
        totalTime: `${totalDurationHrs} hrs`,
        maxSpeed: `${maxSpeedKmh} km/h`,
        avgSpeed: `${avgSpeedKmh} km/h`
      }
    };
  };

  const handleExportCSV = async () => {
    if (reportData.length === 0) return showToast('No records to export');
    setExportingType('csv');
    try {
      await new Promise(r => setTimeout(r, 150));
      exportToCSV(reportType, reportData, activeVehicle, getExportMetadata());
      showToast('CSV report downloaded successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to download CSV');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportXLSX = async () => {
    if (reportData.length === 0) return showToast('No records to export');
    setExportingType('xlsx');
    try {
      await new Promise(r => setTimeout(r, 150));
      exportToXLSX(reportType, reportData, activeVehicle, getExportMetadata());
      showToast('Excel (.xlsx) report downloaded successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to download Excel');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPDF = async () => {
    if (reportData.length === 0) return showToast('No records to export');
    setExportingType('pdf');
    try {
      await new Promise(r => setTimeout(r, 150));
      exportToPDF(reportType, reportData, activeVehicle, getExportMetadata());
      showToast('PDF report downloaded successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to download PDF');
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 overflow-hidden select-none font-sans">
      
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2 backdrop-blur-md">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200/90 space-y-3 shadow-xs shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-9 h-9 shrink-0 p-1 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
              <VehicleCategoryIcon category={activeVehicle?.category} className="w-full h-full object-contain" />
            </div>
            <select
              value={activeVehicle?.id || ''}
              onChange={(e) => setSelectedVehicleId(parseInt(e.target.value))}
              className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
            >
              {liveVehicles.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-end sm:self-auto">
            {['today', 'yesterday', 'week', 'month'].map(d => (
              <button
                key={d}
                onClick={() => setDateRange(d)}
                className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                  dateRange === d ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d === 'week' ? '7 Days' : (d === 'month' ? '30 Days' : d)}
              </button>
            ))}
          </div>
        </div>

        {/* Report Type Tabs and View Mode */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 flex-1">
            <button
              onClick={() => setReportType('trips')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                reportType === 'trips' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation size={13} />
              <span>Trips</span>
            </button>

            <button
              onClick={() => setReportType('stops')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                reportType === 'stops' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={13} />
              <span>Stops</span>
            </button>

            <button
              onClick={() => setReportType('summary')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                reportType === 'summary' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={13} />
              <span>Summary</span>
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-xl transition cursor-pointer ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
              title="Cards View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-xl transition cursor-pointer ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
              title="Table View"
            >
              <Table size={15} />
            </button>
          </div>
        </div>

        {/* Action Center with CSV, XLSX, and PDF EXPORTS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={loadReport}
            disabled={loading}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span>{loading ? 'Refreshing...' : 'Reload'}</span>
          </button>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
              Download Report:
            </span>

            <button
              onClick={handleExportCSV}
              disabled={reportData.length === 0 || exportingType !== null}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-40"
              title="Download CSV"
            >
              {exportingType === 'csv' ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <FileText size={13} className="text-slate-600" />}
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportXLSX}
              disabled={reportData.length === 0 || exportingType !== null}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-40"
              title="Download Excel (.xlsx)"
            >
              {exportingType === 'xlsx' ? <Loader2 size={13} className="animate-spin text-emerald-600" /> : <FileSpreadsheet size={13} className="text-emerald-600" />}
              <span>Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={reportData.length === 0 || exportingType !== null}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm shadow-red-600/25 cursor-pointer disabled:opacity-40"
              title="Download PDF Report"
            >
              {exportingType === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span>PDF Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="p-3 sm:px-4 bg-slate-50 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 text-center">
        <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold block uppercase">
            {reportType === 'stops' ? 'Total Stops' : 'Total Run'}
          </span>
          <span className="text-base font-black text-blue-600 font-mono tabular-nums">
            {reportType === 'stops' ? reportData.length : `${totalTripKm} km`}
          </span>
        </div>
        <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold block uppercase">
            {reportType === 'stops' ? 'Stop Duration' : 'Total Time'}
          </span>
          <span className="text-base font-black text-slate-800 font-mono tabular-nums">
            {totalDurationHrs} hrs
          </span>
        </div>
        <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold block uppercase">Top Speed</span>
          <span className="text-base font-black text-red-600 font-mono tabular-nums">{maxSpeedKmh} km/h</span>
        </div>
        <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold block uppercase">Records</span>
          <span className="text-base font-black text-emerald-600 font-mono tabular-nums">{reportData.length}</span>
        </div>
      </div>

      {/* Report Feed */}
      <div className="flex-1 overflow-y-auto custom-scroll p-3 sm:p-4 space-y-3 pb-36">
        {loading ? (
          <VehicleLoadingAnimation vehicleNumber={activeVehicle?.name || 'AbsTracker'} message="Loading report data..." />
        ) : reportData.length === 0 ? (
          <div className="text-center py-20 text-slate-400 space-y-2">
            <FileText size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No records found for this period</p>
            <p className="text-xs text-slate-500">Tap <span className="font-bold text-blue-600">Yesterday</span> or <span className="font-bold text-blue-600">7 Days</span>.</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto custom-scroll">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3 text-center">#</th>
                    <th className="py-3 px-3">Start / Arrival</th>
                    <th className="py-3 px-3">End / Depart</th>
                    <th className="py-3 px-3">Distance / Duration</th>
                    <th className="py-3 px-3">Speeds</th>
                    <th className="py-3 px-3">Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reportData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{formatIndianTime(item.startTime)}</td>
                      <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{formatIndianTime(item.endTime)}</td>
                      <td className="py-2.5 px-3 font-bold text-blue-600 font-mono whitespace-nowrap">
                        {item.distance ? `${(item.distance / 1000).toFixed(1)} km` : formatDuration(item.duration)}
                      </td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        {Math.round((item.averageSpeed || 0) * 1.852)} / {Math.round((item.maxSpeed || 0) * 1.852)} km/h
                      </td>
                      <td className="py-2.5 px-3 max-w-[260px] truncate">{item.startAddress || item.address || 'Location record'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          reportType === 'trips' ? (
            reportData.map((item, idx) => {
              const distanceKm = item.distance ? (item.distance / 1000).toFixed(1) : 0;
              const durationText = formatDuration(item.duration);
              const maxSpd = Math.round((item.maxSpeed || 0) * 1.852);
              const avgSpd = Math.round((item.averageSpeed || 0) * 1.852);

              return (
                <div key={idx} className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black font-mono">
                        #{idx + 1}
                      </div>
                      <span className="text-xs font-black text-slate-800">Trip Record</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-black font-mono">
                        {distanceKm} km
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold font-mono">
                        {durationText}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">
                          {formatIndianTime(item.startTime)}
                        </span>
                        <p className="text-slate-800 font-medium line-clamp-1">{item.startAddress || 'Start location'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">
                          {formatIndianTime(item.endTime)}
                        </span>
                        <p className="text-slate-800 font-medium line-clamp-1">{item.endAddress || 'End location'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-3 text-slate-500 font-mono">
                      <span>Avg: <strong className="text-slate-800">{avgSpd}</strong> km/h</span>
                      <span>Max: <strong className="text-red-600">{maxSpd}</strong> km/h</span>
                    </div>

                    <button
                      onClick={() => handleReplayTrip(item)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play size={12} />
                      <span>Replay</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : reportType === 'stops' ? (
            reportData.map((item, idx) => (
              <div key={idx} className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-[10px] font-black">
                      🛑
                    </span>
                    <span className="text-xs font-black text-slate-900">Stop #{idx + 1}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-black font-mono">
                    {formatDuration(item.duration)}
                  </span>
                </div>

                <p className="text-xs text-slate-700 font-medium">📍 {item.address || 'Halt position'}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-100">
                  <span>Arr: {formatIndianTime(item.startTime)}</span>
                  <span>Dep: {formatIndianTime(item.endTime)}</span>
                </div>
              </div>
            ))
          ) : (
            reportData.map((sum, idx) => (
              <div key={idx} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-slate-900">{sum.deviceName || activeVehicle.name}</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Distance</span>
                    <span className="text-base font-black text-blue-600 font-mono">{(sum.distance / 1000).toFixed(1)} km</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Max Speed</span>
                    <span className="text-base font-black text-red-600 font-mono">{Math.round((sum.maxSpeed || 0) * 1.852)} km/h</span>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
