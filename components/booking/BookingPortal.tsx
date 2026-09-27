"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, MapPin, Plus, ShieldCheck, CalendarDays } from "lucide-react";
import { bookingCategories, eligibleAddonsFor, projectQuestion, quoteFor, money, type BookingCategory, type BookingPackage, type PaymentOption } from "@/data/booking";
import { musicBookingTerms } from "@/data/music-booking";
import { shootWindow } from "@/lib/booking/hours";
import type { Intake } from "@/lib/booking/schema";
import { promotionDateLabel, savingsFor, savingsPercentFor, type PublicPromotion } from "@/lib/booking/promotions";
import { Availability } from "./Availability";
import styles from "@/app/booking/portal.module.css";

const Scheduler = dynamic(() => import("./Scheduler"), { ssr: false, loading: () => <div className={styles.loading}>Opening the booking calendar…</div> });
type Policies = { version: string; cancellation: string; rescheduling: string; balance: string };
type SchedulingSession = { calLink: string; config: { name: string; email: string; notes: string; date: string; slot: string } };

// initial* props pre-fill the wizard from an assistant-created draft (see
// app/checkout/review/page.tsx); the customer still reviews and submits
// through the same trusted steps as a normal visitor.
export function BookingPortal({ live, policies, enabledPackages, fullPaymentPackages, promotions, packages, initialPackageId, initialAddonIds, initialSlot, initialPaymentOption, initialPromoCode, initialIntake, initialStep }: { live: boolean; policies: Policies; enabledPackages: string[]; fullPaymentPackages: string[]; promotions: PublicPromotion[]; packages: BookingPackage[]; initialPackageId?: string; initialAddonIds?: string[]; initialSlot?: string; initialPaymentOption?: PaymentOption; initialPromoCode?: string; initialIntake?: Partial<Intake>; initialStep?: number }) {
  const initialSelected = initialPackageId ? packages.find((pkg) => pkg.id === initialPackageId) ?? null : null;
  const [category, setCategory] = useState<BookingCategory>(initialSelected?.category ?? "music");
  const [selected, setSelected] = useState<BookingPackage | null>(initialSelected);
  const [step, setStep] = useState(initialStep ?? 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<SchedulingSession | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>(initialAddonIds ?? []);
  const [intake, setIntake] = useState<Partial<Intake>>(initialIntake ?? {});
  const [selectedSlot, setSelectedSlot] = useState(initialSlot ?? "");
  const [paymentOption, setPaymentOption] = useState<PaymentOption>(initialAddonIds?.length ? "deposit" : initialPaymentOption ?? "deposit");
  const [promoCode, setPromoCode] = useState(initialPromoCode ?? "");
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const packagesViewport = useRef<HTMLDivElement>(null);
  const [activePackageIndex, setActivePackageIndex] = useState(0);
  const visiblePackages = packages.filter((pkg) => pkg.category === category);
  // Live booking only works for packages mapped to a Cal event; the rest become quote requests.
  const bookable = (pkg: BookingPackage) => !pkg.inquiryOnly && (!live || enabledPackages.includes(pkg.id));
  const selectedPromotion = selected ? promotions.find((promotion) => promotion.packageId === selected.id) ?? null : null;
  const quote = selected && !selected.inquiryOnly ? quoteFor(selected.id, addonIds, paymentOption, selectedPromotion, packages) : null;
  // Live pay-in-full needs its own full-price Cal event; the preview always shows both choices.
  const canPayFull = Boolean(selected && addonIds.length === 0 && (!live || fullPaymentPackages.includes(selected.id)));
  const eligibleAddons = selected ? eligibleAddonsFor(selected) : [];
  const currentCategory = bookingCategories.find((item) => item.id === category)!;

  function move(next: number) { setStep(next); setError(""); requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); document.getElementById("booking-flow")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); }); }
  function navigateStep(next: number) { if (next === 0 || (next === 1 && Boolean(category)) || (next === 2 && Boolean(selected)) || (next === 3 && Boolean(selectedSlot))) { setSession(null); move(next); } }
  function choose(pkg: BookingPackage) { setSelected(pkg); setAddonIds([]); setSession(null); setSelectedSlot(""); setPaymentOption("deposit"); setPromoCode(""); move(2); }
  function toggleAddon(id: string) {
    setAddonIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setPaymentOption("deposit");
    setSession(null);
  }

  function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    const fields = Object.fromEntries(form);
    setIntake({ ...intake, ...fields } as Partial<Intake>);
    setSession(null); move(4);
  }

  function preview(values: Intake) {
    sessionStorage.setItem("mb-booking-preview", JSON.stringify({ packageId: values.packageId, package: selected, addonIds: values.addonIds, paymentOption: values.paymentOption, promotion: selectedPromotion, slot: values.selectedSlot, name: values.name || "Your name" }));
    router.push("/booking/success?preview=1");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const terms = new FormData(event.currentTarget).get("terms") === "on";
    const values = { ...intake, packageId: selected.id, selectedSlot, addonIds, paymentOption, promoCode, promotionId: selectedPromotion?.id, terms } as Intake;
    setIntake(values); setError("");
    if (!live) { preview(values); return; }
    setPending(true);
    try {
      const response = await fetch("/api/booking/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn’t open scheduling. Please try again.");
      setSession(data); move(4); // same step: brings the summary and Cal checkout into view
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setPending(false); }
  }

  return <main id="main-content">
    <section className={styles.flow} id="booking-flow">
      <ol className={styles.steps} aria-label="Booking progress">{["Production", "Package", "Date", "Details", "Payment"].map((label, index) => { const active = step; const completed = active > index; return <li key={label} className={active === index ? styles.stepActive : completed ? styles.stepDone : ""} aria-current={active === index ? "step" : undefined}>{completed ? <button type="button" className={styles.stepButton} onClick={() => navigateStep(index)} aria-label={`Return to ${label}`}><span aria-hidden="true"><Check size={14} /></span><span className={styles.stepLabel}>{label}</span></button> : <><span aria-hidden="true">{`0${index + 1}`}</span><span className={styles.stepLabel}>{label}</span></>}</li>; })}</ol>

      {step <= 1 ? <>
        {step === 0 && <><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / YOUR STORY, YOUR FORMAT</p><h2 ref={heading} tabIndex={-1}>WHAT ARE WE <em>MAKING?</em></h2></div><p>Start with the shape of the story.<br />We’ll build the right production around it.</p></div>
        <div className={styles.categories} role="group" aria-label="Production category">{bookingCategories.map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => { setCategory(item.id); setActivePackageIndex(0); move(1); }} className={category === item.id ? styles.categoryActive : ""}><span className={styles.categoryTop}><span>{item.number}</span><ArrowUpRight size={16} /></span><strong>{item.label}</strong><small>{item.description}</small></button>)}</div></>}
        {step === 1 && <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / FIND YOUR FIT</p><h2 ref={heading} tabIndex={-1}>CHOOSE YOUR <em>PACKAGE.</em></h2></div><p>{currentCategory.description}<br />Pick the scope that matches the story.</p></div>}
        {step === 1 && <><div className={styles.categoryCaption}><span>{category === "music" ? musicBookingTerms.tagline : currentCategory.description}</span><span>PACKAGE {String(activePackageIndex + 1).padStart(2, "0")} / {String(visiblePackages.length).padStart(2, "0")}</span></div>
        <div className={styles.packages} key={category} role="region" aria-roledescription="carousel" aria-label={`${currentCategory.label} packages`} ref={packagesViewport} onScroll={(event) => { const cards = Array.from(event.currentTarget.children) as HTMLElement[]; if (!cards.length) return; const center = event.currentTarget.getBoundingClientRect().left + event.currentTarget.clientWidth / 2; const nearest = cards.reduce((best, card, i) => Math.abs(card.getBoundingClientRect().left + card.offsetWidth / 2 - center) < Math.abs(cards[best].getBoundingClientRect().left + cards[best].offsetWidth / 2 - center) ? i : best, 0); setActivePackageIndex((current) => current === nearest ? current : nearest); }}>{visiblePackages.map((pkg, index) => { const deal = promotions.find((promotion) => promotion.packageId === pkg.id); return <article key={pkg.id} aria-roledescription="slide" aria-label={`${pkg.name}, package ${index + 1} of ${visiblePackages.length}`} className={[styles.package, pkg.featured ? styles.featured : "", deal ? styles.dealPackage : "", activePackageIndex === index ? styles.packageCurrent : ""].filter(Boolean).join(" ")} style={{ animationDelay: `${index * 70}ms` }}>
          <div className={styles.packageTop}><span>0{index + 1} / {currentCategory.label}</span>{deal ? <span className={styles.dealTag}>{deal.label || "PACKAGE DEAL"}</span> : pkg.featured && <span className={styles.featuredTag}>THE STUDIO PICK</span>}</div>
          <h3>{pkg.name}</h3><ul className={styles.essentialList}>{pkg.includes.filter((item) => !/\b(?:hours?|locations?)\b|professional camera setup|cinematic editing|professional lighting setup/i.test(item)).slice(0, 2).map((item) => <li key={item}><Check size={14} />{item}</li>)}{pkg.revisions > 0 && <li><Check size={14} />{pkg.revisions} revision{pkg.revisions > 1 ? "s" : ""}</li>}</ul>
          <div className={styles.price}>{pkg.inquiryOnly && !pkg.price ? <strong>Let’s talk.</strong> : deal ? <><span>{deal.label || "SPECIAL RATE"}</span><del>{money(deal.originalPrice)}</del><strong>{money(deal.discountedPrice)}<small>USD</small></strong><b className={styles.savings}>{deal.discountType === "percentage" ? `SAVE ${savingsPercentFor(deal)}%` : `SAVE ${money(savingsFor(deal))}`}</b><p>{money(Math.round(deal.discountedPrice * .5))} deposit (50%) to reserve your shoot</p></> : <><span>{pkg.startingPrice || pkg.category !== "music" ? "STARTING AT" : "PACKAGE PRICE"}</span><strong>{money(pkg.price)}{pkg.startingPrice ? "+" : ""}<small>USD</small></strong><p>{pkg.inquiryOnly ? "50%" : money(pkg.deposit)} {pkg.category === "music" ? "non-refundable " : ""}deposit{pkg.inquiryOnly ? "" : " (50%)"} to reserve your shoot{pkg.inquiryOnly ? " after quote approval" : ", or pay in full"}</p></>}</div>
          {deal && <div className={styles.dealDetails}>{deal.valueNote && <strong>{deal.valueNote}</strong>}<span>Available until {promotionDateLabel(deal.bookingDeadline || deal.endsOn)}</span>{deal.remainingQuantity !== null && <span>{deal.remainingQuantity} booking{deal.remainingQuantity === 1 ? "" : "s"} remaining at this rate</span>}{deal.requiresCode && <span>Promo code required</span>}</div>}
          <div className={styles.packageStats}><span><Clock3 size={15} />{pkg.minutes ? `${pkg.category === "music" ? "Up to " : ""}${pkg.minutes / 60}-hour shoot` : "Tailored scope"}</span><span><MapPin size={15} />{pkg.locationLabel || (pkg.locations ? `${pkg.locations} location${pkg.locations > 1 ? "s" : ""}` : "Any location")}</span></div>
          {!bookable(pkg) ? <a className={styles.outlineButton} href={`mailto:hello@vizualbymb.com?subject=${encodeURIComponent(`${pkg.name} production inquiry`)}`}>{pkg.inquiryOnly ? "Request custom quote" : "Request this package"} <ArrowUpRight size={18} /></a> : <button type="button" className={pkg.featured || deal ? styles.primaryButton : styles.outlineButton} onClick={() => choose(pkg)}>{deal ? "Book this deal" : "Book this package"} <ArrowUpRight size={18} /></button>}
        </article>; })}</div>
        <div className={styles.packagePager} role="group" aria-label="Choose a package to view">{visiblePackages.map((pkg, index) => <button key={pkg.id} type="button" aria-label={`Show package ${index + 1}: ${pkg.name}`} aria-current={activePackageIndex === index ? "true" : undefined} onClick={() => packagesViewport.current?.children[index]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest", inline: "center" })}><span /></button>)}</div>
        <div className={styles.customQuote}><span>HAVE SOMETHING ELSE IN MIND?</span><p>Some stories need a different starting point.</p><a href="mailto:hello@vizualbymb.com?subject=Custom%20production%20inquiry">Let’s build your production <ArrowUpRight size={18} /></a></div></>}
      </> : selected && quote && <>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{step === 2 ? "03 / FIND YOUR MOMENT" : step === 3 ? "04 / SET THE SCENE" : "05 / MAKE IT OFFICIAL"}</p><h2 ref={heading} tabIndex={-1}>{step === 2 ? <>LET’S SET <em>THE DATE.</em></> : step === 3 ? <>TELL US THE <em>VISION.</em></> : <>YOUR NEXT <em>CHAPTER.</em></>}</h2></div></div>
        <div className={`${styles.checkoutGrid} ${step === 2 || step === 3 ? styles.detailsStep : ""}`}><div className={styles.checkoutMain}>
          {step === 2 && <>{eligibleAddons.length > 0 && <section><p className={styles.eyebrow}>OPTIONAL ADD-ONS</p><div className={styles.addons}>{eligibleAddons.map((addon) => <label key={addon.id} className={`${styles.addon} ${addonIds.includes(addon.id) ? styles.addonSelected : ""}`}><input type="checkbox" checked={addonIds.includes(addon.id)} onChange={() => toggleAddon(addon.id)} /><span className={styles.addonIcon}>{addonIds.includes(addon.id) ? <Check size={18} /> : <Plus size={18} />}</span><span><strong>{addon.name}</strong><small>{addon.description}</small></span><b>+{money(addon.price)}</b></label>)}</div><p className={styles.smallText}>Add-ons are added to the remaining balance. Paying in full online is available only when no add-ons are selected.</p></section>}<Availability live={live} packageId={selected.id} minutes={selected.minutes} onSelect={(slot) => { setSelectedSlot(slot); move(3); }} /></>}
          {step === 3 && <form className={styles.intake} onSubmit={saveDetails}>
            <p className={styles.smallText}>Selected: {selectedSlot && `${new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "America/New_York" }).format(new Date(selectedSlot))}, ${shootWindow(selectedSlot, selected.minutes)}`} · New York time. Not reserved until payment.</p>
            <div className={styles.formTrap} aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <div className={styles.fieldGrid}>
              <label>Full name <span>*</span><input name="name" required minLength={2} maxLength={100} autoComplete="name" defaultValue={intake.name} placeholder="Your name" /></label>
              <label>Email <span>*</span><input name="email" type="email" required maxLength={160} autoComplete="email" defaultValue={intake.email} placeholder="you@example.com" /></label>
              <label>Phone number <span>*</span><input name="phone" type="tel" required minLength={7} maxLength={30} autoComplete="tel" defaultValue={intake.phone} placeholder="(555) 000-0000" /></label>
              <label>How did you find us? <small>Optional</small><select name="referral" defaultValue={intake.referral ?? ""}><option value="">Choose one</option>{["Instagram", "TikTok", "YouTube", "Google search", "Referral from a friend", "Worked together before", "LinkedIn", "Other"].map((o) => <option key={o}>{o}</option>)}</select></label>
              <label className={styles.fullField}>{projectQuestion.label} <span>*</span><textarea name="project" required minLength={15} maxLength={2000} rows={4} defaultValue={intake.project} placeholder={projectQuestion.placeholder} /></label>
            </div>
            <button type="submit" className={styles.primaryButton}>Continue to payment<ArrowRight size={18} /></button><p className={styles.secureNote}><ShieldCheck size={15} />{live ? "Nothing is charged until you confirm payment at the next step." : "Preview only. Your details stay in this browser and are not submitted."}</p>
          </form>}
          {step === 4 && (session ? <>
            <div className={styles.paymentSummary}><p><strong>{paymentOption === "full" ? "Pay in full" : "Deposit"} · {money(quote.dueNow)} today</strong><span>{paymentOption === "full" ? "Nothing left to pay" : `${money(quote.balance)} balance later`} · {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(selectedSlot))}, {shootWindow(selectedSlot, selected.minutes)}</span></p><button type="button" className={styles.textLink} onClick={() => setSession(null)}>Change</button></div>
            <Scheduler session={session} />
          </> : live && !enabledPackages.includes(selected.id) ? <div className={styles.emptyState}><CalendarDays size={36} /><h3>Your package isn’t open for online booking yet.</h3><p>Please contact the studio to find a date.</p><a href="mailto:hello@vizualbymb.com" className={styles.primaryButton}>Contact the studio <ArrowUpRight size={17} /></a></div> : <form className={styles.intake} onSubmit={submit}>
            <p className={styles.smallText}>Selected: {`${new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "America/New_York" }).format(new Date(selectedSlot))}, ${shootWindow(selectedSlot, selected.minutes)}`} · New York time. Not reserved until payment.</p>
            <div className={styles.addons} role="radiogroup" aria-label="Payment option">{([["deposit", "Pay the deposit", `${money(quote.deposit)} today to reserve your date. ${money(quote.total - quote.deposit)} remaining balance.`, quote.deposit], ["full", "Pay in full", `${money(quote.total)} today. Nothing left to pay.`, quote.total]] as const).filter(([id]) => id === "deposit" || canPayFull).map(([id, name, detail, amount]) => <label key={id} className={`${styles.addon} ${paymentOption === id ? styles.addonSelected : ""}`}><input type="radio" name="paymentOption" value={id} checked={paymentOption === id} onChange={() => setPaymentOption(id)} /><span className={styles.addonIcon}>{paymentOption === id && <Check size={18} />}</span><span><strong>{name}</strong><small>{detail}</small></span><b>{money(amount)}</b></label>)}</div>
            {selectedPromotion?.requiresCode && <label className={styles.promoCode}>Promo code <span>*</span><input value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} required maxLength={40} autoCapitalize="characters" autoComplete="off" placeholder="Enter your package code" /><small>The offer is revalidated securely before payment.</small></label>}
            <div className={styles.termsBox}><h3>A FEW THINGS TO KNOW.</h3>{selected.category === "music" && <p>{paymentOption === "full" ? "Paying in full secures your shoot date; the 50% deposit portion is non-refundable." : musicBookingTerms.deposit}</p>}{paymentOption === "deposit" && <p>{policies.balance}</p>}<details><summary>Cancellation & rescheduling <ChevronDown size={15} /></summary><p>{policies.cancellation}</p><p>{policies.rescheduling}</p></details><label className={styles.consent}><input name="terms" type="checkbox" required defaultChecked={intake.terms} /><span>I agree to the <a href="/booking/terms" target="_blank" rel="noreferrer">booking and cancellation terms</a> and have read the <a href="/booking/privacy" target="_blank" rel="noreferrer">privacy notice</a>.{!live && " These are preview terms only."}</span></label></div>
            {error && <p role="alert" className={styles.error}>{error}</p>}<button type="submit" className={styles.primaryButton} disabled={pending}>{pending ? "Checking your date…" : live ? `Continue to pay ${money(quote.dueNow)}` : "Preview confirmation"}<ArrowRight size={18} /></button><p className={styles.secureNote}><ShieldCheck size={15} />{live ? "Your payment is collected securely through Stripe. No card details touch this site." : "Preview only. No reservation, no payment. Just a look at what comes next."}</p>
          </form>)}
        </div><aside className={styles.summary} aria-label="Your booking summary"><p className={styles.eyebrow}>YOUR BOOKING</p><h3>{selected.name}</h3><div className={styles.summaryMeta}><span><Clock3 size={14} />{selected.minutes / 60}-hour shoot</span><span><MapPin size={14} />{selected.locationLabel || `${selected.locations} location${selected.locations === 1 ? "" : "s"}`}</span></div><div className={styles.summaryLines}>{quote.promotion ? <><div><span>Original price</span><del>{money(quote.originalPrice)}</del></div><div><span>Package deal</span><strong>{money(quote.packagePrice)}</strong></div><div className={styles.dealSaving}><span>You save</span><strong>{money(quote.savings)}</strong></div></> : <div><span>Package price</span><strong>{money(quote.packagePrice)}</strong></div>}<div className={styles.total}><span>Production total</span><strong>{money(quote.total)}</strong></div></div><div className={styles.deposit}><span>{paymentOption === "full" ? "DUE TODAY" : "DEPOSIT DUE TODAY"}</span><strong>{money(quote.dueNow)}</strong></div><div className={styles.balance}><span>Remaining balance</span><strong>{money(quote.balance)}</strong></div>{quote.promotion && <p className={styles.smallText}>{quote.promotion.label || "Package deal"}{quote.promotion.valueNote ? ` · ${quote.promotion.valueNote}` : ""}</p>}<div className={styles.summaryFoot}><ShieldCheck size={15} /><span>Final pricing and offer availability are checked again before payment.</span></div></aside></div>
      </>}
    </section>
  </main>;
}
