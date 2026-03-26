"use client";

import { useEffect, useState } from "react";
import { contactService } from "@/services/contactService";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import type { Contact } from "@/types";

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await contactService.getAll();
      setContacts(data);
    } catch (error) {
      console.error("Failed to load contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <a
            href="/contact"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + Add Contact
          </a>
        </div>

        {contacts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No contacts yet.</p>
            <p className="text-sm mt-2">
              Add your first contact to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {contacts.map((contact) => (
              <div
                key={contact._id}
                className="p-4 border rounded-lg hover:shadow-md transition-shadow flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold">{contact.name}</h3>
                  <p className="text-sm text-gray-500">{contact.email}</p>
                  {contact.phone && (
                    <p className="text-sm text-gray-400">{contact.phone}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50 transition-colors">
                    Edit
                  </button>
                  <button className="px-3 py-1 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </ProtectedRoute>
  );
}
