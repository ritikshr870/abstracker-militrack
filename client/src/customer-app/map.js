import L from "leaflet";

/**
 * AbsTracker Ultra-HD Map Engine
 * AbsTracker Ultra-HD Map Engine
 * Keyless, reliable providers: Carto Voyager, OSM, Esri Satellite, Dark Mode
 */
export const MAP_PROVIDERS = {
  traveltime: {
    name: "TravelTime HD (Streets & Places)",
    url: "https://tiles.traveltimeapp.com/osm-bright/{z}/{x}/{y}.png?key=4b4350ea",
    options: {
      maxZoom: 19,
      maxNativeZoom: 19,
      tileSize: 256,
      zoomOffset: 0,
      attribution: '&copy; TravelTime &copy; OpenStreetMap'
    }
  },
  streets: {
    name: "Google Streets HD",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 20,
      maxNativeZoom: 19,
      tileSize: 256,
      zoomOffset: 0,
      attribution: '&copy; Esri, HERE, Garmin'
    }
  },
  osm: {
    name: "OpenStreetMap Standard",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      maxNativeZoom: 19,
      tileSize: 256,
      zoomOffset: 0,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  satellite: {
    name: "Satellite Imagery HD",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 19,
      maxNativeZoom: 19,
      tileSize: 256,
      zoomOffset: 0,
      attribution: '&copy; Esri, Maxar, Earthstar'
    }
  }
};

export function isValidCoord(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    !isNaN(nLat) &&
    !isNaN(nLng) &&
    nLat !== 0 &&
    nLng !== 0 &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180
  );
}

/**
 * Exact Great-Circle Bearing Calculation
 * Returns the exact geographic compass angle (0° to 360°) of the path from point 1 to point 2.
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const toDeg = rad => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);

  return (toDeg(theta) + 360) % 360;
}

export function lerpAngle(startAngle, endAngle, factor = 0.14) {
  const diff = ((((endAngle - startAngle) % 360) + 540) % 360) - 180;
  return (startAngle + diff * factor + 360) % 360;
}

export function createMap(container, center = [25.6528, 84.9690], zoom = 15, providerKey = "voyager") {
  if (!container) return null;

  const validCenter = isValidCoord(center[0], center[1]) ? center : [25.6528, 84.9690];
  const map = L.map(container, {
    center: validCenter,
    zoom: zoom,
    zoomControl: false,
    attributionControl: false,
    fadeAnimation: true,
    zoomAnimation: true,
    markerZoomAnimation: true
  });

  const layerGroup = L.layerGroup().addTo(map);
  setMapLayer(map, layerGroup, providerKey);

  [50, 200, 500].forEach(delay => {
    setTimeout(() => {
      try {
        if (map && map._container) map.invalidateSize();
      } catch (e) {}
    }, delay);
  });

  return { map, layerGroup };
}

export function setMapLayer(map, layerGroup, providerKey) {
  if (!map || !layerGroup) return;
  layerGroup.clearLayers();

  const provider = MAP_PROVIDERS[providerKey] || MAP_PROVIDERS.voyager;
  const tileLayer = L.tileLayer(provider.url, provider.options);
  layerGroup.addLayer(tileLayer);

  [40, 150, 350].forEach(d => {
    setTimeout(() => {
      try {
        if (map && map._container) map.invalidateSize();
      } catch (e) {}
    }, d);
  });
}

/**
 * Smoothly interpolates a Leaflet marker to a target position over durationMs.
 * Used for route history playback.
 */
export function smoothGlideMarker(marker, targetLat, targetLng, targetBearing = 0, durationMs = 300) {
  if (!marker || !isValidCoord(targetLat, targetLng)) return;

  if (marker._glideAnimId) {
    cancelAnimationFrame(marker._glideAnimId);
    marker._glideAnimId = null;
  }

  const startLatLng = marker.getLatLng();
  const startLat = startLatLng.lat;
  const startLng = startLatLng.lng;
  const startTime = performance.now();
  const dur = Math.max(durationMs, 50);

  let currentBearing = marker._currentBearing || targetBearing;

  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / dur, 1);

    const lat = startLat + (targetLat - startLat) * progress;
    const lng = startLng + (targetLng - startLng) * progress;

    try {
      marker.setLatLng([lat, lng]);
      currentBearing = lerpAngle(currentBearing, targetBearing, 0.2);
      marker._currentBearing = currentBearing;

      const el = marker.getElement();
      if (el) {
        const rotEl = el.querySelector('.vehicle-silhouette-rotator') || el.querySelector('.vehicle-bearing-rotator');
        if (rotEl) {
          rotEl.style.transform = `rotate(${Math.round(currentBearing)}deg)`;
        }
      }
    } catch (e) {
      return;
    }

    if (progress < 1) {
      marker._glideAnimId = requestAnimationFrame(animate);
    } else {
      marker._glideAnimId = null;
      try {
        marker.setLatLng([targetLat, targetLng]);
      } catch (e) {}
    }
  };

  marker._glideAnimId = requestAnimationFrame(animate);
}

/**
 * Local DB Persistent Waypoint Storage for continuous interpolation
 */
export function getVehicleLocalHistory(deviceId) {
  try {
    const raw = localStorage.getItem(`abstracker_telematics_${deviceId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveVehicleLocalHistory(deviceId, points) {
  try {
    const trimmed = points.slice(-30);
    localStorage.setItem(`abstracker_telematics_${deviceId}`, JSON.stringify(trimmed));
  } catch (e) {}
}

/**
 * ============================================================================
 * EXACT PATH-ALIGNED TELEMATICS GLIDER (NON-STOP CONTINUOUS MOTION ENGINE)
 * Architecture:
 * - Computes EXACT geographic path bearing along the vector of travel.
 * - Vehicle front points PRECISELY along the road path (zero crab-walking / sideways driving).
 * - Distributes motion across 15-20s server intervals so the vehicle glides continuously.
 * - Continuous cruise fallback keeps the vehicle advancing along the road heading if pings are delayed.
 * - OnPositionUpdate callback updates live polyline trail and camera tracking smoothly.
 * ============================================================================
 */
export class TelematicsVehicleGlider {
  constructor(marker, deviceId) {
    this.marker = marker;
    this.deviceId = deviceId || 'default';
    this.queue = [];
    this.currentLat = null;
    this.currentLng = null;
    this.currentBearing = 0;
    this.targetBearing = 0;
    this.segmentStart = null;
    this.segmentTarget = null;
    this.segmentStartTime = 0;
    this.segmentDuration = 16000; // 16s default calibrated for 15-20s server intervals
    this.animId = null;
    this.isRunning = false;
    this.speedKmh = 0;
    this.lastPacketTime = 0;
    this.lastFrameTime = performance.now();
    this.localHistory = getVehicleLocalHistory(this.deviceId);
    this.onPositionUpdate = null;
  }

  enqueue(point) {
    if (!isValidCoord(point.latitude, point.longitude)) return;

    const speed = Number(point.speed || 0);
    const isRunning = point.status === 'running' || speed > 1 || point.ignition === true;
    this.isRunning = isRunning;
    this.speedKmh = speed;

    const now = performance.now();

    // Measure real arrival delta between server pings (15s to 20s)
    if (this.lastPacketTime > 0) {
      const delta = now - this.lastPacketTime;
      if (delta >= 6000 && delta <= 40000) {
        this.segmentDuration = Math.round(delta * 0.94);
      }
    } else {
      this.segmentDuration = 16000;
    }
    this.lastPacketTime = now;

    // Initial position setup
    if (this.currentLat === null || this.currentLng === null) {
      this.currentLat = point.latitude;
      this.currentLng = point.longitude;
      this.currentBearing = (point.course && point.course > 0) ? point.course : 0;
      this.targetBearing = this.currentBearing;
      try {
        this.marker.setLatLng([this.currentLat, this.currentLng]);
        const el = this.marker.getElement();
        if (el) {
          const rotEl = el.querySelector('.vehicle-silhouette-rotator');
          if (rotEl) rotEl.style.transform = `rotate(${Math.round(this.currentBearing)}deg)`;
        }
      } catch (e) {}

      this.localHistory.push({
        lat: point.latitude,
        lng: point.longitude,
        speed: speed,
        course: this.currentBearing,
        time: Date.now()
      });
      saveVehicleLocalHistory(this.deviceId, this.localHistory);
      return;
    }

    const lastPoint = this.queue[this.queue.length - 1] || { 
      latitude: this.currentLat, 
      longitude: this.currentLng 
    };
    const latDiff = Math.abs(point.latitude - lastPoint.latitude);
    const lngDiff = Math.abs(point.longitude - lastPoint.longitude);

    // Filter sub-meter GPS noise (< ~1.5 meters)
    if (latDiff < 0.000015 && lngDiff < 0.000015) {
      return;
    }

    // CALCULATE EXACT PATH BEARING ALONG THE ROAD TRAJECTORY
    let pathBearing = calculateBearing(lastPoint.latitude, lastPoint.longitude, point.latitude, point.longitude);
    const courseToUse = !isNaN(pathBearing) ? pathBearing : ((point.course && point.course > 0) ? point.course : this.currentBearing);

    // Save to Local DB
    this.localHistory.push({
      lat: point.latitude,
      lng: point.longitude,
      speed: speed,
      course: courseToUse,
      time: Date.now()
    });
    saveVehicleLocalHistory(this.deviceId, this.localHistory);

    this.queue.push({
      latitude: point.latitude,
      longitude: point.longitude,
      course: courseToUse,
      speed: speed,
      status: point.status || 'stopped',
      time: now
    });

    if (this.queue.length > 25) {
      this.queue.shift();
    }

    if (!this.animId) {
      this.startSegment();
    }
  }

  startSegment() {
    if (this.queue.length === 0) {
      // If queue empty but vehicle is running: NEVER STOP! Keep cruising along heading!
      if (this.isRunning && this.speedKmh > 1) {
        this.lastFrameTime = performance.now();
        this.runContinuousCruise();
      } else {
        this.animId = null;
      }
      return;
    }

    this.segmentStart = {
      lat: this.currentLat,
      lng: this.currentLng,
      bearing: this.currentBearing
    };

    this.segmentTarget = this.queue.shift();

    // Exact path bearing from segmentStart to segmentTarget
    const dLat = Math.abs(this.segmentTarget.latitude - this.segmentStart.lat);
    const dLng = Math.abs(this.segmentTarget.longitude - this.segmentStart.lng);
    if (dLat > 0.000015 || dLng > 0.000015) {
      this.targetBearing = calculateBearing(
        this.segmentStart.lat,
        this.segmentStart.lng,
        this.segmentTarget.latitude,
        this.segmentTarget.longitude
      );
    } else if (this.segmentTarget.course && this.segmentTarget.course > 0) {
      this.targetBearing = this.segmentTarget.course;
    } else {
      this.targetBearing = this.currentBearing;
    }

    // Catch-up pacing if queue accumulated multiple packets
    const qLen = this.queue.length;
    if (qLen >= 3) {
      this.segmentDuration = Math.min(this.segmentDuration, 3500);
    } else if (qLen >= 1) {
      this.segmentDuration = Math.min(this.segmentDuration, 7500);
    }

    this.segmentStartTime = performance.now();
    this.lastFrameTime = performance.now();
    this.runAnimation();
  }

  runAnimation() {
    const animate = (currentTime) => {
      if (!this.marker || !this.marker._map) {
        this.animId = null;
        return;
      }

      const elapsed = currentTime - this.segmentStartTime;
      const progress = Math.min(elapsed / this.segmentDuration, 1);

      // Smooth steady ease across 90%, then gentle deceleration taper
      const ease = progress < 0.92 ? progress / 0.92 : 1 - Math.pow(1 - progress, 2) * 0.08;

      this.currentLat = this.segmentStart.lat + (this.segmentTarget.latitude - this.segmentStart.lat) * ease;
      this.currentLng = this.segmentStart.lng + (this.segmentTarget.longitude - this.segmentStart.lng) * ease;

      // Smoothly steer heading to match path direction
      this.currentBearing = lerpAngle(this.currentBearing, this.targetBearing, 0.14);

      try {
        this.marker.setLatLng([this.currentLat, this.currentLng]);

        const el = this.marker.getElement();
        if (el) {
          const rotEl = el.querySelector('.vehicle-silhouette-rotator');
          if (rotEl) {
            rotEl.style.transform = `rotate(${Math.round(this.currentBearing)}deg)`;
          }
        }
      } catch (e) {
        this.animId = null;
        return;
      }

      if (this.onPositionUpdate) {
        this.onPositionUpdate(this.currentLat, this.currentLng, this.currentBearing);
      }

      if (progress < 1) {
        this.animId = requestAnimationFrame(animate);
      } else {
        // Target reached
        this.currentLat = this.segmentTarget.latitude;
        this.currentLng = this.segmentTarget.longitude;
        this.currentBearing = this.targetBearing;

        if (this.queue.length > 0) {
          // Immediately glide into next buffered segment: ZERO PAUSE, ZERO FREEZE!
          this.startSegment();
        } else if (this.isRunning && this.speedKmh > 1) {
          // Waiting for next 15-20s server ping: smoothly cruise forward along the road!
          this.lastFrameTime = performance.now();
          this.runContinuousCruise();
        } else {
          // Vehicle stopped / parked: come to rest
          this.animId = null;
        }
      }
    };

    this.animId = requestAnimationFrame(animate);
  }

  runContinuousCruise() {
    const cruise = (currentTime) => {
      if (!this.marker || !this.marker._map) {
        this.animId = null;
        return;
      }

      // If next packet arrived while cruising, steer into next segment immediately!
      if (this.queue.length > 0) {
        this.startSegment();
        return;
      }

      // If vehicle stopped or packet has not arrived for > 45 seconds, gently stop
      const elapsedSincePacket = currentTime - this.lastPacketTime;
      if (!this.isRunning || this.speedKmh <= 1 || elapsedSincePacket > 45000) {
        this.animId = null;
        return;
      }

      const dt = Math.min(currentTime - this.lastFrameTime, 50);
      this.lastFrameTime = currentTime;

      // Displacement at actual vehicle speed along current bearing
      const speedMps = (this.speedKmh * 1000) / 3600;
      const distMeters = speedMps * (dt / 1000);
      const rad = (this.currentBearing * Math.PI) / 180;
      const dLat = (distMeters * Math.cos(rad)) / 111139;
      const dLng = (distMeters * Math.sin(rad)) / (111139 * Math.cos((this.currentLat * Math.PI) / 180));

      this.currentLat += dLat;
      this.currentLng += dLng;

      try {
        this.marker.setLatLng([this.currentLat, this.currentLng]);
        const el = this.marker.getElement();
        if (el) {
          const rotEl = el.querySelector('.vehicle-silhouette-rotator');
          if (rotEl) {
            rotEl.style.transform = `rotate(${Math.round(this.currentBearing)}deg)`;
          }
        }
      } catch (e) {
        this.animId = null;
        return;
      }

      if (this.onPositionUpdate) {
        this.onPositionUpdate(this.currentLat, this.currentLng, this.currentBearing);
      }

      this.animId = requestAnimationFrame(cruise);
    };

    this.animId = requestAnimationFrame(cruise);
  }

  destroy() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.queue = [];
    this.onPositionUpdate = null;
  }
}

/**
 * Universal marker updater using the adaptive telematics glider
 */
export function updateVehicleMarkerWithBuffer(marker, vehicleData) {
  if (!marker || !vehicleData || !isValidCoord(vehicleData.latitude, vehicleData.longitude)) return;

  if (!marker._telematicsGlider) {
    marker._telematicsGlider = new TelematicsVehicleGlider(marker, vehicleData.id);
  }

  marker._telematicsGlider.enqueue(vehicleData);
}

/**
 * Helper to smoothly pan the map ONLY when vehicle approaches edges (prevents map stutter)
 */
export function smoothFollowVehicle(map, lat, lng) {
  if (!map || !isValidCoord(lat, lng)) return;
  try {
    const center = map.getCenter();
    const dist = center.distanceTo([lat, lng]);
    if (dist > 45) {
      map.panTo([lat, lng], { animate: true, duration: 1.2 });
    }
  } catch (e) {}
}
