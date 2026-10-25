import AnalyzeWorkspace from "@/components/AnalyzeWorkspace";

export default function AnalyzePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Change analysis</h1>
        <p className="mt-1 text-sm text-muted">
          Upload satellite images of the same location from two dates and compare them.
        </p>
      </div>
      <AnalyzeWorkspace />
    </div>
  );
}
