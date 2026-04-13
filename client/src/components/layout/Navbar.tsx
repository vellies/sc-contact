"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type NavItem =
  | { type: "link"; href: string; label: string }
  | { type: "group"; label: string; items: { href: string; label: string }[] };

const navItems: NavItem[] = [
  { type: "link",  href: "/dashboard", label: "Dashboard" },
  { type: "link",  href: "/locations", label: "Locations" },
  {
    type: "group",
    label: "Education",
    items: [
      { href: "/education",    label: "Education Finder" },
      { href: "/institutions", label: "Institutions" },
      { href: "/mailerlite",   label: "Scrape" },
    ],
  },
  {
    type: "group",
    label: "Coaching",
    items: [
      { href: "/coaching",      label: "Coaching Finder" },
      { href: "/coaching-list", label: "Coaching List" },
    ],
  },
  { type: "link", href: "/gleads", label: "gLeads" },
];

function DropdownGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: { href: string; label: string }[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const isActive = items.some((i) => pathname === i.href);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <li ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 text-sm font-medium transition-colors hover:text-blue-600",
          isActive ? "text-blue-600" : "text-gray-600"
        )}
      >
        {label}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-44 bg-white border rounded-xl shadow-lg py-1 z-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-4 py-2 text-sm transition-colors hover:bg-blue-50 hover:text-blue-600",
                pathname === item.href
                  ? "text-blue-600 font-medium bg-blue-50"
                  : "text-gray-600"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">
          Education
        </Link>

        <ul className="flex items-center gap-6">
          {navItems.map((item) =>
            item.type === "link" ? (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-blue-600",
                    pathname === item.href || (item.href === "/dashboard" && pathname === "/")
                      ? "text-blue-600"
                      : "text-gray-600"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ) : (
              <DropdownGroup
                key={item.label}
                label={item.label}
                items={item.items}
                pathname={pathname}
              />
            )
          )}

          {user ? (
            <>
              <li className="text-sm text-gray-600 font-medium">Hi, {user.name}</li>
              <li>
                <button
                  onClick={logout}
                  className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                >
                  Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link
                  href="/login"
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-blue-600",
                    pathname === "/login" ? "text-blue-600" : "text-gray-600"
                  )}
                >
                  Login
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Sign Up
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}
