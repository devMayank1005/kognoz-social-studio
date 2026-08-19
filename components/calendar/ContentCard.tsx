"use client";

import React from "react";
import { C, FONT } from "@/lib/tokens";
import { STUDIO_FORMATS } from "@/lib/formats";
import {
  STATUS_CONFIG,
  STATUS_NEXT,
  PLATFORMS,
  PILLAR_COLORS,
  type ContentItem,
  type ContentStatus
} from "./types";

interface ContentCardProps {
  item: ContentItem;
  onEdit: (item: ContentItem) => void;
  onStatusChange: (id: string, nextStatus: ContentStatus) => void;
  compact?: boolean;
}

export function ContentCard({ item, onEdit, onStatusChange, compact = false }: ContentCardProps) {
  const isStudioFmt = (STUDIO_FORMATS as readonly string[]).includes(item.contentType);
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.Draft;
  const platformCfg = PLATFORMS.find((p) => p.id === item.platform) || {
    label: item.platform,
    color: C.inkSoft,
    bg: C.mist
  };
  const pillarCol = PILLAR_COLORS[item.pillar] || C.blue;

  function createStudioHref(): string {
    const p = new URLSearchParams({
      topic: item.topic || item.title,
      format: item.contentType,
      pillar: item.pillar,
      n: String(item.n || item.id)
    });
    if (item.set) p.set("set", item.set);
    if (item.style) p.set("style", item.style);
    return `/?${p.toString()}`;
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleStatusCycle(e: React.MouseEvent) {
    e.stopPropagation();
    const next = STATUS_NEXT[item.status] || "Draft";
    onStatusChange(item.id, next);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onEdit(item)}
      style={{
        background: "#ffffff",
        border: `1px solid ${C.line}`,
        borderRadius: 8,
        padding: compact ? "6px 8px" : "8px 10px",
        fontSize: 12,
        fontFamily: FONT,
        cursor: "grab",
        boxShadow: "0 1px 3px rgba(0, 30, 60, 0.05)",
        transition: "all 0.15s ease",
        position: "relative",
        userSelect: "none"
      }}
      className="content-card-hover"
    >
      {/* Top row: Platform & Status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <span
            style={{
              background: platformCfg.bg,
              color: platformCfg.color,
              fontSize: 10,
              fontWeight: 700,
              padding: "1.5px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 90
            }}
          >
            {platformCfg.label}
          </span>
          {item.time && (
            <span style={{ fontSize: 10, color: C.inkMute, fontWeight: 600 }}>
              {item.time}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleStatusCycle}
          title={`Status: ${item.status}. Click to cycle.`}
          style={{
            background: statusCfg.bg,
            color: statusCfg.color,
            border: `1px solid ${statusCfg.border}`,
            fontSize: 9.5,
            fontWeight: 700,
            padding: "1.5px 6px",
            borderRadius: 10,
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.15s ease"
          }}
        >
          {statusCfg.label}
        </button>
      </div>

      {/* Middle row: Title / Topic */}
      <div
        style={{
          fontSize: compact ? 11.5 : 12,
          fontWeight: 600,
          color: C.ink,
          lineHeight: 1.35,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: compact ? 2 : 2,
          WebkitBoxOrient: "vertical",
          marginBottom: 4
        }}
      >
        {item.title || item.topic}
      </div>

      {/* Bottom row: Content Type, Pillar Dot & Studio Link */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: pillarCol,
              flexShrink: 0
            }}
            title={`Pillar: ${item.pillar}`}
          />
          <span
            style={{
              fontSize: 10.5,
              color: C.inkSoft,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {item.contentType}
          </span>
        </div>

        {isStudioFmt && (
          <a
            href={createStudioHref()}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: C.blue,
              textDecoration: "none",
              background: C.mist,
              padding: "1.5px 5px",
              borderRadius: 4,
              flexShrink: 0
            }}
            title="Open in Studio to generate slides"
          >
            Studio →
          </a>
        )}
      </div>
    </div>
  );
}
