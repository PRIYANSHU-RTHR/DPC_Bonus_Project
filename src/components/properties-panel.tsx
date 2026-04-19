'use client';

/**
 * Properties Panel — Right-side panel for tool settings and detected spikes
 */

import React from 'react';
import {
  Target,
  Trash2,
  ChevronDown,
  ChevronUp,
  Grid3x3,
  ScanLine,
  Layers,
  FileText,
  Columns3,
  Wand2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useToolStore,
  useDetectionStore,
  useImageStore,
  useMaskStore,
  useUIStore,
} from '@/lib/stores';
import { presets as presetList } from '@/lib/presets';
import { runInverseFFT } from '@/lib/pipeline';
import { applyCircularBrush } from '@/lib/mask-engine';
import { cn } from '@/lib/utils';

const presetIconMap: Record<string, React.ElementType> = {
  Grid3x3,
  ScanLine,
  Layers,
  FileText,
  Columns3,
  Sparkles: Wand2,
};

export function PropertiesPanel() {
  const activeTool = useToolStore((s) => s.activeTool);
  const spectrum = useImageStore((s) => s.spectrum);
  const [spikesOpen, setSpikesOpen] = React.useState(true);
  const [presetsOpen, setPresetsOpen] = React.useState(true);

  if (!spectrum) return null;

  return (
    <div className="w-64 bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-y-auto shrink-0">
      {/* Tool Properties Section */}
      <div className="p-3">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          Tool Properties
        </h3>
        {activeTool === 'brush' && <BrushProps />}
        {activeTool === 'star' && <StarBrushProps />}
        {activeTool === 'eraser' && <EraserProps />}
        {activeTool === 'notch' && <NotchProps />}
        {activeTool === 'directional' && <DirectionalProps />}
        {activeTool === 'bandstop' && <BandStopProps />}
        {activeTool === 'pan' && (
          <p className="text-xs text-neutral-500">Click and drag to pan. Scroll to zoom.</p>
        )}
      </div>

      <Separator className="bg-neutral-800" />

      {/* Intensity Slider */}
      <div className="p-3">
        <SliderField
          label="Blend Intensity"
          value={useToolStore.getState().intensity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => useToolStore.getState().setIntensity(v)}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </div>

      <Separator className="bg-neutral-800" />

      {/* Presets Section */}
      <div className="p-3">
        <button
          className="flex items-center justify-between w-full text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2"
          onClick={() => setPresetsOpen(!presetsOpen)}
        >
          <span>Presets</span>
          {presetsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {presetsOpen && <PresetButtons />}
      </div>

      <Separator className="bg-neutral-800" />

      {/* Detected Spikes Section */}
      <div className="p-3 flex-1">
        <button
          className="flex items-center justify-between w-full text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2"
          onClick={() => setSpikesOpen(!spikesOpen)}
        >
          <span>Detected Peaks</span>
          {spikesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {spikesOpen && <SpikeList />}
      </div>
    </div>
  );
}

// --- Slider Field Component ---
function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const [localValue, setLocalValue] = React.useState(value);
  
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs text-neutral-300">{label}</Label>
        <span className="text-[10px] text-neutral-500 font-mono">
          {format ? format(localValue) : localValue.toFixed(2)}
        </span>
      </div>
      <Slider
        value={localValue}
        min={min}
        max={max}
        step={step}
        onValueChange={(v: number) => { setLocalValue(v); onChange(v); }}
        className="w-full"
      />
    </div>
  );
}

// --- Tool-specific property panels ---

function BrushProps() {
  const { brushRadius, brushSoftness, setBrushRadius, setBrushSoftness } = useToolStore();
  return (
    <>
      <SliderField label="Radius" value={brushRadius} min={2} max={60} step={1} onChange={setBrushRadius} format={(v) => `${v}px`} />
      <SliderField label="Softness" value={brushSoftness} min={0} max={1} step={0.05} onChange={setBrushSoftness} format={(v) => `${Math.round(v * 100)}%`} />
    </>
  );
}

function StarBrushProps() {
  const { starArms, starArmWidth, starRadius, starSoftness, setStarArms, setStarArmWidth, setStarRadius, setStarSoftness } = useToolStore();
  return (
    <>
      <div className="mb-3">
        <Label className="text-xs text-neutral-300 mb-1.5 block">Arms</Label>
        <div className="flex gap-1">
          {[4, 6, 8, 12].map((n) => (
            <Button
              key={n}
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 text-xs',
                starArms === n ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
              )}
              onClick={() => setStarArms(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>
      <SliderField label="Radius" value={starRadius} min={10} max={120} step={1} onChange={setStarRadius} format={(v) => `${v}px`} />
      <SliderField label="Arm Width" value={starArmWidth} min={0.03} max={0.5} step={0.01} onChange={setStarArmWidth} format={(v) => `${(v * (180/Math.PI)).toFixed(1)} deg`} />
      <SliderField label="Softness" value={starSoftness} min={0} max={1} step={0.05} onChange={setStarSoftness} format={(v) => `${Math.round(v * 100)}%`} />
    </>
  );
}

function EraserProps() {
  const { brushRadius, brushSoftness, setBrushRadius, setBrushSoftness } = useToolStore();
  return (
    <>
      <SliderField label="Radius" value={brushRadius} min={2} max={60} step={1} onChange={setBrushRadius} format={(v) => `${v}px`} />
      <SliderField label="Softness" value={brushSoftness} min={0} max={1} step={0.05} onChange={setBrushSoftness} format={(v) => `${Math.round(v * 100)}%`} />
    </>
  );
}

function NotchProps() {
  const { notchRadius, setNotchRadius } = useToolStore();
  return (
    <>
      <SliderField label="Radius" value={notchRadius} min={3} max={30} step={1} onChange={setNotchRadius} format={(v) => `${v}px`} />
      <p className="text-[10px] text-neutral-500 mt-1">Click a peak to place a notch filter. Symmetric filter applied automatically.</p>
    </>
  );
}

function DirectionalProps() {
  const { directionalAngle, directionalWidth, setDirectionalAngle, setDirectionalWidth } = useToolStore();
  return (
    <>
      <SliderField label="Angle" value={directionalAngle} min={0} max={Math.PI} step={0.01} onChange={setDirectionalAngle} format={(v) => `${Math.round(v * (180 / Math.PI))} deg`} />
      <SliderField label="Width" value={directionalWidth} min={0.02} max={0.5} step={0.01} onChange={setDirectionalWidth} format={(v) => `${(v * (180/Math.PI)).toFixed(1)} deg`} />
    </>
  );
}

function BandStopProps() {
  const { bandInner, bandOuter, setBandInner, setBandOuter } = useToolStore();
  return (
    <>
      <SliderField label="Inner Radius" value={bandInner} min={5} max={300} step={1} onChange={setBandInner} format={(v) => `${v}px`} />
      <SliderField label="Outer Radius" value={bandOuter} min={10} max={400} step={1} onChange={setBandOuter} format={(v) => `${v}px`} />
    </>
  );
}

// --- Preset Buttons ---
function PresetButtons() {
  const mask = useMaskStore((s) => s.mask);
  const spectrum = useImageStore((s) => s.spectrum);
  const pushHistory = useMaskStore((s) => s.pushHistory);
  const setMask = useMaskStore((s) => s.setMask);

  const handlePreset = async (presetId: string) => {
    if (!mask || !spectrum) return;
    const preset = presetList.find((p) => p.id === presetId);
    if (!preset) return;

    pushHistory();
    const newMask = new Float32Array(mask);
    preset.apply(newMask, spectrum.magnitude, spectrum.fftWidth, spectrum.fftHeight);
    setMask(newMask);

    try {
      await runInverseFFT();
    } catch (e) {
      console.error('IFFT failed:', e);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {presetList.map((p) => {
        const Icon = presetIconMap[p.icon] || Target;
        return (
          <Tooltip key={p.id} delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-2 px-2 flex flex-col items-center gap-1 text-neutral-400 hover:text-white hover:bg-neutral-800"
                onClick={() => handlePreset(p.id)}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] leading-tight text-center">{p.name}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{p.description}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// --- Spike List ---
function SpikeList() {
  const spikes = useDetectionStore((s) => s.spikes);
  const mask = useMaskStore((s) => s.mask);
  const spectrum = useImageStore((s) => s.spectrum);
  const pushHistory = useMaskStore((s) => s.pushHistory);
  const setMask = useMaskStore((s) => s.setMask);

  if (spikes.length === 0) {
    return <p className="text-[10px] text-neutral-500">No peaks detected.</p>;
  }

  const removeSpike = async (spike: typeof spikes[0]) => {
    if (!mask || !spectrum) return;
    pushHistory();
    const newMask = new Float32Array(mask);
    applyCircularBrush(newMask, spectrum.fftWidth, spectrum.fftHeight, spike.x, spike.y, 8, 0.5, false);
    setMask(newMask);
    try { await runInverseFFT(); } catch (_e) { /* handled */ }
  };

  const removeAll = async () => {
    if (!mask || !spectrum) return;
    pushHistory();
    const newMask = new Float32Array(mask);
    for (const spike of spikes) {
      applyCircularBrush(newMask, spectrum.fftWidth, spectrum.fftHeight, spike.x, spike.y, 8, 0.5, false);
    }
    setMask(newMask);
    try { await runInverseFFT(); } catch (_e) { /* handled */ }
  };

  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs text-neutral-400 hover:text-white justify-start gap-2"
        onClick={removeAll}
      >
        <Trash2 className="h-3 w-3" />
        Remove All ({spikes.length})
      </Button>
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {spikes.map((spike, i) => (
          <button
            key={i}
            className="flex items-center gap-2 w-full px-2 py-1 rounded text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            onClick={() => removeSpike(spike)}
          >
            <Target className="h-3 w-3 text-cyan-500 shrink-0" />
            <span className="truncate flex-1 text-left">{spike.label}</span>
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-neutral-800">
              {(spike.intensity * 100).toFixed(0)}%
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
