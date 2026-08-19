"use client";

import React from "react";
import { C, FONT } from "@/lib/tokens";
import {
  PLATFORMS,
  PILLARS_LIST,
  STATUS_ORDER,
  STATUS_CONFIG,
  ALL_CONTENT_TYPES
} from "./types";

interface CalendarFiltersProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedPlatform: string;
  onPlatformChange: (val: string) => void;
  selectedType: string;
  onTypeChange: (val: string) => void;
  selectedStatus: string;
  onStatusChange: (val: string) => void;
  selectedPillar: string;
  onPillarChange: (val: string) => void;
  onClearFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

export function CalendarFilters({
  searchQuery,
  onSearchChange,
  selectedPlatform,
  onPlatformChange,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
  selectedPillar,
  onPillarChange,
  onClearFilters,
  totalCount,
  filteredCount
}: CalendarFiltersProps) {
  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedPlatform !== "all" ||
    selectedType !== "all" ||
    selectedStatus !== "all" ||
    selectedPillar !== "all";

  const selectStyle: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 600,
    color: C.inkSoft,
    background: "#ffffff",
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    padding: "6px 10px",
    outline: "none",
    cursor: "pointer"
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "10px 0",
        fontFamily: FONT
      }}
    >
      {/* Search Input */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#ffffff",
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: "6px 12px",
            width: "100%",
            boxSizing: "border-box"
          }}
        >
          <span style={{ fontSize: 13, color: C.inkMute }}>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search content, topics, captions…"
            style={{
              fontFamily: FONT,
              fontSize: 12.5,
              color: C.ink,
              border: "none",
              outline: "none",
              width: "100%",
              background: "transparent"
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 12,
                color: C.inkMute,
                cursor: "pointer",
                padding: "0 4px"
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Platform */}
        <select
          value={selectedPlatform}
          onChange={(e) => onPlatformChange(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Content Type */}
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Types</option>
          {ALL_CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Statuses</option>
          {STATUS_ORDER.map((st) => (
            <option key={st} value={st}>
              {STATUS_CONFIG[st].label}
            </option>
          ))}
        </select>

        {/* Pillar */}
        <select
          value={selectedPillar}
          onChange={(e) => onPillarChange(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Pillars</option>
          {PILLARS_LIST.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 700,
              color: "#B4442E",
              background: "#FDF3F2",
              border: "1px solid #F5C6CB",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}
          >
            ✕ Reset ({filteredCount}/{totalCount})
          </button>
        )}
      </div>
    </div>
  );
}
