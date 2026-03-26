"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import StatesTab from "@/components/locations/StatesTab";
import DistrictsTab from "@/components/locations/DistrictsTab";
import AreasTab from "@/components/locations/AreasTab";
import type { StateType, DistrictType } from "@/types";

export default function LocationsPage() {
  const [selectedState, setSelectedState] = useState<StateType | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictType | null>(null);

  const handleSelectState = (state: StateType | null) => {
    setSelectedState(state);
    setSelectedDistrict(null);
  };

  return (
    <ProtectedRoute>
      <section className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Location Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage States, Districts & Areas with pincodes
          </p>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mt-3 text-sm">
            <span
              onClick={() => {
                setSelectedState(null);
                setSelectedDistrict(null);
              }}
              className="text-blue-600 cursor-pointer hover:underline"
            >
              All States
            </span>
            {selectedState && (
              <>
                <span className="text-gray-400">/</span>
                <span
                  onClick={() => setSelectedDistrict(null)}
                  className="text-blue-600 cursor-pointer hover:underline"
                >
                  {selectedState.name}
                </span>
              </>
            )}
            {selectedDistrict && (
              <>
                <span className="text-gray-400">/</span>
                <span className="text-gray-700 font-medium">
                  {selectedDistrict.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: States */}
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <StatesTab
              onSelectState={handleSelectState}
              selectedStateId={selectedState?._id ?? null}
            />
          </div>

          {/* Column 2: Districts */}
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <DistrictsTab
              selectedState={selectedState}
              onSelectDistrict={setSelectedDistrict}
              selectedDistrictId={selectedDistrict?._id ?? null}
            />
          </div>

          {/* Column 3: Areas */}
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <AreasTab
              selectedDistrict={selectedDistrict}
              stateName={selectedState?.name ?? ""}
            />
          </div>
        </div>
      </section>
    </ProtectedRoute>
  );
}
