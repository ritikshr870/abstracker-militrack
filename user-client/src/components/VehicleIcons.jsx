import React from 'react';
import L from 'leaflet';
import { Car, Truck, Bus, Bike } from 'lucide-react';

/**
 * Top-down realistic, high-precision SVG vehicle models for the MAP
 */
export function getVehicleSvgBody(category = '', color = '#2563eb') {
  const cat = (category || '').toLowerCase();

  if (cat.includes('truck') || cat.includes('dumper') || cat.includes('tipper') || cat.includes('lorry')) {
    // Top-down heavy commercial truck
    return `
      <g filter="drop-shadow(0px 2px 5px rgba(0,0,0,0.5))">
        <!-- Wheels -->
        <rect x="9" y="8" width="4" height="8" rx="1.5" fill="#0f172a" stroke="#ffffff" stroke-width="0.8"/>
        <rect x="35" y="8" width="4" height="8" rx="1.5" fill="#0f172a" stroke="#ffffff" stroke-width="0.8"/>
        <rect x="8" y="24" width="4.5" height="9" rx="1.5" fill="#0f172a" stroke="#ffffff" stroke-width="0.8"/>
        <rect x="35.5" y="24" width="4.5" height="9" rx="1.5" fill="#0f172a" stroke="#ffffff" stroke-width="0.8"/>
        <rect x="8" y="34" width="4.5" height="9" rx="1.5" fill="#0f172a" stroke="#ffffff" stroke-width="0.8"/>
        <rect x="35.5" y="34" width="4.5" height="9" rx="1.5" fill="#0f172a" stroke="#ffffff" stroke-width="0.8"/>
        <!-- Cabin -->
        <rect x="13" y="6" width="22" height="14" rx="3.5" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>
        <rect x="16" y="8" width="16" height="4" rx="1.5" fill="#0f172a"/>
        <!-- Mirrors -->
        <rect x="10" y="8" width="3" height="1.5" rx="0.5" fill="#334155"/>
        <rect x="35" y="8" width="3" height="1.5" rx="0.5" fill="#334155"/>
        <!-- Cargo Body -->
        <rect x="12" y="21" width="24" height="23" rx="2.5" fill="#334155" stroke="#ffffff" stroke-width="1.5"/>
        <line x1="12" y1="32" x2="36" y2="32" stroke="#64748b" stroke-width="1.2"/>
        <!-- Heading Arrow -->
        <polygon points="24,1 29,6 19,6" fill="#facc15"/>
      </g>
    `;
  }

  if (cat.includes('motorcycle') || cat.includes('bike') || cat.includes('scooter') || cat.includes('two-wheeler')) {
    // Top-down motorcycle / scooter
    return `
      <g filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.5))">
        <!-- Handlebar -->
        <line x1="13" y1="13" x2="35" y2="13" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <circle cx="13" cy="13" r="1.5" fill="#0f172a"/>
        <circle cx="35" cy="13" r="1.5" fill="#0f172a"/>
        <!-- Front Wheel -->
        <rect x="22" y="4" width="4" height="11" rx="2" fill="#0f172a" stroke="#ffffff" stroke-width="1"/>
        <!-- Fuel Tank / Body -->
        <path d="M20 15 C20 12, 28 12, 28 15 L27 29 C27 31, 21 31, 21 29 Z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
        <!-- Seat -->
        <rect x="22" y="28" width="4" height="8" rx="2" fill="#1e293b"/>
        <!-- Rear Wheel -->
        <rect x="22" y="36" width="4" height="11" rx="2" fill="#0f172a" stroke="#ffffff" stroke-width="1"/>
        <!-- Heading Arrow -->
        <polygon points="24,1 27,5 21,5" fill="#facc15"/>
      </g>
    `;
  }

  if (cat.includes('bus') || cat.includes('coach')) {
    // Top-down passenger bus / coach
    return `
      <g filter="drop-shadow(0px 2px 5px rgba(0,0,0,0.5))">
        <!-- Bus Body -->
        <rect x="13" y="5" width="22" height="38" rx="5" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <!-- Front Windshield -->
        <rect x="15.5" y="7" width="17" height="5" rx="1.5" fill="#0f172a"/>
        <!-- Side Windows -->
        <rect x="14" y="14" width="3.5" height="23" fill="#cbd5e1"/>
        <rect x="30.5" y="14" width="3.5" height="23" fill="#cbd5e1"/>
        <!-- Roof A/C Unit -->
        <rect x="19" y="18" width="10" height="14" rx="2" fill="#ffffff" fill-opacity="0.3"/>
        <!-- Rear Window -->
        <rect x="16" y="39" width="16" height="3" rx="1" fill="#0f172a"/>
        <!-- Heading Arrow -->
        <polygon points="24,1 28,5 20,5" fill="#facc15"/>
      </g>
    `;
  }

  if (cat.includes('tractor') || cat.includes('agri')) {
    // Top-down farm tractor
    return `
      <g filter="drop-shadow(0px 2px 5px rgba(0,0,0,0.5))">
        <!-- Big Rear Wheels -->
        <rect x="7" y="24" width="6" height="15" rx="2" fill="#0f172a" stroke="#ffffff" stroke-width="1"/>
        <rect x="35" y="24" width="6" height="15" rx="2" fill="#0f172a" stroke="#ffffff" stroke-width="1"/>
        <!-- Front Wheels -->
        <rect x="11" y="9" width="3.5" height="7" rx="1" fill="#0f172a" stroke="#ffffff" stroke-width="0.8"/>
        <rect x="33.5" y="9" width="3.5" height="7" rx="1" fill="#0f172a" stroke="#ffffff" stroke-width="0.8"/>
        <!-- Hood / Engine -->
        <rect x="18" y="7" width="12" height="19" rx="3" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>
        <!-- Driver Seat & Rollbar -->
        <rect x="17" y="26" width="14" height="10" rx="2" fill="#1e293b" stroke="#ffffff" stroke-width="1"/>
        <!-- Heading Arrow -->
        <polygon points="24,1 28,6 20,6" fill="#facc15"/>
      </g>
    `;
  }

  // Default: Top-down aerodynamic sedan / car
  return `
    <g filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.5))">
      <!-- Wheels -->
      <rect x="9.5" y="11" width="3.5" height="8" rx="1.2" fill="#0f172a" stroke="#ffffff" stroke-width="0.6"/>
      <rect x="35" y="11" width="3.5" height="8" rx="1.2" fill="#0f172a" stroke="#ffffff" stroke-width="0.6"/>
      <rect x="9.5" y="30" width="3.5" height="8" rx="1.2" fill="#0f172a" stroke="#ffffff" stroke-width="0.6"/>
      <rect x="35" y="30" width="3.5" height="8" rx="1.2" fill="#0f172a" stroke="#ffffff" stroke-width="0.6"/>
      <!-- Car Body -->
      <path d="M16 8 C18 6, 30 6, 32 8 L35 15 L35 37 C35 41, 13 41, 13 37 L13 15 Z" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>
      <!-- Front Windshield -->
      <path d="M16 14 L32 14 L30 19 L18 19 Z" fill="#0f172a"/>
      <!-- Roof -->
      <rect x="18" y="20" width="12" height="10" rx="1.5" fill="#ffffff" fill-opacity="0.25"/>
      <!-- Rear Windshield -->
      <path d="M18 31 L30 31 L32 35 L16 35 Z" fill="#0f172a"/>
      <!-- Heading Arrow -->
      <polygon points="24,1 28,6 20,6" fill="#facc15"/>
    </g>
  `;
}

/**
 * Get vehicle image icon URL for dashboard cards and lists
 */
export function getVehicleImageUrl(category = '') {
  const cat = (category || '').toLowerCase();
  if (cat.includes('tractor') || cat.includes('agri')) return '/vehicles/tractor.png';
  if (cat.includes('truck') || cat.includes('dumper') || cat.includes('lorry') || cat.includes('tipper')) return '/vehicles/truck.png';
  if (cat.includes('bus') || cat.includes('coach')) return '/vehicles/bus.png';
  if (cat.includes('motorcycle') || cat.includes('bike') || cat.includes('scooter') || cat.includes('two-wheeler')) return '/vehicles/bike.png';
  return '/vehicles/car.png';
}

/**
 * Vehicle Category Icon Component for Dashboard, Vehicles Page, and Modals
 * Renders the clean vehicle image icon in a crisp card container with fallback
 */
export function VehicleCategoryIcon({ category = '', size = 24, className = '' }) {
  const [imgError, setImgError] = React.useState(false);
  const imageUrl = getVehicleImageUrl(category);

  const pixelSize = typeof size === 'number' ? `${size}px` : (size || '24px');
  const iconPixel = typeof size === 'number' ? Math.max(12, Math.round(size * 0.75)) : 18;

  if (!imgError && imageUrl) {
    return (
      <div
        style={{ width: pixelSize, height: pixelSize, minWidth: pixelSize, minHeight: pixelSize }}
        className={`bg-white rounded-xl p-0.5 flex items-center justify-center shrink-0 border border-slate-100 shadow-2xs overflow-hidden ${className}`}
      >
        <img
          src={imageUrl}
          alt={category || 'Vehicle'}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain shrink-0"
          loading="lazy"
        />
      </div>
    );
  }

  const cat = (category || '').toLowerCase();
  if (cat.includes('truck') || cat.includes('dumper') || cat.includes('lorry')) {
    return (
      <div
        style={{ width: pixelSize, height: pixelSize, minWidth: pixelSize, minHeight: pixelSize }}
        className={`bg-white rounded-xl p-0.5 flex items-center justify-center shrink-0 border border-slate-100 shadow-2xs ${className}`}
      >
        <Truck size={iconPixel} className="text-amber-500" />
      </div>
    );
  }
  if (cat.includes('bike') || cat.includes('motorcycle') || cat.includes('scooter')) {
    return (
      <div
        style={{ width: pixelSize, height: pixelSize, minWidth: pixelSize, minHeight: pixelSize }}
        className={`bg-white rounded-xl p-0.5 flex items-center justify-center shrink-0 border border-slate-100 shadow-2xs ${className}`}
      >
        <Bike size={iconPixel} className="text-indigo-500" />
      </div>
    );
  }
  if (cat.includes('bus') || cat.includes('coach')) {
    return (
      <div
        style={{ width: pixelSize, height: pixelSize, minWidth: pixelSize, minHeight: pixelSize }}
        className={`bg-white rounded-xl p-0.5 flex items-center justify-center shrink-0 border border-slate-100 shadow-2xs ${className}`}
      >
        <Bus size={iconPixel} className="text-emerald-600" />
      </div>
    );
  }
  return (
    <div
      style={{ width: pixelSize, height: pixelSize, minWidth: pixelSize, minHeight: pixelSize }}
      className={`bg-white rounded-xl p-0.5 flex items-center justify-center shrink-0 border border-slate-100 shadow-2xs ${className}`}
    >
      <Car size={iconPixel} className="text-blue-600" />
    </div>
  );
}

/**
 * Top-Down Realistic Directional Vehicle Icon on Leaflet Map
 */
export function createDirectionalVehicleIcon({ name = '', speed = 0, course = 0, status = 'stopped', isSelected = false, category = 'car' }) {
  const isMoving = status === 'running' || status === 'moving';
  const isIdle = status === 'idle';
  const isOffline = status === 'offline';

  // Professional Telematics Color Coding
  const statusColor = isMoving ? '#16a34a' : (isIdle ? '#d97706' : (isOffline ? '#64748b' : '#dc2626'));
  const haloColor = isMoving ? 'rgba(22, 163, 74, 0.25)' : (isIdle ? 'rgba(217, 119, 6, 0.25)' : 'rgba(220, 38, 38, 0.18)');
  const safeCourse = Math.round(course || 0);

  const vehicleSvg = getVehicleSvgBody(category, statusColor);

  return L.divIcon({
    className: 'vehicle-moving-marker',
    html: `
      <div style="position: relative; width: 56px; height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer;">
        
        <!-- Vehicle Plate / Name Tag -->
        ${name ? `
          <div style="position: absolute; top: -18px; white-space: nowrap; background: rgba(15, 23, 42, 0.95); color: #ffffff; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 2px 8px rgba(0,0,0,0.35); pointer-events: none; z-index: 20; letter-spacing: 0.3px;">
            ${name}
          </div>
        ` : ''}

        <!-- Radar Pulse Aura (Only when vehicle is actively moving) -->
        ${isMoving ? `
          <div style="position: absolute; inset: 2px; border-radius: 9999px; background: ${haloColor}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; z-index: 2;"></div>
        ` : ''}

        <!-- Top-Down Realistic Rotated Vehicle Silhouette -->
        <div style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; transform: rotate(${safeCourse}deg); transition: transform 0.25s linear; z-index: 10; ${isSelected ? 'filter: drop-shadow(0 0 10px #2563eb);' : ''}">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            ${vehicleSvg}
          </svg>
        </div>

        <!-- Live Speed Pill when Moving -->
        ${isMoving && speed > 0 ? `
          <div style="position: absolute; bottom: -10px; background: #16a34a; color: #ffffff; font-weight: 900; font-size: 9px; padding: 1px 6px; border-radius: 5px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; z-index: 20; font-family: monospace;">
            ${speed} km/h
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28]
  });
}
