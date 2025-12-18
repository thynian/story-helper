import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Lightbulb } from "lucide-react";

interface StoryInputStepProps {
  initialStory: string;
  onSubmit: (story: string) => void;
}

const EXAMPLE_STORY = `Als Benutzer möchte ich mich einloggen können, damit ich auf mein Konto zugreifen kann.`;

export function StoryInputStep({ initialStory, onSubmit }: StoryInputStepProps) {
  const [story, setStory] = useState(initialStory);

  const handleSubmit = () => {
    if (story.trim()) {
      onSubmit(story.trim());
    }
  };

  const handleUseExample = () => {
    setStory(EXAMPLE_STORY);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">User Story eingeben</h2>
        <p className="text-sm text-muted-foreground">
          Geben Sie Ihre User Story ein, um sie analysieren und verbessern zu lassen.
        </p>
      </div>

      <div className="space-y-3">
        <Textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="Als [Rolle] möchte ich [Funktion], damit [Nutzen]..."
          className="min-h-[160px] text-base resize-none"
        />
        
        <button
          onClick={handleUseExample}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <Lightbulb className="h-4 w-4" />
          Beispiel verwenden
        </button>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit} 
          disabled={!story.trim()}
          size="lg"
        >
          Analysieren
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
