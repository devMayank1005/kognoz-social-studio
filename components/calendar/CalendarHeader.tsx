"use client";

import React from "react";
import { C, FONT, DISPLAY_FONT } from "@/lib/tokens";
import type { CalendarViewMode } from "./types";

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectMonthYear: (year: number, month: number) => void;
  onOpenCreateModal: () => void;
  postedCount: number;
  totalCount: number;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

export function CalendarHeader({
  currentDate,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
  onSelectMonthYear,
  onOpenCreateModal,
  postedCount,
  totalCount
}: CalendarHeaderProps) {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const formattedMonthYear = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  // Years range for dropdown (-2 to +4 years)
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        paddingBottom: 16,
        borderBottom: `1px solid ${C.line}`,
        fontFamily: FONT
      }}
    >
      {/* Left: Month/Year Navigator & Today */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Prev / Next buttons */}
        <div style={{ display: "inline-flex", background: "#ffffff", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
          <button
            type="button"
            onClick={onPrev}
            title="Previous"
            style={{
              background: "transparent",
              border: "none",
              borderRight: `1px solid ${C.line}`,
              padding: "7px 12px",
              fontSize: 13,
              fontWeight: 700,
              color: C.ink,
              cursor: "pointer"
            }}
          >
            ◀
          </button>
          <button
            type="button"
            onClick={onNext}
            title="Next"
            style={{
              background: "transparent",
              border: "none",
              padding: "7px 12px",
              fontSize: 13,
              fontWeight: 700,
              color: C.ink,
              cursor: "pointer"
            }}
          >
            ▶
          </button>
        </div>

        {/* Month & Year Title with Selectors */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 22,
              fontWeight: 600,
              color: C.ink,
              margin: 0,
              letterSpacing: "-0.01em"
            }}
          >
            {formattedMonthYear}
          </h2>

          {/* Quick jump month/year selectors */}
          <select
            value={currentMonth}
            onChange={(e) => onSelectMonthYear(currentYear, Number(e.target.value))}
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 600,
              color: C.inkSoft,
              background: C.mist,
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              padding: "3px 6px",
              cursor: "pointer",
              outline: "none"
            }}
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={currentYear}
            onChange={(e) => onSelectMonthYear(Number(e.target.value), currentMonth)}
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 600,
              color: C.inkSoft,
              background: C.mist,
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              padding: "3px 6px",
              cursor: "pointer",
              outline: "none"
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Today button */}
        <button
          type="button"
          onClick={onToday}
          style={{
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 700,
            color: C.blue,
            background: C.mist,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: "6px 12px",
            cursor: "pointer"
          }}
        >
          Today
        </button>

        {/* Progress badge */}
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: C.inkSoft,
            background: "#ffffff",
            border: `1px solid ${C.line}`,
            padding: "4px 9px",
            borderRadius: 12
          }}
        >
          {postedCount} / {totalCount} posted
        </span>
      </div>

      {/* Right: View Switcher (Month | Week | List) & Create Content */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Segmented View Switcher */}
        <div
          style={{
            display: "inline-flex",
            background: C.mist,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: 3,
            gap: 2
          }}
        >
          {(["month", "week", "list"] as CalendarViewMode[]).map((mode) => {
            const isActive = viewMode === mode;
            const label = mode.charAt(0).toUpperCase() + mode.slice(1);
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? C.blue : C.inkSoft,
                  background: isActive ? "#ffffff" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 12px",
                  cursor: "pointer",
                  boxShadow: isActive ? "0 1px 3px rgba(0, 30, 60, 0.08)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Create Content Button */}
        <button
          type="button"
          onClick={onOpenCreateModal}
          style={{
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 700,
            color: "#ffffff",
            background: C.blue,
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 2px 8px rgba(0, 81, 132, 0.25)"
          }}
        >
          <span>+</span>
          <span>Create Content</span>
        </button>
      </div>
    </div>
  );
}
