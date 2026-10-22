import { useState } from "react";
import { ReflectFooter, ReflectNotSaved } from "./ReflectShell";
import { ReflectTextInput } from "./ReflectTextInput";
import type { ReflectContent, ReflectEntry, ReflectTextField } from "./types";

/**
 * The story step (spec §4.4, plate 4): the scene line, then the story under
 * the observer prompt. Both prompts are practice content, served by the API in
 * the practice locale (PD-7, §6.5); the bound and soft-line sentences are
 * interface strings. Saving shows nothing while it works (W6); only a failure
 * does. Nothing is offered while the person writes (AC-21). No Back (D-3, PD-6).
 *
 * The fields are controlled here; the text is sent by `onChange` -> autosave.
 */
export function StoryStep({
  entry,
  content,
  onChange,
  failed,
  onRetry,
  onNext,
  busy,
}: {
  entry: ReflectEntry;
  content: ReflectContent;
  onChange: (field: ReflectTextField, value: string) => void;
  failed: boolean;
  onRetry: () => void;
  onNext: () => void;
  busy: boolean;
}) {
  const [scene, setScene] = useState(entry.scene ?? "");
  const [story, setStory] = useState(entry.story ?? "");
  const { story: prompts } = content.prompts;
  const { limits } = content;

  return (
    <div className="space-y-6">
      <ReflectTextInput
        id="reflect-scene"
        label={prompts.scenePrompt}
        placeholder={prompts.scenePlaceholder}
        value={scene}
        max={limits.scene}
        onChange={(v) => {
          setScene(v);
          onChange("scene", v);
        }}
      />
      <ReflectTextInput
        id="reflect-story"
        label={prompts.storyPrompt}
        value={story}
        max={limits.story}
        softLine={limits.storySoftLine}
        multiline
        onChange={(v) => {
          setStory(v);
          onChange("story", v);
        }}
      />
      {failed && <ReflectNotSaved onRetry={onRetry} />}
      <ReflectFooter onNext={onNext} nextDisabled={failed || busy} />
    </div>
  );
}
