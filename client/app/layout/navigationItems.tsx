import {
  BookOpen,
  Calendar,
  FolderKanban,
  Settings,
  Sun,
  Wrench,
} from "lucide-react";
import type { TFunction } from "i18next";

export function getSidebarItems(t: TFunction) {
  return [
  {
    id: "today",
    title: t("nav.today"),
    href: "/today",
    icon: <Sun className="h-4 w-4" />,
  },
  {
    id: "calendar",
    title: t("nav.calendar"),
    href: "/calendar",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    id: "tools",
    title: t("nav.tools"),
    href: "/tools",
    icon: <Wrench className="h-4 w-4" />,
  },
  {
    id: "activities",
    title: t("nav.activities"),
    href: "/activities",
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    id: "concepts",
    title: t("nav.concepts"),
    href: "/concepts",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    id: "settings",
    title: t("nav.settings"),
    href: "/settings",
    icon: <Settings className="h-4 w-4" />,
  },
];
}

export function getBottomBarItems(t: TFunction) {
  return [
    { id: "today", href: "/today", icon: <Sun className="h-5 w-5" />, title: t("nav.today") },
    { id: "calendar", href: "/calendar", icon: <Calendar className="h-5 w-5" />, title: t("nav.calendar") },
    { id: "tools", href: "/tools", icon: <Wrench className="h-5 w-5" />, title: t("nav.tools") },
    { id: "activities", href: "/activities", icon: <FolderKanban className="h-5 w-5" />, title: t("nav.activities") },
    { id: "settings", href: "/settings", icon: <Settings className="h-5 w-5" />, title: t("nav.settings") },
  ];
}
