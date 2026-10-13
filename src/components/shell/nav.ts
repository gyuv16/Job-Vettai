import {
  BriefcaseBusiness,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Radar,
  Settings,
  Trophy,
  UserRound,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  hint: string;
  primary?: boolean;
}

// Mirrors the original framework's commands: /setup, /scrape, /rank, /apply,
// /interview, /outcome (+ /html-report), /upskill.
export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, hint: "Pipeline at a glance", primary: true },
  { href: "/profile", label: "Profile", short: "Profile", icon: UserRound, hint: "Your source of truth" },
  { href: "/search", label: "Job Search", short: "Search", icon: Radar, hint: "Scan job portals", primary: true },
  { href: "/rank", label: "Rank & Shortlist", short: "Rank", icon: Trophy, hint: "Batch fit scoring", primary: true },
  { href: "/apply", label: "Apply Studio", short: "Apply", icon: WandSparkles, hint: "Evaluate, draft, review", primary: true },
  { href: "/interview", label: "Interview Prep", short: "Interview", icon: MessagesSquare, hint: "Prep packs & mock" },
  { href: "/tracker", label: "Tracker", short: "Tracker", icon: BriefcaseBusiness, hint: "Kanban of applications", primary: true },
  { href: "/upskill", label: "Upskill", short: "Upskill", icon: GraduationCap, hint: "Gap heatmap & plan" },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings, hint: "Keys, data, theme" },
];
