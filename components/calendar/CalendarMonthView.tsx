"use client";

import React, { useMemo } from "react";
import { C, FONT } from "@/lib/tokens";
import { CalendarDayCell } from "./CalendarDayCell";
import { getMonthMatrix, type CalendarDayInfo } from "./calendarUtils";
import type { ContentItem, ContentStatus } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarMonthViewProps {
  year: number;
  month: number;
  items: ContentItem[];
  onAddNew: (dateKey: string) => void;
  onEditItem: (item: ContentItem) => void;
  onStatusChange: (id: string, nextStatus: ContentStatus) => void;
  onDropItem: (itemId: string, targetDateKey: string) => void;
}

export function CalendarMonthView({
  year,
  month,
  items,
  onAddNew,
  onEditItem,
  onStatusChange,
  onDropItem
}: CalendarMonthViewProps) {
  const days: CalendarDayInfo[] = useMemo(() => getMonthMatrix(year, month), [year, month]);

  // Group items by dateKey
  const itemsByDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const item of items) {
      if (!item.date) continue;
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    }
    // Sort items within each day by time or title
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
      map.set(key, list);
    }
    return map;
  }, [items]);

  return (
    <div style={{ width: "100%", overflowX: "auto", paddingBottom: 16 }}>
      <div style={{ minWidth: 720, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Weekdays Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 8,
            padding: "0 2px"
          }}
        >
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              style={{
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 700,
                color: i === 0 || i === 6 ? C.inkMute : C.inkSoft,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                textAlign: "center",
                padding: "6px 0"
              }}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* 7-column Month Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: 8
          }}
        >
          {days.map((day) => (
            <CalendarDayCell
              key={day.dateKey}
              day={day}
              items={itemsByDate.get(day.dateKey) || []}
              onAddNew={onAddNew}
              onEditItem={onEditItem}
              onStatusChange={onStatusChange}
              onDropItem={onDropItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
