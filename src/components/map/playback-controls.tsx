"use client";

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";

/* ── Props ─────────────────────────────────────────────── */

interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: number;
  progress: number; // 0–1
  currentTime: string; // formatted
  totalTime: string;   // formatted
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (progress: number) => void;
  onSkipStart: () => void;
  onSkipEnd: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onClose: () => void;
}

const SPEEDS = [1, 2, 4, 8, 16];

/* ── Component ─────────────────────────────────────────── */

export function PlaybackControls({
  isPlaying,
  speed,
  progress,
  currentTime,
  totalTime,
  onPlayPause,
  onSpeedChange,
  onSeek,
  onSkipStart,
  onSkipEnd,
  onStepBack,
  onStepForward,
  onClose,
}: PlaybackControlsProps) {
  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-[#E2E8F0] px-4 py-3 flex items-center gap-3 select-none">
      {/* Transport Buttons */}
      <div className="flex items-center gap-1">
        <ControlBtn onClick={onSkipStart} title="Go to start">
          <SkipBack className="w-3.5 h-3.5" />
        </ControlBtn>
        <ControlBtn onClick={onStepBack} title="Step back">
          <ChevronsLeft className="w-3.5 h-3.5" />
        </ControlBtn>

        <button
          onClick={onPlayPause}
          title={isPlaying ? "Pause" : "Play"}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        <ControlBtn onClick={onStepForward} title="Step forward">
          <ChevronsRight className="w-3.5 h-3.5" />
        </ControlBtn>
        <ControlBtn onClick={onSkipEnd} title="Go to end">
          <SkipForward className="w-3.5 h-3.5" />
        </ControlBtn>
      </div>

      {/* Speed Selector */}
      <div className="flex items-center gap-0.5 bg-[#F1F5F9] rounded-lg p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
              speed === s
                ? "bg-[#2563EB] text-white"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <span className="text-[11px] font-mono text-[#64748B] w-[42px] text-right">
          {currentTime}
        </span>

        <div
          className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full cursor-pointer relative group"
          onClick={handleBarClick}
        >
          {/* Filled track */}
          <div
            className="absolute top-0 left-0 h-full bg-[#2563EB] rounded-full transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#2563EB] rounded-full shadow-sm border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress * 100}% - 6px)` }}
          />
        </div>

        <span className="text-[11px] font-mono text-[#94A3B8] w-[42px]">
          {totalTime}
        </span>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="p-1 hover:bg-[#F1F5F9] rounded-lg transition-colors ml-1"
        title="Close playback"
      >
        <X className="w-3.5 h-3.5 text-[#64748B]" />
      </button>
    </div>
  );
}

/* ── Small icon button ─────────────────────────────────── */

function ControlBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
    >
      {children}
    </button>
  );
}
