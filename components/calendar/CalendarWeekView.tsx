"use client";

import React, { useMemo } from "react";
import { C, FONT } from "@/lib/tokens";
import { ContentCard } from "./ContentCard";
import { getWeekDays, type CalendarDayInfo } from "./calendarUtils";
import type { ContentItem, ContentStatus } from "./types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface CalendarWeekViewProps {
  currentDate: Date;
  items: ContentItem[];
  onAddNew: (dateKey: string) => void;
  onEditItem: (item: ContentItem) => void;
  onStatusChange: (id: string, nextStatus: ContentStatus) => void;
  onDropItem: (itemId: string, targetDateKey: string) => void;
}

export function CalendarWeekView({
  currentDate,
  items,
  onAddNew,
  onEditItem,
  onStatusChange,
  onDropItem
}: CalendarWeekViewProps) {
  const weekDays: CalendarDayInfo[] = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const item of items) {
      if (!item.date) continue;
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
      map.set(key, list);
    }
    return map;
  }, [items]);

  return (
    <div style={{ width: "100%", overflowX: "auto", paddingBottom: 16 }}>
      <div
        style={{
          minWidth: 840,
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 10
        }}
      >
        {weekDays.map((day, idx) => {
          const dayItems = itemsByDate.get(day.dateKey) || [];

          function handleDragOver(e: React.DragEvent) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }

          function handleDrop(e: React.DragEvent) {
            e.preventDefault();
            const itemId = e.dataTransfer.getData("text/plain");
            if (itemId) onDropItem(itemId, day.dateKey);
          }

          return (
            <div
              key={day.dateKey}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                background: day.isToday ? "#F8FCFF" : "#ffffff",
                border: day.isToday ? `2px solid ${C.blue}` : `1px solid ${C.line}`,
                borderRadius: 10,
                padding: "12px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 380,
                boxSizing: "border-box"
              }}
            >
              {/* Day Header */}
              <div style={{ paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.inkMute }}>
                    {WEEKDAYS[idx].slice(0, 3)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAddNew(day.dateKey)}
                    title={`Add content on ${day.dateKey}`}
                    style={{
                      background: C.mist,
                      color: C.blue,
                      border: "none",
                      borderRadius: 4,
                      width: 20,
                      height: 20,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    +
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span
                    style={{
                      fontFamily: FONT,
                      fontSize: 16,
                      fontWeight: day.isToday ? 800 : 700,
                      color: day.isToday ? C.blue : C.ink
                    }}
                  >
                    {day.dayNumber}
                  </span>
                  {day.isToday && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.blue, background: "#EAF1F4", padding: "1px 5px", borderRadius: 4 }}>
                      Today
                    </span>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                {dayItems.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    onEdit={onEditItem}
                    onStatusChange={onStatusChange}
                  />
                ))}

                {dayItems.length === 0 && (
                  <div
                    onClick={() => onAddNew(day.dateKey)}
                    style={{
                      flex: 1,
                      minHeight: 60,
                      border: `1px dashed ${C.lineD}`,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11.5,
                      color: C.inkMute,
                      cursor: "pointer",
                      background: "#FAFCFD"
                    }}
                  >
                    + Schedule
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
