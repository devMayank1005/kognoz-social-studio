"use client";

import React, { useState, useMemo } from "react";
import { C, FONT } from "@/lib/tokens";
import { STUDIO_FORMATS } from "@/lib/formats";
import {
  STATUS_CONFIG,
  STATUS_NEXT,
  PLATFORMS,
  PILLAR_COLORS,
  getAuthorInfo,
  type ContentItem,
  type ContentStatus
} from "./types";
import { formatDisplayDate } from "./calendarUtils";

interface CalendarListViewProps {
  items: ContentItem[];
  onAddNew: (dateKey?: string) => void;
  onEditItem: (item: ContentItem) => void;
  onStatusChange: (id: string, nextStatus: ContentStatus) => void;
  onRewriteAI: (item: ContentItem) => void;
}

export function CalendarListView({
  items,
  onAddNew,
  onEditItem,
  onStatusChange,
  onRewriteAI
}: CalendarListViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Group items by date sorted ascending
  const groupedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const cmp = (a.date || "").localeCompare(b.date || "");
      if (cmp !== 0) return cmp;
      return (a.time || "00:00").localeCompare(b.time || "00:00");
    });

    const groups: { dateKey: string; items: ContentItem[] }[] = [];
    let currentKey = "";
    let currentList: ContentItem[] = [];

    for (const it of sorted) {
      if (it.date !== currentKey) {
        if (currentKey) {
          groups.push({ dateKey: currentKey, items: currentList });
        }
        currentKey = it.date;
        currentList = [it];
      } else {
        currentList.push(it);
      }
    }
    if (currentKey) {
      groups.push({ dateKey: currentKey, items: currentList });
    }
    return groups;
  }, [items]);

  async function handleCopy(e: React.MouseEvent, it: ContentItem) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(it.content || it.topic || "");
      setCopiedId(it.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "#ffffff",
          borderRadius: 12,
          border: `1px solid ${C.line}`,
          marginTop: 12
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>📅</div>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.ink, margin: "0 0 6px 0" }}>
          No content matches your filters
        </h3>
        <p style={{ fontFamily: FONT, fontSize: 13, color: C.inkMute, margin: "0 0 16px 0" }}>
          Try clearing search filters or create a new post for your schedule.
        </p>
        <button
          type="button"
          onClick={() => onAddNew()}
          style={{
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 700,
            color: "#ffffff",
            background: C.blue,
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            cursor: "pointer"
          }}
        >
          + Create Content
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {groupedItems.map((group) => (
        <section key={group.dateKey}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${C.line}` }}>
            <h3
              style={{
                fontFamily: FONT,
                fontSize: 13.5,
                fontWeight: 700,
                color: C.inkSoft,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: 0
              }}
            >
              {formatDisplayDate(group.dateKey)}
            </h3>
            <button
              type="button"
              onClick={() => onAddNew(group.dateKey)}
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: C.blue,
                background: "transparent",
                border: "none",
                cursor: "pointer"
              }}
            >
              + Add to this day
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.items.map((it) => {
              const isExpanded = expandedId === it.id;
              const statusCfg = STATUS_CONFIG[it.status] || STATUS_CONFIG.Draft;
              const platformCfg = PLATFORMS.find((p) => p.id === it.platform) || {
                label: it.platform,
                color: C.inkSoft,
                bg: C.mist
              };
              const pillarCol = PILLAR_COLORS[it.pillar] || C.blue;
              const isStudioFmt = (STUDIO_FORMATS as readonly string[]).includes(it.contentType);
              const author = getAuthorInfo(it.authorName, it.authorEmail || it.platform);

              function createStudioHref(): string {
                const p = new URLSearchParams({
                  topic: it.topic || it.title,
                  format: it.contentType,
                  pillar: it.pillar,
                  n: String(it.n || it.id)
                });
                if (it.set) p.set("set", it.set);
                if (it.style) p.set("style", it.style);
                return `/?${p.toString()}`;
              }

              return (
                <div
                  key={it.id}
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    overflow: "hidden",
                    boxShadow: "0 1px 4px rgba(0, 30, 60, 0.04)"
                  }}
                >
                  {/* Main row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : it.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontFamily: FONT,
                      fontSize: 13
                    }}
                  >
                    {/* Time */}
                    <span style={{ fontSize: 11.5, color: C.inkMute, fontWeight: 600, width: 44, flexShrink: 0 }}>
                      {it.time || "—"}
                    </span>

                    {/* Platform Pill */}
                    <span
                      style={{
                        background: platformCfg.bg,
                        color: platformCfg.color,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 4,
                        flexShrink: 0
                      }}
                    >
                      {platformCfg.label}
                    </span>

                    {/* Content Type & Pillar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, width: 120 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: pillarCol, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.contentType}
                      </span>
                    </div>

                    {/* Title / Topic */}
                    <span
                      style={{
                        flex: 1,
                        fontWeight: 600,
                        color: C.ink,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {it.title || it.topic}
                    </span>

                    {/* Quick Studio Action */}
                    {isStudioFmt && (
                      <a
                        href={createStudioHref()}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: C.blue,
                          textDecoration: "none",
                          background: C.mist,
                          padding: "3px 8px",
                          borderRadius: 6,
                          flexShrink: 0
                        }}
                      >
                        Studio →
                      </a>
                    )}

                    {/* Author Initial Badge */}
                    <span
                      title={`Added by ${author.displayName}`}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: author.bg,
                        color: author.color,
                        fontSize: 10.5,
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px solid ${author.color}40`,
                        flexShrink: 0
                      }}
                    >
                      {author.initial}
                    </span>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditItem(it);
                      }}
                      style={{
                        background: "transparent",
                        border: `1px solid ${C.line}`,
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 11.5,
                        color: C.inkSoft,
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                    >
                      Edit
                    </button>

                    {/* Status Pill */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(it.id, STATUS_NEXT[it.status] || "Draft");
                      }}
                      style={{
                        background: statusCfg.bg,
                        color: statusCfg.color,
                        border: `1px solid ${statusCfg.border}`,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 9px",
                        borderRadius: 12,
                        cursor: "pointer",
                        flexShrink: 0
                      }}
                    >
                      {statusCfg.label}
                    </button>

                    {/* Expand Arrow */}
                    <span style={{ fontSize: 11, color: C.inkMute, marginLeft: 2 }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div style={{ padding: "12px 16px 14px", borderTop: `1px solid ${C.line}`, background: "#FAFCFD", fontFamily: FONT }}>
                      {it.content ? (
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: C.ink, whiteSpace: "pre-wrap", marginBottom: 12 }}>
                          {it.content}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12.5, fontStyle: "italic", color: C.inkMute, marginBottom: 12 }}>
                          No caption written yet. Use AI to generate or write manually.
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, it)}
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: C.blue,
                            background: C.white,
                            border: `1.5px solid ${C.blue}`,
                            borderRadius: 6,
                            padding: "5px 12px",
                            cursor: "pointer"
                          }}
                        >
                          {copiedId === it.id ? "✓ Copied" : "Copy text"}
                        </button>

                        <button
                          type="button"
                          onClick={() => onRewriteAI(it)}
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#ffffff",
                            background: C.teal,
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 14px",
                            cursor: "pointer"
                          }}
                        >
                          ✨ Generate / Rewrite with Claude
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditItem(it)}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: C.inkSoft,
                            background: C.mist,
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 12px",
                            cursor: "pointer"
                          }}
                        >
                          Edit Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
