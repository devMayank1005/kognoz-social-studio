import { describe, it, expect } from "vitest";
import {
  getMonthMatrix,
  getWeekDays,
  formatDateKey,
  migrateLegacyPlan,
  filterContentItems
} from "../components/calendar/calendarUtils";
import type { ContentItem } from "../components/calendar/types";

describe("Calendar Utilities", () => {
  describe("formatDateKey", () => {
    it("formats year, month (0-indexed), and day correctly", () => {
      expect(formatDateKey(2026, 7, 20)).toBe("2026-08-20");
      expect(formatDateKey(2026, 0, 1)).toBe("2026-01-01");
      expect(formatDateKey(2026, 11, 31)).toBe("2026-12-31");
    });
  });

  describe("getMonthMatrix", () => {
    it("generates correct matrix for August 2026 (starts Saturday, spans 6 weeks, 31 days)", () => {
      const days = getMonthMatrix(2026, 7); // Aug 2026
      expect(days.length).toBe(42); // 42 cells (starts Sat, spans 6 weeks)
      const currentMonthDays = days.filter((d) => d.isCurrentMonth);
      expect(currentMonthDays.length).toBe(31);
      expect(currentMonthDays[0].dayNumber).toBe(1);
      expect(currentMonthDays[30].dayNumber).toBe(31);
    });

    it("correctly handles February in leap year (2024 has 29 days)", () => {
      const days = getMonthMatrix(2024, 1); // Feb 2024
      const currentMonthDays = days.filter((d) => d.isCurrentMonth);
      expect(currentMonthDays.length).toBe(29);
    });

    it("correctly handles February in non-leap year (2025 has 28 days)", () => {
      const days = getMonthMatrix(2025, 1); // Feb 2025
      const currentMonthDays = days.filter((d) => d.isCurrentMonth);
      expect(currentMonthDays.length).toBe(28);
    });
  });

  describe("getWeekDays", () => {
    it("returns 7 days starting from Sunday", () => {
      const wed = new Date(2026, 7, 19); // Aug 19, 2026 is Wednesday
      const week = getWeekDays(wed);
      expect(week.length).toBe(7);
      expect(week[0].dayNumber).toBe(16); // Sun Aug 16
      expect(week[3].dayNumber).toBe(19); // Wed Aug 19
      expect(week[6].dayNumber).toBe(22); // Sat Aug 22
    });
  });

  describe("migrateLegacyPlan", () => {
    it("seeds from template when given null or empty object", () => {
      const items = migrateLegacyPlan(null);
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toHaveProperty("id");
      expect(items[0]).toHaveProperty("date");
      expect(items[0]).toHaveProperty("platform");
    });

    it("converts legacy PlanItem array into ContentItem array", () => {
      const legacyRaw = {
        month: 1,
        items: [
          { n: 1, day: 5, ch: "Lokesh", fmt: "Carousel", pillar: "Consulting POV", topic: "Test Topic", copy: "Test copy" }
        ]
      };
      const items = migrateLegacyPlan(legacyRaw);
      expect(items.length).toBe(1);
      expect(items[0].title).toBe("Test Topic");
      expect(items[0].platform).toBe("Lokesh");
      expect(items[0].contentType).toBe("Carousel");
      expect(items[0].content).toBe("Test copy");
      expect(items[0].date).toMatch(/^\d{4}-\d{2}-05$/);
    });

    it("preserves already migrated ContentItem array", () => {
      const modernItems: ContentItem[] = [
        {
          id: "item_123",
          title: "Modern Post",
          topic: "Modern Topic",
          platform: "LinkedIn",
          contentType: "Video",
          date: "2026-08-20",
          status: "Scheduled",
          pillar: "Human + AI",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z"
        }
      ];
      const items = migrateLegacyPlan({ version: 3, items: modernItems });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe("item_123");
      expect(items[0].status).toBe("Scheduled");
    });
  });

  describe("filterContentItems", () => {
    const mockItems: ContentItem[] = [
      {
        id: "1",
        title: "AI Integration in People Function",
        topic: "AI Integration in People Function",
        content: "How AI transforms HR teams.",
        platform: "LinkedIn",
        contentType: "Carousel",
        date: "2026-08-20",
        status: "Draft",
        pillar: "Human + AI",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01"
      },
      {
        id: "2",
        title: "The Culture Code",
        topic: "The Culture Code",
        content: "Review of the book.",
        platform: "Harpreet",
        contentType: "Video",
        date: "2026-08-22",
        status: "Posted",
        pillar: "Behavioral Signal",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01"
      }
    ];

    it("filters by search query", () => {
      const result = filterContentItems(mockItems, "transforms", "all", "all", "all", "all");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("1");
    });

    it("filters by platform", () => {
      const result = filterContentItems(mockItems, "", "Harpreet", "all", "all", "all");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("2");
    });

    it("filters by status", () => {
      const result = filterContentItems(mockItems, "", "all", "all", "Posted", "all");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("2");
    });

    it("returns all items when filters are 'all' and query is empty", () => {
      const result = filterContentItems(mockItems, "", "all", "all", "all", "all");
      expect(result.length).toBe(2);
    });
  });
});
