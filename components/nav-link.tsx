"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkProps = {
  href: string;
  label: string;
  icon: string;
};

export function NavLink({ href, icon, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link className={`nav-link${isActive ? " nav-link-active" : ""}`} href={href}>
      <span aria-hidden="true" className="material-symbols-outlined nav-link-icon">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
