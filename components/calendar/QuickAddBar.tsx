"use client";

import React, { useState } from "react";
import { C, FONT } from "@/lib/tokens";
import { PLATFORMS, type ContentItem } from "./types";
import { generateContentId, getTodayKey } from "./calendarUtils";

interface QuickAddBarProps {
  currentDateKey: string;
  onAddQuick: (item: ContentItem) => void;
  onOpenFullModal: (dateKey?: string) => void;
}

export function QuickAddBar({ currentDateKey, onAddQuick, onOpenFullModal }: QuickAddBarProps) {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("LinkedIn");
  const [contentType, setContentType] = useState("Carousel");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    const newItem: ContentItem = {
      id: generateContentId(),
      title: topic.trim(),
      topic: topic.trim(),
      platform,
      contentType,
      date: currentDateKey || getTodayKey(),
      time: "10:00",
      status: "Planned",
      pillar: "Behavioral Signal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddQuick(newItem);
    setTopic("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#ffffff",
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: "6px 10px",
        boxShadow: "0 2px 6px rgba(0, 30, 60, 0.03)",
        boxSizing: "border-box",
        flexWrap: "wrap"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 240 }}>
        <span style={{ fontSize: 15, color: C.blue, fontWeight: 700 }}>+</span>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Quick add topic or post idea (press Enter)…"
          style={{
            fontFamily: FONT,
            fontSize: 13,
            color: C.ink,
            border: "none",
            outline: "none",
            width: "100%",
            background: "transparent"
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          style={{
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            color: C.inkSoft,
            background: C.mist,
            border: `1px solid ${C.line}`,
            borderRadius: 6,
            padding: "4px 8px",
            outline: "none",
            cursor: "pointer"
          }}
        >
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          style={{
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            color: C.inkSoft,
            background: C.mist,
            border: `1px solid ${C.line}`,
            borderRadius: 6,
            padding: "4px 8px",
            outline: "none",
            cursor: "pointer"
          }}
        >
          <option value="Carousel">Carousel</option>
          <option value="Square">Square</option>
          <option value="Idea Deck">Idea Deck</option>
          <option value="Article Cover">Article Cover</option>
          <option value="Stat Card">Stat Card</option>
          <option value="Text post">Text post</option>
          <option value="Founder Video">Founder Video</option>
          <option value="Poll">Poll</option>
        </select>

        <button
          type="submit"
          disabled={!topic.trim()}
          style={{
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 700,
            color: "#ffffff",
            background: topic.trim() ? C.blue : C.inkMute,
            border: "none",
            borderRadius: 6,
            padding: "5px 12px",
            cursor: topic.trim() ? "pointer" : "default",
            opacity: topic.trim() ? 1 : 0.6,
            transition: "all 0.15s ease"
          }}
        >
          Add
        </button>

        <button
          type="button"
          onClick={() => onOpenFullModal(currentDateKey)}
          style={{
            fontFamily: FONT,
            fontSize: 11.5,
            fontWeight: 600,
            color: C.blue,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px 6px"
          }}
        >
          Full Details ↗
        </button>
      </div>
    </form>
  );
}
