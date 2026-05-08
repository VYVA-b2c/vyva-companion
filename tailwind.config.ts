import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx,jsx}", "./components/**/*.{ts,tsx,jsx}", "./app/**/*.{ts,tsx,jsx}", "./src/**/*.{ts,tsx,jsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        display: ["Lora", "serif"],
        body: ["DM Sans", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        vyva: {
          purple: "hsl(var(--vyva-purple))",
          "purple-light": "hsl(var(--vyva-purple-light))",
          "purple-pale": "hsl(var(--vyva-purple-pale))",
          gold: "hsl(var(--vyva-gold))",
          "gold-light": "hsl(var(--vyva-gold-light))",
          green: "hsl(var(--vyva-green))",
          "green-light": "hsl(var(--vyva-green-light))",
          "green-dark": "hsl(var(--vyva-green-dark))",
          red: "hsl(var(--vyva-red))",
          "red-light": "hsl(var(--vyva-red-light))",
          teal: "hsl(var(--vyva-teal))",
          "teal-light": "hsl(var(--vyva-teal-light))",
          rose: "hsl(var(--vyva-rose))",
          "rose-light": "hsl(var(--vyva-rose-light))",
          cream: "hsl(var(--vyva-cream))",
          warm: "hsl(var(--vyva-warm))",
          warm2: "hsl(var(--vyva-warm2))",
          "text-1": "hsl(var(--vyva-text-1))",
          "text-2": "hsl(var(--vyva-text-2))",
          "text-3": "hsl(var(--vyva-text-3))",
          border: "hsl(var(--vyva-border))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "vyva-card": "0 2px 12px rgba(0,0,0,0.07)",
        "vyva-card-hover": "0 4px 20px rgba(0,0,0,0.12)",
        "vyva-hero": "0 8px 32px rgba(91,18,160,0.25)",
        "vyva-sos": "0 4px 16px rgba(185,28,28,0.40)",
        "vyva-fab": "0 4px 18px rgba(107,33,168,0.40)",
        "vyva-input": "0 1px 4px rgba(0,0,0,0.06)",
      },
      fontSize: {
        "vyva-hero": ["28px", { lineHeight: "1.25", fontWeight: "700" }],
        "vyva-title": ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        "vyva-body-lg": ["17px", { lineHeight: "1.65" }],
        "vyva-body": ["15px", { lineHeight: "1.6" }],
        "vyva-caption": ["13px", { lineHeight: "1.5" }],
        "vyva-label": ["11px", { lineHeight: "1.4", letterSpacing: "0.04em" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
