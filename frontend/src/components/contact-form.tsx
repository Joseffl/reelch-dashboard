"use client";

import { PhoneField } from "./phone-field";

import { useErrorToast, toast } from "@/components/toasts";

import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [, setError] = useErrorToast();
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(data.entries());
    try {
      const response = await fetch(`${apiUrl}/contact`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message[0] : result.message ?? "We could not send your message");
      setComplete(true); toast.success("Your message has been received.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not send your message"); }
    finally { setBusy(false); }
  }

  if (complete) return <div className="contact-form-success"><span><Check/></span><h2>Message received.</h2><p>Thanks for reaching out. The Reelch team can now review your enquiry from the support dashboard.</p><button type="button" onClick={() => setComplete(false)}>Send another message</button></div>;

  return <form className="contact-form" onSubmit={submit}>
    <div className="contact-form-heading"><h2>Send us a message.</h2><p>Fields marked with * are required.</p></div>
    <div className="contact-form-fields">
      <Field label="Full name *" name="fullName" placeholder="Your full name" required/>
      <Field label="Email address *" name="email" type="email" placeholder="you@example.com" required/>
      <PhoneField label="Phone number" name="phone" />
      <Field label="Company" name="company" placeholder="Company or organisation"/>
      <label>What can we help with? *<select name="enquiryType" required defaultValue=""><option value="" disabled>Select one</option><option value="business">Running a campaign</option><option value="promoter">Becoming a promoter</option><option value="support">Account support</option><option value="partnership">Partnership</option><option value="other">Something else</option></select></label>
      <Field label="Subject *" name="subject" placeholder="A short summary" required/>
      <label className="contact-message">Message *<textarea name="message" minLength={20} maxLength={5000} required placeholder="Tell us how we can help…"/></label>
    </div>

    <button className="button dark contact-submit" disabled={busy}>{busy ? <><LoaderCircle className="contact-spinner"/> Sending…</> : <>Send message <ArrowRight/></>}</button>
    <small>Do not include passwords or payment credentials.</small>
  </form>;
}

function Field({ label, name, type = "text", placeholder, required = false }: { label:string;name:string;type?:string;placeholder:string;required?:boolean }) {
  return <label>{label}<input name={name} type={type} placeholder={placeholder} required={required}/></label>;
}
