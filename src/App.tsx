import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Download, Eye, Map, Pause, Smartphone, Volume2, VolumeX, X } from 'lucide-react';
import { LalkhanWorldEngine, GameModeState, HudSnapshot, MobileControlInput } from './engine/worldEngine';
import {
  CrowdDensity,
  WeatherMode,
  createInitialSaveData,
  formatChattogramClock,
} from './sim/worldState';
import { loadWorldProgress, resetWorldProgress, saveWorldProgress } from './sim/saveSystem';
import { getSurveyReport } from './gis/projection';
import { VERIFIED_LANDMARKS } from './gis/landmarks';
import { Minimap } from './components/Minimap';
import { WorldMapModal } from './components/WorldMapModal';
import { MobileControls } from './components/MobileControls';
import { PauseModal } from './components/PauseModal';
import { InteractionPanels } from './components/InteractionPanels';
import { NpcSpeechOverlay } from './components/NpcSpeechOverlay';
import { SleepOverlay } from './components/SleepOverlay';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<LalkhanWorldEngine | null>(null);

  const [mode, setMode] = useState<GameModeState>('title');
  const [mapOpen, setMapOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [weather, setWeather] = useState<WeatherMode>('clear');
  const [crowdDensity, setCrowdDensity] = useState<CrowdDensity>('medium');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<{ width: number; height: number; dataUrl: string } | null>(null);

  const survey = getSurveyReport();

  const updateGameState = useCallback((next: GameModeState) => {
    setMode(next);
    document.body.dataset.state = next;
    engineRef.current?.setMode(next);
  }, []);

  const handleStart = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    updateGameState('playing');
  }, [updateGameState]);

  useEffect(() => {
    const syncTouchControls = () => {
      const isTouch = window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768;
      setShowMobileControls(isTouch);
    };
    syncTouchControls();
    window.addEventListener('resize', syncTouchControls);

    const params = new URLSearchParams(window.location.search);
    const autoStart = params.get('autostart') === '1';
    document.body.dataset.state = autoStart ? 'playing' : 'title';

    let mounted = true;
    let engine: LalkhanWorldEngine | null = null;

    loadWorldProgress().then((saveData) => {
      if (!mounted || !canvasMountRef.current) return;
      setWeather(saveData.weather);
      setCrowdDensity(saveData.crowdDensity);

      engine = new LalkhanWorldEngine(
        canvasMountRef.current,
        saveData,
        (snap) => setHud(snap),
        (data) => void saveWorldProgress(data)
      );
      engineRef.current = engine;

      if (autoStart) {
        setMode('playing');
        engine.setMode('playing');
      } else {
        setMode('title');
        engine.setMode('title');
      }
    });

    return () => {
      mounted = false;
      window.removeEventListener('resize', syncTouchControls);
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Global keyboard shortcuts for Title -> Playing, Map [M], Pause [Esc / P], Mute [KeyN/Btn]
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStart();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (mapOpen) {
          setMapOpen(false);
          updateGameState('playing');
        } else if (mode === 'playing') {
          updateGameState('paused');
        } else if (mode === 'paused') {
          updateGameState('playing');
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setMapOpen((prev) => {
          const next = !prev;
          updateGameState(next ? 'paused' : 'playing');
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, mapOpen, handleStart, updateGameState]);

  const handleUpdateMobileInput = useCallback((patch: Partial<MobileControlInput>) => {
    if (!engineRef.current) return;
    Object.assign(engineRef.current.mobileInput, patch);
  }, []);

  const handleCaptureSnapshot = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const snap = eng.capturePhotoSnapshot();
    setLastSnapshot(snap);
    const a = document.createElement('a');
    a.href = snap.dataUrl;
    a.download = `lalkhan-bazar-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleResetWorld = useCallback(async () => {
    const fresh = await resetWorldProgress();
    setWeather(fresh.weather);
    setCrowdDensity(fresh.crowdDensity);
    engineRef.current?.resetPlayerPosition(fresh);
    updateGameState('playing');
  }, [updateGameState]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0e141b]">
      {/* Isolated WebGL Canvas Mount (Never unmounted by React HUD updates) */}
      <div ref={canvasMountRef} data-testid="world-canvas-mount" className="h-full w-full" />

      {/* TITLE SCREEN OVERLAY */}
      {mode === 'title' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-6 sm:p-10">
          {/* Calm left-aligned editorial scrim & bespoke SVG lockup */}
          <div className="max-w-xl rounded-2xl bg-[#0b1219]/82 p-7 shadow-2xl border border-[#d6cfc2]/15 pointer-events-auto">
            {/* Bespoke Inline SVG Title Emblem: Chattogram Hills + Elevated Flyover Arch + Mosque Crescent */}
            <svg
              viewBox="0 0 410 62"
              className="mb-3 h-12 w-auto max-w-full"
              aria-label="Lalkhan Bazar Chattogram Emblem"
            >
              <path
                d="M6 48 Q42 12 88 38 Q128 16 172 48"
                fill="none"
                stroke="#34d399"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M10 46 Q95 26 196 42 L245 42"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <line x1="68" y1="36" x2="68" y2="52" stroke="#d6cfc2" strokeWidth="3" />
              <line x1="128" y1="34" x2="128" y2="52" stroke="#d6cfc2" strokeWidth="3" />
              <line x1="186" y1="40" x2="186" y2="52" stroke="#d6cfc2" strokeWidth="3" />
              <path
                d="M218 22 A9 9 0 1 0 227 33 A7 7 0 1 1 218 22 Z"
                fill="#f59e0b"
              />
              <text
                x="248"
                y="34"
                fill="#f4f1ea"
                fontFamily="Outfit, sans-serif"
                fontSize="13"
                fontWeight="700"
                letterSpacing="2"
              >
                WARD 14
              </text>
              <text
                x="248"
                y="49"
                fill="#9fb0be"
                fontFamily="JetBrains Mono, monospace"
                fontSize="10"
              >
                22.3504°N · 91.8168°E
              </text>
            </svg>

            <h1 className="font-display text-4xl font-bold tracking-tight text-[#f4f1ea] sm:text-5xl text-balance">
              Lalkhan Bazar
            </h1>
            <p className="mt-1 font-display text-lg font-medium text-amber-300">
              লালখান বাজার · Chattogram Real-Life Open World
            </p>

            <p className="mt-4 font-mono-tabular text-xs leading-relaxed text-[#c6d1db]">
              {survey.mappedAreaSqKm} km² (1:1 UTM) · {survey.ewExtentM}×{survey.nsExtentM} m ·{' '}
              {survey.totalRoadLengthKm} km Roads · {survey.mappedBuildings.toLocaleString()} Buildings ·{' '}
              {survey.elevationMinM}–{survey.elevationMaxM} m SRTM Hills
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={handleStart}
                className="rounded-lg bg-amber-400 px-6 py-3 font-display text-base font-bold text-[#0f172a] shadow-lg transition-transform hover:bg-amber-300 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
              >
                Enter Lalkhan Bazar
              </button>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-[#e6ecf2] hover:bg-white/15"
              >
                GIS Survey & Map
              </button>
            </div>
          </div>

          {/* Single flat control hint line */}
          <div className="mx-auto rounded-lg border border-white/10 bg-[#0b1219]/82 px-4 py-1.5 text-center text-xs font-medium tracking-wide text-[#e8e3d9] shadow">
            WASD Move · Mouse Drag Look · Shift Run · Space Jump · E Interact / Drive · G Greet · V Camera · F Photo · M Map · Esc Pause
          </div>
        </div>
      )}

      {/* PLAYING HUD OVERLAY (hidden cleanly during Photo Mode) */}
      {mode === 'playing' && hud && !hud.photoMode && (
        <div className="pointer-events-none fixed inset-0 z-10">
          {/* Top-Left Compact Location & Daily Life Cluster */}
          <div className="absolute top-3 left-3 max-w-[calc(100vw-134px)] rounded-xl border border-[#d6cfc2]/20 bg-[#0e161d]/90 px-3 py-2 text-[#f4f1ea] shadow-lg sm:top-4 sm:left-4 sm:max-w-[330px] sm:px-4 sm:py-2.5">
            <div className="flex items-baseline justify-between gap-2 sm:gap-3">
              <span className="truncate font-display text-xs font-bold text-amber-300 sm:text-sm">
                {hud.zoneName}
              </span>
              <span className="shrink-0 font-mono-tabular text-[11px] text-[#9fb0be] sm:text-xs">
                {hud.elevationASL}m ASL
              </span>
            </div>
            <div className="truncate text-[11px] text-[#d6dfe7] sm:text-xs">
              {hud.streetName} · <span className="capitalize text-emerald-300/90">{hud.groundSurface}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono-tabular text-[10px] text-[#aebcc8] sm:mt-1.5 sm:text-[11px]">
              <span>{formatChattogramClock(hud.timeOfDay)}</span>
              <span>·</span>
              <span className="text-sky-300">{hud.weatherLabel}</span>
              <span>·</span>
              <span className={hud.isAdhanWindow ? 'font-semibold text-emerald-300' : ''}>
                Next {hud.prayerNext} {hud.prayerNextTime}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2.5 border-t border-white/10 pt-1 font-mono-tabular text-[11px] sm:mt-1.5 sm:gap-3 sm:pt-1.5 sm:text-xs">
              <span className="font-semibold text-emerald-300">৳{hud.walletBdt}</span>
              <span className="text-[#cbd5df]">Energy {hud.energy}%</span>
              <span className="text-teal-300">+ {hud.companionInfo.name}</span>
              <span className="hidden text-[#9cb0c0] sm:inline">
                Visited {hud.visitedCount}/{VERIFIED_LANDMARKS.length}
              </span>
            </div>
          </div>

          {/* Top-Right Real-Scale Minimap + Utility Icon Buttons */}
          <div className="pointer-events-auto absolute top-3 right-3 z-30 flex flex-col items-end gap-1.5 sm:top-4 sm:right-4 sm:gap-2">
            <Minimap
              playerX={hud.x}
              playerZ={hud.z}
              playerYaw={hud.yaw}
              onOpenFullMap={() => {
                setMapOpen(true);
                updateGameState('paused');
              }}
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                title="Switch 3rd / 1st Person Camera [V]"
                aria-label="Toggle camera view"
                onClick={(e) => {
                  e.currentTarget.blur();
                  engineRef.current?.toggleCameraMode();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-[#0e161d]/90 text-white hover:bg-[#192633]"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                title="Photo Mode (Hide HUD & Film Grain) [F]"
                aria-label="Toggle Photo Mode"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setLastSnapshot(null);
                  engineRef.current?.togglePhotoMode();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-[#0e161d]/90 text-white hover:bg-[#192633]"
              >
                <Camera className="h-4 w-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                title="Toggle On-Screen Touch Controls"
                aria-label="Toggle mobile controls"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setShowMobileControls((v) => !v);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-md border border-white/15 ${
                  showMobileControls ? 'bg-amber-400 text-[#0f172a]' : 'bg-[#0e161d]/90 text-white hover:bg-[#192633]'
                }`}
              >
                <Smartphone className="h-4 w-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                title="Open Full Map [M]"
                aria-label="Open full map"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMapOpen(true);
                  updateGameState('paused');
                }}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-[#0e161d]/90 text-white hover:bg-[#192633]"
              >
                <Map className="h-4 w-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                title="Mute / Unmute Audio"
                aria-label="Toggle audio mute"
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (engineRef.current) setMuted(engineRef.current.toggleMute());
                }}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-[#0e161d]/90 text-white hover:bg-[#192633]"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                tabIndex={-1}
                title="Pause & Settings [Esc]"
                aria-label="Pause simulation"
                onClick={(e) => {
                  e.currentTarget.blur();
                  updateGameState('paused');
                }}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-[#0e161d]/90 text-white hover:bg-[#192633]"
              >
                <Pause className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Floating 2D Screen-Projected Bangla Speech Bubbles above NPCs & Companion */}
          <NpcSpeechOverlay bubbles={hud.speechBubbles} />

          {/* Contextual Action Panels */}
          <InteractionPanels
            hud={hud}
            onPrimaryInteract={() => engineRef.current?.triggerPrimaryInteract()}
            onSelectFloor={(f) => engineRef.current?.setElevatorFloor(f)}
            onStepStairs={(d) => engineRef.current?.climbStairsFloor(d)}
            onBuyItem={(item) => engineRef.current?.buyShopItem(item)}
            onMosqueAction={(act) => engineRef.current?.performMosqueAction(act)}
            onBoardBus={(destName, dx, dz) => engineRef.current?.boardBusRide(destName, dx, dz)}
            onTalkNpc={() => engineRef.current?.triggerTalkWithNearbyNpc()}
            onTriggerSleep={() => engineRef.current?.triggerSleep(7.5)}
            onApartmentAction={(spotId) => engineRef.current?.interactApartmentSpot(spotId)}
          />

          {/* Mobile Touch Controls & Dedicated Vehicle Driving Controls */}
          {(showMobileControls || hud.isDriving) && (
            <MobileControls
              isDriving={hud.isDriving}
              hasPrompt={Boolean(hud.prompt)}
              hasTalkNpc={Boolean(hud.nearbyTalkNpc)}
              gear={hud.gear}
              isReversing={hud.isReversing}
              speedKmh={hud.speedKmh}
              onUpdateInput={handleUpdateMobileInput}
              onRotateCamera={(dy, dp) => engineRef.current?.rotateCameraBy(dy, dp)}
              onInteract={() => engineRef.current?.triggerPrimaryInteract()}
              onTalkNpc={() => engineRef.current?.triggerTalkWithNearbyNpc()}
              onOpenMap={() => {
                setMapOpen(true);
                updateGameState('paused');
              }}
              onPause={() => updateGameState('paused')}
            />
          )}
        </div>
      )}

      {/* SLEEP SEQUENCE BLACK FADE & LOADING SCREEN */}
      {mode === 'playing' && hud && (
        <SleepOverlay
          active={hud.sleepOverlay.active}
          fadeOpacity={hud.sleepOverlay.fadeOpacity}
          progress={hud.sleepOverlay.progress}
          phase={hud.sleepOverlay.phase}
          hours={hud.sleepOverlay.hours}
        />
      )}

      {/* PHOTO MODE MINIMAL SHUTTER BAR */}
      {mode === 'playing' && hud?.photoMode && (
        <div
          data-testid="photo-mode-bar"
          className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex flex-col items-center gap-2 px-4"
        >
          {lastSnapshot && (
            <div
              data-testid="photo-saved-badge"
              className="pointer-events-auto flex items-center gap-2 rounded-lg border border-emerald-400/35 bg-[#0c1a16]/94 px-3 py-1.5 font-mono-tabular text-xs text-emerald-200 shadow-lg"
            >
              <span>Saved {lastSnapshot.width}×{lastSnapshot.height} PNG</span>
              <a
                href={lastSnapshot.dataUrl}
                download={`lalkhan-bazar-${lastSnapshot.width}x${lastSnapshot.height}.png`}
                className="flex items-center gap-1 rounded bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-[#08131d] hover:bg-emerald-400"
              >
                <Download className="h-3 w-3" />
                Download
              </a>
            </div>
          )}
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/15 bg-[#0e161d]/92 px-4 py-2 text-xs text-[#f4f1ea] shadow-xl">
            <span className="font-mono-tabular text-[11px] text-amber-300">35mm Film Grain</span>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Save high-resolution snapshot"
              onClick={(e) => {
                e.currentTarget.blur();
                handleCaptureSnapshot();
              }}
              className="flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#0f172a] hover:bg-amber-300"
            >
              <Camera className="h-3.5 w-3.5" />
              Save Snapshot
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Exit Photo Mode"
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.setPhotoMode(false);
              }}
              className="flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
              Exit [F]
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {mode === 'paused' && !mapOpen && hud && (
        <PauseModal
          timeOfDay={hud.timeOfDay}
          weather={hud.weather}
          weatherAuto={hud.weatherAuto}
          weatherLabel={hud.weatherLabel}
          clockSpeed={hud.clockSpeed}
          crowdDensity={crowdDensity}
          onResume={() => updateGameState('playing')}
          onSetTime={(h) => engineRef.current?.setTimeOfDay(h)}
          onSetWeather={(w) => {
            setWeather(w);
            engineRef.current?.setWeather(w);
          }}
          onSetWeatherAuto={(auto) => engineRef.current?.setWeatherAuto(auto)}
          onSetClockSpeed={(spd) => engineRef.current?.setClockSpeed(spd)}
          onSetCrowd={(d) => {
            setCrowdDensity(d);
            engineRef.current?.setCrowdDensity(d);
          }}
          onOpenMap={() => setMapOpen(true)}
          onResetWorld={handleResetWorld}
          onReturnTitle={() => updateGameState('title')}
        />
      )}

      {/* FULL INTERACTIVE GIS MAP, SURVEY & EXPANSION MODAL */}
      {mapOpen && (
        <WorldMapModal
          playerX={hud ? hud.x : createInitialSaveData().x}
          playerZ={hud ? hud.z : createInitialSaveData().z}
          onFastTravel={(x, z, label, yaw) => {
            engineRef.current?.fastTravelTo(x, z, label, yaw);
            setMapOpen(false);
            updateGameState('playing');
          }}
          onClose={() => {
            setMapOpen(false);
            if (mode !== 'title') updateGameState('playing');
          }}
        />
      )}
    </div>
  );
}
