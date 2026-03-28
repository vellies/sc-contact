"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/locations", label: "Locations" },
  { href: "/education", label: "Education" },
  { href: "/institutions", label: "Institutions" },
  { href: "/mailerlite", label: "MailerLite" },
];

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
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-blue-600",
                  pathname === link.href || (link.href === "/dashboard" && pathname === "/") ? "text-blue-600" : "text-gray-600"
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}

          {user ? (
            <>
              <li className="text-sm text-gray-600 font-medium">
                Hi, {user.name}
              </li>
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
