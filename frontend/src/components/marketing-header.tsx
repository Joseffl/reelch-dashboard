"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const links = [
  { href: "/#how", label: "How it Works" },
  { href: "/#businesses", label: "For businesses" },
  { href: "/#promoters", label: "For promoters" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const desktop = window.matchMedia("(min-width: 901px)");
    const resize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", resize);
    window.addEventListener("keydown", close);
    return () => { desktop.removeEventListener("change", resize); window.removeEventListener("keydown", close); document.body.style.overflow = previous; };
  }, [open]);

  return <><header className={`header marketing-header ${open ? "navigation-open" : ""} ${scrolled ? "header-scrolled" : ""}`}>
    <div className="wrap nav">
      <Link href="/" aria-label="Reelch home" className="logo" onClick={() => setOpen(false)}>REELCH<span>.</span></Link>
      <nav aria-label="Primary navigation">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
      <div className="nav-actions"><Link href="/login">Sign in</Link><Link className="button dark" href="/register">Get started <ArrowRight/></Link></div>
      <button className="menu-button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="marketing-mobile-menu" onClick={() => setOpen(value => !value)}>{open ? <X/> : <Menu/>}</button>
    </div>
    <div id="marketing-mobile-menu" className={`mobile-menu ${open ? "mobile-menu-open" : ""}`} aria-hidden={!open} inert={!open}>
      <nav aria-label="Mobile navigation">{links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowRight/></Link>)}</nav>
      <div><Link href="/login" className="button light" onClick={() => setOpen(false)}>Sign in</Link><Link href="/register" className="button dark" onClick={() => setOpen(false)}>Get started <ArrowRight/></Link></div>
    </div>
  </header>{open && <button type="button" className="marketing-menu-backdrop" aria-label="Close navigation backdrop" onClick={() => setOpen(false)} />}</>;
}
