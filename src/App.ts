import type { Monitor, PanelConfig, MapLayers } from '@/types';
import { normalizeExclusiveChoropleths } from '@/components/resilience-choropleth-utils';
import type { AppContext } from '@/app/app-context';
import {
  REFRESH_INTERVALS,
  DEFAULT_MAP_LAYERS,
  MOBILE_DEFAULT_MAP_LAYERS,
  STORAGE_KEYS,
  SITE_VARIANT,
  ALL_PANELS,
  VARIANT_DEFAULTS,
  getEffectivePanelConfig,
  FREE_MAX_PANELS,
  FREE_MAX_SOURCES,
} from '@/config';
import { sanitizeLayersForVariant } from '@/config/map-layer-definitions';
import type { MapVariant } from '@/config/map-layer-definitions';
import { initDB, cleanOldSnapshots, isAisConfigured, initAisStream, isOutagesConfigured, disconnectAisStream } from '@/services';
import { isProUser } from '@/services/widget-store';
import { mlWorker } from '@/services/ml-worker';
import { getAiFlowSettings, subscribeAiFlowChange, isHeadlineMemoryEnabled } from '@/services/ai-flow-settings';
import { startLearning } from '@/services/country-instability';
import { loadFromStorage, parseMapUrlState, saveToStorage, isMobileDevice } from '@/utils';
import type { ParsedMapUrlState } from '@/utils';
import { SignalModal, IntelligenceGapBadge, BreakingNewsBanner } from '@/components';
import { initBreakingNewsAlerts, destroyBreakingNewsAlerts } from '@/services/breaking-news-alerts';
import { isDesktopRuntime, waitForSidecarReady } from '@/services/runtime';
import { BETA_MODE } from '@/config/beta';
import { trackEvent, trackDeeplinkOpened, initAuthAnalytics } from '@/services/analytics';
import { preloadCountryGeometry, getCountryNameByCode } from '@/services/country-geometry';
import { initI18n, t } from '@/services/i18n';

import { FEEDS, INTEL_SOURCES } from '@/config/feeds';
import { fetchBootstrapData, getBootstrapHydrationState, markBootstrapAsLive, type BootstrapHydrationState } from '@/services/bootstrap';
import { describeFreshness } from '@/services/persistent-cache';
import { DesktopUpdater } from '@/app/desktop-updater';
import { CountryIntelManager } from '@/app/country-intel';
import { SearchManager } from '@/app/search-manager';
import { RefreshScheduler } from '@/app/refresh-scheduler';
import { PanelLayoutManager } from '@/app/panel-layout';
import { DataLoaderManager } from '@/app/data-loader';
import { EventHandlerManager } from '@/app/event-handlers';
import { resolveUserRegion, resolvePreciseUserCoordinates, type PreciseCoordinates } from '@/utils/user-location';
import { initAuthState, subscribeAuthState } from '@/services/auth-state';
import { install as installCloudPrefsSync, onSignIn as cloudPrefsSignIn, onSignOut as cloudPrefsSignOut } from '@/utils/cloud-prefs-sync';
import { getConvexClient, getConvexApi, waitForConvexAuth } from '@/services/convex-client';
import { initEntitlementSubscription, destroyEntitlementSubscription, resetEntitlementState } from '@/services/entitlements';
import { initSubscriptionWatch, destroySubscriptionWatch } from '@/services/billing';
import { capturePendingCheckoutIntentFromUrl, resumePendingCheckout } from '@/services/checkout';

export type { CountryBriefSignals } from '@/app/app-context';

export class App {
  private state: AppContext;
  private pendingDeepLinkCountry: string | null = null;
  private pendingDeepLinkExpanded = false;
  private pendingDeepLinkStoryCode: string | null = null;

  private panelLayout: PanelLayoutManager;
  private dataLoader: DataLoaderManager;
  private eventHandlers: EventHandlerManager;
  private searchManager: SearchManager;
  private countryIntel: CountryIntelManager;
  private refreshScheduler: RefreshScheduler;
  private desktopUpdater: DesktopUpdater;

  private modules: { destroy(): void }[] = [];
  private unsubAiFlow: (() => void) | null = null;
  private unsubFreeTier: (() => void) | null = null;
  private visiblePanelPrimed = new Set<string>();
  private visiblePanelPrimeRaf: number | null = null;
  private bootstrapHydrationState: BootstrapHydrationState = getBootstrapHydrationState();
  private cachedModeBannerEl: HTMLElement | null = null;
  private readonly handleViewportPrime = (): void => {
    if (this.visiblePanelPrimeRaf !== null) return;
    this.visiblePanelPrimeRaf = window.requestAnimationFrame(() => {
      this.visiblePanelPrimeRaf = null;
      void this.primeVisiblePanelData();
    });
  };
  private readonly handleConnectivityChange = (): void => {
    this.updateConnectivityUi();
  };

  private isPanelNearViewport(panelId: string, marginPx = 400): boolean {
    const panel = this.state.panels[panelId] as { isNearViewport?: (marginPx?: number) => boolean } | undefined;
    return panel?.isNearViewport?.(marginPx) ?? false;
  }

  private isAnyPanelNearViewport(panelIds: string[], marginPx = 400): boolean {
    return panelIds.some((panelId) => this.isPanelNearViewport(panelId, marginPx));
  }

  private getCachedBootstrapUpdatedAt(): number | null {
    const cachedTierTimestamps = Object.values(this.bootstrapHydrationState.tiers)
      .filter((tier) => tier.source === 'cached')
      .map((tier) => tier.updatedAt)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (cachedTierTimestamps.length === 0) return null;
    return Math.min(...cachedTierTimestamps);
  }

  private updateConnectivityUi(): void {
    const statusIndicator = this.state.container.querySelector('.status-indicator');
    const statusLabel = statusIndicator?.querySelector('span:last-child');
    const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    // Only treat a complete cache fallback (no live data at all) as "cached" for UI purposes.
    // 'mixed' means live data was partially fetched — showing "Live data unavailable" would be misleading.
    const usingCachedBootstrap = this.bootstrapHydrationState.source === 'cached';
    const cachedUpdatedAt = this.getCachedBootstrapUpdatedAt();

    let statusMode: 'live' | 'cached' | 'unavailable' = 'live';
    let bannerMessage: string | null = null;

    if (!online) {
      // Offline: show banner regardless of mixed/cached (any cached data is better than nothing)
      const hasAnyCached = this.bootstrapHydrationState.source === 'cached' || this.bootstrapHydrationState.source === 'mixed';
      if (hasAnyCached) {
        statusMode = 'cached';
        const offlineCachedAt = this.bootstrapHydrationState.tiers
          ? Math.min(...Object.values(this.bootstrapHydrationState.tiers)
              .filter((tier) => tier.source === 'cached' || tier.source === 'mixed')
              .map((tier) => tier.updatedAt)
              .filter((v): v is number => typeof v === 'number' && Number.isFinite(v)))
          : NaN;
        const freshness = Number.isFinite(offlineCachedAt) ? describeFreshness(offlineCachedAt) : t('common.cached').toLowerCase();
        bannerMessage = t('connectivity.offlineCached', { freshness });
      } else {
        statusMode = 'unavailable';
        bannerMessage = t('connectivity.offlineUnavailable');
      }
    } else if (usingCachedBootstrap) {
      statusMode = 'cached';
      const freshness = cachedUpdatedAt ? describeFreshness(cachedUpdatedAt) : t('common.cached').toLowerCase();
      bannerMessage = t('connectivity.cachedFallback', { freshness });
    }

    if (statusIndicator && statusLabel) {
      statusIndicator.classList.toggle('status-indicator--cached', statusMode === 'cached');
      statusIndicator.classList.toggle('status-indicator--unavailable', statusMode === 'unavailable');
      statusLabel.textContent = statusMode === 'live'
        ? t('header.live')
        : statusMode === 'cached'
          ? t('header.cached')
          : t('header.unavailable');
    }

    if (bannerMessage) {
      if (!this.cachedModeBannerEl) {
        this.cachedModeBannerEl = document.createElement('div');
        this.cachedModeBannerEl.className = 'cached-mode-banner';
        this.cachedModeBannerEl.setAttribute('role', 'status');
        this.cachedModeBannerEl.setAttribute('aria-live', 'polite');

        const badge = document.createElement('span');
        badge.className = 'cached-mode-banner__badge';
        const text = document.createElement('span');
        text.className = 'cached-mode-banner__text';
        this.cachedModeBannerEl.append(badge, text);

        const header = this.state.container.querySelector('.header');
        if (header?.parentElement) {
          header.insertAdjacentElement('afterend', this.cachedModeBannerEl);
        } else {
          this.state.container.prepend(this.cachedModeBannerEl);
        }
      }

      this.cachedModeBannerEl.classList.toggle('cached-mode-banner--unavailable', statusMode === 'unavailable');
      const badge = this.cachedModeBannerEl.querySelector('.cached-mode-banner__badge')!;
      const text = this.cachedModeBannerEl.querySelector('.cached-mode-banner__text')!;
      badge.textContent = statusMode === 'cached' ? t('header.cached') : t('header.unavailable');
      text.textContent = bannerMessage;
      return;
    }

    this.cachedModeBannerEl?.remove();
    this.cachedModeBannerEl = null;
  }

  private async primeVisiblePanelData(forceAll = false): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    const primeTask = (key: string, task: () => Promise<unknown>): void => {
      if (this.visiblePanelPrimed.has(key) || this.state.inFlight.has(key)) return;
      const wrapped = (async () => {
        this.state.inFlight.add(key);
        try {
          await task();
          this.visiblePanelPrimed.add(key);
        } finally {
          this.state.inFlight.delete(key);
        }
      })();
      tasks.push(wrapped);
    };

    const shouldPrime = (id: string): boolean => forceAll || this.isPanelNearViewport(id);
    const shouldPrimeAny = (ids: string[]): boolean => forceAll || this.isAnyPanelNearViewport(ids);

    if (shouldPrimeAny(['markets', 'heatmap', 'commodities', 'crypto', 'crypto-heatmap', 'defi-tokens', 'ai-tokens', 'other-tokens'])) {
      primeTask('markets', () => this.dataLoader.loadMarkets());
    }
    if (shouldPrime('economic-calendar')) {
      const panel = this.state.panels['economic-calendar'] as EconomicCalendarPanel | undefined;
      if (panel) primeTask('economic-calendar', () => panel.fetchData());
    }
    if (shouldPrime('fear-greed')) {
      const panel = this.state.panels['fear-greed'] as unknown as { fetchData: () => Promise<boolean> } | undefined;
      if (panel?.fetchData) primeTask('fear-greed', () => panel.fetchData());
    }
    if (shouldPrime('etf-flows')) {
      const panel = this.state.panels['etf-flows'] as unknown as { fetchData: () => Promise<boolean> } | undefined;
      if (panel?.fetchData) primeTask('etf-flows', () => panel.fetchData());
    }
    if (shouldPrime('stablecoins')) {
      const panel = this.state.panels['stablecoins'] as unknown as { fetchData: () => Promise<boolean> } | undefined;
      if (panel?.fetchData) primeTask('stablecoins', () => panel.fetchData());
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  }

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);

    const PANEL_ORDER_KEY = 'panel-order';
    const PANEL_SPANS_KEY = 'ivee-panel-spans';

    const isMobile = isMobileDevice();
    const isDesktopApp = isDesktopRuntime();
    const monitors = loadFromStorage<Monitor[]>(STORAGE_KEYS.monitors, []);

    // Use mobile-specific defaults on first load (no saved layers)
    const defaultLayers = isMobile ? MOBILE_DEFAULT_MAP_LAYERS : DEFAULT_MAP_LAYERS;

    let mapLayers: MapLayers;
    let panelSettings: Record<string, PanelConfig>;

    // Panels that must survive variant switches: desktop config, user-created widgets, MCP panels.
    const isDynamicPanel = (k: string) => k === 'runtime-config' || k.startsWith('cw-') || k.startsWith('mcp-');

    const currentVariant = SITE_VARIANT;
    {
      localStorage.setItem('ivee-variant', currentVariant);
      localStorage.removeItem(STORAGE_KEYS.mapLayers);
      mapLayers = normalizeExclusiveChoropleths(
        sanitizeLayersForVariant({ ...defaultLayers }, currentVariant as MapVariant), null,
      );
      panelSettings = {};
      const cryptoKeys = VARIANT_DEFAULTS[currentVariant] ?? [];
      for (const key of cryptoKeys) {
        panelSettings[key] = { ...getEffectivePanelConfig(key, currentVariant), enabled: true };
      }
      saveToStorage(STORAGE_KEYS.panels, panelSettings);
      localStorage.removeItem('panel-order');
      localStorage.removeItem('panel-order-bottom');
      localStorage.removeItem('panel-order-bottom-set');
      localStorage.removeItem('panel-spans');
    }

    // Desktop key management panel must always remain accessible in Tauri.
    if (isDesktopApp) {
      if (!panelSettings['runtime-config'] || !panelSettings['runtime-config'].enabled) {
        panelSettings['runtime-config'] = {
          ...panelSettings['runtime-config'],
          name: panelSettings['runtime-config']?.name ?? 'Desktop Configuration',
          enabled: true,
          priority: panelSettings['runtime-config']?.priority ?? 2,
        };
        saveToStorage(STORAGE_KEYS.panels, panelSettings);
      }
    }

    const initialUrlState: ParsedMapUrlState | null = parseMapUrlState(window.location.search, mapLayers);
    if (initialUrlState.layers) {
      mapLayers = normalizeExclusiveChoropleths(
        sanitizeLayersForVariant(initialUrlState.layers, currentVariant as MapVariant), null,
      );
      initialUrlState.layers = mapLayers;
    }

    const disabledSources = new Set(loadFromStorage<string[]>(STORAGE_KEYS.disabledFeeds, []));

    // Build shared state object
    this.state = {
      map: null,
      isMobile,
      isDesktopApp,
      container: el,
      panels: {},
      newsPanels: {},
      panelSettings,
      mapLayers,
      allNews: [],
      newsByCategory: {},
      latestMarkets: [],
      latestPredictions: [],
      latestClusters: [],
      intelligenceCache: {},
      cyberThreatsCache: null,
      disabledSources,
      currentTimeRange: '7d',
      inFlight: new Set(),
      seenGeoAlerts: new Set(),
      monitors,
      signalModal: null,
      searchModal: null,
      findingsBadge: null,
      breakingBanner: null,
      playbackControl: null,
      exportPanel: null,
      unifiedSettings: null,
      pizzintIndicator: null,
      llmStatusIndicator: null,
      countryTimeline: null,
      countersPanel: null,
      authModal: null,
      authHeaderWidget: null,
      tvMode: null,
      happyAllItems: [],
      isDestroyed: false,
      isPlaybackMode: false,
      isIdle: false,
      initialLoadComplete: false,
      resolvedLocation: 'global',
      initialUrlState,
      PANEL_ORDER_KEY,
      PANEL_SPANS_KEY,
    };

    // Instantiate modules (callbacks wired after all modules exist)
    this.refreshScheduler = new RefreshScheduler(this.state);
    this.countryIntel = new CountryIntelManager(this.state);
    this.desktopUpdater = new DesktopUpdater(this.state);

    this.dataLoader = new DataLoaderManager(this.state, {
      renderCriticalBanner: (postures) => this.panelLayout.renderCriticalBanner(postures),
      refreshOpenCountryBrief: () => this.countryIntel.refreshOpenBrief(),
    });

    this.searchManager = new SearchManager(this.state, {
      openCountryBriefByCode: (code, country) => this.countryIntel.openCountryBriefByCode(code, country),
    });

    this.panelLayout = new PanelLayoutManager(this.state, {
      openCountryStory: (code, name) => this.countryIntel.openCountryStory(code, name),
      openCountryBrief: (code) => {
        const name = CountryIntelManager.resolveCountryName(code);
        void this.countryIntel.openCountryBriefByCode(code, name);
      },
      loadAllData: () => this.dataLoader.loadAllData(),
      updateMonitorResults: () => this.dataLoader.updateMonitorResults(),
      loadSecurityAdvisories: () => this.dataLoader.loadSecurityAdvisories(),
    });

    this.eventHandlers = new EventHandlerManager(this.state, {
      updateSearchIndex: () => this.searchManager.updateSearchIndex(),
      loadAllData: () => this.dataLoader.loadAllData(),
      flushStaleRefreshes: () => this.refreshScheduler.flushStaleRefreshes(),
      setHiddenSince: (ts) => this.refreshScheduler.setHiddenSince(ts),
      loadDataForLayer: (layer) => { void this.dataLoader.loadDataForLayer(layer as keyof MapLayers); },
      waitForAisData: () => this.dataLoader.waitForAisData(),
      syncDataFreshnessWithLayers: () => this.dataLoader.syncDataFreshnessWithLayers(),
      ensureCorrectZones: () => this.panelLayout.ensureCorrectZones(),
      refreshOpenCountryBrief: () => this.countryIntel.refreshOpenBrief(),
      stopLayerActivity: (layer) => this.dataLoader.stopLayerActivity(layer),
      mountLiveNewsIfReady: () => this.panelLayout.mountLiveNewsIfReady(),
      updateFlightSource: (adsb, military) => this.searchManager.updateFlightSource(adsb, military),
    });

    // Wire cross-module callback: DataLoader → SearchManager
    this.dataLoader.updateSearchIndex = () => this.searchManager.updateSearchIndex();

    // Track destroy order (reverse of init)
    this.modules = [
      this.desktopUpdater,
      this.panelLayout,
      this.countryIntel,
      this.searchManager,
      this.dataLoader,
      this.refreshScheduler,
      this.eventHandlers,
    ];
  }

  public async init(): Promise<void> {
    const initStart = performance.now();
    await initDB();
    await initI18n();
    const aiFlow = getAiFlowSettings();
    if (aiFlow.browserModel || isDesktopRuntime()) {
      await mlWorker.init();
      if (BETA_MODE) mlWorker.loadModel('summarization-beta').catch(() => { });
    }

    if (aiFlow.headlineMemory) {
      mlWorker.init().then(ok => {
        if (ok) mlWorker.loadModel('embeddings').catch(() => { });
      }).catch(() => { });
    }

    this.unsubAiFlow = subscribeAiFlowChange((key) => {
      if (key === 'browserModel') {
        const s = getAiFlowSettings();
        if (s.browserModel) {
          mlWorker.init();
        } else if (!isHeadlineMemoryEnabled()) {
          mlWorker.terminate();
        }
      }
      if (key === 'headlineMemory') {
        if (isHeadlineMemoryEnabled()) {
          mlWorker.init().then(ok => {
            if (ok) mlWorker.loadModel('embeddings').catch(() => { });
          }).catch(() => { });
        } else {
          mlWorker.unloadModel('embeddings').catch(() => { });
          const s = getAiFlowSettings();
          if (!s.browserModel && !isDesktopRuntime()) {
            mlWorker.terminate();
          }
        }
      }
    });

    // Check AIS configuration before init
    if (!isAisConfigured()) {
      this.state.mapLayers.ais = false;
    } else if (this.state.mapLayers.ais) {
      initAisStream();
    }

    // Wait for sidecar readiness on desktop so bootstrap hits a live server
    if (isDesktopRuntime()) {
      await waitForSidecarReady(3000);
    }

    // Hydrate in-memory cache from bootstrap endpoint (before panels construct and fetch)
    await fetchBootstrapData();
    this.bootstrapHydrationState = getBootstrapHydrationState();

    // Verify OAuth OTT and hydrate auth session BEFORE any UI subscribes to auth state
    await initAuthState();
    if (isProUser()) {
      initAuthAnalytics();
    }
    installCloudPrefsSync(SITE_VARIANT);
    this.enforceFreeTierLimits();

    let _prevUserId: string | null = null;
    this.unsubFreeTier = subscribeAuthState((session) => {
      this.enforceFreeTierLimits();
      const userId = session.user?.id ?? null;
      if (userId !== null && userId !== _prevUserId) {
        void cloudPrefsSignIn(userId, SITE_VARIANT);

        // Rebind Convex watches to the real Clerk userId (was bound to anon UUID at init)
        destroyEntitlementSubscription();
        destroySubscriptionWatch();
        void initEntitlementSubscription(userId);
        void initSubscriptionWatch(userId);

        // Claim any anonymous purchase made before sign-in (anon → real user migration)
        const anonId = localStorage.getItem('wm-anon-id');
        if (anonId) {
          void (async () => {
            const [client, api] = await Promise.all([getConvexClient(), getConvexApi()]);
            if (!client || !api) return;
            // Wait for ConvexClient WebSocket auth handshake to complete.
            // Without this, mutations arrive at Convex before the server
            // has the JWT → "Authentication required" errors.
            const ready = await waitForConvexAuth(10_000);
            if (!ready) {
              console.warn('[billing] claimSubscription skipped — Convex auth not ready');
              return;
            }
            const result = await client.mutation(api.payments.billing.claimSubscription, { anonId });
            const claimed = result.claimed;
            const totalClaimed = claimed.subscriptions + claimed.entitlements +
                                 claimed.customers + claimed.payments;
            if (totalClaimed > 0) {
              console.log('[billing] Claimed anon subscription on sign-in:', claimed);
            }
            // Always remove after non-throwing completion — mutation is idempotent.
            // Prevents cold Convex init + mutation on every sign-in for non-purchasers.
            localStorage.removeItem('wm-anon-id');
          })().catch((err: unknown) => {
            console.warn('[billing] claimSubscription failed:', err);
            // Non-fatal — anon ID preserved for retry on next page load
          });
        }
        void resumePendingCheckout({
          openAuth: () => this.state.authModal?.open(),
        });
      } else if (userId === null && _prevUserId !== null) {
        destroyEntitlementSubscription();
        destroySubscriptionWatch();
        cloudPrefsSignOut();
        resetEntitlementState();
      }
      _prevUserId = userId;
    });


    const geoCoordsPromise: Promise<PreciseCoordinates | null> =
      this.state.isMobile && this.state.initialUrlState?.lat === undefined && this.state.initialUrlState?.lon === undefined
        ? resolvePreciseUserCoordinates(5000)
        : Promise.resolve(null);

    const resolvedRegion = await resolveUserRegion();
    this.state.resolvedLocation = resolvedRegion;

    // Phase 1: Layout (creates map + panels — they'll find hydrated data)
    this.panelLayout.init();
    // showProBanner(this.state.container); // Disabled for hackathon
    this.updateConnectivityUi();
    window.addEventListener('online', this.handleConnectivityChange);
    window.addEventListener('offline', this.handleConnectivityChange);

    const mobileGeoCoords = await geoCoordsPromise;
    if (mobileGeoCoords && this.state.map) {
      this.state.map.setCenter(mobileGeoCoords.lat, mobileGeoCoords.lon, 6);
    }

    // Phase 2: Shared UI components
    this.state.signalModal = new SignalModal();
    this.state.signalModal.setLocationClickHandler((lat, lon) => {
      this.state.map?.setCenter(lat, lon, 4);
    });
    if (!this.state.isMobile) {
      this.state.findingsBadge = new IntelligenceGapBadge();
      this.state.findingsBadge.setOnSignalClick((signal) => {
        if (localStorage.getItem('wm-settings-open') === '1') return;
        this.state.signalModal?.showSignal(signal);
      });
      this.state.findingsBadge.setOnAlertClick((alert) => {
        if (localStorage.getItem('wm-settings-open') === '1') return;
        this.state.signalModal?.showAlert(alert);
      });
    }

    if (!this.state.isMobile) {
      initBreakingNewsAlerts();
      this.state.breakingBanner = new BreakingNewsBanner();
    }

    // Phase 3: UI setup methods
    this.eventHandlers.startHeaderClock();
    this.eventHandlers.setupPlaybackControl();
    this.eventHandlers.setupStatusPanel();
    this.eventHandlers.setupPizzIntIndicator();
    this.eventHandlers.setupLlmStatusIndicator();
    this.eventHandlers.setupExportPanel();

    // Correlation engine removed for crypto hackathon
    this.eventHandlers.setupUnifiedSettings();
    // TODO: isProUser() gate should be removed when we are ready to get new users signing up
    if (isProUser()) this.eventHandlers.setupAuthWidget();
    const pendingCheckout = capturePendingCheckoutIntentFromUrl();
    if (pendingCheckout) {
      // Checkout intent from /pro page redirect. Resume immediately if
      // already authenticated, otherwise the auth callback handles it.
      void resumePendingCheckout({
        openAuth: () => this.state.authModal?.open(),
      });
    }

    // Phase 4: SearchManager, MapLayerHandlers, CountryIntel
    this.searchManager.init();
    this.eventHandlers.setupMapLayerHandlers();
    this.countryIntel.init();

    // Phase 5: Event listeners + URL sync
    this.eventHandlers.init();
    // Capture deep link params BEFORE URL sync overwrites them
    const initState = parseMapUrlState(window.location.search, this.state.mapLayers);
    this.pendingDeepLinkCountry = initState.country ?? null;
    this.pendingDeepLinkExpanded = initState.expanded === true;
    const earlyParams = new URLSearchParams(window.location.search);
    this.pendingDeepLinkStoryCode = earlyParams.get('c') ?? null;
    this.eventHandlers.setupUrlStateSync();

    // Start deep link handling early — its retry loop polls hasSufficientData()
    // independently, so it must not be gated behind loadAllData() which can hang.
    this.handleDeepLinks();

    // Phase 6: Data loading
    this.dataLoader.syncDataFreshnessWithLayers();
    if (SITE_VARIANT !== 'crypto') {
      await preloadCountryGeometry();
    }
    // Prime panel-specific data concurrently with bulk loading.
    // primeVisiblePanelData owns ETF, Stablecoins, Gulf Economies, etc. that
    // are NOT part of loadAllData. Running them in parallel prevents those
    // panels from being blocked when a loadAllData batch is slow.
    window.addEventListener('scroll', this.handleViewportPrime, { passive: true });
    window.addEventListener('resize', this.handleViewportPrime);
    await Promise.all([
      this.dataLoader.loadAllData(true),
      this.primeVisiblePanelData(true),
    ]);

    // If bootstrap was served from cache but live data just loaded, promote the status indicator
    markBootstrapAsLive();
    this.bootstrapHydrationState = getBootstrapHydrationState();
    this.updateConnectivityUi();

    startLearning();

    // Hide unconfigured layers after first data load
    if (!isAisConfigured()) {
      this.state.map?.hideLayerToggle('ais');
    }
    if (isOutagesConfigured() === false) {
      this.state.map?.hideLayerToggle('outages');
    }

    // Phase 7: Refresh scheduling
    this.setupRefreshIntervals();
    this.eventHandlers.setupSnapshotSaving();
    cleanOldSnapshots().catch((e) => console.warn('[Storage] Snapshot cleanup failed:', e));

    // Phase 8: Update checks
    this.desktopUpdater.init();

    // Analytics
    trackEvent('wm_app_loaded', {
      load_time_ms: Math.round(performance.now() - initStart),
      panel_count: Object.keys(this.state.panels).length,
    });
    this.eventHandlers.setupPanelViewTracking();
  }

  /**
   * Enforce free-tier panel and source limits.
   * Reads current values from storage, trims if necessary, and saves back.
   * Safe to call multiple times (idempotent) — e.g. on auth state changes.
   */
  private enforceFreeTierLimits(): void {
    if (isProUser()) return;

    // --- Panel limit ---
    const panelSettings = loadFromStorage<Record<string, PanelConfig>>(STORAGE_KEYS.panels, {});
    let cwDisabled = false;
    for (const key of Object.keys(panelSettings)) {
      if (key.startsWith('cw-') && panelSettings[key]?.enabled) {
        panelSettings[key] = { ...panelSettings[key]!, enabled: false };
        cwDisabled = true;
      }
    }
    const enabledKeys = Object.entries(panelSettings)
      .filter(([k, v]) => v.enabled && !k.startsWith('cw-'))
      .sort(([ka, a], [kb, b]) => (a.priority ?? 99) - (b.priority ?? 99) || ka.localeCompare(kb))
      .map(([k]) => k);
    const needsTrim = enabledKeys.length > FREE_MAX_PANELS;
    if (needsTrim) {
      for (const key of enabledKeys.slice(FREE_MAX_PANELS)) {
        panelSettings[key] = { ...panelSettings[key]!, enabled: false };
      }
      console.log(`[App] Free tier: trimmed ${enabledKeys.length - FREE_MAX_PANELS} panel(s) to enforce ${FREE_MAX_PANELS}-panel limit`);
    }
    if (cwDisabled || needsTrim) saveToStorage(STORAGE_KEYS.panels, panelSettings);

    // --- Source limit ---
    const disabledSources = new Set(loadFromStorage<string[]>(STORAGE_KEYS.disabledFeeds, []));
    const allSourceNames = (() => {
      const s = new Set<string>();
      Object.values(FEEDS).forEach(feeds => feeds?.forEach(f => s.add(f.name)));
      INTEL_SOURCES.forEach(f => s.add(f.name));
      return Array.from(s).sort((a, b) => a.localeCompare(b));
    })();
    const currentlyEnabled = allSourceNames.filter(n => !disabledSources.has(n));
    const enabledCount = currentlyEnabled.length;
    if (enabledCount > FREE_MAX_SOURCES) {
      const toDisable = enabledCount - FREE_MAX_SOURCES;
      for (const name of currentlyEnabled.slice(FREE_MAX_SOURCES)) {
        disabledSources.add(name);
      }
      saveToStorage(STORAGE_KEYS.disabledFeeds, Array.from(disabledSources));
      console.log(`[App] Free tier: disabled ${toDisable} source(s) to enforce ${FREE_MAX_SOURCES}-source limit`);
    }
  }

  public destroy(): void {
    this.state.isDestroyed = true;
    window.removeEventListener('scroll', this.handleViewportPrime);
    window.removeEventListener('resize', this.handleViewportPrime);
    window.removeEventListener('online', this.handleConnectivityChange);
    window.removeEventListener('offline', this.handleConnectivityChange);
    if (this.visiblePanelPrimeRaf !== null) {
      window.cancelAnimationFrame(this.visiblePanelPrimeRaf);
      this.visiblePanelPrimeRaf = null;
    }

    // Destroy all modules in reverse order
    for (let i = this.modules.length - 1; i >= 0; i--) {
      this.modules[i]!.destroy();
    }

    // Clean up subscriptions, map, AIS, and breaking news
    this.unsubAiFlow?.();
    this.unsubFreeTier?.();
    this.state.breakingBanner?.destroy();
    destroyBreakingNewsAlerts();
    this.cachedModeBannerEl?.remove();
    this.cachedModeBannerEl = null;
    this.state.map?.destroy();
    disconnectAisStream();
  }

  private handleDeepLinks(): void {
    const url = new URL(window.location.href);
    const DEEP_LINK_INITIAL_DELAY_MS = 1500;

    // Check for country brief deep link: ?c=IR (captured early before URL sync)
    const storyCode = this.pendingDeepLinkStoryCode ?? url.searchParams.get('c');
    this.pendingDeepLinkStoryCode = null;
    if (url.pathname === '/story' || storyCode) {
      const countryCode = storyCode;
      if (countryCode) {
        trackDeeplinkOpened('country', countryCode);
        const countryName = getCountryNameByCode(countryCode.toUpperCase()) || countryCode;
        setTimeout(() => {
          this.countryIntel.openCountryBriefByCode(countryCode.toUpperCase(), countryName, {
            maximize: true,
          });
          this.eventHandlers.syncUrlState();
        }, DEEP_LINK_INITIAL_DELAY_MS);
        return;
      }
    }

    // Check for country brief deep link: ?country=UA or ?country=UA&expanded=1
    const deepLinkCountry = this.pendingDeepLinkCountry;
    const deepLinkExpanded = this.pendingDeepLinkExpanded;
    this.pendingDeepLinkCountry = null;
    this.pendingDeepLinkExpanded = false;
    if (deepLinkCountry) {
      trackDeeplinkOpened('country', deepLinkCountry);
      const cName = CountryIntelManager.resolveCountryName(deepLinkCountry);
      setTimeout(() => {
        this.countryIntel.openCountryBriefByCode(deepLinkCountry, cName, {
          maximize: deepLinkExpanded,
        });
        this.eventHandlers.syncUrlState();
      }, DEEP_LINK_INITIAL_DELAY_MS);
    }
  }

  private setupRefreshIntervals(): void {
    this.refreshScheduler.scheduleRefresh('news', () => this.dataLoader.loadNews(), REFRESH_INTERVALS.feeds);
    this.refreshScheduler.registerAll([
      {
        name: 'markets',
        fn: () => this.dataLoader.loadMarkets(),
        intervalMs: REFRESH_INTERVALS.markets,
        condition: () => this.isAnyPanelNearViewport(['markets', 'heatmap', 'commodities', 'crypto', 'crypto-heatmap', 'defi-tokens', 'ai-tokens', 'other-tokens']),
      },
    ]);
  }
}
