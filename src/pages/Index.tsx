import { StoryWizard } from "@/components/StoryWizard";
import { FileText } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                User Story Quality Assistant
              </h1>
              <p className="text-xs text-muted-foreground">
                Analysieren · Verbessern · Akzeptanzkriterien generieren
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <StoryWizard />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-auto">
        <div className="container mx-auto px-4">
          <p className="text-xs text-center text-muted-foreground">
            User Story Quality Assistant MVP · Human-in-the-loop Workflow
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
