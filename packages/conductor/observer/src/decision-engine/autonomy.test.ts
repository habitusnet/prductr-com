import { describe, it, expect } from "vitest";
import { canActAutonomously, AutonomyLevel } from "./autonomy";
import { AutonomousActionType } from "../types";

describe("autonomy", () => {
  describe("canActAutonomously", () => {
    const allActions: AutonomousActionType[] = [
      "prompt_agent",
      "restart_agent",
      "reassign_task",
      "retry_task",
      "pause_agent",
      "release_lock",
      "update_task_status",
    ];

    describe("full_auto level", () => {
      const level: AutonomyLevel = "full_auto";

      it("should allow prompt_agent", () => {
        expect(canActAutonomously(level, "prompt_agent")).toBe(true);
      });

      it("should allow restart_agent", () => {
        expect(canActAutonomously(level, "restart_agent")).toBe(true);
      });

      it("should allow reassign_task", () => {
        expect(canActAutonomously(level, "reassign_task")).toBe(true);
      });

      it("should allow retry_task", () => {
        expect(canActAutonomously(level, "retry_task")).toBe(true);
      });

      it("should allow pause_agent", () => {
        expect(canActAutonomously(level, "pause_agent")).toBe(true);
      });

      it("should allow release_lock", () => {
        expect(canActAutonomously(level, "release_lock")).toBe(true);
      });

      it("should allow update_task_status", () => {
        expect(canActAutonomously(level, "update_task_status")).toBe(true);
      });

      it("should allow all 7 actions", () => {
        allActions.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(true);
        });
      });
    });

    describe("supervised level", () => {
      const level: AutonomyLevel = "supervised";
      const allowedActions: AutonomousActionType[] = [
        "prompt_agent",
        "retry_task",
        "update_task_status",
      ];
      const disallowedActions: AutonomousActionType[] = [
        "restart_agent",
        "reassign_task",
        "pause_agent",
        "release_lock",
      ];

      it("should allow prompt_agent", () => {
        expect(canActAutonomously(level, "prompt_agent")).toBe(true);
      });

      it("should not allow restart_agent", () => {
        expect(canActAutonomously(level, "restart_agent")).toBe(false);
      });

      it("should not allow reassign_task", () => {
        expect(canActAutonomously(level, "reassign_task")).toBe(false);
      });

      it("should allow retry_task", () => {
        expect(canActAutonomously(level, "retry_task")).toBe(true);
      });

      it("should not allow pause_agent", () => {
        expect(canActAutonomously(level, "pause_agent")).toBe(false);
      });

      it("should not allow release_lock", () => {
        expect(canActAutonomously(level, "release_lock")).toBe(false);
      });

      it("should allow update_task_status", () => {
        expect(canActAutonomously(level, "update_task_status")).toBe(true);
      });

      it("should allow exactly 3 actions", () => {
        allowedActions.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(true);
        });
        disallowedActions.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(false);
        });
      });
    });

    describe("assisted level", () => {
      const level: AutonomyLevel = "assisted";
      const allowedActions: AutonomousActionType[] = [
        "prompt_agent",
        "update_task_status",
      ];
      const disallowedActions: AutonomousActionType[] = [
        "restart_agent",
        "reassign_task",
        "retry_task",
        "pause_agent",
        "release_lock",
      ];

      it("should allow prompt_agent", () => {
        expect(canActAutonomously(level, "prompt_agent")).toBe(true);
      });

      it("should not allow restart_agent", () => {
        expect(canActAutonomously(level, "restart_agent")).toBe(false);
      });

      it("should not allow reassign_task", () => {
        expect(canActAutonomously(level, "reassign_task")).toBe(false);
      });

      it("should not allow retry_task", () => {
        expect(canActAutonomously(level, "retry_task")).toBe(false);
      });

      it("should not allow pause_agent", () => {
        expect(canActAutonomously(level, "pause_agent")).toBe(false);
      });

      it("should not allow release_lock", () => {
        expect(canActAutonomously(level, "release_lock")).toBe(false);
      });

      it("should allow update_task_status", () => {
        expect(canActAutonomously(level, "update_task_status")).toBe(true);
      });

      it("should allow exactly 2 actions", () => {
        allowedActions.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(true);
        });
        disallowedActions.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(false);
        });
      });
    });

    describe("manual level", () => {
      const level: AutonomyLevel = "manual";

      it("should not allow prompt_agent", () => {
        expect(canActAutonomously(level, "prompt_agent")).toBe(false);
      });

      it("should not allow restart_agent", () => {
        expect(canActAutonomously(level, "restart_agent")).toBe(false);
      });

      it("should not allow reassign_task", () => {
        expect(canActAutonomously(level, "reassign_task")).toBe(false);
      });

      it("should not allow retry_task", () => {
        expect(canActAutonomously(level, "retry_task")).toBe(false);
      });

      it("should not allow pause_agent", () => {
        expect(canActAutonomously(level, "pause_agent")).toBe(false);
      });

      it("should not allow release_lock", () => {
        expect(canActAutonomously(level, "release_lock")).toBe(false);
      });

      it("should not allow update_task_status", () => {
        expect(canActAutonomously(level, "update_task_status")).toBe(false);
      });

      it("should disallow all actions", () => {
        allActions.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(false);
        });
      });
    });

    describe("permission matrix coverage", () => {
      it("full_auto has all 7 actions allowed", () => {
        const level: AutonomyLevel = "full_auto";
        const allAllowed = [
          "prompt_agent",
          "restart_agent",
          "reassign_task",
          "retry_task",
          "pause_agent",
          "release_lock",
          "update_task_status",
        ] as const;

        allAllowed.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(true);
        });
      });

      it("supervised allows only 3 actions: prompt_agent, retry_task, update_task_status", () => {
        const level: AutonomyLevel = "supervised";
        const allowed: AutonomousActionType[] = [
          "prompt_agent",
          "retry_task",
          "update_task_status",
        ];
        const denied: AutonomousActionType[] = [
          "restart_agent",
          "reassign_task",
          "pause_agent",
          "release_lock",
        ];

        allowed.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(true);
        });
        denied.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(false);
        });
      });

      it("assisted allows only 2 actions: prompt_agent, update_task_status", () => {
        const level: AutonomyLevel = "assisted";
        const allowed: AutonomousActionType[] = [
          "prompt_agent",
          "update_task_status",
        ];
        const denied: AutonomousActionType[] = [
          "restart_agent",
          "reassign_task",
          "retry_task",
          "pause_agent",
          "release_lock",
        ];

        allowed.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(true);
        });
        denied.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(false);
        });
      });

      it("manual allows 0 actions (empty set)", () => {
        const level: AutonomyLevel = "manual";
        const allDenied: AutonomousActionType[] = [
          "prompt_agent",
          "restart_agent",
          "reassign_task",
          "retry_task",
          "pause_agent",
          "release_lock",
          "update_task_status",
        ];

        allDenied.forEach((action) => {
          expect(canActAutonomously(level, action)).toBe(false);
        });
      });
    });
  });
});
