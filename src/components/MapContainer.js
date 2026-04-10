/**
 * MapContainer - Conditional map renderer
 * Renders DeckGLMap (WebGL) on desktop, fallback to D3/SVG MapComponent on mobile.
 * Supports an optional 3D globe mode (globe.gl) selectable from Settings.
 */
import { isMobileDevice } from '@/utils';
import { MapComponent } from './Map';
import { DeckGLMap } from './DeckGLMap';
import { GlobeMap } from './GlobeMap';
/**
 * Unified map interface that delegates to either DeckGLMap or MapComponent
 * based on device capabilities
 */
export class MapContainer {
    constructor(container, initialState, preferGlobe = false) {
        Object.defineProperty(this, "container", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isMobile", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "deckGLMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "svgMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "globeMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "initialState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "useDeckGL", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "useGlobe", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isResizingInternal", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "resizeObserver", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        // ─── Callback cache (survives map mode switches) ───────────────────────────
        Object.defineProperty(this, "cachedOnStateChanged", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedOnLayerChange", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedOnTimeRangeChanged", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedOnCountryClicked", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedOnHotspotClicked", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedOnAircraftPositionsUpdate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedOnMapContextMenu", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        // ─── Data cache (survives map mode switches) ───────────────────────────────
        Object.defineProperty(this, "cachedEarthquakes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedWeatherAlerts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedOutages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedAisDisruptions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedAisDensity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedCableAdvisories", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedRepairShips", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedCableHealth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedProtests", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedFlightDelays", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedAircraftPositions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedMilitaryFlights", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedMilitaryFlightClusters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedMilitaryVessels", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedMilitaryVesselClusters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedNaturalEvents", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedFires", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedTechEvents", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedUcdpEvents", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedDisplacementFlows", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedClimateAnomalies", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedRadiationObservations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedGpsJamming", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedSatellites", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedDiseaseOutbreaks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedCyberThreats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedIranEvents", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedNewsLocations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedPositiveEvents", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedKindnessData", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedHappinessScores", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedCIIScores", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedResilienceRanking", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedResilienceGreyedOut", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "cachedSpeciesRecovery", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedRenewableInstallations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedHotspotActivity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedEscalationFlights", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedEscalationVessels", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedImageryScenes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cachedWebcams", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.container = container;
        this.initialState = initialState;
        this.isMobile = isMobileDevice();
        this.useGlobe = preferGlobe && this.hasWebGLSupport();
        this.useDeckGL = !this.useGlobe && this.shouldUseDeckGL();
        if (!this.useDeckGL && this.initialState.layers?.resilienceScore) {
            this.initialState = { ...this.initialState, layers: { ...this.initialState.layers, resilienceScore: false } };
        }
        this.init();
    }
    hasWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            // deck.gl + maplibre rely on WebGL2 features in desktop mode.
            // Some Linux WebKitGTK builds expose only WebGL1, which can lead to
            // an empty/black render surface instead of a usable map.
            const gl2 = canvas.getContext('webgl2');
            return !!gl2;
        }
        catch {
            return false;
        }
    }
    shouldUseDeckGL() {
        if (!this.hasWebGLSupport())
            return false;
        if (!this.isMobile)
            return true;
        const mem = navigator.deviceMemory;
        if (mem !== undefined && mem < 3)
            return false;
        return true;
    }
    initSvgMap(logMessage) {
        console.log(logMessage);
        this.useDeckGL = false;
        this.deckGLMap = null;
        this.container.classList.remove('deckgl-mode');
        this.container.classList.add('svg-mode');
        // DeckGLMap mutates DOM early during construction. If initialization throws,
        // clear partial deck.gl nodes before creating the SVG fallback.
        this.container.innerHTML = '';
        this.svgMap = new MapComponent(this.container, this.initialState);
    }
    init() {
        if (this.useGlobe) {
            console.log('[MapContainer] Initializing 3D globe (globe.gl mode)');
            this.globeMap = new GlobeMap(this.container, this.initialState);
        }
        else if (this.useDeckGL) {
            console.log('[MapContainer] Initializing deck.gl map (desktop mode)');
            try {
                this.container.classList.add('deckgl-mode');
                this.deckGLMap = new DeckGLMap(this.container, {
                    ...this.initialState,
                    view: this.initialState.view,
                });
            }
            catch (error) {
                console.warn('[MapContainer] DeckGL initialization failed, falling back to SVG map', error);
                this.initSvgMap('[MapContainer] Initializing SVG map (DeckGL fallback mode)');
            }
        }
        else {
            this.initSvgMap('[MapContainer] Initializing SVG map (mobile/fallback mode)');
        }
        // Automatic resize on container change (fixes gaps on load/layout shift)
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                // Skip if we are already handling resize manually via drag handlers
                if (this.isResizingInternal)
                    return;
                this.resize();
            });
            this.resizeObserver.observe(this.container);
        }
    }
    /** Switch to 3D globe mode at runtime (called from Settings). */
    switchToGlobe() {
        if (this.useGlobe)
            return;
        const snapshot = this.getState();
        const center = this.getCenter();
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.destroyFlatMap();
        this.useGlobe = true;
        this.useDeckGL = false;
        this.globeMap = new GlobeMap(this.container, this.initialState);
        this.restoreViewport(snapshot, center);
        this.rehydrateActiveMap();
    }
    /** Reload basemap style (called when map provider changes in Settings). */
    reloadBasemap() {
        this.deckGLMap?.reloadBasemap();
    }
    /** Switch back to flat map at runtime (called from Settings). */
    switchToFlat() {
        if (!this.useGlobe)
            return;
        const snapshot = this.getState();
        const center = this.getCenter();
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.globeMap?.destroy();
        this.globeMap = null;
        this.useGlobe = false;
        this.useDeckGL = this.shouldUseDeckGL();
        this.init();
        this.restoreViewport(snapshot, center);
        this.rehydrateActiveMap();
    }
    restoreViewport(snapshot, center) {
        this.setLayers(snapshot.layers);
        this.setTimeRange(snapshot.timeRange);
        this.setView(snapshot.view);
        if (center)
            this.setCenter(center.lat, center.lon, snapshot.zoom);
    }
    rehydrateActiveMap() {
        // 1. Re-wire callbacks (through own public methods for adapter safety)
        if (this.cachedOnStateChanged)
            this.onStateChanged(this.cachedOnStateChanged);
        if (this.cachedOnLayerChange)
            this.setOnLayerChange(this.cachedOnLayerChange);
        if (this.cachedOnTimeRangeChanged)
            this.onTimeRangeChanged(this.cachedOnTimeRangeChanged);
        if (this.cachedOnCountryClicked)
            this.onCountryClicked(this.cachedOnCountryClicked);
        if (this.cachedOnHotspotClicked)
            this.onHotspotClicked(this.cachedOnHotspotClicked);
        if (this.cachedOnAircraftPositionsUpdate)
            this.setOnAircraftPositionsUpdate(this.cachedOnAircraftPositionsUpdate);
        if (this.cachedOnMapContextMenu)
            this.onMapContextMenu(this.cachedOnMapContextMenu);
        // 2. Re-push all cached data
        if (this.cachedEarthquakes)
            this.setEarthquakes(this.cachedEarthquakes);
        if (this.cachedWeatherAlerts)
            this.setWeatherAlerts(this.cachedWeatherAlerts);
        if (this.cachedOutages)
            this.setOutages(this.cachedOutages);
        if (this.cachedAisDisruptions != null && this.cachedAisDensity != null)
            this.setAisData(this.cachedAisDisruptions, this.cachedAisDensity);
        if (this.cachedCableAdvisories != null && this.cachedRepairShips != null)
            this.setCableActivity(this.cachedCableAdvisories, this.cachedRepairShips);
        if (this.cachedCableHealth)
            this.setCableHealth(this.cachedCableHealth);
        if (this.cachedProtests)
            this.setProtests(this.cachedProtests);
        if (this.cachedFlightDelays)
            this.setFlightDelays(this.cachedFlightDelays);
        if (this.cachedAircraftPositions)
            this.setAircraftPositions(this.cachedAircraftPositions);
        if (this.cachedMilitaryFlights)
            this.setMilitaryFlights(this.cachedMilitaryFlights, this.cachedMilitaryFlightClusters ?? []);
        if (this.cachedMilitaryVessels)
            this.setMilitaryVessels(this.cachedMilitaryVessels, this.cachedMilitaryVesselClusters ?? []);
        if (this.cachedNaturalEvents)
            this.setNaturalEvents(this.cachedNaturalEvents);
        if (this.cachedFires)
            this.setFires(this.cachedFires);
        if (this.cachedTechEvents)
            this.setTechEvents(this.cachedTechEvents);
        if (this.cachedUcdpEvents)
            this.setUcdpEvents(this.cachedUcdpEvents);
        if (this.cachedDisplacementFlows)
            this.setDisplacementFlows(this.cachedDisplacementFlows);
        if (this.cachedClimateAnomalies)
            this.setClimateAnomalies(this.cachedClimateAnomalies);
        if (this.cachedRadiationObservations)
            this.setRadiationObservations(this.cachedRadiationObservations);
        if (this.cachedGpsJamming)
            this.setGpsJamming(this.cachedGpsJamming);
        if (this.cachedSatellites)
            this.setSatellites(this.cachedSatellites);
        if (this.cachedDiseaseOutbreaks)
            this.setDiseaseOutbreaks(this.cachedDiseaseOutbreaks);
        if (this.cachedCyberThreats)
            this.setCyberThreats(this.cachedCyberThreats);
        if (this.cachedIranEvents)
            this.setIranEvents(this.cachedIranEvents);
        if (this.cachedNewsLocations)
            this.setNewsLocations(this.cachedNewsLocations);
        if (this.cachedPositiveEvents)
            this.setPositiveEvents(this.cachedPositiveEvents);
        if (this.cachedKindnessData)
            this.setKindnessData(this.cachedKindnessData);
        if (this.cachedHappinessScores)
            this.setHappinessScores(this.cachedHappinessScores);
        if (this.cachedCIIScores)
            this.setCIIScores(this.cachedCIIScores);
        if (this.cachedResilienceRanking)
            this.setResilienceRanking(this.cachedResilienceRanking, this.cachedResilienceGreyedOut);
        if (this.cachedSpeciesRecovery)
            this.setSpeciesRecoveryZones(this.cachedSpeciesRecovery);
        if (this.cachedRenewableInstallations)
            this.setRenewableInstallations(this.cachedRenewableInstallations);
        if (this.cachedHotspotActivity)
            this.updateHotspotActivity(this.cachedHotspotActivity);
        if (this.cachedEscalationFlights && this.cachedEscalationVessels)
            this.updateMilitaryForEscalation(this.cachedEscalationFlights, this.cachedEscalationVessels);
        if (this.cachedImageryScenes)
            this.setImageryScenes(this.cachedImageryScenes);
        if (this.cachedWebcams) {
            if (this.useGlobe)
                this.globeMap?.setWebcams(this.cachedWebcams);
            else if (this.useDeckGL)
                this.deckGLMap?.setWebcams(this.cachedWebcams);
            else
                this.svgMap?.setWebcams(this.cachedWebcams);
        }
    }
    isGlobeMode() {
        return this.useGlobe;
    }
    isDeckGLActive() {
        return this.useDeckGL;
    }
    destroyFlatMap() {
        this.deckGLMap?.destroy();
        this.deckGLMap = null;
        this.svgMap?.destroy();
        this.svgMap = null;
        this.container.innerHTML = '';
        this.container.classList.remove('deckgl-mode', 'svg-mode');
    }
    // ─── Unified public API - delegates to active map implementation ────────────
    render() {
        if (this.useGlobe) {
            this.globeMap?.render();
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.render();
        }
        else {
            this.svgMap?.render();
        }
    }
    resize() {
        if (this.useGlobe) {
            this.globeMap?.resize();
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.resize();
        }
        else {
            this.svgMap?.resize();
        }
    }
    setIsResizing(isResizing) {
        this.isResizingInternal = isResizing;
        if (this.useGlobe) {
            this.globeMap?.setIsResizing(isResizing);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setIsResizing(isResizing);
        }
        else {
            this.svgMap?.setIsResizing(isResizing);
        }
    }
    setView(view, zoom) {
        if (this.useGlobe) {
            this.globeMap?.setView(view, zoom);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setView(view, zoom);
        }
        else {
            this.svgMap?.setView(view, zoom);
        }
    }
    setZoom(zoom) {
        if (this.useGlobe) {
            this.globeMap?.setZoom(zoom);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setZoom(zoom);
        }
        else {
            this.svgMap?.setZoom(zoom);
        }
    }
    setCenter(lat, lon, zoom) {
        if (this.useGlobe) {
            this.globeMap?.setCenter(lat, lon, zoom);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setCenter(lat, lon, zoom);
        }
        else {
            this.svgMap?.setCenter(lat, lon);
            if (zoom != null)
                this.svgMap?.setZoom(zoom);
        }
    }
    getCenter() {
        if (this.useGlobe)
            return this.globeMap?.getCenter() ?? null;
        if (this.useDeckGL)
            return this.deckGLMap?.getCenter() ?? null;
        return this.svgMap?.getCenter() ?? null;
    }
    setTimeRange(range) {
        if (this.useGlobe) {
            this.globeMap?.setTimeRange(range);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setTimeRange(range);
        }
        else {
            this.svgMap?.setTimeRange(range);
        }
    }
    getTimeRange() {
        if (this.useGlobe)
            return this.globeMap?.getTimeRange() ?? '7d';
        if (this.useDeckGL)
            return this.deckGLMap?.getTimeRange() ?? '7d';
        return this.svgMap?.getTimeRange() ?? '7d';
    }
    setLayers(layers) {
        const sanitized = !this.useDeckGL && layers.resilienceScore ? { ...layers, resilienceScore: false } : layers;
        if (this.useGlobe) {
            this.globeMap?.setLayers(sanitized);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setLayers(sanitized);
        }
        else {
            this.svgMap?.setLayers(sanitized);
        }
    }
    getState() {
        if (this.useGlobe)
            return this.globeMap?.getState() ?? this.initialState;
        if (this.useDeckGL) {
            const state = this.deckGLMap?.getState();
            return state ? { ...state, view: state.view } : this.initialState;
        }
        return this.svgMap?.getState() ?? this.initialState;
    }
    // ─── Data setters ────────────────────────────────────────────────────────────
    setEarthquakes(earthquakes) {
        this.cachedEarthquakes = earthquakes;
        if (this.useGlobe) {
            this.globeMap?.setEarthquakes(earthquakes);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setEarthquakes(earthquakes);
        }
        else {
            this.svgMap?.setEarthquakes(earthquakes);
        }
    }
    setImageryScenes(scenes) {
        this.cachedImageryScenes = scenes;
        if (this.useGlobe) {
            this.globeMap?.setImageryScenes(scenes);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setImageryScenes(scenes);
        }
    }
    setWebcams(markers) {
        this.cachedWebcams = markers;
        if (this.useGlobe) {
            this.globeMap?.setWebcams(markers);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setWebcams(markers);
        }
        else {
            this.svgMap?.setWebcams(markers);
        }
    }
    setWeatherAlerts(alerts) {
        this.cachedWeatherAlerts = alerts;
        if (this.useGlobe) {
            this.globeMap?.setWeatherAlerts(alerts);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setWeatherAlerts(alerts);
        }
        else {
            this.svgMap?.setWeatherAlerts(alerts);
        }
    }
    setOutages(outages) {
        this.cachedOutages = outages;
        if (this.useGlobe) {
            this.globeMap?.setOutages(outages);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setOutages(outages);
        }
        else {
            this.svgMap?.setOutages(outages);
        }
    }
    setTrafficAnomalies(anomalies) {
        if (this.useGlobe) {
            this.globeMap?.setTrafficAnomalies(anomalies);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setTrafficAnomalies(anomalies);
        }
    }
    setDdosLocations(hits) {
        if (this.useGlobe) {
            this.globeMap?.setDdosLocations(hits);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setDdosLocations(hits);
        }
    }
    setAisData(disruptions, density) {
        this.cachedAisDisruptions = disruptions;
        this.cachedAisDensity = density;
        if (this.useGlobe) {
            this.globeMap?.setAisData(disruptions, density);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setAisData(disruptions, density);
        }
        else {
            this.svgMap?.setAisData(disruptions, density);
        }
    }
    setCableActivity(advisories, repairShips) {
        this.cachedCableAdvisories = advisories;
        this.cachedRepairShips = repairShips;
        if (this.useGlobe) {
            this.globeMap?.setCableActivity(advisories, repairShips);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setCableActivity(advisories, repairShips);
        }
        else {
            this.svgMap?.setCableActivity(advisories, repairShips);
        }
    }
    setCableHealth(healthMap) {
        this.cachedCableHealth = healthMap;
        if (this.useGlobe) {
            this.globeMap?.setCableHealth(healthMap);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setCableHealth(healthMap);
        }
        else {
            this.svgMap?.setCableHealth(healthMap);
        }
    }
    setProtests(events) {
        this.cachedProtests = events;
        if (this.useGlobe) {
            this.globeMap?.setProtests(events);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setProtests(events);
        }
        else {
            this.svgMap?.setProtests(events);
        }
    }
    setFlightDelays(delays) {
        this.cachedFlightDelays = delays;
        if (this.useGlobe) {
            this.globeMap?.setFlightDelays(delays);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setFlightDelays(delays);
        }
        else {
            this.svgMap?.setFlightDelays(delays);
        }
    }
    setAircraftPositions(positions) {
        this.cachedAircraftPositions = positions;
        if (this.useDeckGL) {
            this.deckGLMap?.setAircraftPositions(positions);
        }
        else {
            this.svgMap?.setAircraftPositions(positions);
        }
    }
    setMilitaryFlights(flights, clusters = []) {
        this.cachedMilitaryFlights = flights;
        this.cachedMilitaryFlightClusters = clusters;
        if (this.useGlobe) {
            this.globeMap?.setMilitaryFlights(flights);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setMilitaryFlights(flights, clusters);
        }
        else {
            this.svgMap?.setMilitaryFlights(flights, clusters);
        }
    }
    setMilitaryVessels(vessels, clusters = []) {
        this.cachedMilitaryVessels = vessels;
        this.cachedMilitaryVesselClusters = clusters;
        if (this.useGlobe) {
            this.globeMap?.setMilitaryVessels(vessels, clusters);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setMilitaryVessels(vessels, clusters);
        }
        else {
            this.svgMap?.setMilitaryVessels(vessels, clusters);
        }
    }
    setNaturalEvents(events) {
        this.cachedNaturalEvents = events;
        if (this.useGlobe) {
            this.globeMap?.setNaturalEvents(events);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setNaturalEvents(events);
        }
        else {
            this.svgMap?.setNaturalEvents(events);
        }
    }
    setFires(fires) {
        this.cachedFires = fires;
        if (this.useGlobe) {
            this.globeMap?.setFires(fires);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setFires(fires);
        }
        else {
            this.svgMap?.setFires(fires);
        }
    }
    setTechEvents(events) {
        this.cachedTechEvents = events;
        if (this.useGlobe) {
            this.globeMap?.setTechEvents(events);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setTechEvents(events);
        }
        else {
            this.svgMap?.setTechEvents(events);
        }
    }
    setUcdpEvents(events) {
        this.cachedUcdpEvents = events;
        if (this.useGlobe) {
            this.globeMap?.setUcdpEvents(events);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setUcdpEvents(events);
        }
    }
    setDisplacementFlows(flows) {
        this.cachedDisplacementFlows = flows;
        if (this.useGlobe) {
            this.globeMap?.setDisplacementFlows(flows);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setDisplacementFlows(flows);
        }
    }
    setClimateAnomalies(anomalies) {
        this.cachedClimateAnomalies = anomalies;
        if (this.useGlobe) {
            this.globeMap?.setClimateAnomalies(anomalies);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setClimateAnomalies(anomalies);
        }
    }
    setRadiationObservations(observations) {
        this.cachedRadiationObservations = observations;
        if (this.useGlobe) {
            this.globeMap?.setRadiationObservations(observations);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setRadiationObservations(observations);
        }
        else {
            this.svgMap?.setRadiationObservations(observations);
        }
    }
    setGpsJamming(hexes) {
        this.cachedGpsJamming = hexes;
        if (this.useGlobe) {
            this.globeMap?.setGpsJamming(hexes);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setGpsJamming(hexes);
        }
    }
    setSatellites(positions) {
        this.cachedSatellites = positions;
        if (this.useGlobe) {
            this.globeMap?.setSatellites(positions);
            return;
        }
    }
    setDiseaseOutbreaks(outbreaks) {
        this.cachedDiseaseOutbreaks = outbreaks;
        if (this.useGlobe)
            return; // TODO: add globe support for disease outbreaks layer
        if (this.useDeckGL)
            this.deckGLMap?.setDiseaseOutbreaks(outbreaks);
    }
    setCyberThreats(threats) {
        this.cachedCyberThreats = threats;
        if (this.useGlobe) {
            this.globeMap?.setCyberThreats(threats);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setCyberThreats(threats);
        }
        else {
            this.svgMap?.setCyberThreats(threats);
        }
    }
    setIranEvents(events) {
        this.cachedIranEvents = events;
        if (this.useGlobe) {
            this.globeMap?.setIranEvents(events);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setIranEvents(events);
        }
        else {
            this.svgMap?.setIranEvents(events);
        }
    }
    setNewsLocations(data) {
        this.cachedNewsLocations = data;
        if (this.useGlobe) {
            this.globeMap?.setNewsLocations(data);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setNewsLocations(data);
        }
        else {
            this.svgMap?.setNewsLocations(data);
        }
    }
    setPositiveEvents(events) {
        this.cachedPositiveEvents = events;
        if (this.useGlobe) {
            this.globeMap?.setPositiveEvents(events);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setPositiveEvents(events);
        }
        // SVG map does not support positive events layer
    }
    setKindnessData(points) {
        this.cachedKindnessData = points;
        if (this.useGlobe) {
            this.globeMap?.setKindnessData(points);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setKindnessData(points);
        }
        // SVG map does not support kindness layer
    }
    setHappinessScores(data) {
        this.cachedHappinessScores = data;
        if (this.useGlobe) {
            this.globeMap?.setHappinessScores(data);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setHappinessScores(data);
        }
        // SVG map does not support choropleth overlay
    }
    setChokepointData(data) {
        if (this.useGlobe) {
            this.globeMap?.setChokepointData(data);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setChokepointData(data);
            return;
        }
        this.svgMap?.setChokepointData(data);
    }
    setCIIScores(scores) {
        this.cachedCIIScores = scores;
        if (this.useGlobe) {
            this.globeMap?.setCIIScores(scores);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setCIIScores(scores);
        }
    }
    setResilienceRanking(items, greyedOut = []) {
        this.cachedResilienceRanking = items;
        this.cachedResilienceGreyedOut = greyedOut;
        if (this.useDeckGL) {
            this.deckGLMap?.setResilienceRanking(items, greyedOut);
        }
    }
    setSpeciesRecoveryZones(species) {
        this.cachedSpeciesRecovery = species;
        if (this.useGlobe) {
            this.globeMap?.setSpeciesRecoveryZones(species);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setSpeciesRecoveryZones(species);
        }
        // SVG map does not support species recovery layer
    }
    setRenewableInstallations(installations) {
        this.cachedRenewableInstallations = installations;
        if (this.useGlobe) {
            this.globeMap?.setRenewableInstallations(installations);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setRenewableInstallations(installations);
        }
        // SVG map does not support renewable installations layer
    }
    updateHotspotActivity(news) {
        this.cachedHotspotActivity = news;
        if (this.useDeckGL) {
            this.deckGLMap?.updateHotspotActivity(news);
        }
        else {
            this.svgMap?.updateHotspotActivity(news);
        }
    }
    updateMilitaryForEscalation(flights, vessels) {
        this.cachedEscalationFlights = flights;
        this.cachedEscalationVessels = vessels;
        if (this.useDeckGL) {
            this.deckGLMap?.updateMilitaryForEscalation(flights, vessels);
        }
        else {
            this.svgMap?.updateMilitaryForEscalation(flights, vessels);
        }
    }
    getHotspotDynamicScore(hotspotId) {
        if (this.useDeckGL) {
            return this.deckGLMap?.getHotspotDynamicScore(hotspotId);
        }
        return this.svgMap?.getHotspotDynamicScore(hotspotId);
    }
    highlightAssets(assets) {
        if (this.useDeckGL) {
            this.deckGLMap?.highlightAssets(assets);
        }
        else {
            this.svgMap?.highlightAssets(assets);
        }
    }
    // ─── Callback setters ────────────────────────────────────────────────────────
    onHotspotClicked(callback) {
        this.cachedOnHotspotClicked = callback;
        if (this.useGlobe) {
            this.globeMap?.setOnHotspotClick(callback);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setOnHotspotClick(callback);
        }
        else {
            this.svgMap?.onHotspotClicked(callback);
        }
    }
    onTimeRangeChanged(callback) {
        this.cachedOnTimeRangeChanged = callback;
        if (this.useGlobe) {
            this.globeMap?.onTimeRangeChanged(callback);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setOnTimeRangeChange(callback);
        }
        else {
            this.svgMap?.onTimeRangeChanged(callback);
        }
    }
    setOnLayerChange(callback) {
        this.cachedOnLayerChange = callback;
        if (this.useGlobe) {
            this.globeMap?.setOnLayerChange(callback);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setOnLayerChange(callback);
        }
        else {
            this.svgMap?.setOnLayerChange(callback);
        }
    }
    setOnAircraftPositionsUpdate(callback) {
        this.cachedOnAircraftPositionsUpdate = callback;
        if (this.useDeckGL) {
            this.deckGLMap?.setOnAircraftPositionsUpdate(callback);
        }
    }
    getBbox() {
        if (this.useDeckGL)
            return this.deckGLMap?.getBbox() ?? null;
        if (this.useGlobe)
            return this.globeMap?.getBbox() ?? null;
        return null;
    }
    onStateChanged(callback) {
        this.cachedOnStateChanged = callback;
        if (this.useGlobe) {
            this.globeMap?.onStateChanged(callback);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setOnStateChange((state) => {
                callback({ ...state, view: state.view });
            });
        }
        else {
            this.svgMap?.onStateChanged(callback);
        }
    }
    getHotspotLevels() {
        if (this.useDeckGL) {
            return this.deckGLMap?.getHotspotLevels() ?? {};
        }
        return this.svgMap?.getHotspotLevels() ?? {};
    }
    setHotspotLevels(levels) {
        if (this.useDeckGL) {
            this.deckGLMap?.setHotspotLevels(levels);
        }
        else {
            this.svgMap?.setHotspotLevels(levels);
        }
    }
    initEscalationGetters() {
        if (this.useDeckGL) {
            this.deckGLMap?.initEscalationGetters();
        }
        else {
            this.svgMap?.initEscalationGetters();
        }
    }
    // UI visibility methods
    hideLayerToggle(layer) {
        if (this.useGlobe) {
            this.globeMap?.hideLayerToggle(layer);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.hideLayerToggle(layer);
        }
        else {
            this.svgMap?.hideLayerToggle(layer);
        }
    }
    setLayerLoading(layer, loading) {
        if (this.useGlobe) {
            this.globeMap?.setLayerLoading(layer, loading);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setLayerLoading(layer, loading);
        }
        else {
            this.svgMap?.setLayerLoading(layer, loading);
        }
    }
    setLayerReady(layer, hasData) {
        if (this.useGlobe) {
            this.globeMap?.setLayerReady(layer, hasData);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setLayerReady(layer, hasData);
        }
        else {
            this.svgMap?.setLayerReady(layer, hasData);
        }
    }
    flashAssets(assetType, ids) {
        if (this.useDeckGL) {
            this.deckGLMap?.flashAssets(assetType, ids);
        }
        // SVG map doesn't have flashAssets - only supported in deck.gl mode
    }
    // Layer enable/disable and trigger methods
    enableLayer(layer) {
        if (layer === 'resilienceScore' && !this.useDeckGL)
            return;
        if (this.useGlobe) {
            this.globeMap?.enableLayer(layer);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.enableLayer(layer);
        }
        else {
            this.svgMap?.enableLayer(layer);
        }
    }
    triggerHotspotClick(id) {
        if (this.useDeckGL) {
            this.deckGLMap?.triggerHotspotClick(id);
        }
        else {
            this.svgMap?.triggerHotspotClick(id);
        }
    }
    triggerConflictClick(id) {
        if (this.useDeckGL) {
            this.deckGLMap?.triggerConflictClick(id);
        }
        else {
            this.svgMap?.triggerConflictClick(id);
        }
    }
    triggerBaseClick(id) {
        if (this.useDeckGL) {
            this.deckGLMap?.triggerBaseClick(id);
        }
        else {
            this.svgMap?.triggerBaseClick(id);
        }
    }
    triggerPipelineClick(id) {
        if (this.useDeckGL) {
            this.deckGLMap?.triggerPipelineClick(id);
        }
        else {
            this.svgMap?.triggerPipelineClick(id);
        }
    }
    triggerCableClick(id) {
        if (this.useDeckGL) {
            this.deckGLMap?.triggerCableClick(id);
        }
        else {
            this.svgMap?.triggerCableClick(id);
        }
    }
    triggerDatacenterClick(id) {
        if (this.useDeckGL) {
            this.deckGLMap?.triggerDatacenterClick(id);
        }
        else {
            this.svgMap?.triggerDatacenterClick(id);
        }
    }
    triggerNuclearClick(id) {
        if (this.useDeckGL) {
            this.deckGLMap?.triggerNuclearClick(id);
        }
        else {
            this.svgMap?.triggerNuclearClick(id);
        }
    }
    triggerIrradiatorClick(id) {
        if (this.useDeckGL) {
            this.deckGLMap?.triggerIrradiatorClick(id);
        }
        else {
            this.svgMap?.triggerIrradiatorClick(id);
        }
    }
    flashLocation(lat, lon, durationMs) {
        if (this.useGlobe) {
            this.globeMap?.flashLocation(lat, lon, durationMs);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.flashLocation(lat, lon, durationMs);
        }
        else {
            this.svgMap?.flashLocation(lat, lon, durationMs);
        }
    }
    onCountryClicked(callback) {
        this.cachedOnCountryClicked = callback;
        if (this.useGlobe) {
            this.globeMap?.setOnCountryClick(callback);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setOnCountryClick(callback);
        }
        else {
            this.svgMap?.setOnCountryClick(callback);
        }
    }
    onMapContextMenu(callback) {
        this.cachedOnMapContextMenu = callback;
        if (this.useGlobe) {
            this.globeMap?.setOnMapContextMenu(callback);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.setOnMapContextMenu(callback);
        }
    }
    fitCountry(code) {
        if (this.useGlobe) {
            this.globeMap?.fitCountry(code);
            return;
        }
        if (this.useDeckGL) {
            this.deckGLMap?.fitCountry(code);
        }
        else {
            this.svgMap?.fitCountry(code);
        }
    }
    highlightCountry(code) {
        if (this.useDeckGL) {
            this.deckGLMap?.highlightCountry(code);
        }
    }
    clearCountryHighlight() {
        if (this.useDeckGL) {
            this.deckGLMap?.clearCountryHighlight();
        }
    }
    setRenderPaused(paused) {
        if (this.useDeckGL) {
            this.deckGLMap?.setRenderPaused(paused);
        }
    }
    // Utility methods
    isDeckGLMode() {
        return this.useDeckGL;
    }
    isMobileMode() {
        return this.isMobile;
    }
    destroy() {
        this.resizeObserver?.disconnect();
        this.globeMap?.destroy();
        this.deckGLMap?.destroy();
        this.svgMap?.destroy();
        this.clearCache();
    }
    clearCache() {
        this.cachedOnStateChanged = null;
        this.cachedOnLayerChange = null;
        this.cachedOnTimeRangeChanged = null;
        this.cachedOnCountryClicked = null;
        this.cachedOnHotspotClicked = null;
        this.cachedOnAircraftPositionsUpdate = null;
        this.cachedOnMapContextMenu = null;
        this.cachedEarthquakes = null;
        this.cachedWeatherAlerts = null;
        this.cachedOutages = null;
        this.cachedAisDisruptions = null;
        this.cachedAisDensity = null;
        this.cachedCableAdvisories = null;
        this.cachedRepairShips = null;
        this.cachedCableHealth = null;
        this.cachedProtests = null;
        this.cachedFlightDelays = null;
        this.cachedAircraftPositions = null;
        this.cachedMilitaryFlights = null;
        this.cachedMilitaryFlightClusters = null;
        this.cachedMilitaryVessels = null;
        this.cachedMilitaryVesselClusters = null;
        this.cachedNaturalEvents = null;
        this.cachedFires = null;
        this.cachedTechEvents = null;
        this.cachedUcdpEvents = null;
        this.cachedDisplacementFlows = null;
        this.cachedClimateAnomalies = null;
        this.cachedRadiationObservations = null;
        this.cachedGpsJamming = null;
        this.cachedSatellites = null;
        this.cachedDiseaseOutbreaks = null;
        this.cachedCyberThreats = null;
        this.cachedIranEvents = null;
        this.cachedNewsLocations = null;
        this.cachedPositiveEvents = null;
        this.cachedKindnessData = null;
        this.cachedHappinessScores = null;
        this.cachedCIIScores = null;
        this.cachedSpeciesRecovery = null;
        this.cachedRenewableInstallations = null;
        this.cachedHotspotActivity = null;
        this.cachedEscalationFlights = null;
        this.cachedEscalationVessels = null;
        this.cachedImageryScenes = null;
    }
}
