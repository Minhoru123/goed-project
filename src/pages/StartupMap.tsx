import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Company } from '../types';
import { loadCompanies } from '../lib/loadData';
import { colorFor } from '../lib/sectorColor';
import { resolveBrandSector, SECTOR_ICON_PATHS } from '../lib/sectorIcon';
import { aiFilterCompanies } from '../lib/filterCompanies';
import StartupCard from '../components/StartupCard';
import { cleanCity, getKnownCities } from '../lib/companyMeta';
import '../lib/leafletIcons';

const UTAH_CENTER: [number, number] = [39.5, -111.5];
const OVERLAP_OFFSET = 0.00035;

type Placed = Company & {
  lat: number;
  lng: number;
  markerLat: number;
  markerLng: number;
};

function sectorIcon(sector: string | null, color: string, selected: boolean): L.DivIcon {
  const size = selected ? 36 : 28;
  const inner = size - 8;
  const brand = resolveBrandSector(sector);
  const pathHtml = brand ? SECTOR_ICON_PATHS[brand] : SECTOR_ICON_PATHS.DEFAULT;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathHtml}</svg>`;

  return L.divIcon({
    className: 'startup-marker',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${color};
      display:flex;align-items:center;justify-content:center;
      border:2px solid #0F172A;
      box-shadow:0 0 0 ${selected ? 3 : 1}px ${selected ? color : 'rgba(0,0,0,0.35)'}, 0 2px 6px rgba(0,0,0,0.4);
      ${selected ? 'transform:scale(1.05);' : ''}
    ">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function clusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 50 ? 44 : 54;
  return L.divIcon({
    className: 'startup-cluster',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:rgba(212,175,55,0.92);
      color:#0F172A;
      display:flex;align-items:center;justify-content:center;
      border:3px solid #ffffff;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);
      font-weight:700;font-size:13px;font-family:system-ui;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function RevealSelectedMarker({
  selectedId,
  target,
  revealNonce,
  markerRefs,
  clusterGroupRef,
}: {
  selectedId: string | null;
  target: [number, number] | null;
  revealNonce: number;
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
  clusterGroupRef: React.MutableRefObject<L.MarkerClusterGroup | null>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedId || !target) return;

    const marker = markerRefs.current.get(selectedId);
    if (!marker) return;

    const openPopup = () => {
      window.requestAnimationFrame(() => {
        if (marker.isPopupOpen()) return;
        marker.openPopup();
      });
    };

    const openMarker = () => {
      const targetZoom = Math.max(map.getZoom(), 12);
      const shouldMove = map.getZoom() !== targetZoom || !map.getCenter().equals(marker.getLatLng());

      if (!shouldMove) {
        openPopup();
        return;
      }

      const openAfterMove = () => openPopup();
      map.once('moveend', openAfterMove);
      map.flyTo(target, targetZoom, { duration: 0.7 });
    };

    const clusterGroup = clusterGroupRef.current;
    if (clusterGroup?.zoomToShowLayer) {
      clusterGroup.zoomToShowLayer(marker, openMarker);
      return;
    }

    openMarker();
  }, [map, selectedId, target, revealNonce, markerRefs, clusterGroupRef]);

  return null;
}

function ClearSelectionOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvents({
    click: () => onClear(),
  });

  return null;
}

function DirectionsActionSheet({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const linkStyle: React.CSSProperties = { color: '#ffffff', textDecoration: 'none' };

  function stop(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  if (!open) {
    return (
      <div className="pt-2" onMouseDown={stop} onClick={stop}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen(true);
          }}
          onMouseDown={stop}
          className="w-full rounded-md bg-utah-gold px-2 py-1.5 text-center text-[11px] font-semibold"
          style={{ color: '#ffffff' }}
        >
          Get directions
        </button>
      </div>
    );
  }

  return (
    <div className="pt-2" onMouseDown={stop} onClick={stop}>
      <div className="overflow-hidden rounded-md border border-utah-stone/20">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noreferrer"
          onMouseDown={stop}
          onClick={stop}
          className="block bg-utah-gold px-2 py-2 text-center text-[11px] font-semibold"
          style={linkStyle}
        >
          Google Maps
        </a>
        <a
          href={`https://maps.apple.com/?q=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noreferrer"
          onMouseDown={stop}
          onClick={stop}
          className="block bg-utah-slate px-2 py-2 text-center text-[11px] font-semibold"
          style={linkStyle}
        >
          Apple Maps
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen(false);
          }}
          onMouseDown={stop}
          className="block w-full bg-utah-stone/20 px-2 py-1.5 text-center text-[11px] font-semibold"
          style={{ color: '#ffffff' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function StartupMap() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [hiringFilter, setHiringFilter] = useState<'' | 'yes' | 'no'>('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealNonce, setRevealNonce] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  // AI search (matchmaking modes)
  type Intent = 'browse' | 'customer' | 'partner' | 'acquisition';
  const INTENT_PROMPTS: Record<Intent, string> = {
    browse: '',
    customer:
      "I'm looking for potential customers for: ", // user appends
    partner:
      "I'm looking for partners (channel, integration, co-marketing) who: ",
    acquisition:
      "I'm sizing up acquisition targets that: ",
  };
  const [intent, setIntent] = useState<Intent>('browse');
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ ids: Set<string>; reasoning: string; summary: string } | null>(null);

  async function runAiFilter() {
    const q = aiQuery.trim();
    if (!q || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    const prefix = INTENT_PROMPTS[intent];
    const fullQuery = prefix ? `${prefix}${q}` : q;
    try {
      const r = await aiFilterCompanies(fullQuery);
      setAiResult({ ids: new Set(r.ids), reasoning: r.reasoning, summary: r.summary });
      setSearch('');
      setSectorFilter('');
      setStageFilter('');
      setSizeFilter('');
      setHiringFilter('');
      setLocationFilter('');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI search failed');
    } finally {
      setAiLoading(false);
    }
  }

  function clearAi() {
    setAiResult(null);
    setAiQuery('');
    setAiError(null);
    setIntent('browse');
  }

  useEffect(() => {
    loadCompanies()
      .then(setCompanies)
      .catch((e: Error) => setError(e.message));
  }, []);

  const placed = useMemo<Placed[]>(() => {
    const base = companies.filter((c): c is Company & { lat: number; lng: number } => c.lat != null && c.lng != null);
    const groups = new Map<string, (Company & { lat: number; lng: number })[]>();

    for (const company of base) {
      const key = `${company.lat}:${company.lng}`;
      const group = groups.get(key);
      if (group) {
        group.push(company);
      } else {
        groups.set(key, [company]);
      }
    }

    return base.map((company) => {
      const group = groups.get(`${company.lat}:${company.lng}`) ?? [company];
      const index = group.findIndex((entry) => entry.id === company.id && entry.name === company.name);
      if (group.length === 1 || index === -1) {
        return { ...company, markerLat: company.lat, markerLng: company.lng };
      }

      const angle = (index / group.length) * Math.PI * 2;
      return {
        ...company,
        markerLat: company.lat + Math.sin(angle) * OVERLAP_OFFSET,
        markerLng: company.lng + Math.cos(angle) * OVERLAP_OFFSET,
      };
    });
  }, [companies]);
  const knownCities = useMemo(() => {
    return getKnownCities(placed);
  }, [placed]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    for (const c of placed) if (c.sector) s.add(c.sector);
    return Array.from(s).sort();
  }, [placed]);

  const stages = useMemo(() => {
    const s = new Set<string>();
    for (const c of placed) if (c.stage) s.add(c.stage);
    return Array.from(s).sort();
  }, [placed]);

  const sizes = useMemo(() => {
    const s = new Set<string>();
    for (const c of placed) if (c.employees) s.add(c.employees);
    return Array.from(s).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (Number.isNaN(na) || Number.isNaN(nb)) return a.localeCompare(b);
      return na - nb;
    });
  }, [placed]);

  const locations = useMemo(() => {
    const s = new Map<string, string>();
    for (const c of placed) {
      const clean = cleanCity(c.city, c.address, knownCities);
      if (clean) s.set(clean.toLowerCase(), clean);
    }
    return Array.from(s.values()).sort();
  }, [placed, knownCities]);

  const filtered = useMemo(() => {
    // AI filter takes precedence over the manual filters when active.
    if (aiResult) {
      const order = new Map<string, number>();
      let i = 0;
      for (const id of aiResult.ids) order.set(id, i++);
      return placed
        .filter((c) => aiResult.ids.has(c.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    const q = search.trim().toLowerCase();
    return placed.filter((c) => {
      if (sectorFilter && c.sector !== sectorFilter) return false;
      if (stageFilter && c.stage !== stageFilter) return false;
      if (sizeFilter && c.employees !== sizeFilter) return false;
      const cityLabel = cleanCity(c.city, c.address, knownCities);
      if (locationFilter && cityLabel?.toLowerCase() !== locationFilter.toLowerCase()) return false;
      if (hiringFilter === 'yes' && c.hiring !== true) return false;
      if (hiringFilter === 'no' && c.hiring === true) return false;
      if (!q) return true;
      const hay = `${c.name} ${cityLabel ?? ''} ${c.sector ?? ''} ${c.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [placed, search, sectorFilter, stageFilter, sizeFilter, hiringFilter, locationFilter, aiResult, knownCities]);

  const selected = useMemo(() => filtered.find((c) => c.id === selectedId) ?? null, [filtered, selectedId]);
  const flyTarget = selected ? ([selected.markerLat, selected.markerLng] as [number, number]) : null;

  function selectAndScroll(id: string) {
    setSelectedId(id);
    setRevealNonce((current) => current + 1);
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearFilters() {
    setSearch('');
    setSectorFilter('');
    setStageFilter('');
    setSizeFilter('');
    setHiringFilter('');
    setLocationFilter('');
    setSelectedId(null);
  }

  const anyFilter = !!(search || sectorFilter || stageFilter || sizeFilter || hiringFilter || locationFilter);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Utah Startup Map</h1>
          <p className="mt-1 text-sm text-utah-stone/70">
            {placed.length} mapped · {filtered.length} matching filters
          </p>
        </div>
      </div>

      {error && (
        <div className="card mb-4 border-utah-red/40 bg-utah-red/5 text-sm text-utah-red">
          Couldn't load companies.json — run <code>npm run data</code> first. ({error})
        </div>
      )}

      <div className="card mb-4 border-utah-gold/30">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-utah-gold">
            AI search · ask in plain English
          </p>
          {aiResult && (
            <button className="text-xs text-utah-gold hover:underline" onClick={clearAi} type="button">
              Clear AI filter
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {([
            { id: 'browse', label: 'Browse', desc: 'open exploration' },
            { id: 'customer', label: 'Find customers', desc: 'who would buy what I sell' },
            { id: 'partner', label: 'Find partners', desc: 'channels, integrations, co-marketing' },
            { id: 'acquisition', label: 'Find acquisitions', desc: 'potential targets to buy' },
          ] as { id: Intent; label: string; desc: string }[]).map((m) => {
            const on = intent === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setIntent(m.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  on
                    ? 'border-utah-gold bg-utah-gold/15 text-utah-gold'
                    : 'border-utah-stone/20 text-utah-stone/70 hover:border-utah-gold/50 hover:text-utah-stone'
                }`}
                title={m.desc}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-md border border-utah-stone/20 px-3 py-2 text-sm outline-none focus:border-utah-gold"
            placeholder={
              intent === 'customer'
                ? 'e.g., manufacturing companies in Utah County that would need automation software'
                : intent === 'partner'
                  ? 'e.g., outdoor brands in Park City that could co-market with us'
                  : intent === 'acquisition'
                    ? 'e.g., bootstrapped seed-stage SaaS in SLC, 5-15 employees'
                    : 'e.g., Series A AI companies in Salt Lake City'
            }
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runAiFilter(); }}
            disabled={aiLoading}
          />
          <button
            className="btn-primary text-sm"
            onClick={runAiFilter}
            disabled={aiLoading || !aiQuery.trim()}
            type="button"
          >
            {aiLoading ? 'Searching…' : 'AI search'}
          </button>
        </div>
        {aiError && <p className="mt-2 text-xs text-red-400">{aiError}</p>}
        {aiResult && (
          <div className="mt-3 rounded-md border border-utah-gold/30 bg-utah-gold/5 p-3 text-xs text-utah-stone/80">
            <p className="font-semibold text-utah-gold">Showing {aiResult.ids.size} matches</p>
            <p className="mt-1 italic text-utah-stone/70">{aiResult.reasoning}</p>
            {aiResult.summary && <p className="mt-2">{aiResult.summary}</p>}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[360px_1fr]">
        <aside className="flex h-[75vh] flex-col rounded-xl border border-utah-stone/10 bg-utah-slate">
          <div className="space-y-2 border-b border-utah-stone/10 p-3">
            <input
              className="w-full rounded-md border border-utah-stone/20 px-3 py-2 text-sm outline-none focus:border-utah-sky"
              placeholder="Search name, city, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-md border border-utah-stone/20 px-2 py-2 text-sm"
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="">All sectors</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="rounded-md border border-utah-stone/20 px-2 py-2 text-sm"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="">All stages</option>
                {stages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="rounded-md border border-utah-stone/20 px-2 py-2 text-sm"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
              >
                <option value="">All sizes</option>
                {sizes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="rounded-md border border-utah-stone/20 px-2 py-2 text-sm"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="">All cities</option>
                {locations.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="col-span-2 rounded-md border border-utah-stone/20 px-2 py-2 text-sm"
                value={hiringFilter}
                onChange={(e) => setHiringFilter(e.target.value as '' | 'yes' | 'no')}
              >
                <option value="">Hiring status: any</option>
                <option value="yes">Hiring now</option>
                <option value="no">Not hiring</option>
              </select>
            </div>
            {anyFilter && (
              <button
                className="text-xs text-utah-sky hover:underline"
                onClick={clearFilters}
                type="button"
              >
                Clear filters
              </button>
            )}
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {filtered.length === 0 && (
              <p className="text-sm text-utah-stone/60">No matches. Try clearing filters.</p>
            )}
            {filtered.map((c) => (
              <div key={c.id} data-id={c.id}>
                <StartupCard
                  company={c}
                  cityLabel={cleanCity(c.city, c.address, knownCities)}
                  selected={c.id === selectedId}
                  onSelect={selectAndScroll}
                />
              </div>
            ))}
          </div>
        </aside>

        <div className="overflow-hidden rounded-xl border border-utah-stone/10">
          <MapContainer center={UTAH_CENTER} zoom={7} style={{ height: '75vh', width: '100%' }}>
            <ClearSelectionOnMapClick onClear={() => setSelectedId(null)} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />
            <RevealSelectedMarker
              selectedId={selectedId}
              target={flyTarget}
              revealNonce={revealNonce}
              markerRefs={markerRefs}
              clusterGroupRef={clusterGroupRef}
            />
            <MarkerClusterGroup
              ref={clusterGroupRef}
              chunkedLoading
              showCoverageOnHover={false}
              spiderfyOnMaxZoom
              maxClusterRadius={50}
              iconCreateFunction={clusterIcon}
            >
            {filtered.map((c) => {
              const isSelected = c.id === selectedId;
              return (
                <Marker
                  key={c.id}
                  position={[c.markerLat, c.markerLng]}
                  icon={sectorIcon(c.sector, colorFor(c.sector), isSelected)}
                  ref={(marker) => {
                    if (marker) {
                      markerRefs.current.set(c.id, marker);
                    } else {
                      markerRefs.current.delete(c.id);
                    }
                  }}
                  eventHandlers={{ click: () => selectAndScroll(c.id) }}
                  zIndexOffset={isSelected ? 1000 : 0}
                >
                  <Popup
                    maxWidth={320}
                    minWidth={280}
                    autoClose
                    closeOnClick
                    eventHandlers={{ remove: () => setSelectedId((current) => (current === c.id ? null : current)) }}
                  >
                    <div className="min-w-[260px] max-w-[300px]">
                      {c.photoUrl && (
                        <div className="relative -mx-3 -mt-3 mb-2 h-28 overflow-hidden rounded-t-md bg-utah-sky/20">
                          <img
                            src={c.photoUrl}
                            alt={c.name}
                            className="h-full w-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div
                            className="absolute -bottom-5 left-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white shadow"
                            style={{ background: colorFor(c.sector) }}
                          >
                            <span className="text-lg font-bold text-white">
                              {c.name.slice(0, 1).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className={`space-y-2 ${c.photoUrl ? 'pt-5' : ''}`}>
                        <div className="text-base font-bold leading-tight">{c.name}</div>

                        {c.description && (
                          <p className="text-xs leading-snug opacity-80">{c.description}</p>
                        )}

                        {c.address && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide opacity-50">Address</div>
                            <div className="text-xs">{c.address}</div>
                          </div>
                        )}

                        {(c.website || c.linkedin) && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide opacity-50">Links</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {c.website && (
                                <a
                                  href={c.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md border border-utah-stone/30 px-2 py-0.5 text-[11px]"
                                >
                                  Website
                                </a>
                              )}
                              {c.linkedin && (
                                <a
                                  href={c.linkedin}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md border border-utah-stone/30 px-2 py-0.5 text-[11px]"
                                >
                                  LinkedIn
                                </a>
                              )}
                              <Link
                                to={`/companies/${c.id}`}
                                className="rounded-md border border-utah-gold/40 px-2 py-0.5 text-[11px] text-utah-gold"
                              >
                                Full profile
                              </Link>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {c.stage && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wide opacity-50">Stage</div>
                              <div className="text-xs font-medium">{c.stage}</div>
                            </div>
                          )}
                          {c.employees && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wide opacity-50"># of Employees</div>
                              <div className="text-xs font-medium">{c.employees}</div>
                            </div>
                          )}
                          {c.sector && (
                            <div className="col-span-2">
                              <div className="text-[10px] uppercase tracking-wide opacity-50">Sector</div>
                              <div className="text-xs font-medium">{c.sector}</div>
                            </div>
                          )}
                        </div>

                        {c.address && <DirectionsActionSheet address={c.address} />}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
