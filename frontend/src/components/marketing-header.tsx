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
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return <header className={`header marketing-header ${scrolled ? "header-scrolled" : ""}`}>
    <div className="wrap nav">
      <Link href="/" className="logo">REELCH<span>.</span></Link>
      <nav aria-label="Primary navigation">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
      <div className="nav-actions"><Link href="/login">Sign in</Link><Link className="button dark" href="/#waitlist">Get early access <ArrowRight/></Link></div>
      <button className="menu-button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? <X/> : <Menu/>}</button>
    </div>
    <div className={`mobile-menu ${open ? "mobile-menu-open" : ""}`} aria-hidden={!open}>
      <nav aria-label="Mobile navigation">{links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowRight/></Link>)}</nav>
      <div><Link href="/login" className="button light" onClick={() => setOpen(false)}>Sign in</Link><Link href="/#waitlist" className="button dark" onClick={() => setOpen(false)}>Get early access <ArrowRight/></Link></div>
    </div>
  </header>;
}
