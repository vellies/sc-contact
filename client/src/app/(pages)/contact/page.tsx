"use client";

import ContactForm from "@/components/forms/ContactForm";

export default function ContactPage() {
  return (
    <section className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
      <ContactForm />
    </section>
  );
}
