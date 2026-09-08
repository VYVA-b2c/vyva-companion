import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MedicationRefillsScreen from "./MedicationRefillsScreen";
import { apiFetch } from "@/lib/queryClient";

const { prepareEvidenceMock } = vi.hoisted(() => ({
  prepareEvidenceMock: vi.fn(),
}));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...original, apiFetch: vi.fn() };
});

vi.mock("@/lib/showVyvaEvidence", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/showVyvaEvidence")>();
  return { ...original, prepareShowVyvaEvidenceFile: prepareEvidenceMock };
});

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
  };
});

const apiFetchMock = vi.mocked(apiFetch);

const medicine = {
  medicineId: "medicine-1",
  medicineName: "Metformin",
  strength: "500mg once daily",
  doseUnit: "tablet",
  unitsPerDose: 1,
  inventoryUnit: "tablet",
  inventoryUnitsPerDose: 1,
  dailyFrequency: 1,
  refillAlertDays: 7,
  inventoryTrackingEnabled: true,
  estimatedQuantity: 18,
  daysRemaining: 18,
  projectedRunOutDate: "2026-09-17",
  status: "on_track" as const,
  confidence: "high" as const,
  calculationReason: "Based on the latest stock count and daily routine.",
  updatedAt: "2026-08-30T10:00:00Z",
  updatedBy: { name: "Rosa", role: "elder" },
  history: [{ id: "event-1", type: "stock_count" as const, quantity: 18, unit: "tablet", occurredOn: "2026-08-30", source: "manual", updatedBy: "Rosa", actorRole: "elder" }],
};

function renderScreen(currentMedicine = medicine) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => ({
          profileId: "profile-1",
          actorRole: "elder",
          permissions: { manage_inventory: true },
          medicines: [currentMedicine],
        }),
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/meds/refills"]}>
        <MedicationRefillsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MedicationRefillsScreen", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    prepareEvidenceMock.mockReset();
    prepareEvidenceMock.mockResolvedValue({
      dataUrl: "data:image/jpeg;base64,medicine",
      fileName: "medicine.jpg",
      mimeType: "image/jpeg",
      kind: "image",
      reviewedPage: null,
      qualityIssues: [],
      metrics: null,
    });
  });

  it("shows the forecast, confidence, attribution, and reminder-only boundary", async () => {
    renderScreen();
    expect(await screen.findByText("You have about 18 days left")).toBeInTheDocument();
    expect(screen.getAllByText("18 tablets").length).toBeGreaterThan(0);
    expect(screen.getByText(/High confidence · Updated by Rosa/)).toBeInTheDocument();
    expect(screen.getByText(/VYVA never orders or contacts anyone/)).toBeInTheDocument();
  });

  it("reviews a manual purchase before saving and shows recalculated coverage", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      summary: { ...medicine, estimatedQuantity: 46, daysRemaining: 46, projectedRunOutDate: "2026-10-15" },
    }), { status: 201, headers: { "Content-Type": "application/json" } }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-update-medicine-supply"));
    fireEvent.click(screen.getByTestId("button-refill-manual"));
    expect(screen.getByTestId("refill-draft-projection")).toHaveTextContent("Confirm the quantity and routine");
    fireEvent.change(screen.getByTestId("input-refill-quantity"), { target: { value: "28" } });
    expect(screen.getByTestId("refill-draft-projection")).toHaveTextContent("Projected run-out date");
    fireEvent.click(screen.getByTestId("button-refill-save"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock.mock.calls[0]?.[0]).toBe("/api/meds/refills/me/medicines/medicine-1/purchases");
    expect(JSON.parse(String(apiFetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      quantity: 28,
      doseUnit: "tablet",
      unitsPerDose: 1,
      inventoryUnit: "tablet",
      inventoryUnitsPerDose: 1,
      dailyFrequency: 1,
      refillAlertDays: 7,
      source: "manual",
    });
    expect(await screen.findByText("About 46 days covered")).toBeInTheDocument();
    expect(screen.getByText(/No order was placed and nobody was contacted/)).toBeInTheDocument();
  });

  it("sends an absolute count to the stock-count endpoint", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({ summary: { ...medicine, estimatedQuantity: 9, daysRemaining: 9 } }), { status: 201, headers: { "Content-Type": "application/json" } }));
    renderScreen();
    fireEvent.click(await screen.findByTestId("button-update-medicine-supply"));
    fireEvent.click(screen.getByTestId("button-refill-stock-count"));
    fireEvent.change(screen.getByTestId("input-refill-quantity"), { target: { value: "9" } });
    fireEvent.click(screen.getByTestId("button-refill-save"));
    await waitFor(() => expect(apiFetchMock.mock.calls[0]?.[0]).toContain("/stock-counts"));
  });

  it("keeps package count separate from dose and volume in the photo review", async () => {
    const eyeDrops = {
      ...medicine,
      medicineName: "Monoprost",
      strength: "1 drop once daily",
      doseUnit: "drop",
      inventoryUnit: null,
      estimatedQuantity: null,
      daysRemaining: null,
      projectedRunOutDate: null,
      status: "setup_needed" as const,
    };
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      draft: {
        medicineName: "Monoprost",
        strength: "1 drop",
        packageCount: 1,
        unitsPerPackage: 30,
        totalQuantity: 30,
        inventoryQuantity: 30,
        inventoryUnit: "single_dose_container",
        doseUnit: "single_dose_container",
        inventoryEvidenceText: "30 envases unidosis",
        contentAmountPerUnit: 0.2,
        contentUnit: "ml",
        contentEvidenceText: "0,2 ml",
        purchasedOn: "2026-08-31",
      },
      confidence: "medium",
      needsReview: true,
      warnings: ["A conflicting derived value was ignored."],
      imageRetained: false,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    renderScreen(eyeDrops);
    fireEvent.click(await screen.findByTestId("button-update-medicine-supply"));
    fireEvent.change(screen.getByTestId("input-refill-photo"), {
      target: { files: [new File(["photo"], "medicine.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.click(await screen.findByTestId("button-show-vyva-capture-use"));

    expect(await screen.findByTestId("refill-inventory-evidence")).toHaveTextContent("30 envases unidosis");
    expect(screen.getByTestId("refill-inventory-evidence")).toHaveTextContent("0.2 ml per unit");
    expect(screen.getByTestId("input-refill-quantity")).toHaveValue(30);
    expect(screen.getByTestId("input-refill-unit")).toHaveValue("single_dose_container");
    expect(screen.getByTestId("input-refill-dose-unit")).toHaveValue("drop");
    expect(screen.queryByDisplayValue("6")).not.toBeInTheDocument();
  });
});
