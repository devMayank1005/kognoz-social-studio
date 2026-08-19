"use client";

import React, { useState } from "react";
import { C, FONT } from "@/lib/tokens";
import { ContentCard } from "./ContentCard";
import type { CalendarDayInfo } from "./calendarUtils";
import type { ContentItem, ContentStatus } from "./types";

interface CalendarDayCellProps {
  day: CalendarDayInfo;
  items: ContentItem[];
  onAddNew: (dateKey: string) => void;
  onEditItem: (item: ContentItem) => void;
  onStatusChange: (id: string, nextStatus: ContentStatus) => void;
  onDropItem: (itemId: string, targetDateKey: string) => void;
}

export function CalendarDayCell({
  day,
  items,
  onAddNew,
  onEditItem,
  onStatusChange,
  onDropItem
}: CalendarDayCellProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDragOver) setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const itemId = e.dataTransfer.getData("text/plain");
    if (itemId) {
      onDropItem(itemId, day.dateKey);
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        minHeight: 120,
        background: isDragOver
          ? "#EBF5FB"
          : day.isToday
          ? "#FDFEFE"
          : day.isCurrentMonth
          ? "#ffffff"
          : "#F8FAFC",
        border: isDragOver
          ? `2px dashed ${C.blue}`
          : day.isToday
          ? `2px solid ${C.blue}`
          : `1px solid ${C.line}`,
        borderRadius: 8,
        padding: "8px 8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        opacity: day.isCurrentMonth ? 1 : 0.6,
        transition: "background-color 0.15s ease, border-color 0.15s ease",
        position: "relative",
        boxSizing: "border-box"
      }}
    >
      {/* Day header: Number + Today indicator + Quick Add Button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: day.isToday ? 800 : day.isCurrentMonth ? 600 : 500,
              color: day.isToday ? "#ffffff" : day.isCurrentMonth ? C.ink : C.inkMute,
              background: day.isToday ? C.blue : "transparent",
              width: day.isToday ? 22 : "auto",
              height: day.isToday ? 22 : "auto",
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {day.dayNumber}
          </span>
          {day.isToday && (
            <span style={{ fontSize: 10, fontWeight: 700, color: C.blue, textTransform: "uppercase" }}>
              Today
            </span>
          )}
        </div>

        {/* Hover / Tap Add Button */}
        <button
          type="button"
          onClick={() => onAddNew(day.dateKey)}
          title={`Add content on ${day.dateKey}`}
          style={{
            background: isHovered ? C.mist : "transparent",
            color: C.blue,
            border: "none",
            borderRadius: 4,
            width: 22,
            height: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isHovered || day.isToday ? 1 : 0,
            transition: "all 0.15s ease"
          }}
        >
          +
        </button>
      </div>

      {/* Content items list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            onEdit={onEditItem}
            onStatusChange={onStatusChange}
            compact
          />
        ))}

        {items.length === 0 && isHovered && (
          <div
            onClick={() => onAddNew(day.dateKey)}
            style={{
              flex: 1,
              minHeight: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              color: C.inkMute,
              border: `1px dashed ${C.lineD}`,
              borderRadius: 6,
              cursor: "pointer",
              background: "#FAFCFD"
            }}
          >
            + Add content
          </div>
        )}
      </div>
    </div>
  );
}
