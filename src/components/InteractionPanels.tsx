import {
  BedDouble,
  BusFront,
  Building2,
  CarFront,
  Coffee,
  DoorOpen,
  Home,
  MessageCircle,
  Sparkles,
  Store,
  Tv,
  Users,
  Volume2,
} from 'lucide-react';
import { HudSnapshot } from '../engine/worldEngine';
import { ShopItem, VERIFIED_BUS_STOPS } from '../gis/landmarks';
import { ApartmentSpotKind } from '../sim/ameenCenter';

interface InteractionPanelsProps {
  hud: HudSnapshot;
  onPrimaryInteract: () => void;
  onSelectFloor: (floor: number) => void;
  onStepStairs: (delta: number) => void;
  onBuyItem: (item: ShopItem) => void;
  onMosqueAction: (action: 'shoes' | 'wudu' | 'pray') => void;
  onBoardBus: (destName: string, destX: number, destZ: number) => void;
  onTalkNpc: () => void;
  onTriggerSleep: () => void;
  onApartmentAction: (spotId: ApartmentSpotKind) => void;
}

export function InteractionPanels({
  hud,
  onPrimaryInteract,
  onSelectFloor,
  onStepStairs,
  onBuyItem,
  onMosqueAction,
  onBoardBus,
  onTalkNpc,
  onTriggerSleep,
  onApartmentAction,
}: InteractionPanelsProps) {
  const lm = hud.insideLandmark;
  const isInsideAmeenApt = lm?.id === 'amin_centre' && hud.currentFloor === 2;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-36 z-20 flex flex-col items-center gap-2 px-4 sm:bottom-5">
      {/* Live Spatial Bengali Vendor Voice Call Banner */}
      {hud.vendorVoice && (
        <div
          data-testid="vendor-dialogue-banner"
          className="max-w-md rounded-xl border border-amber-400/45 bg-[#1b140d]/95 px-4 py-2 text-[#f4f1ea] shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-amber-300">
            <span className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />
              {hud.vendorVoice.bengaliShopName} · {hud.vendorVoice.shopName}
            </span>
            <span className="font-mono-tabular text-[#d9c49e]">{hud.vendorVoice.distanceM} m</span>
          </div>
          <div className="mt-0.5 text-sm font-bold text-amber-200">
            “{hud.vendorVoice.line.bengaliText}”
          </div>
          <div className="mt-0.5 text-xs italic text-[#efe3cd]">
            “{hud.vendorVoice.line.romanized}” ·{' '}
            <span className="not-italic text-[#c7b392]">{hud.vendorVoice.line.englishMeaning}</span>
          </div>
        </div>
      )}

      {/* Proximity / Manual NPC Greeting Subtitle */}
      {hud.npcGreeting && (
        <div
          data-testid="npc-greeting-banner"
          className="max-w-md rounded-xl border border-emerald-400/35 bg-[#0c1a16]/94 px-4 py-2 text-[#f4f1ea] shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-emerald-300">
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              {hud.npcGreeting.roleLabel}
            </span>
            <span className="font-mono-tabular text-[#9ec4b8]">{hud.npcGreeting.distanceM} m</span>
          </div>
          <div className="mt-0.5 text-sm font-bold text-amber-200">{hud.npcGreeting.bengaliText}</div>
          <div className="mt-0.5 text-xs italic text-[#d5e5df]">
            “{hud.npcGreeting.romanized}” ·{' '}
            <span className="not-italic text-[#9db6ae]">{hud.npcGreeting.englishMeaning}</span>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {hud.toastMessage && (
        <div
          data-testid="hud-toast"
          className="rounded-lg border border-amber-300/30 bg-[#0e161d]/92 px-4 py-1.5 text-xs font-medium text-amber-200 shadow-lg"
        >
          {hud.toastMessage}
        </div>
      )}

      {/* Driving Speedometer, Current Gear, Reverse Indicator & Companion Strip */}
      {hud.isDriving && (
        <div
          data-testid="vehicle-hud-strip"
          className="pointer-events-auto hidden flex-wrap items-center justify-center gap-3 rounded-xl border border-white/15 bg-[#0e161d]/94 px-5 py-2.5 text-[#f4f1ea] shadow-xl sm:flex"
        >
          <CarFront className="h-5 w-5 text-amber-400" />
          <div className="flex items-baseline gap-1.5">
            <span data-testid="vehicle-speed-kmh" className="font-mono-tabular text-2xl font-bold text-white">
              {hud.speedKmh}
            </span>
            <span className="text-xs text-[#9fb0be]">km/h</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 font-mono-tabular text-xs font-bold">
            <span className="text-[#9fb0be]">GEAR</span>
            <span data-testid="vehicle-gear" className={hud.isReversing ? 'text-red-400' : 'text-amber-300'}>
              {hud.gear}
            </span>
          </div>

          {hud.isReversing && (
            <span
              data-testid="vehicle-reverse-badge"
              className="rounded bg-red-600 px-2 py-0.5 font-mono-tabular text-[11px] font-bold tracking-wider text-white"
            >
              REVERSE
            </span>
          )}

          <span className="text-xs text-[#cfd8e0]">
            · {hud.vehicleLabel} · <span className="text-teal-300">+ {hud.companionInfo.name}</span>
          </span>

          <button
            type="button"
            tabIndex={-1}
            data-testid="exit-vehicle-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onPrimaryInteract();
            }}
            className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#0f172a] hover:bg-amber-300 whitespace-nowrap"
          >
            Exit [E]
          </button>
        </div>
      )}

      {/* Nearby Interactive NPC Talk Button + Companion Indicator */}
      {!hud.isDriving && hud.nearbyTalkNpc && (
        <button
          type="button"
          tabIndex={-1}
          data-testid="npc-talk-btn"
          onClick={(e) => {
            e.currentTarget.blur();
            onTalkNpc();
          }}
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-[#0b231e]/94 px-4 py-2 text-xs font-bold text-emerald-100 shadow-xl hover:bg-[#11332c]"
        >
          <MessageCircle className="h-4 w-4 text-emerald-300" />
          <span>কথা বলুন · Talk to {hud.nearbyTalkNpc.roleLabel} [G/T]</span>
          <span className="font-mono-tabular text-[11px] text-emerald-300">({hud.nearbyTalkNpc.distanceM} m)</span>
        </button>
      )}

      {/* Floor 2 Private Home Apartment Interactive Controls (Sleep / TV / Kitchen / Bath / Desk / Storage) */}
      {!hud.isDriving && isInsideAmeenApt && (
        <div
          data-testid="ameen-apartment-panel"
          className="pointer-events-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 rounded-xl border border-sky-400/35 bg-[#0c1926]/95 px-4 py-2.5 text-white shadow-xl"
        >
          <div className="mr-1 flex items-center gap-1.5 text-xs font-bold text-sky-300">
            <Home className="h-4 w-4" />
            <span>My Home Apartment · আমিন সেন্টার ফ্লোর ২</span>
          </div>

          {hud.apartmentSpot && hud.apartmentSpot.id !== 'bed' && (
            <button
              type="button"
              tabIndex={-1}
              data-testid={`apt-spot-${hud.apartmentSpot.id}`}
              onClick={(e) => {
                e.currentTarget.blur();
                onApartmentAction(hud.apartmentSpot!.id);
              }}
              className="flex items-center gap-1.5 rounded-md bg-sky-400 px-3.5 py-1.5 text-xs font-bold text-[#08131d] hover:bg-sky-300"
            >
              <Tv className="h-3.5 w-3.5" />
              {hud.apartmentSpot.name} · {hud.apartmentSpot.actionLabel}
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            data-testid="sleep-action-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerSleep();
            }}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold shadow transition-colors ${
              hud.apartmentSpot?.id === 'bed'
                ? 'bg-amber-400 text-[#0f172a] hover:bg-amber-300'
                : 'border border-amber-300/45 bg-amber-400/15 text-amber-200 hover:bg-amber-400 hover:text-[#0f172a]'
            }`}
          >
            <BedDouble className="h-4 w-4" />
            {hud.apartmentSpot?.id === 'bed' ? 'SLEEP · ঘুমান (7.5h) [E]' : 'Sleep in Bed · ঘুমান'}
          </button>

          <span className="flex items-center gap-1 text-[11px] text-teal-300">
            <Users className="h-3.5 w-3.5" />
            {hud.companionInfo.name} ({hud.companionInfo.bengaliName}) · Sleeps: {hud.sleepCount}
          </span>
        </div>
      )}

      {/* Inside Mosque Daily Life Panel */}
      {!hud.isDriving && lm && lm.isMosque && (
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-[#0d1c18]/94 px-4 py-3 text-white shadow-xl">
          <div className="mr-2 flex flex-col">
            <span className="text-xs font-semibold text-emerald-300">{lm.bengaliName}</span>
            <span className="text-xs text-[#cbd7d3]">{lm.name}</span>
          </div>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onMosqueAction('shoes');
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              hud.shoesRemoved
                ? 'bg-emerald-500 text-[#0f172a]'
                : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {hud.shoesRemoved ? 'Shoes Removed ✓' : '1. Remove Shoes'}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onMosqueAction('wudu');
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              hud.wuduPerformed
                ? 'bg-sky-400 text-[#0f172a]'
                : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {hud.wuduPerformed ? 'Wudu Ready ✓' : '2. Perform Wudu'}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onMosqueAction('pray');
            }}
            className="flex items-center gap-1.5 rounded-md bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-[#0f172a] hover:bg-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            3. Offer Prayer ({hud.prayerCurrent})
          </button>
        </div>
      )}

      {/* Inside Elevator / Multi-Floor / Rooftop Building */}
      {!hud.isDriving && lm && !lm.isMosque && (lm.hasElevator || lm.hasRooftop) && (
        <div
          data-testid="building-floor-panel"
          className="pointer-events-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#0e161d]/94 px-4 py-2.5 text-white shadow-xl"
        >
          <Building2 className="h-4 w-4 text-amber-300" />
          <span className="text-xs font-semibold text-white">{lm.name}</span>
          <span className="font-mono-tabular text-xs text-amber-300">
            ·{' '}
            {hud.currentFloor === 0
              ? 'Ground'
              : hud.currentFloor === lm.floors
                ? 'Rooftop'
                : lm.id === 'amin_centre' && hud.currentFloor === 2
                  ? 'Floor 2 (Home)'
                  : `Floor ${hud.currentFloor}`}
          </span>

          {lm.hasElevator ? (
            <div className="flex flex-wrap items-center gap-1">
              {[0, 1, 2, Math.floor(lm.floors / 2), lm.floors - 1, lm.floors]
                .filter((v, i, arr) => v >= 0 && v <= lm.floors && arr.indexOf(v) === i)
                .map((fl) => (
                  <button
                    key={fl}
                    type="button"
                    tabIndex={-1}
                    data-testid={`elevator-floor-${fl}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectFloor(fl);
                    }}
                    className={`rounded px-2.5 py-1 font-mono-tabular text-xs font-semibold ${
                      hud.currentFloor === fl
                        ? 'bg-amber-400 text-[#0f172a]'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {fl === 0
                      ? 'G'
                      : fl === lm.floors
                        ? 'Roof'
                        : lm.id === 'amin_centre' && fl === 2
                          ? 'F2 Home'
                          : `F${fl}`}
                  </button>
                ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                disabled={hud.currentFloor <= 0}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStepStairs(-1);
                }}
                className="rounded bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20 disabled:opacity-35"
              >
                Stairs Down
              </button>
              <button
                type="button"
                tabIndex={-1}
                disabled={hud.currentFloor >= lm.floors}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStepStairs(1);
                }}
                className="rounded bg-amber-400 px-2.5 py-1 text-xs font-bold text-[#0f172a] hover:bg-amber-300 disabled:opacity-35"
              >
                Stairs Up / Roof
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inside Shop / Restaurant / Tea Stall Menu */}
      {!hud.isDriving && lm && lm.shopMenu && lm.shopMenu.length > 0 && (
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-[#121820]/94 px-4 py-2.5 text-white shadow-xl">
          <Coffee className="h-4 w-4 text-amber-300" />
          <span className="mr-1 text-xs font-semibold text-amber-200">{lm.bengaliName}</span>
          {lm.shopMenu.map((item) => (
            <button
              key={item.id}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onBuyItem(item);
              }}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-400 hover:text-[#0f172a]"
            >
              {item.name} · <span className="font-mono-tabular font-bold">৳{item.priceBdt}</span>
            </button>
          ))}
        </div>
      )}

      {/* Nearby Roadside Business, New Market Stall Counter, or Ameen Center Ground Shop (Bata/oppo/SAMSUNG/vivo/realme/itel) */}
      {!hud.isDriving && hud.nearbyShop && hud.nearbyShop.items.length > 0 && (
        <div
          data-testid="nearby-shop-panel"
          className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border border-amber-400/35 bg-[#121820]/94 px-4 py-2.5 text-white shadow-xl"
        >
          <Store className="h-4 w-4 text-amber-300" />
          <span className="mr-1 text-xs font-semibold text-amber-200">
            {hud.nearbyShop.bengaliName} · {hud.nearbyShop.name}
          </span>
          {hud.nearbyShop.items.map((item) => (
            <button
              key={item.id}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onBuyItem(item);
              }}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-400 hover:text-[#0f172a]"
            >
              {item.name} · <span className="font-mono-tabular font-bold">৳{item.priceBdt}</span>
            </button>
          ))}
        </div>
      )}

      {/* Outdoor Bus Stop Boarding Strip */}
      {!hud.isDriving && !lm && hud.prompt?.kind === 'bus_stop' && (
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-[#0e161d]/94 px-4 py-2.5 text-white shadow-xl">
          <BusFront className="h-4 w-4 text-sky-300" />
          <span className="text-xs font-semibold text-sky-200">{hud.prompt.title}</span>
          {VERIFIED_BUS_STOPS.filter((bs) => bs.id !== hud.prompt?.busStopId).map((bs) => (
            <button
              key={bs.id}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onBoardBus(bs.name, bs.x - 3, bs.z + 3);
              }}
              className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-[#08131d] hover:bg-sky-400"
            >
              Ride to {bs.name.replace(' Bus Stop', '').replace(' Bus Stand', '')} (৳15)
            </button>
          ))}
        </div>
      )}

      {/* Outdoor Door / Vehicle Quick Prompt */}
      {!hud.isDriving && !lm && hud.prompt && (hud.prompt.kind === 'door' || hud.prompt.kind === 'vehicle') && (
        <button
          type="button"
          tabIndex={-1}
          data-testid="primary-interact-btn"
          onClick={(e) => {
            e.currentTarget.blur();
            onPrimaryInteract();
          }}
          className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-amber-300/40 bg-[#0e161d]/94 px-4 py-2 text-xs font-semibold text-white shadow-xl hover:bg-[#182531]"
        >
          {hud.prompt.kind === 'door' ? (
            <DoorOpen className="h-4 w-4 text-amber-300" />
          ) : (
            <CarFront className="h-4 w-4 text-emerald-400" />
          )}
          <span className="text-amber-200">{hud.prompt.bengaliTitle}</span>
          <span>·</span>
          <span>{hud.prompt.actionLabel}</span>
        </button>
      )}
    </div>
  );
}
