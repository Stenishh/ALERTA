"use client";

import Link from "next/link";
import Image from "next/image";
import alertaLogo from "@/public/logo/ALERTA Logo.png";
import { usePathname } from "next/navigation";
import { useUnit } from "@/lib/unit-context";
import {
  LayoutGrid,
  Settings,
  PlusCircle,
  LucideIcon,
} from "lucide-react";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
}

function NavItem({ href, label, icon: Icon }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
        isActive
          ? "bg-white/10 text-white font-semibold"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      <Icon size={15} className="flex-shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const { unitName } = useUnit();

  return (
    <aside className="w-56 h-screen bg-slate-900 flex flex-col flex-shrink-0 border-r border-slate-800">

      {/* TOPO */}
      <div className="px-5 pt-7 pb-5 border-b border-slate-800">
        <Link
          href="/"
          aria-label="ALERTA — Painel Geral"
          className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <Image
            src={alertaLogo}
            alt="ALERTA"
            priority
            sizes="184px"
            className="h-auto w-full"
          />
        </Link>
        <p className="text-center text-slate-300 text-[11px] mt-3 uppercase tracking-[0.2em] truncate">
          {unitName || "Adicione o nome do hospital"}
        </p>
      </div>

      {/* NAVEGAÇÃO */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-1">
        <NavItem href="/" label="Painel Geral" icon={LayoutGrid} />
      </nav>

      {/* RODAPÉ */}
      <div className="px-3 py-4 border-t border-slate-800 flex flex-col gap-1">
        <NavItem href="/devices/new" label="Novo Dispositivo" icon={PlusCircle} />
        <NavItem href="/settings" label="Configurações" icon={Settings} />
        
      </div>

    </aside>
  );
}
