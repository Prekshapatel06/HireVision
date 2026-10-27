import React from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Upload,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Profile } from "@/types/profile";

interface CertificationsSectionProps {
  profile: Profile;
  addListItem: (field: keyof Profile, defaultObj: any) => void;
  removeListItem: (field: keyof Profile, index: number) => void;
  updateListItem: (
    field: keyof Profile,
    index: number,
    key: string,
    value: any
  ) => void;
  handleSaveProfile: () => void;
  saving: boolean;
}

export default function CertificationsSection({
  profile,
  addListItem,
  removeListItem,
  updateListItem,
  handleSaveProfile,
  saving,
}: CertificationsSectionProps) {
  const handleCertificateUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file only.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateListItem(
          "certifications",
          index,
          "certificate_pdf",
          reader.result
        );
      }
    };

    reader.readAsDataURL(file);
  };

  const openCertificatePdf = (pdfData: string) => {
    if (!pdfData) return;
    try {
      if (pdfData.startsWith("http://") || pdfData.startsWith("https://")) {
        window.open(pdfData, "_blank");
        return;
      }
      const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, "");
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (err) {
      console.error("Error opening certificate PDF:", err);
      window.open(pdfData, "_blank");
    }
  };

  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6">
      {profile.certifications.map((cert, index) => {
        const certificatePdf = (
          cert as typeof cert & {
            certificate_pdf?: string;
          }
        ).certificate_pdf;

        return (
          <div
            key={index}
            className="p-5 bg-purple-50/40 rounded-[20px] border border-purple-100 relative space-y-4"
          >
            <button
              type="button"
              onClick={() => removeListItem("certifications", index)}
              className="absolute top-4 right-4 text-purple-500 hover:text-purple-700 cursor-pointer transition-colors"
              aria-label="Delete certification"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Certificate Name */}
              <div>
                <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                  Certificate Name
                </label>

                <input
                  type="text"
                  value={cert.certificate_name || ""}
                  onChange={(e) =>
                    updateListItem(
                      "certifications",
                      index,
                      "certificate_name",
                      e.target.value
                    )
                  }
                  className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                  placeholder="e.g. AWS Certified Developer"
                />
              </div>

              {/* Platform / Issuer */}
              <div>
                <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                  Platform / Issuer
                </label>

                <input
                  type="text"
                  value={cert.platform || ""}
                  onChange={(e) =>
                    updateListItem(
                      "certifications",
                      index,
                      "platform",
                      e.target.value
                    )
                  }
                  className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                  placeholder="e.g. Coursera"
                />
              </div>

              {/* Issue Date */}
              <div>
                <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                  Issue Date
                </label>

                <input
                  type="date"
                  value={cert.issue_date || ""}
                  onChange={(e) =>
                    updateListItem(
                      "certifications",
                      index,
                      "issue_date",
                      e.target.value
                    )
                  }
                  className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                />
              </div>

              {/* Credential Link */}
              <div>
                <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                  Credential Link
                </label>

                <input
                  type="url"
                  value={cert.credential_link || ""}
                  onChange={(e) =>
                    updateListItem(
                      "certifications",
                      index,
                      "credential_link",
                      e.target.value
                    )
                  }
                  className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                  placeholder="https://..."
                />
              </div>

              {/* Certificate PDF */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                  Certificate PDF
                </label>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    id={`certificate-pdf-${index}`}
                    onChange={(e) =>
                      handleCertificateUpload(e, index)
                    }
                    className="hidden"
                  />

                  <label
                    htmlFor={`certificate-pdf-${index}`}
                    className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-[10px] text-xs font-bold text-purple-600 cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Certificate PDF
                  </label>

                  {certificatePdf && (
                    <button
                      type="button"
                      onClick={() => openCertificatePdf(certificatePdf)}
                      className="px-4 py-2.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-[10px] text-xs font-bold text-violet-700 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <FileText className="h-4 w-4 text-violet-600" />
                      View Certificate PDF
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-[9px] text-slate-400 font-medium mt-1.5">
                  PDF files only. The certificate will be saved as a Base64
                  string.
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() =>
            addListItem("certifications", {
              certificate_name: "",
              platform: "",
              issue_date: "",
              credential_link: "",
              certificate_pdf: "",
            })
          }
          className="w-full py-3.5 bg-purple-50 hover:bg-purple-100 rounded-[12px] text-purple-600 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors border border-purple-100"
        >
          <Plus className="h-4 w-4" />
          Add Certification
        </button>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={saving}
          className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center gap-2 cursor-pointer shrink-0 shadow-lg shadow-purple-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Certifications
        </button>
      </div>
    </div>
  );
}