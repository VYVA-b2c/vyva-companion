import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";
import MenuScreen, { MENU_TILES } from "./MenuScreen";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderMenu(props?: ComponentProps<typeof MenuScreen>) {
  return render(
    <MemoryRouter initialEntries={["/menu"]}>
      <Routes>
        <Route path="/menu" element={<><MenuScreen {...props} /><LocationProbe /></>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MenuScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders exactly the four approved Menu tiles", () => {
    renderMenu();

    const grid = screen.getByTestId("menu-tile-grid");
    const tiles = within(grid).getAllByRole("button");

    expect(tiles).toHaveLength(4);
    expect(grid).toHaveTextContent("My Health");
    expect(grid).toHaveTextContent("Brain Power");
    expect(grid).toHaveTextContent("Community");
    expect(grid).toHaveTextContent("Concierge");
    expect(grid).toHaveTextContent("Check-ins & medicines");
    expect(grid).toHaveTextContent("Memory, focus & calm");
    expect(grid).toHaveTextContent("Rooms & support");
    expect(grid).toHaveTextContent("Everyday help");
    expect(screen.getByTestId("menu-shell")).toHaveClass("lg:max-w-[900px]");
    expect(MENU_TILES.map((tile) => tile.path)).toEqual([
      "/health",
      "/mind-memory",
      "/social-rooms",
      "/concierge",
    ]);
    expect(screen.getByTestId("menu-tile-health").querySelector('[data-vyva-accent="pulse"]')).toBeInTheDocument();
    expect(screen.getByTestId("menu-tile-brain").querySelector('[data-vyva-accent="bridge"]')).toBeInTheDocument();
    expect(screen.getByTestId("menu-tile-community").querySelector('[data-vyva-accent="link"]')).toBeInTheDocument();
    expect(screen.getByTestId("menu-tile-concierge").querySelector('[data-vyva-accent="clapper"]')).toBeInTheDocument();
  });

  it("routes each Menu tile to the existing app destination", () => {
    renderMenu();

    fireEvent.click(screen.getByTestId("menu-tile-brain"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/mind-memory");
  });

  it("can override tile paths for the isolated Home/Nav design preview", () => {
    renderMenu({
      tilePathOverrides: {
        health: "/dev/home-master/health",
        brain: "/dev/home-master/brain",
        community: "/dev/home-master/community",
        concierge: "/dev/home-master/concierge",
      },
    });

    fireEvent.click(screen.getByTestId("menu-tile-health"));
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/dev/home-master/health");
  });

  it("returns to Home from the voice button", () => {
    renderMenu();

    fireEvent.click(screen.getByTestId("button-menu-voice-home"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/");
  });

  it("opens profile and settings in-place from manual mode before protected routes", () => {
    renderMenu();

    fireEvent.click(screen.getByTestId("button-menu-profile"));

    const profileMenu = screen.getByTestId("menu-profile-menu");
    expect(profileMenu).toBeInTheDocument();
    expect(profileMenu).toHaveTextContent("Profile & settings");
    expect(profileMenu).toHaveClass("md:max-w-[720px]");
    expect(profileMenu).toHaveClass("md:top-1/2");
    expect(profileMenu).toHaveClass("md:-translate-y-1/2");
    expect(screen.getByTestId("menu-profile-menu-links")).toHaveClass("md:grid-cols-2");
    expect(screen.getByTestId("button-menu-profile-menu-backdrop")).toHaveClass("md:backdrop-blur-[3px]");
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/menu");
    expect(screen.getByTestId("button-menu-profile-account").querySelector('[data-vyva-accent="id"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-health").querySelector('[data-vyva-accent="pulse"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-medications").querySelector('[data-vyva-accent="divider"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-emergency").querySelector('[data-vyva-accent="check"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-care-team").querySelector('[data-vyva-accent="link"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-providers").querySelector('[data-vyva-accent="scope"]')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-menu-profile-account"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/settings/account");
  });

  it("can return to the public Home preview when rendered by the dev preview route", () => {
    renderMenu({ backPath: "/dev/home-master" });

    fireEvent.click(screen.getByTestId("button-menu-voice-home"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/dev/home-master");
  });

  it("uses the right-side purple voice control instead of a back control", () => {
    renderMenu();

    const voiceHomeButton = screen.getByTestId("button-menu-voice-home");

    expect(screen.queryByTestId("button-menu-back")).not.toBeInTheDocument();
    expect(voiceHomeButton).not.toHaveClass("justify-self-end");
    expect(voiceHomeButton).toHaveClass("h-10");
    expect(voiceHomeButton).toHaveClass("w-10");
    expect(voiceHomeButton).toHaveClass("!min-h-10");
    expect(voiceHomeButton).toHaveClass("bg-[#6D28D9]");
    expect(voiceHomeButton).toHaveClass("text-white");
  });

  it("uses a cohesive dark Menu surface when the Home master theme is dark", () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");

    renderMenu();

    expect(screen.getByTestId("menu-screen")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByTestId("menu-screen")).toHaveClass("bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)]");
    expect(screen.getByTestId("menu-tile-health")).toHaveClass("bg-[#2A2034]");
    expect(screen.getByTestId("button-menu-profile")).toBeInTheDocument();
  });

  it("uses the canonical My Health action-grid rhythm across breakpoints", () => {
    renderMenu();

    const grid = screen.getByTestId("menu-tile-grid");
    const firstTile = screen.getByTestId("menu-tile-health");

    expect(grid).toHaveClass("grid-cols-1", "gap-4");
    expect(grid).toHaveClass("md:grid-cols-2");
    expect(grid).toHaveClass("md:gap-5");
    expect(grid).not.toHaveClass("lg:grid-cols-4");
    expect(firstTile).toHaveClass("min-h-[84px]", "md:min-h-[158px]");
    expect(firstTile).toHaveClass("grid-cols-[56px_minmax(0,1fr)_auto]");
    expect(firstTile).toHaveClass("md:grid-cols-[64px_minmax(0,1fr)_auto]");
    expect(firstTile).toHaveClass("rounded-[26px]", "md:p-5");
    expect(screen.getByTestId("menu-tile-health-title")).toHaveClass("text-[20px]", "md:text-[24px]");
    expect(screen.getByTestId("menu-tile-health-detail")).toHaveClass("sr-only");
    expect(firstTile.querySelector('[data-vyva-icon="utility"]')).toBeInTheDocument();
  });

  it("matches the Home master responsive shell width without becoming fixed-width", () => {
    renderMenu();

    const shell = screen.getByTestId("menu-shell");
    const topbar = screen.getByTestId("menu-topbar");

    expect(shell).toHaveClass("w-full");
    expect(shell).toHaveClass("max-w-[430px]");
    expect(shell).toHaveClass("sm:max-w-[680px]");
    expect(shell).toHaveClass("lg:max-w-[900px]");
    expect(shell).toHaveClass("px-6", "sm:px-7", "pt-8");
    expect(topbar).toHaveClass("grid-cols-[40px_1fr_40px]");
    expect(topbar).not.toHaveClass("px-1", "sm:px-3", "lg:px-5");
    expect(screen.getByTestId("button-menu-profile")).toHaveClass("h-10", "w-10");
    expect(screen.getByTestId("button-menu-voice-home")).toHaveClass("h-10", "w-10");
    expect(screen.getByTestId("menu-screen")).not.toHaveClass("px-5", "md:px-8");
    expect(screen.getByRole("heading", { name: "Menu" })).toHaveClass("sr-only");
    expect(screen.getByRole("heading", { name: "Menu" })).toHaveClass("md:not-sr-only");
    expect(screen.getByTestId("menu-grid-stage")).toHaveClass("mt-7");
    expect(screen.getByTestId("menu-grid-stage")).not.toHaveClass("md:items-center");
    expect(screen.getByTestId("menu-screen")).not.toHaveClass("pb-[calc(120px+env(safe-area-inset-bottom))]");
  });
});
