import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import CategorySort, { getFallbackSequence, getNextCategorySortTierAfterRound } from "./CategorySort";

describe("CategorySort", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLanguage("es");
  });

  it("renders the practice round and starts play without Supabase data", async () => {
    render(<CategorySort userId="" onExit={vi.fn()} />);

    expect(await screen.findByTestId("category-sort-intro")).toBeInTheDocument();
    expect(screen.getByTestId("category-sort-flow-shell").querySelector("h1")).toHaveTextContent("Clasifica y Ordena");
    expect(screen.getAllByTestId("category-sort-rule-card")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Empezar ejercicio" }));

    expect(screen.getByText("Tarjeta 1 de 12")).toBeInTheDocument();
    expect(screen.getByText(/Ordena por/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rojo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Naranja" })).toBeInTheDocument();
  }, 10_000);

  it("renders the intro in French without falling back to Spanish game copy", async () => {
    setLanguage("fr");

    render(<CategorySort userId="" onExit={vi.fn()} />);

    expect(await screen.findByTestId("category-sort-intro")).toBeInTheDocument();
    expect(screen.getByTestId("category-sort-flow-shell").querySelector("h1")).toHaveTextContent("Tri de categories");
    expect(screen.getByText("Triez chaque carte selon la regle affichee en haut. La regle changera.")).toBeInTheDocument();
    expect(screen.getAllByText("Couleur").length).toBeGreaterThan(0);
    expect(screen.getByText("Forme")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir l'exemple" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commencer l'exercice" })).toBeInTheDocument();
    expect(screen.queryByText("Clasifica y Ordena")).not.toBeInTheDocument();
  });

  it("advances practice levels after a strong completed round", () => {
    expect(getNextCategorySortTierAfterRound(1, 75)).toBe(2);
    expect(getNextCategorySortTierAfterRound(1, 74)).toBe(1);
    expect(getNextCategorySortTierAfterRound(19, 100)).toBe(20);
    expect(getNextCategorySortTierAfterRound(20, 100)).toBe(20);
  });

  it("varies the local practice rule sequence across levels", () => {
    expect(getFallbackSequence(1).rules.map((rule) => rule.rule)).toEqual(["color", "shape", "color"]);
    expect(getFallbackSequence(2).rules.map((rule) => rule.rule)).toEqual(["shape", "color", "shape"]);
    expect(getFallbackSequence(3).rules.map((rule) => rule.rule)).toEqual(["color", "size", "shape"]);
    expect(getFallbackSequence(1).rules[0].label_fr).toBe("Couleur");
  });
});
