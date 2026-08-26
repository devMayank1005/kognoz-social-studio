"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { storeGet, storeSet } from "@/lib/storeClient";
import { C, FONT } from "@/lib/tokens";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarFilters } from "./CalendarFilters";
import { QuickAddBar } from "./QuickAddBar";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarListView } from "./CalendarListView";
import { ContentEditorModal } from "./ContentEditorModal";
import {
  type ContentItem,
  type ContentStatus,
  type CalendarViewMode,
  type DynamicCalendarStore
} from "./types";
import {
  migrateLegacyPlan,
  filterContentItems,
  formatDateKey,
  dateToKey,
  getTodayKey
} from "./calendarUtils";

const STORAGE_KEY = "kognoz-calendar";

export function CalendarView() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPillar, setSelectedPillar] = useState("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<ContentItem | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState(getTodayKey());

  // Status & persistence states
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Load from Supabase Store API on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { value, stale } = await storeGet<unknown>(STORAGE_KEY);
        if (stale) throw new Error("store unreachable");
        setItems(migrateLegacyPlan(value));
      } catch (e) {
        console.warn("Falling back to local calendar initialization:", e);
        // Try localStorage fallback
        try {
          const local = localStorage.getItem(STORAGE_KEY);
          if (local) {
            const parsed = JSON.parse(local);
            setItems(migrateLegacyPlan(parsed));
          } else {
            setItems(migrateLegacyPlan(null));
          }
        } catch {
          setItems(migrateLegacyPlan(null));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save to /api/store and localStorage
  const persistItems = useCallback(async (nextItems: ContentItem[]) => {
    setIsSaving(true);
    const payload: DynamicCalendarStore = {
      version: 3,
      items: nextItems,
      updatedAt: new Date().toISOString()
    };

    try {
      const saved = await storeSet<unknown>(STORAGE_KEY, payload);
      if (saved.ok) {
        setError("");
      } else if (saved.reason === "conflict") {
        // Someone else saved while this tab was editing. Overwriting them is what
        // the old blind PUT did, and it destroyed work silently. Take the server's
        // copy and tell the user their change did not stick.
        setItems(migrateLegacyPlan(saved.serverValue));
        setError(
          `${saved.updatedBy || "Someone else"} changed the calendar while you were editing. ` +
            `Their version is now shown — please redo your change.`
        );
      } else {
        setError("Note: Changes saved locally. Server sync pending.");
      }
    } catch (e) {
      console.warn("Failed to persist calendar to server:", e);
      setError("Note: Changes saved locally. Server sync pending.");
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Filtered items
  const filteredItems = useMemo(() => {
    return filterContentItems(
      items,
      searchQuery,
      selectedPlatform,
      selectedType,
      selectedStatus,
      selectedPillar
    );
  }, [items, searchQuery, selectedPlatform, selectedType, selectedStatus, selectedPillar]);

  // Counts
  const postedCount = useMemo(() => items.filter((i) => i.status === "Posted").length, [items]);

  // Navigation handlers
  function handlePrev() {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "week") {
        d.setDate(d.getDate() - 7);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  }

  function handleNext() {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "week") {
        d.setDate(d.getDate() + 7);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  function handleSelectMonthYear(year: number, month: number) {
    setCurrentDate(new Date(year, month, 1));
  }

  function handleClearFilters() {
    setSearchQuery("");
    setSelectedPlatform("all");
    setSelectedType("all");
    setSelectedStatus("all");
    setSelectedPillar("all");
  }

  // CRUD handlers
  function handleOpenCreateModal(dateKey?: string) {
    setModalItem(null);
    setModalInitialDate(dateKey || dateToKey(currentDate));
    setIsModalOpen(true);
  }

  function handleEditItem(item: ContentItem) {
    setModalItem(item);
    setModalInitialDate(item.date || getTodayKey());
    setIsModalOpen(true);
  }

  function handleSaveItem(savedItem: ContentItem) {
    setItems((prev) => {
      const exists = prev.some((it) => it.id === savedItem.id);
      const next = exists
        ? prev.map((it) => (it.id === savedItem.id ? savedItem : it))
        : [savedItem, ...prev];
      persistItems(next);
      return next;
    });
  }

  function handleDeleteItem(id: string) {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      persistItems(next);
      return next;
    });
  }

  function handleStatusChange(id: string, nextStatus: ContentStatus) {
    setItems((prev) => {
      const next = prev.map((it) =>
        it.id === id ? { ...it, status: nextStatus, updatedAt: new Date().toISOString() } : it
      );
      persistItems(next);
      return next;
    });
  }

  function handleDropItem(itemId: string, targetDateKey: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.id === itemId);
      if (!target || target.date === targetDateKey) return prev;
      const next = prev.map((it) =>
        it.id === itemId ? { ...it, date: targetDateKey, updatedAt: new Date().toISOString() } : it
      );
      persistItems(next);
      return next;
    });
  }

  function handleQuickAdd(newItem: ContentItem) {
    setItems((prev) => {
      const next = [newItem, ...prev];
      persistItems(next);
      return next;
    });
  }

  if (loading) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", fontFamily: FONT, color: C.inkSoft }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
        <div>Loading your content calendar…</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT }}>
      {/* Saving / Error Banner */}
      {error && (
        <div
          style={{
            padding: "8px 14px",
            background: "#FFF4E5",
            border: "1px solid #FFD8A8",
            borderRadius: 8,
            color: "#9A5B13",
            fontSize: 12.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9A5B13" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Navigation */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onSelectMonthYear={handleSelectMonthYear}
        onOpenCreateModal={() => handleOpenCreateModal()}
        postedCount={postedCount}
        totalCount={items.length}
      />

      {/* Quick Add Bar */}
      <QuickAddBar
        currentDateKey={dateToKey(currentDate)}
        onAddQuick={handleQuickAdd}
        onOpenFullModal={handleOpenCreateModal}
      />

      {/* Filter Toolbar */}
      <CalendarFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedPlatform={selectedPlatform}
        onPlatformChange={setSelectedPlatform}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedPillar={selectedPillar}
        onPillarChange={setSelectedPillar}
        onClearFilters={handleClearFilters}
        totalCount={items.length}
        filteredCount={filteredItems.length}
      />

      {/* Main View Area */}
      {viewMode === "month" && (
        <CalendarMonthView
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          items={filteredItems}
          onAddNew={handleOpenCreateModal}
          onEditItem={handleEditItem}
          onStatusChange={handleStatusChange}
          onDropItem={handleDropItem}
        />
      )}

      {viewMode === "week" && (
        <CalendarWeekView
          currentDate={currentDate}
          items={filteredItems}
          onAddNew={handleOpenCreateModal}
          onEditItem={handleEditItem}
          onStatusChange={handleStatusChange}
          onDropItem={handleDropItem}
        />
      )}

      {viewMode === "list" && (
        <CalendarListView
          items={filteredItems}
          onAddNew={handleOpenCreateModal}
          onEditItem={handleEditItem}
          onStatusChange={handleStatusChange}
          onRewriteAI={handleEditItem}
        />
      )}

      {/* Create / Edit Modal */}
      <ContentEditorModal
        isOpen={isModalOpen}
        item={modalItem}
        initialDate={modalInitialDate}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
    </div>
  );
}

export default CalendarView;
