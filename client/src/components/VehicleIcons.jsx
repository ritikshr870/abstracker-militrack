import React from 'react';
import L from 'leaflet';
import { Truck, Car, Bike, Bus } from 'lucide-react';

export function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const toDeg = rad => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (toDeg(θ) + 360) % 360;
}

// Top-down realistic SVG paths based on category
function getVehicleSvgBody(category, color) {
  const cat = (category || '').toLowerCase();

  if (cat.includes('truck') || cat.includes('dumper')) {
    // Top-down heavy commercial truck
    return `
      <g filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.45))">
        <!-- Truck Cabin -->
        <rect x="15" y="6" width="18" height="14" rx="3" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>
        <rect x="17" y="8" width="14" height="4" rx="1.5" fill="#1e293b"/>
        <!-- Truck Cargo Body -->
        <rect x="13" y="21" width="22" height="22" rx="2" fill="#334155" stroke="#ffffff" stroke-width="1.5"/>
        <line x1="13" y1="32" x2="35" y2="32" stroke="#64748b" stroke-width="1"/>
        <!-- Wheels -->
        <rect x="11" y="9" width="3" height="7" rx="1" fill="#0f172a"/>
        <rect x="34" y="9" width="3" height="7" rx="1" fill="#0f172a"/>
        <rect x="10" y="25" width="3" height="8" rx="1" fill="#0f172a"/>
        <rect x="35" y="25" width="3" height="8" rx="1" fill="#0f172a"/>
        <rect x="10" y="34" width="3" height="8" rx="1" fill="#0f172a"/>
        <rect x="35" y="34" width="3" height="8" rx="1" fill="#0f172a"/>
        <!-- Heading Arrow -->
        <polygon points="24,1 28,6 20,6" fill="#fbbf24"/>
      </g>
    `;
  }

  if (cat.includes('motorcycle') || cat.includes('bike') || cat.includes('scooter')) {
    // Top-down motorcycle
    return `
      <g filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.45))">
        <!-- Handlebar -->
        <line x1="14" y1="14" x2="34" y2="14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <!-- Front Wheel -->
        <rect x="22" y="5" width="4" height="10" rx="2" fill="#0f172a" stroke="#ffffff" stroke-width="1"/>
        <!-- Body / Tank -->
        <path d="M21 15 C21 13, 27 13, 27 15 L26 28 C26 30, 22 30, 22 28 Z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
        <!-- Seat -->
        <rect x="22" y="27" width="4" height="8" rx="2" fill="#1e293b"/>
        <!-- Rear Wheel -->
        <rect x="22" y="35" width="4" height="10" rx="2" fill="#0f172a" stroke="#ffffff" stroke-width="1"/>
        <!-- Heading Arrow -->
        <polygon points="24,1 27,5 21,5" fill="#fbbf24"/>
      </g>
    `;
  }

  if (cat.includes('bus')) {
    // Top-down bus / passenger coach
    return `
      <g filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.45))">
        <!-- Bus Body -->
        <rect x="14" y="6" width="20" height="36" rx="5" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <!-- Front Windshield -->
        <rect x="16" y="8" width="16" height="5" rx="1.5" fill="#0f172a"/>
        <!-- Side Windows -->
        <rect x="15" y="15" width="3" height="22" fill="#94a3b8"/>
        <rect x="30" y="15" width="3" height="22" fill="#94a3b8"/>
        <!-- Rear Window -->
        <rect x="17" y="38" width="14" height="3" rx="1" fill="#0f172a"/>
        <!-- Heading Arrow -->
        <polygon points="24,1 28,5 20,5" fill="#fbbf24"/>
      </g>
    `;
  }

  // Default: Top-down aerodynamic sedan / car
  return `
    <g filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.45))">
      <!-- Wheels -->
      <rect x="10" y="11" width="3" height="7" rx="1" fill="#0f172a"/>
      <rect x="35" y="11" width="3" height="7" rx="1" fill="#0f172a"/>
      <rect x="10" y="30" width="3" height="7" rx="1" fill="#0f172a"/>
      <rect x="35" y="30" width="3" height="7" rx="1" fill="#0f172a"/>
      <!-- Car Body -->
      <path d="M16 8 C18 6, 30 6, 32 8 L35 15 L35 37 C35 41, 13 41, 13 37 L13 15 Z" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>
      <!-- Front Windshield -->
      <path d="M16 14 L32 14 L30 19 L18 19 Z" fill="#0f172a"/>
      <!-- Roof -->
      <rect x="18" y="20" width="12" height="10" rx="1.5" fill="#ffffff" fill-opacity="0.25"/>
      <!-- Rear Windshield -->
      <path d="M18 31 L30 31 L32 35 L16 35 Z" fill="#0f172a"/>
      <!-- Heading Arrow -->
      <polygon points="24,1 28,6 20,6" fill="#fbbf24"/>
    </g>
  `;
}

export function createDirectionalVehicleIcon(bearing = 0, color = '#2563eb', label = '', category = 'car') {
  const safeBearing = Math.round(bearing || 0);
  const vehicleSvg = getVehicleSvgBody(category, color);

  return L.divIcon({
    className: 'vehicle-div-icon',
    html: `
      <div style="width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer;">
        <!-- Directional Rotated Vehicle Silhouette -->
        <div style="transform: rotate(${safeBearing}deg); transition: transform 0.12s linear; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            ${vehicleSvg}
          </svg>
        </div>
        <!-- Vehicle Name / Tag Badge -->
        ${label ? `
          <div style="position: absolute; bottom: -14px; background: rgba(15, 23, 42, 0.95); color: #ffffff; font-size: 10px; font-weight: 800; padding: 1.5px 7px; border-radius: 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.25); pointer-events: none; letter-spacing: 0.3px;">
            ${label}
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [52, 52],
    iconAnchor: [26, 26]
  });
}

// Start / Finish Route Marker Icons
export function createWaypointIcon(type = 'start', label = '') {
  const isStart = type === 'start';
  const bgColor = isStart ? '#10b981' : '#ef4444';
  const text = isStart ? 'START' : 'FINISH';

  return L.divIcon({
    className: 'waypoint-div-icon',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="background: ${bgColor}; color: #ffffff; font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 1.5px solid #ffffff; white-space: nowrap;">
          ${label || text}
        </div>
        <div style="width: 2px; height: 8px; background: #0f172a;"></div>
        <div style="width: 6px; height: 6px; background: ${bgColor}; border-radius: 50%; border: 1px solid #ffffff;"></div>
      </div>
    `,
    iconSize: [40, 30],
    iconAnchor: [20, 28]
  });
}

export const VEHICLE_IMAGES = {
  car: '/vehicles/car.png',
  truck: '/vehicles/truck.png',
  bus: '/vehicles/bus.png',
  tractor: '/vehicles/tractor.png',
  motorcycle: '/vehicles/bike.png',
  bike: '/vehicles/bike.png'
};

export function getVehicleImageUrl(category = '', model = '') {
  const cat = (category || '').toLowerCase();
  const mod = (model || '').toLowerCase();

  if (cat.includes('tractor') || mod.includes('tractor') || cat.includes('agri')) {
    return '/vehicles/tractor.png';
  }
  if (cat.includes('truck') || mod.includes('truck') || cat.includes('dumper') || cat.includes('tipper') || cat.includes('lorry')) {
    return '/vehicles/truck.png';
  }
  if (cat.includes('bus') || mod.includes('bus') || cat.includes('coach')) {
    return '/vehicles/bus.png';
  }
  if (cat.includes('motorcycle') || cat.includes('bike') || cat.includes('scooter') || cat.includes('two-wheeler') || mod.includes('bike')) {
    return '/vehicles/bike.png';
  }
  return '/vehicles/car.png';
}

export function VehicleCategoryIcon({ category = '', model = '', className = 'w-6 h-6' }) {
  const [imgError, setImgError] = React.useState(false);
  const imageUrl = getVehicleImageUrl(category, model);

  if (!imgError && imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={category || 'Vehicle'}
        onError={() => setImgError(true)}
        className={`${className} object-contain shrink-0`}
        loading="lazy"
      />
    );
  }

  const cat = (category || '').toLowerCase();
  const mod = (model || '').toLowerCase();

  if (cat.includes('tractor') || mod.includes('tractor')) {
    return <Truck className={`${className} text-blue-600`} />;
  }
  if (cat.includes('truck') || mod.includes('truck') || cat.includes('dumper')) {
    return <Truck className={`${className} text-amber-600`} />;
  }
  if (cat.includes('motorcycle') || cat.includes('bike') || cat.includes('scooter')) {
    return <Bike className={`${className} text-indigo-600`} />;
  }
  if (cat.includes('bus') || mod.includes('bus')) {
    return <Bus className={`${className} text-rose-600`} />;
  }
  return <Car className={`${className} text-slate-800`} />;
}

