"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setStatus("success");
      setMessage("Thank you. Your note is on its way.");
      formElement.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="form-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label><span>Name</span><input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Your name" /></label>
      <label><span>Email</span><input name="email" type="email" required maxLength={160} autoComplete="email" placeholder="you@studio.com" /></label>
      <label><span>Project</span><textarea name="message" required minLength={10} maxLength={3000} rows={4} placeholder="Tell me a little about the project" /></label>
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending" : "Send inquiry"}<ArrowUpRight size={20} strokeWidth={1.5} />
      </button>
      <p className={`form-status ${status}`} aria-live="polite">{message}</p>
    </form>
  );
}
